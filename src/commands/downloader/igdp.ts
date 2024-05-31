import util from 'util'
import { inline, rtfFormat } from "../../utils"
import { ICommand } from "../../types"
import { igClient } from "../../lib"

export default <ICommand>{
    name: 'igdp',
    aliases: ['igprofile'],
    category: 'downloader',
    description: 'donlot ig profile picture',
    execute: async ({ m, client, args }) => {
        const ping = Date.now() - m.timestamps // time milliseconds
        try {
            if (!args[0]) return m.reply('username needed')
            m.reply('`processing...`')
            const res = await igClient.fetchUser(args[0])
            client.sendMessage(m.from, { image: { url: res.hd_profile_pic_url_info.url } }, { quoted: m })
            m.reply(`${inline('succeed.')} - @${res.username}\n${rtfFormat(ping / 1000, "seconds")}`)
        } catch (error) {
            m.reply(util.format(error))
        }
    }
}