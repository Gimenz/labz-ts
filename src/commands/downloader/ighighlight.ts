import util from 'util'
import { inline, rtfFormat } from "../../utils"
import { ICommand } from "../../types"
import { igClient } from "../../lib"
import moment from 'moment'

export default <ICommand>{
    name: 'igh',
    aliases: ['ighighlight'],
    category: 'downloader',
    description: 'donlot ig highlight',
    execute: async ({ m, client, args }) => {
        const hRegex = /https:\/\/www\.instagram\.com\/s\/(.*?)\?story_media_id=(\d+)_(\d+)/g
        const ping = Date.now() - m.timestamps // time milliseconds
        try {
            if (!hRegex.test(args[0])) return m.reply('not ig highlight url')
            m.reply(`${inline('processing')}`)

            const [, h1, mediaId] = /https:\/\/www\.instagram\.com\/s\/(.*?)\?story_media_id=(\d+)_(\d+)/g.exec(args[0])
            const highlightId = Buffer.from(h1, 'base64').toString('binary').match(/\d+/g)[0]

            const data = await igClient._getReels(highlightId);

            let reels_media = data.data.reels_media.find(x => x.id.match(highlightId))

            let item = reels_media.items.find(x => x.id.toString().match(mediaId))
            const mentions = item.tappable_objects.length ? item.tappable_objects.filter(v => v.__typename == 'GraphTappableMention') : []

            let caption = `taken at : ${moment(item.taken_at_timestamp * 1000).format('DD/MM/YY HH:mm:ss')}\n\n`

            if (mentions.length) {
                caption += 'tagged user:\n'
                for (let u of mentions) {
                    caption += `- @${u.username}\n`
                }
            }

            if (!item.is_video) {
                client.sendMessage(m.from, { image: { url: item.display_url }, caption }, { quoted: m })
            } else
                client.sendMessage(m.from, { video: { url: item.video_resources[0].src }, caption }, { quoted: m })
            m.reply(`${inline('succeed.')} - highlight from @${item.owner.username}\n${rtfFormat(ping / 1000, "seconds")}`)
        } catch (error) {
            m.reply(util.format(error))
        }
    }
}