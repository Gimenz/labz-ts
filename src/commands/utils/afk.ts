import { ICommand } from '../../types';
import { setAFK, clearAFK, getAFK } from '../../lib/database/afk';
import moment from 'moment-timezone';
moment.tz.setDefault('Asia/Jakarta');

export default <ICommand>{
    name: 'afk',
    category: 'utility',
    description: 'Set/unset AFK status',
    execute: async ({ m, args }) => {
        // .afk off → matiin afk
        if (args[0]?.toLowerCase() === 'off') {
            const afk = getAFK();
            if (!afk.active) return m.reply('❌ Kamu tidak sedang AFK.');

            const duration = moment.duration(Date.now() - afk.since);
            const formatted = duration.humanize();

            clearAFK();
            return m.reply(`❌ Sekarang tidak AFK!\nKamu AFK selama: *${formatted}*`);
        }

        // .afk <reason> → nyalain afk
        const reason = args.join(' ') || 'Gak ada alasan';
        setAFK(reason);

        return m.reply(`✅ Sekarang AFK!\n*Alasan:* ${reason}`);
    }
};