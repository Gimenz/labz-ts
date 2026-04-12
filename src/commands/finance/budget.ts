import { ICommand } from "../../types"
import { FinanceService } from "../../lib/finance/financeService"
import { parseAmount } from "../../lib/finance/amountParser"
import { formatBudgetSet, formatError } from "../../lib/finance/formatter"

const CATEGORIES = [
    'Makanan', 'Transportasi', 'Rumah Tangga', 'Belanja',
    'Kesehatan', 'Pendidikan', 'Hiburan', 'Fashion',
    'Komunikasi', 'Perawatan', 'Sosial', 'Lainnya'
]

export default <ICommand>{
    name: 'budget',
    aliases: ['budg', 'b'],
    category: 'finance',
    description: 'Set budget per kategori',
    execute: async ({ m, client, args }) => {
        try {
            if (args.length < 2) {
                let text = `*Format:*\n.budget <kategori> <jumlah>\n\n*Kategori:*\n`
                text += CATEGORIES.map(c => `• ${c}`).join('\n')
                text += `\n\n*Contoh:*\n.budget Makanan 500k`
                return m.reply(text)
            }

            const category = args[0]
            const amount = parseAmount(args[1])

            if (!CATEGORIES.includes(category)) {
                return m.reply(
                    `❌ Kategori tidak dikenal: ${category}\n\n` +
                    `Kategori yang tersedia:\n${CATEGORIES.map(c => `• ${c}`).join('\n')}`
                )
            }

            const service = new FinanceService()
            await service.setBudget(category, amount)

            m.reply(formatBudgetSet(category, amount))
        } catch (error: any) {
            console.error(error)
            m.reply(formatError(error.message))
        }
    }
}