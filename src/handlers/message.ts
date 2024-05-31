import { getContentType, isJidBroadcast, isJidStatusBroadcast, MessageUpsertType, proto, S_WHATSAPP_NET, WAMessage, WASocket } from '@whiskeysockets/baileys';
import fs, { lstatSync, readdirSync } from 'fs';
import axios from 'axios';
import moment from 'moment-timezone';
import { basename, join, sep } from 'path';
import { packages, bgColor, colorize, serializeMessage, cutStr, config } from '../utils';
import { commands, events } from '../lib';
import { ICommand, IEvent } from '../types';
import WAClient from './client';
moment.tz.setDefault('Asia/Jakarta')

export const MessageHandler = async (
    client: WASocket,
    message: {
        messages: proto.IWebMessageInfo[];
        type: MessageUpsertType;
    }
) => {
    if (!message.messages) return
    for (const msg of message.messages) {
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
            const contact = WAClient.store.contacts[m.sender]
            const pushname = contact?.name || contact?.notify || m.pushname
            const storySend = config.storySend

            const caption = `*Story Stealer :*\n• Name : ${pushname}\n• From : wa.me/${m.sender.split('@')[0]}\n• Time : ${getTime}\n• Caption : ${m.text}`
            const modified = WAClient.cMod(client, storySend, m, caption, client.user.id)
            await WAClient.resendMessage(client, storySend, await serializeMessage(client, modified))

            if (m.type == 'audioMessage' || m.type == 'extendedTextMessage') {
                await client.sendMessage(storySend, { text: caption })
            }
        }

        if (m.type == 'viewOnceMessageV2') {
            const caption = `viewOnce message from ${m.sender.replace(S_WHATSAPP_NET, '')} copy & viewed`
            const modified = WAClient.cMod(client, config.storySend, m, caption, client.user.id)
            await WAClient.resendMessage(client, config.storySend, await serializeMessage(client, modified))
        }

        const tipe = bgColor(`${colorize(m.type, 'black')} ${isJidBroadcast(m.from) ? colorize('Status', 'yellow') : ''}`, '#6dd5ed')

        if (!isCmd && !isGroupMsg && !m.key.fromMe) {
            console.log('[MSG]', colorize(getTime, '#A1FFCE'), cutStr(m.text), `~> ${(tipe)} from`, colorize(pushname, '#38ef7d'))
        }
        if (!isCmd && isGroupMsg && !m.key.fromMe) {
            console.log('[MSG]', colorize(getTime, '#A1FFCE'), cutStr(m.text), `~> ${tipe} from`, colorize(pushname, '#38ef7d'), 'in', colorize(formattedTitle, '#C6FFDD'))
        }
        if (isCmd && !isGroupMsg && m.key.fromMe) {
            console.log(colorize('[CMD]'), colorize(getTime, '#A1FFCE'), colorize(`${commandName} [${args.length}]`), colorize(`${cutStr(body)}`, 'cyan'), '~> from', colorize(pushname, '#38ef7d'))
        }
        if (isCmd && isGroupMsg && m.key.fromMe) {
            console.log(colorize('[CMD]'), colorize(getTime, '#A1FFCE'), colorize(`${commandName} [${args.length}]`), colorize(`${cutStr(body)}`, 'cyan'), '~> from', colorize(pushname, '#38ef7d'), 'in', colorize(formattedTitle, '#C6FFDD'))
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
        const baseFilename = basename(file, file.includes(".ts") ? ".ts" : ".js").toLowerCase()
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