import { ICommand } from "../../types";
import { config, updateConfig } from "../../utils";

export default <ICommand>{
    name: 'detectstory',
    aliases: ['ds'],
    category: 'utility',
    description: 'getstory masseh',
    execute: async ({ m, args }) => {
        if (args[0] == 'on') {
            if (config.downloadStory) return m.reply('downloadStory already active')
            config.downloadStory = true
            updateConfig(config)
            m.reply('detecstory status:' + config.downloadStory)
        } else if (args[0] == 'off') {
            if (!config.downloadStory) return m.reply('downloadStory already deactive')
            config.downloadStory = false
            updateConfig(config)
            m.reply('detecstory status:' + config.downloadStory)
        }
    }
}