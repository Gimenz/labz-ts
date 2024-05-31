import { ICommand } from "../../types";
import WAClient from '../../handlers/client';

export default <ICommand>{
    name: 'view',
    aliases: ['v', 'vi'],
    category: 'utility',
    description: 'view masseh',
    execute: async ({ m, client }) => {
        if (m.quoted) {
            await WAClient.resendMessage(client, m.from, m.quoted)
        }
    }
}