import util from 'util'
import { inline, rtfFormat } from "../../utils"
import { ICommand } from "../../types"
import { igClient } from "../../lib"
import { isIgPostUrl } from 'insta-fetcher'

export default <ICommand>{
    name: 'ig',
    aliases: ['insta'],
    category: 'downloader',
    description: 'donlot ig',
    execute: async ({ m, client, args }) => {
        if (args.length == 0) return m.reply('link nya mana?')
        const ping = Date.now() - m.timestamps // time milliseconds
        try {
            // m.reply('`processing...`')
            const res = await igClient.fetchPost(args[0])
            m.reply(`${inline('succeed.')} - post from @${res.username}\n${rtfFormat(ping / 1000, "seconds")}`)
            for (let { url, type } of res.links) {
                if (type == 'image') {
                    client.sendMessage(m.from, { image: { url } }, { quoted: m })
                } else
                    client.sendMessage(m.from, { video: { url } }, { quoted: m })
            }
        } catch (error) {
            m.reply(util.format(error))
        }
    }
}