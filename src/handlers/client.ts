import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal"
import NodeCache from "@cacheable/node-cache";
import makeWASocket, {
    CacheStore,
    DisconnectReason,
    Browsers,
    useMultiFileAuthState,
    jidDecode,
    makeCacheableSignalKeyStore,
    MessageGenerationOptionsFromContent,
    generateForwardMessageContent,
    proto,
    generateWAMessageFromContent,
    WASocket,
    getContentType,
    normalizeMessageContent,
    areJidsSameUser,
    fetchLatestBaileysVersion
} from "baileys";
import moment from 'moment-timezone';
import fs from 'fs';
import { bgColor, cHex, colorize, packages } from "../utils";
import { loadCommands, MessageHandler } from "./message";
import MAIN_LOGGER from "../utils/logger";
import { commands } from "../lib";
import { MessageSerialize } from "../types";
import P, { pino } from 'pino'
import { store } from "./store";
import { SQLiteStore } from '../store/sqlite-store';

const sqliteStore = new SQLiteStore('baileys_store.db');

const START_TIME = Date.now();
moment.tz.setDefault('Asia/Jakarta')
const logger = pino({ level: "silent" })

const msgRetryCounterCache = new NodeCache() as CacheStore

class WAClient {
    constructor() { }

    static decodeJid(jid: string): string {
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid)
            return (decode.user && decode.server && decode.user + "@" + decode.server) || jid
        } else return jid
    }

    static cMod(client: WASocket, jid: string, copy: proto.WebMessageInfo | MessageSerialize, text = '', sender = client.user.id, options: any = {}) {
        copy.message = normalizeMessageContent(copy.message)
        const contentType = Object.keys(copy.message).find((x) => x !== "senderKeyDistributionMessage" && x !== "messageContextInfo" && x !== "inviteLinkGroupTypeV2")
        let msg = copy.message
        let content = msg[contentType]
        if (!content) {
            console.log("cMod: No editable content found:", copy.message);
            return copy; // atau return apa pun yang aman
        }
        if (typeof content === 'string') {
            msg[contentType] = text || content;
        } else if (content?.caption) {
            content.caption = text || content.caption || 'failed to parse message';
        } else if (content?.text) {
            content.text = text || content.text;
        }

        if (typeof content !== 'string') msg[contentType] = {
            ...content,
            ...options
        }
        if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
        else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
        copy.key.remoteJid = jid
        copy.key.fromMe = areJidsSameUser(sender, client.user.id)
        if (options.mentions) {
            copy.message[contentType].contextInfo.mentionedJid = options.mentions
        }

        return proto.WebMessageInfo.fromObject(copy)
    }

    static async resendMessage(client: WASocket, toJid: string, message: Partial<MessageSerialize>, opts?: Omit<MessageGenerationOptionsFromContent, "userJid">) {
        message.message =
            message.message?.viewOnceMessage
                ? message.message.viewOnceMessage?.message : message.message?.viewOnceMessageV2
                    ? message.message.viewOnceMessageV2?.message : message.message?.viewOnceMessageV2Extension
                        ? message.message.viewOnceMessageV2Extension?.message : message.message
        if (message.message[message.type]?.viewOnce) delete message.message[message.type].viewOnce
        if (message.message?.ptvMessage) {
            message.message = {
                videoMessage: {
                    ...message.message.ptvMessage,
                    ptvMessage: undefined // hapus flag ptv
                }
            }
        }
        const content = generateForwardMessageContent(proto.WebMessageInfo.fromObject(message), true)

        if (content.listMessage) content.listMessage.listType = 1
        const contentType = Object.keys(content).find((x) => x !== "senderKeyDistributionMessage" && x !== "messageContextInfo" && x !== "inviteLinkGroupTypeV2")

        if (!contentType || !content[contentType]) {
            console.log("resendMessage: Cannot resend message: no valid content", content);
            return null; // atau return message apa pun yang aman
        }

        content[contentType].contextInfo = {
            ...(message.message[message.type]?.contextInfo ? message.message[message.type].contextInfo : {}),
            ...content[contentType].contextInfo
        }

        const waMessage = generateWAMessageFromContent(toJid, content, {
            userJid: WAClient.decodeJid(client.user.id),
            ...opts
        })

        if (waMessage?.message?.buttonsMessage?.contentText) waMessage.message.buttonsMessage.headerType = proto.Message.ButtonsMessage.HeaderType.EMPTY
        if (waMessage?.message?.buttonsMessage?.imageMessage) waMessage.message.buttonsMessage.headerType = proto.Message.ButtonsMessage.HeaderType.IMAGE
        if (waMessage?.message?.buttonsMessage?.videoMessage) waMessage.message.buttonsMessage.headerType = proto.Message.ButtonsMessage.HeaderType.VIDEO
        if (waMessage?.message?.buttonsMessage?.documentMessage) waMessage.message.buttonsMessage.headerType = proto.Message.ButtonsMessage.HeaderType.DOCUMENT
        if (waMessage?.message?.buttonsMessage?.locationMessage) waMessage.message.buttonsMessage.headerType = proto.Message.ButtonsMessage.HeaderType.LOCATION

        process.nextTick(() => client.upsertMessage(waMessage, "append"))
        await client.relayMessage(toJid, waMessage.message, {
            ...opts,
            messageId: waMessage.key.id,
        })
        return waMessage
    }

    public start = async () => {
        await loadCommands()

        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const { version, isLatest } = await fetchLatestBaileysVersion();

        const getMessageFromStore = async (key: any) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return undefined;
        };
        const client = makeWASocket({
            // @ts-ignore
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            version,
            msgRetryCounterCache,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            retryRequestDelayMs: 10,
            transactionOpts: {
                maxCommitRetries: 5,
                delayBetweenTriesMs: 10
            },
            maxMsgRetryCount: 10,
            appStateMacVerification: {
                patch: true,
                snapshot: true
            },
            getMessage: async (key) => await getMessageFromStore(key)
        })

        const LAUNCH_TIME_MS = Date.now() - START_TIME;

        store?.bind(client.ev)

        const time = moment().format('DD/MM/YY HH:mm:ss')

        client.ev.on('messages.delete', async (msg) => {
            console.log(msg);

        })

        client.ev.on('messages.upsert', async msg => {
            // sqliteStore.saveMessageBatch(
            //     msg.messages.map(m => ({
            //         id: m.key.id!,
            //         jid: m.key.remoteJid!,
            //         data: m,
            //         senderJid: m.key.participant || m.key.remoteJid,
            //         timestamp: m.messageTimestamp
            //     }))
            // );
            MessageHandler(client, msg)
        })

        client.ev.on('chats.upsert', async (chats) => {
            // for (const chat of chats) {
            //     const chatType = chat.name ? 'group' : 'individual';
            //     sqliteStore.saveChat(chat.pnJid! || chat.id, chatType, chat);
            // }
            console.log('got chats', store.chats.all())
        });

        client.ev.on('contacts.upsert', (contacts) => {

            console.log('got contacts', Object.values(store.contacts))
            // for (const contact of contacts) {
            //     sqliteStore.saveContact(contact.id, contact);
            // }
        })

        client.ev.on('groups.update', async (updates) => {
            // for (const update of updates) {
            //     if (update.subject || update.participants) {
            //         sqliteStore.saveGroupMetadata(
            //             update.id,
            //             update.subject || '',
            //             update.participants?.length || 0,
            //             update
            //         );
            //     }
            // }
        });

        client.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            // console.log(connection,lastDisconnect);

            if (qr) {
                qrcode.generate(qr, { small: true }, (qrcodeString) => {
                    console.log(`\n${String(qrcodeString)}`);
                });
            }
            if (connection == 'connecting') {
                console.log(colorize('[ auth ]', cHex.sys), colorize(time, cHex.timestamp), colorize(`${packages.name} is Authenticating...`, '#f12711'));
            } else if (connection == 'close') {
                const { badSession, multideviceMismatch, loggedOut, } = DisconnectReason
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
                if (statusCode == badSession || statusCode == multideviceMismatch || statusCode == loggedOut) {
                    console.log(colorize('[ error ]', cHex.err), colorize(time, cHex.timestamp), colorize(`Connection error`, '#f12711'), lastDisconnect?.error?.message);
                    console.log('session deleted, pls scan again')
                    fs.unlinkSync('./session')
                    setTimeout(() => this.start().catch(() => this.start()), 1500)
                } else {
                    console.log(lastDisconnect);

                    console.log(colorize('[ warn ]', cHex.warn), colorize(time, cHex.timestamp), colorize(`Reconnectong...`, '#f12711'), lastDisconnect?.error?.message);
                    setTimeout(() => this.start().catch(() => this.start()), 1500)
                }
            } else if (connection == 'open') {
                console.log(
                    colorize('[ info ]', cHex.sys),
                    colorize(moment().format('DD/MM/YY HH:mm:ss'), cHex.timestamp),
                    colorize(`${packages.name} is now Connected via ${bgColor(colorize(state.creds.platform, 'black'), cHex.success)}`, cHex.success)
                )
                // const dbInfo = sqliteStore.getStorageStats()
                console.log(`[ 🚀 ] loaded ${colorize(commands.size, cHex.sys)} cmd, ${colorize(store.chats.length, cHex.sys)} chts, ${colorize(store.contacts.length, cHex.sys)} contacts`);
                console.log(`[ ⏱️ ] ${colorize(LAUNCH_TIME_MS / 1000, cHex.sys)}s`)
            }

        })

        // listen for when the auth credentials is updated
        client.ev.on('creds.update', saveCreds)

        return client
    }
}

export default WAClient