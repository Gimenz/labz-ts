import { ICommand } from "../../types";
import WAClient from '../../handlers/client';
import moment from "moment-timezone";
import { getContentType, S_WHATSAPP_NET } from "@whiskeysockets/baileys";

export default <ICommand>{
    name: 'getstory',
    aliases: ['get', 'gs'],
    category: 'utility',
    description: 'getstory masseh',
    execute: async ({ m, client, args }) => {
        try {
            const libPhonenumber = await import("libphonenumber-js")
            let store = WAClient.store

            if (m.quoted && m.quoted.from == 'status@broadcast') {
                await WAClient.resendMessage(client, m.from, m.quoted)
            } else if (args.length >= 1) {
                const { countryCallingCode, phone } = libPhonenumber.parse(m.text, { extended: true })
                const nomer = `${m.mentions ? m.mentions[0] : `${countryCallingCode + phone}@${S_WHATSAPP_NET}`}`
                console.log(nomer);

                const statuses = store.messages['status@broadcast'].array
                    .filter(v => v.participant == nomer)
                    .sort(({ messageTimestamp: timeA }, { messageTimestamp: timeB }) => {
                        return +new Date((timeA.toString())) - +new Date(timeB.toString())
                    })

                console.log(statuses.slice(-1));

                let filtered = `Stories dari ${nomer}\n\n`

                let n = 1;
                for (let a of statuses) {
                    let t = typeof a.messageTimestamp == 'number' ? a.messageTimestamp : a.messageTimestamp.low || a.messageTimestamp.high
                    filtered += `${n}. ${moment(t * 1000).fromNow()} - ${getContentType(a.message).split('Message')[0]}\n`
                    ++n
                }

                m.reply(filtered)
            }
        } catch (error) {
            console.log(error);

        }
    }
}