import { Boom } from "@hapi/boom";
import NodeCache from 'node-cache'
import makeWASocket, {
    makeInMemoryStore,
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
    areJidsSameUser
} from "@whiskeysockets/baileys";
import moment from 'moment-timezone';
import fs from 'fs';
import { colorize, packages } from "../utils";
import { loadCommands, MessageHandler } from "./message";
import MAIN_LOGGER from "../utils/logger";
import { commands } from "../lib";
import { MessageSerialize } from "../types";
import P from 'pino'

const START_TIME = Date.now();

moment.tz.setDefault('Asia/Jakarta')
const logger = MAIN_LOGGER.child({})
logger.level = 'error'

const store = makeInMemoryStore({})
store.readFromFile('./db/baileys_store.json')
setInterval(() => {
    store.writeToFile('./db/baileys_store.json')
}, 10_000)
const msgRetryCounterCache = new NodeCache()

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
        console.log(contentType, content);
        if (typeof content === 'string') msg[contentType] = text || content
        else if (text || content.caption) content.caption = text || content.caption
        else if (content.text) content.text = text || content.text
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

    static store = store

    static async resendMessage(client: WASocket, toJid: string, message: Partial<MessageSerialize>, opts?: Omit<MessageGenerationOptionsFromContent, "userJid">) {
        message.message = message.message?.viewOnceMessage ? message.message.viewOnceMessage?.message : message.message?.viewOnceMessageV2 ? message.message.viewOnceMessage?.message : message.message?.viewOnceMessageV2Extension ? message.message.viewOnceMessageV2Extension?.message : message.message
        if (message.message[message.type]?.viewOnce) delete message.message[message.type].viewOnce
        const content = generateForwardMessageContent(proto.WebMessageInfo.fromObject(message), true)

        if (content.listMessage) content.listMessage.listType = 1
        const contentType = Object.keys(content).find((x) => x !== "senderKeyDistributionMessage" && x !== "messageContextInfo" && x !== "inviteLinkGroupTypeV2")

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
        const { state, saveCreds } = await useMultiFileAuthState('./session')
        const client = makeWASocket({
            logger,
            printQRInTerminal: true,
            auth: {
                creds: state.creds,
                /** caching makes the store faster to send/recv messages */
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            patchMessageBeforeSending: (message) => {
                if (message.buttonsMessage || message.templateMessage || message.listMessage) {
                    message = {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {}
                                },
                                ...message
                            }
                        }
                    }
                }
                return message
            },
            msgRetryCounterCache,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: false,
        })

        const LAUNCH_TIME_MS = Date.now() - START_TIME;

        store?.bind(client.ev)

        const time = moment().format('DD/MM/YY HH:mm:ss')

        client.ev.on('messages.upsert', async msg => {
            MessageHandler(client, msg)
        })

        client.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
            if (connection == 'connecting') {
                console.log(colorize('[SYS]', '#009FFF'), colorize(time, '#A1FFCE'), colorize(`${packages.name} is Authenticating...`, '#f12711'));
            } else if (connection == 'close') {
                const { badSession, multideviceMismatch, loggedOut } = DisconnectReason
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
                if (statusCode == badSession || statusCode == multideviceMismatch || statusCode == loggedOut) {
                    console.log(colorize('[ERROR]', '#009FFF'), colorize(time, '#A1FFCE'), colorize(`Connection error`, '#f12711'), lastDisconnect?.error?.message);
                    console.log('session deleted, pls scan again')
                    fs.unlinkSync('./session')
                    setTimeout(() => this.start().catch(() => this.start()), 1500)
                } else {
                    console.log(colorize('[WARN]', '#efe638'), colorize(time, '#A1FFCE'), colorize(`Reconnectong...`, '#f12711'), lastDisconnect?.error?.message);
                    setTimeout(() => this.start().catch(() => this.start()), 1500)
                }
            } else if (connection == 'open') {
                console.log(
                    colorize('[INFO]', '#A1FFCE'),
                    colorize(moment().format('DD/MM/YY HH:mm:ss'), '#A1FFCE'),
                    colorize(`${packages.name} is now Connected with ${state.creds.platform} client`, '#f64f59')
                )
                console.log(`loaded with ${commands.size} commands, ${store.chats.length} chats, ${Object.keys(store.contacts).length} contacts`);
                console.log(`in ${LAUNCH_TIME_MS / 1000}s`)
            }

        })

        // listen for when the auth credentials is updated
        client.ev.on('creds.update', saveCreds)

        return client
    }
}

export default WAClient