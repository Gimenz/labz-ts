import { FinanceService } from "../../lib/finance/financeService";
import { formatTransactionResults } from "../../lib/finance/formatter";
import { ICommand } from "../../types";

const service = new FinanceService()

export default <ICommand>{
    execute: async ({ m, client }) => {
        const jid = m.from
        const pending = service.getPendingTransactions(jid)
        if (pending) {
            // if ((m.quoted) && (/Konfirmasi Transaksi/i.test(m.quoted.text))) {
            // if (!m.quoted) return
            // if (!/Konfirmasi Transaksi/i.test(m.quoted.text)) return

            const input = m.text?.trim().toLowerCase() || ''

            if (['ya', 'yes', 'y', 'iya', 'ok', 'oke', 'benar'].includes(input)) {
                const pending = service.getPendingTransactions(jid)
                if (pending) {
                    const results = await service.confirmAndExecute(jid)
                    let summary = formatTransactionResults(results, pending.source)

                    for (const result of results) {
                        if (!result.isIncome) {
                            const alert = await service.checkBudgetAlert(result.category)
                            if (alert) {
                                summary += `\n\n${alert}`
                            }
                        }
                    }
                    return m.reply(summary)
                }
            }

            if (['tidak', 'bukan', 'no', 'n', 'cancel', 'batal'].includes(input)) {
                const pending = service.getPendingTransactions(jid)
                if (pending) {
                    service.cancelPending(jid)
                    return m.reply('❌ *Dibatalkan.*')
                }
            }

            // Check if user is confirming via quoted message
            // if (m.quoted) {

            // }
        }
    }
}