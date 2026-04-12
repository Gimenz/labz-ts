

import { commands, Hijri } from "../lib";
import { capitalize, config, convertTime, inline, monospace, packages } from "../utils";
import { ICommand } from "../types";
import { readFileSync } from "fs";
import { join } from "path";
import os from 'os'

export default <ICommand>{
    name: 'menu',
    aliases: ['mnu', 'm', 'help'],
    category: 'general',
    description: 'menune masseh',
    execute: async ({ m, args }) => {
        try {
            const tanggal = new Hijri().getFormattedDate()
            if (args.length == 0) {
                let text = `> *> WA self bot <*\ncoded by ${packages.author}\n\n`
                // text += `📅 ${tanggal.hijriyah} - ${tanggal.jawa}\n`
                // text += `> Server Status\n`
                text += `📅 *${tanggal.hijriyah}*\n`
                text += `🌙 _${tanggal.jawa}_\n\n`
                text += `┌──  *Server Status*\n`
                let creds = JSON.parse(readFileSync(join(__dirname, '..', '..', 'session', 'creds.json'), 'utf-8')) as any
                let uptime = convertTime(os.uptime())
                // let server = {
                //     'wa-host device:': creds.platform,
                //     'os:': os.platform,
                //     'hostname:': os.hostname(),
                //     'uptime:': `${uptime[0]} hours, ${uptime[1]} mins`
                // }
                // for (let a of Object.entries(server)) {
                //     text += `${inline(a[0])} ${monospace(a[1])}\n`
                // }

                const serverInfo = [
                    { label: 'wa-host device', value: creds.platform },
                    { label: 'os', value: os.platform() },
                    { label: 'uptime', value: `${uptime[0]}h ${uptime[1]}m` }
                ]

                serverInfo.forEach(info => {
                    text += `│ ◦ ${info.label}: ${monospace(info.value)}\n`
                })
                text += `└──────────────\n`

                const categoryEmoji: Record<string, string> = {
                    downloader: '💈',
                    finance: '💎',
                    general: '📦',
                    tools: '🔮',
                    utility: '💡'
                }

                let cmds = '';
                for (const category of [...new Set(commands.map((v) => v.category).sort())]) {
                    const icon = categoryEmoji[category.toLowerCase()] || '📂';
                    cmds += `\n${icon} *${category.toUpperCase()}*\n`
                    // cmds += `\n*${(category)}*\n`
                    // let n = 1;
                    for (const cmd of commands.filter((v) => v.category && v.category.includes(category) && v.name).map(v => v)) {
                        const title = commands.findKey((v) => v === cmd)
                        // const alias = commands.filter(t => t === cmd).map(v => v.aliases).join(', ')
                        cmds += `- ${config.prefix}${title} \n`
                        // n++
                    }
                }
                text += `\n֍ commands :\n${cmds}`
                return m.reply(text)
            } else {
                if (!commands.has(args[0])) return m.reply('opowi')
                const code = commands.get(args[0])!.description
                return m.reply(code)
            }
        } catch (error) {
            console.log(error);

        }
    }
}