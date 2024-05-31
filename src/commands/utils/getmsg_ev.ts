import { ICommand } from "../../types";
import moment from 'moment-timezone';
import WAClient from '../../handlers/client';
import { getContentType, proto } from "@whiskeysockets/baileys";
moment.tz.setDefault('Asia/Jakarta')
let store = WAClient.store

export default <ICommand>{
    execute: async ({ m, client }) => {
        const libPhonenumber = await import("libphonenumber-js")
        if ((m.quoted) && (/^pesan yang di hapus/i.test(m.quoted.text))) {
            if (!m.quoted) return
            if (!/^pesan yang di hapus/i.test(m.quoted.text)) return

            let terhapus = store.messages[m.from]
            let filtered = []
            terhapus.array.filter(x => x.hasOwnProperty('message')).filter(x => x.message.protocolMessage).map(x => filtered.push(terhapus.get(x.message.protocolMessage.key.id)))

            if (parseInt(m.text) - 1 > filtered.length - 1) return
            var result = filtered[parseInt(m.text) - 1]

            await WAClient.resendMessage(client, m.from, result)
        } else if ((m.quoted) && (/^Stories dari/i.test(m.quoted.text))) {
            if (!m.quoted) return
            if (!/^Stories dari/i.test(m.quoted.text)) return

            const nomer = m.quoted.text.match(/(\d+)@(\S+)/)[0]
            const statuses = store.messages['status@broadcast'].array
                .filter(v => v.participant == nomer)
                .sort(({ messageTimestamp: timeA }, { messageTimestamp: timeB }) => {
                    return +new Date((timeA.toString())) - +new Date(timeB.toString())
                })

            if (parseInt(m.text) - 1 > statuses.length - 1) return
            var result = statuses[parseInt(m.text) - 1] as any

            await WAClient.resendMessage(client, m.from, result)
        } else if ((m.quoted) && (/^group lists/i.test(m.quoted.text))) {
            let list = m.quoted.text.split('group lists:')[1].trim().split('\n');
            const i = parseInt(m.text) - 1
            if (i - 1 > list.length - 1) return
            console.log(list);
            console.log(i);
            console.log(/\. (.+) \| (.+)/.exec(list[i]));

            const [, groupName, groupId] = /\. (.+) \| (.+)/.exec(list[i])
            let terhapus = store.messages[groupId]

            let filtered: proto.IWebMessageInfo[] = []

            terhapus.array
                .filter(x => x.hasOwnProperty('message'))
                .filter(x => x.message.protocolMessage)
                .map(x => filtered.push(terhapus.get(x.message.protocolMessage.key.id)))

            if (filtered.length == 0) return m.reply('tidak ada history di database')

            let title = `di ${groupName}`

            var temp = `pesan yang di hapus: *${title}* | ${filtered.length} pesan\n\n`
            var index = 1

            filtered.map(({ message, messageTimestamp, key }) => {
                temp += `*${index++}*. @${key.participant.replace('@s.whatsapp.net', '')} | ${moment((messageTimestamp as number) * 1000).format('DD-MM HH:mm:ss')} | ${getContentType(message)}\n`
            })

            // @ts-ignore
            m.reply(temp, { mentions: filtered.map(v => v.key.participant) })
        }
    }
}