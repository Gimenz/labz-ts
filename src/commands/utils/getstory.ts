import { ICommand } from "../../types";
import { store } from '../../handlers/store';
import moment from "moment-timezone";
import { getContentType, S_WHATSAPP_NET } from "baileys";
import parsePhoneNumber from 'libphonenumber-js'
import WAClient from "../../handlers/client";

export default <ICommand>{
    name: 'getstory',
    aliases: ['get', 'gs'],
    category: 'utility',
    description: 'getstory masseh',
    execute: async ({ m, client, args }) => {
        try {
            if (m.quoted && m.quoted.from == 'status@broadcast') {
                await WAClient.resendMessage(client, m.from, m.quoted)
            } else if (args.length >= 1) {
                console.log(parsePhoneNumber(m.text));
                const { countryCallingCode, nationalNumber } = parsePhoneNumber(m.text)

                const nomer = `${`${countryCallingCode + nationalNumber}${S_WHATSAPP_NET}`}`
                console.log(nomer);

                const statuses = store.messages['status@broadcast'].array
                    .filter(v => v.key.participant == nomer)
                    .sort(({ messageTimestamp: timeA }, { messageTimestamp: timeB }) => {
                        return +new Date((timeA.toString())) - +new Date(timeB.toString())
                    })
                if (!statuses || statuses.length == 0) return m.reply(`Tidak ada story dari ${nomer}`)
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