import { ICommand } from "../../types"
import { FinanceService } from "../../lib/finance/financeService"
import { formatReport, formatError } from "../../lib/finance/formatter"

export default <ICommand>{
    name: 'laporan',
    aliases: ['report', 'lap'],
    category: 'finance',
    description: 'Lihat laporan keuangan',
    execute: async ({ m, client, args }) => {
        try {
            const service = new FinanceService()

            // Parse args
            let period: 'daily' | 'weekly' | 'monthly' = 'monthly'

            if (args.length > 0) {
                const input = args.join(' ').toLowerCase()

                if (input.includes('hari') || input.includes('today') || input.includes('daily')) {
                    period = 'daily'
                } else if (input.includes('minggu') || input.includes('week') || input.includes('weekly')) {
                    period = 'weekly'
                } else if (input.includes('bulan') || input.includes('month') || input.includes('monthly')) {
                    period = 'monthly'
                }
            }

            const report = await service.generateReport(period)
            m.reply(formatReport(report))
        } catch (error: any) {
            console.error(error)
            m.reply(formatError(error.message))
        }
    }
}