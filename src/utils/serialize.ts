import { MessageType, getContentType, getDevice, isJidGroup, normalizeMessageContent, proto, WAMessage, WASocket } from "@whiskeysockets/baileys";
import WAClient from "../handlers/client";
import type { MessageSerialize } from "../types/message";

export const serializeMessage = async (client: WASocket, msg: WAMessage) => {
    const m = <MessageSerialize>{}
    let type = getContentType(m.message)
    if (type == "senderKeyDistributionMessage" || type == "messageContextInfo") {
        delete m.message.senderKeyDistributionMessage
        delete m.message.messageContextInfo
    }
    m.message = normalizeMessageContent(msg.message)
    if (m.message) {
        m.key = msg.key
        m.id = m.key.id!
        m.isBot = (m.id.startsWith("BAE5") && m.id.length === 16) || (m.id.startsWith("3EB0") && m.key.id.length === 12)
        m.isGroup = isJidGroup(m.key.remoteJid)!
        m.from = WAClient.decodeJid(m.key.remoteJid)
        m.fromMe = m.key.fromMe
        m.type = Object.keys(m.message).find((type) => type !== "senderKeyDistributionMessage" && type !== "messageContextInfo") as MessageType
        m.sender = WAClient.decodeJid(m.fromMe ? client.user.id : m.isGroup || m.from === "status@broadcast" ? m.key.participant || msg.participant : m.from)
        m.device = getDevice(m.id)
        m.key.participant = !m.key.participant || m.key.participant === "status_me" ? m.sender : m.key.participant
        m.text = m.message.conversation || m.message[m.type]?.text || m.message[m.type]?.caption || m.message[m.type]?.selectedButtonId || m.message[m.type]?.selectedRowId || m.message[m.type]?.comment || ''
        m.mentions = m.message[m.type]?.contextInfo?.mentionedJid || []
        m.viewOnce = !!msg.message?.viewOnceMessage || !!msg.message?.viewOnceMessageV2 || !!msg.message?.viewOnceMessageV2Extension
        m.reply = async (text: string, options = {}) => {
            return await client.sendMessage(
                m.from,
                { text, ...options, contextInfo: m.message[m.type]?.contextInfo || {} },
                { quoted: msg, ephemeralExpiration: m.expiration }
            )
        }
    }

    m.timestamps = (typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : msg.messageTimestamp.low ? msg.messageTimestamp.low : msg.messageTimestamp.high) * 1000 || Date.now()
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
        m.quoted.reply = async (text: string, options = {}) => {
            return await client.sendMessage(
                m.quoted.from,
                { text, ...options },
                { quoted: m.quoted, ...options, ephemeralExpiration: m.expiration }
            )
        }
    } else m.quoted = null

    return m
}