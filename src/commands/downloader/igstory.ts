import util from 'util'
import { inline, rtfFormat } from "../../utils"
import { ICommand } from "../../types"
import { igClient } from "../../lib"
import moment from 'moment'
import { writeFileSync } from 'fs'

export default <ICommand>{
    name: 'igs',
    aliases: ['igstory'],
    category: 'downloader',
    description: 'donlot ig story',
    execute: async ({ m, client, args }) => {
        const ping = Date.now() - m.timestamps // time milliseconds
        try {
            console.log(args[0], /https:\/\/(www\.)?instagram\.com\/stories\/.+/g.test(args[0]));

            if (!/https:\/\/(www\.)?instagram\.com\/stories\/.+/g.test(args[0])) return m.reply('not ig STORY url')
            m.reply(`${inline('processing')}`)

            let u = m.text.match(/https:\/\/(www\.)?instagram\.com\/stories\/.+/g)[0]
            let s = u.indexOf('?') >= 0 ? u.split('?')[0] : (u.split('').pop() == '/' != true ? `${u}` : u);
            let [username, storyId] = s.split('/stories/')[1].split('/')

            const data = await igClient.fetchStories(username);
            let media = data.stories.find(x => x.id.toString().match(storyId))
            const gql = data.graphql.items.find(x => x.id.toString().match(storyId));
            // @ts-ignore
            const mentions = gql?.story_bloks_stickers !== undefined ? gql?.story_bloks_stickers.map(v => v.bloks_sticker.sticker_data) : []
            writeFileSync('./stori.json', JSON.stringify(gql, null, 2))
            let caption = `taken at : ${moment(media.taken_at * 1000).format('DD/MM/YY HH:mm:ss')}`

            if (mentions.length) {
                caption += '\n\ntagged user:\n'
                for (let u of mentions) {
                    caption += `- @${u.ig_mention.username}\n`
                }
            }
            if (media.mimetpye == 'image/jpeg' || media.mimetpye == 'image/png') {
                client.sendMessage(m.from, { image: { url: media.url }, caption }, { quoted: m })
            } else
                client.sendMessage(m.from, { video: { url: media.url }, caption }, { quoted: m })
            m.reply(`${inline('succeed.')} - stories from @${data.username}\n${rtfFormat(ping / 1000, "seconds")}`)
        } catch (error) {
            m.reply(util.format(error))
        }
    }
}