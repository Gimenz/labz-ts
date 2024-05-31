import { config, inline, monospace, packages } from "../utils";
import { ICommand, } from "../types";
import { readFileSync } from "fs";
import { join } from "path";

export default <ICommand>{
    name: 'stat',
    aliases: ['stats'],
    category: 'general',
    description: 'stats masseh',
    execute: async ({ m }) => {
        try {
            let text = `> *> WA self bot <*\ncoded by ${packages.author}\n\n`

            text += `> Server Status\n`
            let creds = JSON.parse(readFileSync(join(__dirname, '..', '..', 'session', 'creds.json'), 'utf-8')) as any
            let server = {
                'wa-host device:': creds.platform,
                'os:': `ucokbaba cloud`,
                'hostname:': 'udin',
                'uptime:': '999 hours 0.0 minutes'
            }
            for (let a of Object.entries(server)) {
                text += `${inline(a[0])} ${monospace(a[1])}\n`
            }

            text += `\n> Configuration\n`
            text += `${inline('downloadStory')} ${monospace(String(config.downloadStory))}\n`

            return m.reply(text)
        } catch (error) {
            console.log(error);

        }
    }
}