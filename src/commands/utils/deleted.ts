import { getContentType, isJidGroup, proto } from "baileys";
import { ICommand } from "../../types";
import moment from 'moment-timezone';
import WAClient from '../../handlers/client';
import fs from 'fs';
import { store } from "../../handlers/store";
moment.tz.setDefault('Asia/Jakarta')

export default <ICommand>{
    name: 'deleted',
    category: 'utility',
    description: 'deleted masseh',
    execute: async ({ m, formattedTitle, args }) => {
        // console.log(store.presences);
        if (args[0] == 'grouplist') {
            const chats = store.chats.all()
            var currentDate = moment().startOf('day').hour(12);
            let groups = chats.filter(v => isJidGroup(v.id) && currentDate.diff(moment(v.conversationTimestamp as number), 'days') >= 3);

            let text = `group lists:\n\n`
            let index = 1
            groups.map(v => {
                text += `*${index}*. ${v.name} | ${v.id}\n`
            })

            m.reply(text)
        } else {
            let terhapus = store.messages[m.from]
            if (args.length >= 1) {
                // @ts-ignore
                terhapus = args[0]
            }

            let filtered: proto.IWebMessageInfo[] = []

            terhapus.array
                .filter(x => x.hasOwnProperty('message'))
                .filter(x => x.message.protocolMessage)
                .map(x => filtered.push(terhapus.get(x.message.protocolMessage.key.id)))

            filtered = filtered.filter(Boolean)


            if (filtered.length == 0) return m.reply('tidak ada history di database')

            let title = m.isGroup ? `di ${formattedTitle}` : `${filtered.slice(-1)[0].hasOwnProperty('pushName') ? filtered.slice(-1)[0].pushName : m.from}`

            var temp = `pesan yang di hapus: *${title}* | ${filtered.length} pesan\n\n`
            var index = 1

            filtered.map(({ message, messageTimestamp, key }) => {
                temp += `*${index++}*. @${key.participant.replace('@lid', '')} | ${moment((messageTimestamp as number) * 1000).format('DD-MM HH:mm:ss')} | ${getContentType(message)}\n`
            })

            // @ts-ignore
            m.reply(temp, { mentions: filtered.map(({ key }) => key.participant) })
        }
    }
}