import { ICommand } from "../../types"
import { FinanceService } from "../../lib/finance/financeService"
import { formatPendingConfirmation, formatPendingConfirmationImage, formatTransactionResults, formatError } from "../../lib/finance/formatter"
import * as fs from 'fs'
import * as path from 'path'
import { downloadMediaMessage } from "baileys"
import logger from "../../utils/logger"

const service = new FinanceService()

export default <ICommand>{
    name: 'fin',
    aliases: ['finance', 'f'],
    category: 'finance',
    description: 'Catat transaksi keuangan (text atau foto struk)',
    execute: async ({ m, client, args }) => {
        try {
            const jid = m.from

            // Check if image
            if (m.type === 'imageMessage' || (m.quoted && m.quoted.type === 'imageMessage')) {
                await m.reply('⏳ Membaca struk... (mohon tunggu 10-15 detik)')

                const mediaBuffer = await downloadMediaMessage(m.quoted ? m.quoted : m, 'buffer', {}, { logger: logger, reuploadRequest: client.updateMediaMessage })
                if (!mediaBuffer) {
                    return m.reply('❌ Gagal download gambar')
                }

                const tmpFile = path.join(process.cwd(), `receipt_${Date.now()}.jpg`)
                fs.writeFileSync(tmpFile, mediaBuffer)

                try {
                    const { transactions, merchant } = await service.parseReceiptImageToTransactions(tmpFile)

                    if (transactions.length === 0) {
                        return m.reply('❌ Tidak bisa parse struk ini. Coba foto yang lebih jelas atau gunakan .fin untuk input manual.')
                    }

                    await service.setPendingTransactions(jid, {
                        transactions,
                        source: 'image',
                        merchant
                    })

                    const confirmation = formatPendingConfirmationImage(transactions, merchant)
                    m.reply(confirmation)
                } catch (error: any) {
                    console.error('Image parsing error:', error)
                    m.reply(`⚠️ Gagal parse gambar: ${error.message}\n\nCoba lagi dengan foto lebih jelas, atau ketik manual:\n.fin beli nasgor 25k`)
                } finally {
                    if (fs.existsSync(tmpFile)) {
                        fs.unlinkSync(tmpFile)
                    }
                }
                return
            }

            // Text input
            if (args.length === 0) {
                return m.reply(
                    `*Format:*\n.fin <transaksi>\n\n` +
                    `*Contoh:*\n` +
                    `.fin beli nasgor 25k\n` +
                    `.fin gaji bulan ini 5jt\n` +
                    `.fin beli nasgor 25k, bensin 50k, rokok 25k\n\n` +
                    `*Atau:*\n` +
                    `Kirim foto struk/pesanan terus reply: .fin`
                )
            }

            await m.react('🍳')

            const input = args.join(' ')
            const transactions = await service.parseTransactions(input)

            await service.setPendingTransactions(jid, {
                transactions,
                source: 'text'
            })

            const confirmation = formatPendingConfirmation(transactions)
            m.reply(confirmation)

        } catch (error: any) {
            console.error(error)
            m.reply(formatError(error.message))
        }
    }
}

