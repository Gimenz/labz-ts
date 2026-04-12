import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'db', 'labz.db'));

// Single row table, karena self-bot jadi ga perlu multi-user
db.exec(`
    CREATE TABLE IF NOT EXISTS afk (
        id      INTEGER PRIMARY KEY CHECK(id = 1),
        active  INTEGER NOT NULL DEFAULT 0,
        reason  TEXT    NOT NULL DEFAULT '',
        since   INTEGER NOT NULL DEFAULT 0
    )
`);

db.prepare(`
    INSERT OR IGNORE INTO afk (id, active, reason, since)
    VALUES (1, 0, '', 0)
`).run();

export interface AFKData {
    id: number;
    active: number;
    reason: string;
    since: number;
}

export function getAFK(): AFKData {
    return db.prepare('SELECT * FROM afk WHERE id = 1').get() as AFKData;
}

export function setAFK(reason: string | null): void {
    db.prepare(`
        UPDATE afk SET active = 1, reason = ?, since = ? WHERE id = 1
    `).run(reason ?? '', Date.now());
}

export function clearAFK(): void {
    db.prepare(`
        UPDATE afk SET active = 0, reason = '', since = 0 WHERE id = 1
    `).run();
}