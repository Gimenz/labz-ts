import { rtfFormat } from "../utils"
import { ICommand } from "../types"

export default <ICommand>{
    name: 'ping',
    category: 'general',
    description: 'bot ngrespon ing',
    execute({ m }) {
        const ping = Date.now() - m.timestamps // time milliseconds
        return m.reply(` ${rtfFormat(ping / 1000, "seconds")}`)
    }
}