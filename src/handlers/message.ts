import { getContentType, isJidBroadcast, isJidStatusBroadcast, MessageUpsertType, proto, S_WHATSAPP_NET, WAMessage, WASocket } from 'baileys';
import fs, { lstatSync, readdirSync } from 'fs';
import axios from 'axios';
import moment from 'moment-timezone';
import { basename, join, sep } from 'path';
import { packages, bgColor, colorize, serializeMessage, cutStr, config, cHex } from '../utils';
import { commands, events } from '../lib';
import { ICommand, IEvent } from '../types';
import { getAFK, AFKData } from '../lib/database/afk';
import WAClient from './client';
moment.tz.setDefault('Asia/Jakarta')

const afkSpamGuard = new Map<string, number>();

export const MessageHandler = async (
    client: WASocket,
    message: {
        messages: WAMessage[];
        type: MessageUpsertType;
    }
) => {
    if (!message.messages) return
    for (const msg of message.messages) {
        if (!msg.message) continue
        const m = await serializeMessage(client, msg)

        const isGroupMsg = m.isGroup
        const groupMetadata = isGroupMsg && await client.groupMetadata(m.from)
        const formattedTitle = isGroupMsg && groupMetadata.subject || 'other'
        const pushname = m.pushname
        const body = m.text
        const arg = body.substring(body.indexOf(' ') + 1)
        const args = body.trim().split(/ +/).slice(1);
        const flags = [];
        const t = m.timestamps
        const isCmd = m.text.startsWith(config.prefix);
        const commandName = isCmd ? m.text.slice(1).trim().split(/ +/).shift()!.toLowerCase() : null
        const getTime = moment(t).format('DD/MM/YY HH:mm:ss')

        // detect stories and send to jid where to save the stories
        if (isJidStatusBroadcast(m.from) && m.type !== 'protocolMessage' && config.downloadStory) {
            const pushname = m.pushname || 'saya'
            const storySend = config.storySend

            const caption = `*Story Stealer :*\n• Name : ${pushname}\n• From : wa.me/${m.sender.split('@')[0]}\n• Time : ${getTime}\n• Caption : ${m.text}`
            const modified = WAClient.cMod(client, storySend, m, caption, client.user.id)
            await WAClient.resendMessage(client, storySend, await serializeMessage(client, modified))

            if (m.type == 'audioMessage' || m.type == 'extendedTextMessage') {
                await client.sendMessage(storySend, { text: caption })
            }
        }

        const afkData: AFKData = getAFK();
        const isIncoming = !m.fromMe;
        if (afkData.active && !isJidStatusBroadcast(m.from) && isIncoming && !isCmd && !isGroupMsg) {
            const chatId = m.from; // jid pengirim

            // Cek apakah chat ini masih dalam periode anti-spam
            const spamExpiry = afkSpamGuard.get(chatId);
            const isSpamming = spamExpiry !== undefined && Date.now() < spamExpiry;

            if (!isSpamming) {
                const tanda = '```'
                var duration = moment.duration(moment().diff(moment(afkData.since)));
                const times = `${tanda}${duration.days()}d: ${duration.hours()}h: ${duration.minutes()}m: ${duration.seconds()}s:${tanda}`
                const reason = afkData.reason;

                await m.reply(`❌ Heyy.. Maaf, saya sedang offline!\n├ Sejak ${times}\n└ Reason : *${reason}*`,)

                if (['turu', 'tidur', 'micek'].includes(reason.toLowerCase())) {
                    await client.sendMessage(chatId, { image: { url: './src/assets/images/turu.jpg' }, viewOnce: true });
                }

                // Set anti-spam 60 detik per chat
                afkSpamGuard.set(chatId, Date.now() + 800_000);
            }
        }

        const tipe = bgColor(`${colorize(getContentType(msg.message), 'black')} ${isJidBroadcast(m.from) ? colorize('Status', '#00a2ff') : ''}`, cHex.success)

        if (!isCmd && !isGroupMsg && !m.key.fromMe) {
            console.log(colorize('[ msg ]', cHex.sys), colorize(getTime, cHex.timestamp), cutStr(m.text), `~> ${(tipe)} from`, colorize(pushname, cHex.user))
        }
        if (!isCmd && isGroupMsg && !m.key.fromMe) {
            console.log(colorize('[ msg ]', cHex.sys), colorize(getTime, cHex.timestamp), cutStr(m.text), `~> ${tipe} from`, colorize(pushname, cHex.user), 'in', colorize(formattedTitle, cHex.group))
        }
        if (isCmd && !isGroupMsg && m.key.fromMe) {
            console.log(colorize('[ cmd ]', cHex.cmd), colorize(getTime, cHex.timestamp), colorize(`${commandName} [${args.length}]`), colorize(`${cutStr(body)}`, cHex.msg), '~> from', colorize(pushname, cHex.user))
        }
        if (isCmd && isGroupMsg && m.key.fromMe) {
            console.log(colorize('[ cmd ]', cHex.cmd), colorize(getTime, cHex.timestamp), colorize(`${commandName} [${args.length}]`), colorize(`${cutStr(body)}`, cHex.msg), '~> from', colorize(pushname, cHex.user), 'in', colorize(formattedTitle, cHex.group))
        }
        if (!m.fromMe) return

        setImmediate(() =>
            events.forEach((event, key) => {
                try {
                    typeof event.execute === "function" && event.execute({ m, client, msg, axios, fs, commands, args, packages, formattedTitle })
                } catch (e) {
                    console.log('[INFO] : %s', colorize(e, 'red'))
                }
            })
        )

        if (!isCmd) return

        const command =
            commands.get(commandName) ||
            commands.find((cmd: any) => cmd.aliases && cmd.aliases.includes(commandName))

        if (!command) return

        try {
            await command.execute({ m, client, msg, axios, fs, commands, args, packages, formattedTitle })
        } catch (e) {
            console.log('[INFO] : %s', colorize(e, 'red'))
        }
    }
}

export const loadCommands = async (cmdPath: string = 'commands') => {
    const files = readdirSync(join(__dirname, '..', cmdPath))
    for (const file of files) {
        const filePath = join(__dirname, "..", cmdPath, file)
        const isDirectory = lstatSync(filePath).isDirectory()
        if (isDirectory) await loadCommands(cmdPath + sep + file)
        const baseFilename = basename(file, file.endsWith(".ts") ? ".ts" : ".js").toLowerCase()
        if (!isDirectory) {
            const importFile = await import(filePath)
            const name: string = importFile?.name || baseFilename
            if (!commands.has(name) && !name.endsWith("_ev")) {
                const cmd: ICommand = importFile?.default || importFile
                commands.set(cmd.name, cmd)
            }
            if (!events.has(name) && name.endsWith("_ev")) {
                const evt: IEvent = importFile?.default || importFile
                events.set(name, evt)
            }
        }
    }
    commands.sort()
    return commands.size
}