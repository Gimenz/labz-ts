import util from 'util'
import { inline, rtfFormat } from "../../utils"
import { ICommand } from "../../types"
import { delay } from "baileys"
import { TikTokDL } from '../../lib'

export default <ICommand>{
    name: 'tiktok',
    aliases: ['t', 'tt'],
    category: 'downloader',
    description: 'donlot tiktok',
    execute: async ({ m, client, args }) => {
        const start = Date.now()
        try {
            m.reply('`processing...`')
            const data = await TikTokDL(args[0])

            const ping = Date.now() - start // time milliseconds
            const author = data?.author?.unique_id
                ? `@${data.author.unique_id}`
                : 'unnamed user'
            const desc = data?.desc || 'n/a'
            const getQ = (q: any) => parseInt(q.gear_name.match(/(\d+)/)?.[1] || 0)

            const best = data.video.bit_rate.reduce((a: any, b: any) => getQ(b) > getQ(a) ? b : a)

            const videoUrl = best.play_addr.url_list[0]
            const qualityText = `${getQ(best)}p`

            const caption =
                `*${author}* ✤ ${inline(qualityText)}

> ${desc}     ❞
Region : ${data?.author?.region || ''}

⇝ _${(ping / 1000).toFixed(2)}s_
`

            if (data.hasOwnProperty('image_post_info')) {
                let images = data.image_post_info.images.map((x: any) => x.display_image.url_list[1])
                m.reply(`${caption}\n\n${images.length} medias`)
                for (let img of images) {
                    await delay(2000)
                    await client.sendMessage(m.from, { image: img })
                }
            } else {
                return client.sendMessage(m.from, { video: { url: videoUrl }, caption }, { quoted: m })
            }
        } catch (error) {
            console.log(error);

            m.reply(util.format(error))
        }
    }
}