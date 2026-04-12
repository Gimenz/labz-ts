import { WAMessage } from 'baileys';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

export class SQLiteStore {
    private db: Database.Database;
    private writeQueue: any[] = [];
    private readonly BATCH_SIZE = 100;
    private readonly BATCH_TIMEOUT = 5000;
    private batchTimer: NodeJS.Timeout | null = null;
    private lidToPhoneMap: Map<string, string> = new Map();

    constructor(filename: string = 'baileys_store.db') {
        const dbDir = resolve('./db');
        if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

        this.db = new Database(resolve(dbDir, filename));
        this.db.pragma('journal_mode = WAL');
        this.initializeSchema();
        this.loadLidMappings();
    }

    private initializeSchema() {
        // Check if sender_phone column exists
        try {
            this.db.prepare('SELECT sender_phone FROM messages LIMIT 1').get();
        } catch (error) {
            // Column tidak ada, perlu migrate
            console.log('⚠️  Migrating database schema...');
            this.migrateSchema();
            return;
        }

        // Schema sudah updated, skip
        this.createTables();
    }

    private migrateSchema() {
        this.db.exec(`
        -- Backup old messages
        CREATE TABLE IF NOT EXISTS messages_backup AS SELECT * FROM messages;

        -- Drop old table
        DROP TABLE IF EXISTS messages;

        -- Create new messages table dengan sender_phone
        CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            jid TEXT NOT NULL,
            sender_jid TEXT,
            sender_phone TEXT,
            message_type TEXT,
            has_deleted_marker INTEGER DEFAULT 0,
            data JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Restore data (sender_phone akan NULL, nanti auto-resolve)
        INSERT INTO messages (id, jid, sender_jid, message_type, has_deleted_marker, data, created_at, updated_at)
        SELECT id, jid, sender_jid, message_type, has_deleted_marker, data, created_at, updated_at 
        FROM messages_backup;

        -- Drop backup
        DROP TABLE messages_backup;
    `);

        // Create new tables
        this.createTables();

        console.log('✅ Migration completed');
    }

    private createTables() {
        this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_jid ON messages(jid);
        CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_jid);
        CREATE INDEX IF NOT EXISTS idx_messages_sender_phone ON messages(sender_phone);
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
        CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(has_deleted_marker);
        CREATE INDEX IF NOT EXISTS idx_messages_broadcast ON messages(jid) WHERE jid = 'status@broadcast';

        CREATE TABLE IF NOT EXISTS chats (
            jid TEXT PRIMARY KEY,
            chat_type TEXT,
            name TEXT,
            data JSON NOT NULL,
            message_count INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(chat_type);
        CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

        CREATE TABLE IF NOT EXISTS contacts (
            jid TEXT PRIMARY KEY,
            phone TEXT,
            name TEXT,
            notify TEXT,
            data JSON NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
        CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);

        CREATE TABLE IF NOT EXISTS group_metadata (
            jid TEXT PRIMARY KEY,
            subject TEXT,
            participant_count INTEGER,
            data JSON NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_group_subject ON group_metadata(subject);

        CREATE TABLE IF NOT EXISTS messages_archive (
            id TEXT PRIMARY KEY,
            jid TEXT NOT NULL,
            sender_phone TEXT,
            data JSON NOT NULL,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_archive_jid ON messages_archive(jid);

        CREATE TABLE IF NOT EXISTS lid_phone_map (
            lid TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_lid_phone ON lid_phone_map(phone);
    `);
    }

    // ============ LID MAPPING FUNCTIONS ============

    private loadLidMappings() {
        const stmt = this.db.prepare('SELECT lid, phone FROM lid_phone_map');
        const rows = stmt.all() as any[];
        rows.forEach(r => this.lidToPhoneMap.set(r.lid, r.phone));
        console.log(`✅ Loaded ${rows.length} LID mappings`);
    }

    /**
     * Register atau update LID to Phone mapping
     */
    registerLidMapping(lid: string, phone: string) {
        const stmt = this.db.prepare(`
            INSERT INTO lid_phone_map (lid, phone, created_at, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(lid) DO UPDATE SET phone = excluded.phone, updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(lid, phone);
        this.lidToPhoneMap.set(lid, phone);
    }

    /**
     * Resolve LID atau rawJid ke phone number
     * Handles: LID format, phone@s.whatsapp.net, dan fallback
     */
    resolveSenderPhone(rawJid: string, contactData?: any): string {
        // Layer 1: Jika sudah phone format (XXXXXX@s.whatsapp.net)
        const phoneMatch = rawJid.match(/^(\d+)@/);
        if (phoneMatch) return phoneMatch[1];

        // Layer 2: Cek di LID map
        if (this.lidToPhoneMap.has(rawJid)) {
            return this.lidToPhoneMap.get(rawJid)!;
        }

        // Layer 3: Cek di contact data JSON
        if (contactData) {
            const contact = typeof contactData === 'string' ? JSON.parse(contactData) : contactData;
            if (contact.phoneNumber) {
                this.registerLidMapping(rawJid, contact.phoneNumber);
                return contact.phoneNumber;
            }
        }

        // Layer 4: Cek di database contacts
        const stmt = this.db.prepare('SELECT phone FROM contacts WHERE jid = ? OR phone LIKE ?');
        const result = stmt.get(rawJid, `%${rawJid}%`) as any;
        if (result?.phone) {
            this.registerLidMapping(rawJid, result.phone);
            return result.phone;
        }

        // Fallback: return as-is (akan di-resolve nanti)
        return rawJid;
    }

    // ============ MESSAGE FUNCTIONS ============

    private extractMessageType(message: any): string {
        if (!message) return 'unknown';
        const types = [
            'conversation',
            'imageMessage',
            'videoMessage',
            'audioMessage',
            'documentMessage',
            'stickerMessage',
            'templateMessage',
            'extendedTextMessage',
            'protocolMessage'
        ];
        return types.find(t => t in message) || 'other';
    }

    /**
     * Save message dengan proper LID resolution
     */
    saveMessage(
        id: string,
        jid: string,
        messageData: any,
        senderJid?: string,
        senderPhone?: string
    ) {
        // Resolve phone jika belum ada
        const resolvedPhone = senderPhone || this.resolveSenderPhone(senderJid || jid, messageData);
        const messageType = this.extractMessageType(messageData.message);
        const hasDeletedMarker = messageData.message?.protocolMessage ? 1 : 0;

        const stmt = this.db.prepare(`
            INSERT INTO messages (id, jid, sender_jid, sender_phone, message_type, has_deleted_marker, data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, sender_phone = excluded.sender_phone, updated_at = CURRENT_TIMESTAMP
        `);

        stmt.run(id, jid, senderJid || jid, resolvedPhone, messageType, hasDeletedMarker, JSON.stringify(messageData));
    }

    saveMessageBatch(messages: Array<{
        id: string,
        jid: string,
        data: any,
        senderJid?: string,
        senderPhone?: string
    }>) {
        this.writeQueue.push(...messages);

        if (this.writeQueue.length >= this.BATCH_SIZE) {
            this.flushBatch();
        } else if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => this.flushBatch(), this.BATCH_TIMEOUT);
        }
    }

    private flushBatch() {
        if (this.writeQueue.length === 0) return;

        const insert = this.db.transaction((msgs: any[]) => {
            const stmt = this.db.prepare(`
                INSERT INTO messages (id, jid, sender_jid, sender_phone, message_type, has_deleted_marker, data, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET data = excluded.data, sender_phone = excluded.sender_phone, updated_at = CURRENT_TIMESTAMP
            `);

            for (const msg of msgs) {
                const messageData = msg.data;
                const resolvedPhone = msg.senderPhone || this.resolveSenderPhone(msg.senderJid || msg.jid, messageData);
                const messageType = this.extractMessageType(messageData.message);
                const hasDeletedMarker = messageData.message?.protocolMessage ? 1 : 0;

                stmt.run(
                    msg.id,
                    msg.jid,
                    msg.senderJid || msg.jid,
                    resolvedPhone,
                    messageType,
                    hasDeletedMarker,
                    JSON.stringify(messageData)
                );
            }
        });

        try {
            insert(this.writeQueue);
        } catch (error) {
            console.error('Error flushing batch:', error);
        }

        this.writeQueue = [];

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    }

    // ============ CONTACT FUNCTIONS ============

    saveContact(jid: string, contactData: any) {
        const phone = this.resolveSenderPhone(jid, contactData);

        // Register mapping kalau ada
        if (phone && !phone.includes('@')) {
            this.registerLidMapping(jid, phone);
        }

        const stmt = this.db.prepare(`
            INSERT INTO contacts (jid, phone, name, notify, data, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(jid) DO UPDATE SET phone = excluded.phone, name = excluded.name, notify = excluded.notify, data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(jid, phone, contactData.name || '', contactData.notify || '', JSON.stringify(contactData));
    }

    // ============ CHAT FUNCTIONS ============

    saveChat(jid: string, chatType: string, chatData: any) {
        const stmt = this.db.prepare(`
            INSERT INTO chats (jid, chat_type, name, data, message_count, updated_at) 
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(jid) DO UPDATE SET chat_type = excluded.chat_type, name = excluded.name, data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(jid, chatType, chatData.name || '', JSON.stringify(chatData));
    }

    // ============ GROUP FUNCTIONS ============

    saveGroupMetadata(jid: string, subject: string, participantCount: number, groupData: any) {
        const stmt = this.db.prepare(`
            INSERT INTO group_metadata (jid, subject, participant_count, data, updated_at) 
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(jid) DO UPDATE SET subject = excluded.subject, participant_count = excluded.participant_count, data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(jid, subject, participantCount, JSON.stringify(groupData));
    }

    // ============ QUERY FUNCTIONS ============

    getStories(limit: number = 50, offset: number = 0) {
        const stmt = this.db.prepare(`
            SELECT id, data, created_at, sender_phone
            FROM messages 
            WHERE jid = 'status@broadcast'
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);

        const rows = stmt.all(limit, offset) as any[];
        return rows.map(r => ({
            id: r.id,
            timestamp: r.created_at,
            senderPhone: r.sender_phone,
            ...JSON.parse(r.data)
        }));
    }

    getStoriesByUser(userPhone: string, limit: number = 20) {
        const stmt = this.db.prepare(`
            SELECT id, data, created_at, sender_phone
            FROM messages 
            WHERE jid = 'status@broadcast' 
            AND sender_phone = ?
            ORDER BY created_at DESC 
            LIMIT ?
        `);

        const rows = stmt.all(userPhone, limit) as any[];
        return rows.map(r => ({
            id: r.id,
            timestamp: r.created_at,
            senderPhone: r.sender_phone,
            ...JSON.parse(r.data)
        }));
    }

    getDeletedMessages(jid?: string, limit: number = 100) {
        let query = `
            SELECT id, jid, data, created_at, sender_phone
            FROM messages 
            WHERE has_deleted_marker = 1
        `;
        const params: any[] = [];

        if (jid) {
            query += ` AND jid = ?`;
            params.push(jid);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as any[];

        return rows.map(r => {
            const msg: WAMessage = JSON.parse(r.data);
            return {
                id: r.id,
                chat: r.jid,
                senderPhone: r.sender_phone,
                deletedMessageId: msg.message?.protocolMessage?.key?.id,
                deletedAt: msg.message?.protocolMessage?.timestampMs || Date.now(),
                timestamp: r.created_at,
                ...msg
            };
        });
    }

    getMessagesByChat(jid: string, limit: number = 50, offset: number = 0) {
        const stmt = this.db.prepare(`
            SELECT id, data, created_at, sender_jid, sender_phone
            FROM messages 
            WHERE jid = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);

        const rows = stmt.all(jid, limit, offset) as any[];
        return rows.map(r => ({
            id: r.id,
            timestamp: r.created_at,
            sender: r.sender_jid,
            senderPhone: r.sender_phone,
            ...JSON.parse(r.data)
        }));
    }

    getMessagesByPhone(phone: string, limit: number = 50, offset: number = 0) {
        const stmt = this.db.prepare(`
            SELECT id, jid, data, created_at, sender_jid, sender_phone
            FROM messages 
            WHERE sender_phone = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);

        const rows = stmt.all(phone, limit, offset) as any[];
        return rows.map(r => ({
            id: r.id,
            chat: r.jid,
            timestamp: r.created_at,
            sender: r.sender_jid,
            senderPhone: r.sender_phone,
            ...JSON.parse(r.data)
        }));
    }

    getAllContacts() {
        const stmt = this.db.prepare(`
            SELECT jid, phone, name, notify, data 
            FROM contacts 
            ORDER BY name ASC
        `);

        const rows = stmt.all() as any[];
        return rows.map(r => ({
            jid: r.jid,
            phone: r.phone,
            name: r.name,
            notify: r.notify,
            ...JSON.parse(r.data)
        }));
    }

    getAllChats() {
        const stmt = this.db.prepare(`
            SELECT jid, chat_type, name, message_count, data 
            FROM chats 
            ORDER BY updated_at DESC
        `);

        const rows = stmt.all() as any[];
        return rows.map(r => ({
            jid: r.jid,
            type: r.chat_type,
            name: r.name,
            messageCount: r.message_count,
            ...JSON.parse(r.data)
        }));
    }

    getAllGroups() {
        const stmt = this.db.prepare(`
            SELECT jid, subject, participant_count, data 
            FROM group_metadata 
            ORDER BY subject ASC
        `);

        const rows = stmt.all() as any[];
        return rows.map(r => ({
            jid: r.jid,
            subject: r.subject,
            participantCount: r.participant_count,
            ...JSON.parse(r.data)
        }));
    }

    searchMessagesInChat(jid: string, searchText: string, limit: number = 50) {
        const stmt = this.db.prepare(`
            SELECT id, data, created_at, sender_phone
            FROM messages 
            WHERE jid = ? 
            AND (
                json_extract(data, "$.message.conversation") LIKE ?
                OR json_extract(data, "$.message.extendedTextMessage.text") LIKE ?
            )
            ORDER BY created_at DESC 
            LIMIT ?
        `);

        const pattern = `%${searchText}%`;
        const rows = stmt.all(jid, pattern, pattern, limit) as any[];
        return rows.map(r => ({
            id: r.id,
            timestamp: r.created_at,
            senderPhone: r.sender_phone,
            ...JSON.parse(r.data)
        }));
    }

    getChatAnalytics(jid: string) {
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as totalMessages,
                COUNT(DISTINCT sender_phone) as uniqueSenders,
                COUNT(CASE WHEN message_type = 'imageMessage' THEN 1 END) as imageCount,
                COUNT(CASE WHEN message_type = 'videoMessage' THEN 1 END) as videoCount,
                COUNT(CASE WHEN message_type = 'audioMessage' THEN 1 END) as audioCount,
                COUNT(CASE WHEN message_type = 'documentMessage' THEN 1 END) as documentCount,
                MIN(created_at) as firstMessageTime,
                MAX(created_at) as lastMessageTime
            FROM messages 
            WHERE jid = ?
        `);

        return stmt.get(jid) as any;
    }

    getStorageStats() {
        const messages = (this.db.prepare('SELECT COUNT(*) as c FROM messages').get() as any).c;
        const chats = (this.db.prepare('SELECT COUNT(*) as c FROM chats').get() as any).c;
        const contacts = (this.db.prepare('SELECT COUNT(*) as c FROM contacts').get() as any).c;
        const groups = (this.db.prepare('SELECT COUNT(*) as c FROM group_metadata').get() as any).c;
        const lidMappings = (this.db.prepare('SELECT COUNT(*) as c FROM lid_phone_map').get() as any).c;

        const topChats = this.db.prepare(`
            SELECT jid, COUNT(*) as count 
            FROM messages 
            GROUP BY jid 
            ORDER BY count DESC 
            LIMIT 10
        `).all() as any[];

        return {
            messages,
            chats,
            contacts,
            groups,
            lidMappings,
            topChats,
            dbSize: this.getDBFileSize()
        };
    }

    private getDBFileSize() {
        const fs = require('fs');
        try {
            const stats = fs.statSync('./db/baileys_store.db');
            return `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
        } catch (e) {
            return 'Unknown';
        }
    }

    archiveOldMessages(daysOld: number = 90) {
        const archiveStmt = this.db.prepare(`
            INSERT INTO messages_archive (id, jid, sender_phone, data)
            SELECT id, jid, sender_phone, data FROM messages 
            WHERE datetime(created_at) < datetime('now', '-' || ? || ' days')
        `);

        const deleteStmt = this.db.prepare(`
            DELETE FROM messages 
            WHERE datetime(created_at) < datetime('now', '-' || ? || ' days')
        `);

        const archive = this.db.transaction(() => {
            archiveStmt.run(daysOld);
            deleteStmt.run(daysOld);
        });

        try {
            archive();
            this.db.exec('VACUUM; ANALYZE;');
        } catch (error) {
            console.error('Error archiving messages:', error);
        }
    }

    getLidMappings(): Map<string, string> {
        return this.lidToPhoneMap;
    }

    vacuum() {
        this.db.exec('VACUUM; ANALYZE;');
    }

    close() {
        this.flushBatch();
        this.db.close();
    }
}