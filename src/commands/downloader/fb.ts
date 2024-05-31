import util from 'util'
import { inline, rtfFormat } from "../../utils"
import { ICommand } from "../../types"
import { SnapSave } from "../../lib"

export default <ICommand>{
    name: 'fb',
    aliases: ['facebook'],
    category: 'downloader',
    description: 'donlot fb',
    execute: async ({ m, client, args }) => {
        const ping = Date.now() - m.timestamps // time milliseconds
        try {
            if (args.length == 0) return m.reply('please provide a url')
            m.reply('`processing...`')
            const fb = await SnapSave(args[0])
            return client.sendMessage(m.from, { video: { url: fb.list[0].url }, caption: `${inline('succeed.')} - ${rtfFormat(ping / 1000, "seconds")}` }, { quoted: m })
        } catch (error) {
            m.reply(util.format(error))
        }
    }
}