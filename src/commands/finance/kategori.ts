import { ICommand } from "../../types"
import { formatCategories } from "../../lib/finance/formatter"

export default <ICommand>{
    name: 'kategori',
    aliases: ['cat', 'categories', 'kategori'],
    category: 'finance',
    description: 'Lihat daftar kategori transaksi',
    execute: async ({ m, client, args }) => {
        m.reply(formatCategories())
    }
}