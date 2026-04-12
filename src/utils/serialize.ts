import { MessageType, getContentType, getDevice, isJidGroup, normalizeMessageContent, proto, WAMessage, WASocket, downloadContentFromMessage, toBuffer, S_WHATSAPP_NET, isJidStatusBroadcast } from "baileys";
import WAClient from "../handlers/client";
import type { MessageSerialize } from "../types/message";
import fileType from 'file-type'
import fs from 'fs'
import { store } from "../handlers/store";
import { SQLiteStore } from '../store/sqlite-store';

const sqliteStore = new SQLiteStore();
const myLidMap = new Map<string, string>();

export const serializeMessage = async (client: WASocket, msg: WAMessage) => {
    if (!msg.message) return

    const normalizedMessage = normalizeMessageContent(msg.message)
    if (!normalizedMessage) return // Return if message could not be normalized

    const m = <MessageSerialize>{}
    m.message = normalizedMessage // Assign the guaranteed IMessage object
    // The previous lines attempting to delete senderKeyDistributionMessage/messageContextInfo
    // are redundant as normalizeMessageContent handles this cleanup, and were operating on an uninitialized m.message.
    let type = getContentType(m.message)
    const rawJid = msg.key.participantAlt || msg.key.remoteJidAlt || msg.key.participant || msg.key.remoteJid;

    const realPhoneNumber = sqliteStore.resolveSenderPhone(rawJid, msg);
    if (m.message) {
        m.key = msg.key
        m.id = m.key.id!
        m.isBot = (m.id.startsWith("BAE5") && m.id.length === 16) || (m.id.startsWith("3EB0") && m.key.id.length === 12)
        m.isGroup = isJidGroup(m.key.remoteJid)
        m.from = WAClient.decodeJid(m.isGroup || isJidStatusBroadcast(m.key.remoteJid) ? m.key.remoteJid : m.key.remoteJidAlt || m.key.participant || m.key.remoteJid)
        m.fromMe = m.key.fromMe
        m.type = Object.keys(m.message).find((type) => type !== "senderKeyDistributionMessage" && type !== "messageContextInfo") as MessageType
        m.sender = WAClient.decodeJid(m.fromMe ? client.user.id : m.isGroup || m.from === "status@broadcast" ? realPhoneNumber || msg.key.participantAlt : m.from)
        m.device = getDevice(m.id)
        m.key.participant = !m.key.participant || m.key.participant === "status_me" ? m.sender : m.key.participant
        m.text = m.message.conversation || m.message[m.type]?.text || m.message[m.type]?.caption || m.message[m.type]?.selectedButtonId || m.message[m.type]?.selectedRowId || m.message[m.type]?.comment || ''
        m.mentions = m.message[m.type]?.contextInfo?.mentionedJid || []
        m.viewOnce = !!msg.message?.viewOnceMessage || !!msg.message?.viewOnceMessageV2 || !!msg.message?.viewOnceMessageV2Extension
        // @ts-expect-error:
        m.reply = async (text: string, options = {}) => {
            return await client.sendMessage(
                m.from,
                { text, ...options, contextInfo: m.message[m.type]?.contextInfo || {} },
                { quoted: msg, ephemeralExpiration: m.expiration }
            )
        }
        // @ts-expect-error:
        m.react = async (emoji: string) => {
            return await client.sendMessage(
                m.from,
                { react: { text: emoji, key: msg.key } }
            )
        }
    }

    m.timestamps =
        (typeof msg.messageTimestamp === "number"
            ? msg.messageTimestamp
            : msg.messageTimestamp?.toNumber?.() || 0) * 1000 || Date.now()
    m.expiration = m.message[m.type]?.contextInfo?.expiration || 0
    m.pushname = msg.pushName || "anonymous"
    m.status = msg.status || 0

    m.quoted = <MessageSerialize>{}
    m.quoted.message = normalizeMessageContent(m.message[m.type]?.contextInfo?.quotedMessage ? m.message[m.type]?.contextInfo?.quotedMessage : null)
    if (m.quoted.message) {
        m.quoted.key = {
            participant: WAClient.decodeJid(m.message[m.type]?.contextInfo?.participant),
            remoteJid: m?.message[m.type]?.contextInfo?.remoteJid || m.from || m.sender,
            fromMe: WAClient.decodeJid(m.message[m.type].contextInfo.participant) === WAClient.decodeJid(client.user.id),
            id: m.message[m.type].contextInfo.stanzaId
        }
        m.quoted.id = m.quoted.key.id
        m.quoted.isBot = (m.quoted.id.startsWith("BAE5") && m.quoted.id.length === 16) || (m.id.startsWith("3EB0") && m.key.id.length === 12)
        m.quoted.isGroup = isJidGroup(m.quoted.key.remoteJid)
        m.quoted.from = WAClient.decodeJid(m.quoted.key.remoteJid)
        m.quoted.fromMe = m.quoted.key.fromMe
        m.quoted.type = Object.keys(m.quoted.message).find((type) => type !== "senderKeyDistributionMessage" && type !== "messageContextInfo") as MessageType
        m.quoted.sender = m.quoted.key.participant
        m.quoted.key.participant = !m.quoted.key.participant ? m.sender : m.quoted.key.participant
        m.quoted.text = m.quoted.message.conversation || m.quoted.message[m.type]?.text || m.quoted.message[m.type]?.caption || m.quoted.message[m.type]?.selectedButtonId || m.quoted.message[m.type]?.selectedRowId || m.quoted.message[m.type]?.comment || ''
        m.quoted.mentions = m.quoted.message[m.quoted.type]?.contextInfo?.mentionedJid || []
        m.quoted.viewOnce = !!m.message[m.type].contextInfo.quotedMessage?.viewOnceMessage || !!m.message[m.type].contextInfo.quotedMessage?.viewOnceMessageV2 || !!m.message[m.type].contextInfo.quotedMessage?.viewOnceMessageV2Extension
        // @ts-ignore:
        m.quoted.reply = async (text: string, options = {}) => {
            return await client.sendMessage(
                m.quoted.from,
                { text, ...options },
                { quoted: m.quoted, ...options, ephemeralExpiration: m.expiration }
            )
        }
    } else m.quoted = null

    // console.log('SERIALIZED =>', m);
    return m
}

/**
 * 
 * @param {proto.IMessage} message 
 * @returns 
 */
export const downloadMediaMessage = async (message: MessageSerialize, filename: string, attachExtension = true) => {
    let m = message.quoted !== null ? message : message.quoted
    const mediaType = {
        imageMessage: "image",
        videoMessage: "video",
        stickerMessage: "sticker",
        documentMessage: "document",
        audioMessage: "audio",
    };

    const stream = await downloadContentFromMessage(m.message[m.type], mediaType[m.type])
    const buffer = await toBuffer(stream)
    if (filename) {
        const extension = await fileType.fileTypeFromBuffer(buffer)
        const trueFileName = attachExtension ? (filename + '.' + extension.ext) : filename
        await fs.writeFileSync(trueFileName, buffer)
        return trueFileName
    }
    return buffer
}


export const resolveLidToPhone = (jid: string, store: any, lidMap: Map<string, string>): string => {
    // Layer 1: Phone JID (5511947763114@s.whatsapp.net)
    const phoneMatch = jid.match(/^(\d+)@/);
    if (phoneMatch) return phoneMatch[1] + S_WHATSAPP_NET;

    // Layer 2: store.contacts cache
    const contact: any = Object.values(store.contacts || {}).find((c: any) =>
        c.id === jid || c.jid === jid
    );
    if (contact?.phoneNumber) return contact.phoneNumber + S_WHATSAPP_NET;

    // Layer 3: lidToPhoneMap (load from auth dir)
    if (lidMap.has(jid)) return lidMap.get(jid) + S_WHATSAPP_NET;


    return jid; // Fallback
}