import util from 'util'
import { inline, rtfFormat } from "../../utils"
import { ICommand } from "../../types"
import { delay } from "@whiskeysockets/baileys"
import { TikTokDL } from '../../lib'

export default <ICommand>{
    name: 'tiktok',
    aliases: ['t', 'tt'],
    category: 'downloader',
    description: 'donlot tiktok',
    execute: async ({ m, client, args }) => {
        const ping = Date.now() - m.timestamps // time milliseconds
        try {
            m.reply('`processing...`')
            const data = await TikTokDL(args[0])

            const author = `Post from @${data.author.unique_id}` || ''
            let caption = `${inline('succeed.')} - ${author} [${data.desc}]`
            if (data.hasOwnProperty('image_post_info')) {
                let images = data.image_post_info.images.map((x: any) => x.display_image.url_list[1])
                m.reply(`${caption}\n\n${images.length} medias`)
                for (let img of images) {
                    await delay(2000)
                    await client.sendMessage(m.from, { image: img })
                }
            } else {
                return client.sendMessage(m.from, { video: { url: data.video.play_addr.url_list[0] }, caption: `${caption}\n\n${rtfFormat(ping / 1000, "seconds")}` }, { quoted: m })
            }
        } catch (error) {
            m.reply(util.format(error))
        }
    }
}