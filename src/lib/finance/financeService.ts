import { GoogleSheetsClient } from './sheetsClient'
import { parseFinanceWithGemini } from './geminiParser'
import { parseReceiptImage, ReceiptData } from './visionParser'
import { formatAmount } from './amountParser'
import moment from 'moment-timezone'

export interface ParsedTransaction {
    type: 'income' | 'expense'
    category: string
    amount: number
    description: string
}

export interface TransactionResult {
    id: string
    description: string
    category: string
    amount: number
    isIncome: boolean
    when: Date
}

export interface Report {
    period: 'daily' | 'weekly' | 'monthly'
    periodName: string
    income: number
    expense: number
    net: number
    byCategory: Record<string, number>
}

const pendingTransactions = new Map<string, { transactions: ParsedTransaction[], source: 'text' | 'image', merchant?: string }>()
const pendingTimeout = new Map<string, NodeJS.Timeout>()

const PENDING_TTL = 5 * 60 * 1000

export class FinanceService {
    private sheets: GoogleSheetsClient

    constructor() {
        this.sheets = new GoogleSheetsClient()
    }

    /**
     * Parse transactions from natural language
     */
    async parseTransactions(input: string): Promise<ParsedTransaction[]> {
        return await parseFinanceWithGemini(input)
    }

    /**
     * Parse receipt/invoice image to transactions
     */
    async parseReceiptImageToTransactions(imageSource: string): Promise<{ transactions: ParsedTransaction[], merchant: string }> {
        const receiptData = await parseReceiptImage(imageSource)

        const transactions: ParsedTransaction[] = receiptData.items.map(item => ({
            type: 'expense',
            category: item.category,
            amount: item.price * item.quantity,
            description: item.description
        }))

        return {
            transactions,
            merchant: receiptData.merchant
        }
    }

    /**
     * Store pending transactions
     */
    async setPendingTransactions(jid: string, data: { transactions: ParsedTransaction[], source: 'text' | 'image', merchant?: string }): Promise<void> {
        if (pendingTimeout.has(jid)) {
            clearTimeout(pendingTimeout.get(jid)!)
        }

        pendingTransactions.set(jid, data)

        const timeout = setTimeout(() => {
            pendingTransactions.delete(jid)
            pendingTimeout.delete(jid)
        }, PENDING_TTL)

        pendingTimeout.set(jid, timeout)
    }

    /**
     * Get pending transactions
     */
    getPendingTransactions(jid: string) {
        return pendingTransactions.get(jid) || null
    }

    /**
     * Confirm and execute pending transactions
     */
    async confirmAndExecute(jid: string): Promise<TransactionResult[]> {
        const pending = pendingTransactions.get(jid)
        if (!pending) {
            throw new Error('Tidak ada transaksi pending')
        }

        const results: TransactionResult[] = []

        for (const tx of pending.transactions) {
            const id = await this.sheets.getNextTransactionId()
            const dateString = moment().format('YYYY-MM-DD') // YYYY-MM-DD
            const timeString = moment().format('HH:mm')  // HH:mm

            await this.sheets.appendTransaction({
                id,
                date: dateString,
                time: timeString,
                type: tx.type,
                category: tx.category,
                description: tx.description,
                amount: tx.amount
            })

            results.push({
                id,
                description: tx.description,
                category: tx.category,
                amount: tx.amount,
                isIncome: tx.type === 'income',
                when: moment().toDate()
            })
        }

        pendingTransactions.delete(jid)
        if (pendingTimeout.has(jid)) {
            clearTimeout(pendingTimeout.get(jid)!)
            pendingTimeout.delete(jid)
        }

        return results
    }

    /**
     * Cancel pending
     */
    cancelPending(jid: string): void {
        pendingTransactions.delete(jid)
        if (pendingTimeout.has(jid)) {
            clearTimeout(pendingTimeout.get(jid)!)
            pendingTimeout.delete(jid)
        }
    }

    /**
     * Get date range for period
     */
    private getDateRange(period: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date; label: string } {
        const now = moment().tz('Asia/Jakarta')
        let start: moment.Moment
        let label: string

        if (period === 'daily') {
            start = now.clone().startOf('day')
            label = now.format('DD MMMM YYYY')
        } else if (period === 'weekly') {
            start = now.clone().startOf('week').add(1, 'day') // Monday
            label = `${start.format('DD MMM')} - ${now.format('DD MMM YYYY')}`
        } else {
            start = now.clone().startOf('month')
            label = now.format('MMMM YYYY')
        }

        return {
            start: start.toDate(),
            end: now.clone().endOf('day').toDate(),
            label
        }
    }

    /**
     * Filter transactions by date range
     */
    private filterTransactionsByDateRange(transactions: any[], start: Date, end: Date): any[] {
        return transactions.filter(tx => {
            const fullDateTime = `${tx.date} ${tx.time}`;
            const txDate = moment.tz(fullDateTime, 'YYYY-MM-DD H:mm', 'Asia/Jakarta').toDate();
            return txDate >= start && txDate <= end
        })
    }

    /**
     * Generate report (daily, weekly, or monthly)
     */
    async generateReport(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<Report> {
        const allTransactions = await this.sheets.getTransactions()
        const dateRange = this.getDateRange(period)
        const transactions = this.filterTransactionsByDateRange(allTransactions, dateRange.start, dateRange.end)

        let income = 0
        let expense = 0
        const byCategory: Record<string, number> = {}

        for (const tx of transactions) {
            if (tx.type === 'income') {
                income += tx.amount
            } else {
                expense += tx.amount
                byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount
            }
        }

        const sortedCategories = Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .reduce((acc, [cat, amt]) => ({ ...acc, [cat]: amt }), {})

        return {
            period,
            periodName: dateRange.label,
            income,
            expense,
            net: income - expense,
            byCategory: sortedCategories
        }
    }

    /**
     * Set budget for category
     */
    async setBudget(category: string, amount: number): Promise<void> {
        await this.sheets.setBudget(category, amount)
    }

    /**
     * Check budget and return alert if needed
     */
    async checkBudgetAlert(category: string): Promise<string | null> {
        const budget = await this.sheets.getBudget(category)
        if (budget <= 0) return null

        const spent = await this.sheets.getCategoryTotal(category)
        const remaining = budget - spent

        if (remaining < 0) {
            const over = Math.abs(remaining)
            return `⚠️ *Budget ${category} TERLAMPAUI!*\n💸 Budget: ${formatAmount(budget)}\n📊 Terpakai: ${formatAmount(spent)}\n❌ Over: ${formatAmount(over)}`
        }

        if (remaining <= budget * 0.2) {
            const percentage = Math.round((remaining / budget) * 100)
            return `⚠️ *Budget ${category} Menipis!*\n💸 Budget: ${formatAmount(budget)}\n📊 Terpakai: ${formatAmount(spent)}\n✅ Sisa: ${formatAmount(remaining)} (${percentage}%)`
        }

        return null
    }
}