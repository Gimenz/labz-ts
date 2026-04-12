import { capitalize } from '../../utils'
import { formatAmount } from './amountParser'
import { Report, ParsedTransaction, TransactionResult } from './financeService'
import moment from 'moment-timezone'

/**
 * Format pending confirmation untuk text input
 */
export function formatPendingConfirmation(transactions: ParsedTransaction[]): string {
    let text = `📋 *Konfirmasi Transaksi*\n\n`

    for (const tx of transactions) {
        const icon = tx.type === 'income' ? '📈' : '📉'
        text += `${icon} ${tx.description}\n`
        text += `   └─ ${tx.category} • ${formatAmount(tx.amount)}\n`
    }

    text += `\n*Benar? reply: ya/tidak*`
    return text
}

/**
 * Format pending confirmation untuk image input (minimalis)
 */
export function formatPendingConfirmationImage(transactions: ParsedTransaction[], merchant: string): string {
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0)

    let text = `✅ *${merchant} (${transactions.length} item)*\n\n`

    for (const tx of transactions) {
        text += `📉 ${tx.description} • ${formatAmount(tx.amount)}\n`
    }

    text += `\n💸 Total: ${formatAmount(totalAmount)}\n`
    text += `\n*Benar? reply: ya/tidak*`

    return text
}

/**
 * Format transaction results setelah confirm
 */
export function formatTransactionResults(results: TransactionResult[], source: 'text' | 'image'): string {
    const totalAmount = results.reduce((sum, r) => sum + r.amount, 0)
    const sourceLabel = source === 'image' ? 'dari Struk' : ''

    let text = `✅ *${results.length} Transaksi ${sourceLabel} Dicatat*\n\n`

    for (const result of results) {
        text += `🆔 ID :${result.id}\n`
        text += `🗒️ Desc : ${result.description}\n`
        text += `📂 Kategori : ${result.category}\n`
        text += `💰 Jumlah : ${formatAmount(result.amount)}\n\n`
    }

    text += `\n💸 Total: ${formatAmount(totalAmount)}\n`

    const formattedDate = moment(results[results.length - 1].when)
        .tz('Asia/Jakarta')
        .format('DD MMM YYYY HH:mm')

    text += `\n📅 ${formattedDate} WIB`

    return text
}

// Add/update formatReport function
export function formatReport(report: Report): string {
    const categoryList = Object.entries(report.byCategory)
        .map(([cat, amt]) => `   • ${cat}: ${formatAmount(amt)}`)
        .join('\n')

    let text = `📊 *Laporan ${capitalize(report.period)}*\n`
    text += `🗓 ${report.periodName}\n\n`

    text += `💵 *Pemasukan:* ${formatAmount(report.income)}\n`
    text += `💸 *Pengeluaran:* ${formatAmount(report.expense)}\n`
    const netEmoji = report.net >= 0 ? '📈' : '📉'
    text += `\n${netEmoji} *Net*: ${formatAmount(report.net)}\n\n`

    if (categoryList) {
        text += `📂 *Kategori:*\n${categoryList}\n`
    }

    return text
}

export function formatBudgetSet(category: string, amount: number): string {
    return `✅ *Budget ${category} Diatur*\n💸 Budget: ${formatAmount(amount)}`
}

export function formatError(message: string): string {
    return `❌ *Error*\n${message}`
}

export function formatCategories(): string {
    const EXPENSE_CATEGORIES = [
        'Makanan', 'Transportasi', 'Rumah Tangga', 'Belanja',
        'Kesehatan', 'Pendidikan', 'Hiburan', 'Fashion',
        'Komunikasi', 'Perawatan', 'Sosial', 'Elektronik', 'Otomotif', 'Lainnya'
    ]

    const INCOME_CATEGORIES = [
        'Gaji', 'Freelance', 'Investasi', 'Hadiah', 'Transfer', 'Lainnya'
    ]

    let text = `📁 *Kategori Transaksi*\n\n`
    text += `*Pengeluaran (Expense):*\n`
    text += EXPENSE_CATEGORIES.map(c => `• ${c}`).join('\n')
    text += `\n\n*Pemasukan (Income):*\n`
    text += INCOME_CATEGORIES.map(c => `• ${c}`).join('\n')

    return text
}