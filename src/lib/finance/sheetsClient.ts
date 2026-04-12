import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import axios from 'axios'
import moment from 'moment-timezone'

interface Transaction {
    id: string
    date: string
    time: string  // ← Tambah ini
    type: string
    category: string
    description: string
    amount: number
}

export class GoogleSheetsClient {
    private doc: GoogleSpreadsheet
    private initialized: boolean = false
    private auth: JWT
    private sheetsApi: string = 'https://sheets.googleapis.com/v4/spreadsheets'

    constructor() {
        const spreadsheetId = process.env.SHEET_ID
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
        const privateKey = process.env.GOOGLE_PRIVATE_KEY

        if (!spreadsheetId || !clientEmail || !privateKey) {
            throw new Error('Missing Google Sheets configuration')
        }

        this.auth = new JWT({
            email: clientEmail,
            key: privateKey.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        })

        this.doc = new GoogleSpreadsheet(spreadsheetId, this.auth)
    }

    /**
     * Get access token
     */
    private async getAccessToken(): Promise<string> {
        const credentials = await this.auth.authorize()
        return credentials.access_token || ''
    }

    /**
     * Initialize spreadsheet
     */
    private async init(): Promise<void> {
        if (this.initialized) return
        try {
            await this.doc.loadInfo()
            this.initialized = true
        } catch (error: any) {
            throw new Error(`Failed to load spreadsheet: ${error.message}`)
        }
    }

    /**
     * Get tab name for current month
     */
    private getTabName(): string {
        const now = new Date()
        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        const month = monthNames[now.getMonth()]
        const year = now.getFullYear()
        return `${month} ${year}`
    }

    /**
     * Get or create sheet for current month
     */
    private async getSheet(): Promise<GoogleSpreadsheetWorksheet> {
        await this.init()
        const tabName = this.getTabName()

        let sheet = this.doc.sheetsByTitle[tabName]

        if (!sheet) {
            sheet = await this.doc.addSheet({
                title: tabName,
                headerValues: ['ID', 'Tanggal', 'Waktu', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah']
            })
            // Format header
            await this.formatHeaderRow(sheet)
        }

        return sheet
    }

    /**
     * Format header row (blue bg, white text, bold)
     */
    private async formatHeaderRow(sheet: GoogleSpreadsheetWorksheet): Promise<void> {
        try {
            const token = await this.getAccessToken()
            const spreadsheetId = this.doc.spreadsheetId
            const sheetId = sheet.sheetId

            const request = {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: 7
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: {
                                        red: 0.08,
                                        green: 0.4,
                                        blue: 0.75
                                    },
                                    textFormat: {
                                        bold: true,
                                        fontSize: 12,
                                        foregroundColor: {
                                            red: 1,
                                            green: 1,
                                            blue: 1
                                        }
                                    },
                                    horizontalAlignment: 'CENTER',
                                    verticalAlignment: 'MIDDLE'
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
                        }
                    }
                ]
            }

            await axios.post(
                `${this.sheetsApi}/${spreadsheetId}:batchUpdate`,
                request,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )
        } catch (error: any) {
            console.warn('Failed to format header:', error.message)
        }
    }

    /**
     * Format transaction row (green for income, pink for expense)
     */
    private async formatTransactionRow(sheet: GoogleSpreadsheetWorksheet, rowIndex: number, isExpense: boolean): Promise<void> {
        try {
            const token = await this.getAccessToken()
            const spreadsheetId = this.doc.spreadsheetId
            const sheetId = sheet.sheetId

            // Pink for expense, green for income
            const bgColor = isExpense
                ? { red: 0.99, green: 0.89, blue: 0.93 }
                : { red: 0.91, green: 0.96, blue: 0.91 }

            const request = {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: rowIndex,
                                endRowIndex: rowIndex + 1,
                                startColumnIndex: 0,
                                endColumnIndex: 7
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: bgColor,
                                    textFormat: {
                                        bold: true,
                                        fontSize: 12,
                                    },
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)'
                        }
                    }
                ]
            }

            await axios.post(
                `${this.sheetsApi}/${spreadsheetId}:batchUpdate`,
                request,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )
        } catch (error: any) {
            console.warn('Failed to format row:', error.message)
        }
    }

    /**
     * Append transaction
     */
    async appendTransaction(tx: Transaction): Promise<void> {
        const sheet = await this.getSheet()
        const time = moment().tz('Asia/Jakarta').format('HH:mm')

        try {
            const newRows = await sheet.addRows([
                {
                    'ID': tx.id,
                    'Tanggal': tx.date,
                    'Waktu': tx.time,
                    'Tipe': tx.type,
                    'Kategori': tx.category,
                    'Deskripsi': tx.description,
                    'Jumlah': tx.amount
                }
            ])

            // Format new row - gunakan rowNumber
            if (newRows.length > 0) {
                const rowNumber = newRows[0].rowNumber
                await this.formatTransactionRow(sheet, rowNumber - 1, tx.type === 'expense') // rowNumber - 1 untuk index
            }
        } catch (error: any) {
            throw new Error(`Failed to append transaction: ${error.message}`)
        }
    }

    /**
     * Get all transactions
     */
    async getTransactions(): Promise<Transaction[]> {
        const sheet = await this.getSheet()

        try {
            const rows = await sheet.getRows()
            const transactions: Transaction[] = []

            for (const row of rows) {
                const tx: Transaction = {
                    id: row.get('ID') || '',
                    date: row.get('Tanggal') || '',
                    time: row.get('Waktu') || '',
                    type: row.get('Tipe') || '',
                    category: row.get('Kategori') || '',
                    description: row.get('Deskripsi') || '',
                    amount: parseFloat(row.get('Jumlah') || '0')
                }

                if (tx.id) {
                    transactions.push(tx)
                }
            }

            return transactions
        } catch (error: any) {
            console.error('Failed to get transactions:', error.message)
            return []
        }
    }

    /**
     * Get next transaction ID
     */
    async getNextTransactionId(): Promise<string> {
        const transactions = await this.getTransactions()
        const now = moment()
        const datePrefix = now.format('YYMMDD')

        let maxCounter = 0
        for (const tx of transactions) {
            if (tx.id.startsWith(datePrefix)) {
                const parts = tx.id.split('-')
                if (parts.length === 2) {
                    const counter = parseInt(parts[1])
                    if (counter > maxCounter) maxCounter = counter
                }
            }
        }

        return `${datePrefix}-${String(maxCounter + 1).padStart(3, '0')}`
    }

    /**
     * Get category total
     */
    async getCategoryTotal(category: string): Promise<number> {
        const transactions = await this.getTransactions()
        return transactions
            .filter(tx => tx.category === category && tx.type === 'expense')
            .reduce((sum, tx) => sum + tx.amount, 0)
    }

    /**
     * Get or create Budget sheet
     */
    private async getBudgetSheet(): Promise<GoogleSpreadsheetWorksheet> {
        await this.init()

        let sheet = this.doc.sheetsByTitle['Budget']

        if (!sheet) {
            sheet = await this.doc.addSheet({
                title: 'Budget',
                headerValues: ['Kategori', 'Budget Bulanan', 'Terpakai', 'Sisa', 'Status'] // Ubah ke Indo
            })
            await this.formatHeaderRow(sheet)
        }

        return sheet
    }

    /**
     * Set budget
     */
    async setBudget(category: string, amount: number): Promise<void> {
        const sheet = await this.getBudgetSheet()

        try {
            const rows = await sheet.getRows()
            let found = false

            for (const row of rows) {
                if (row.get('Kategori') === category) {
                    row.set('Budget Bulanan', amount.toString())
                    row.set('Sisa', amount.toString())
                    row.set('Status', '✅ Aman')
                    await row.save()
                    found = true
                    break
                }
            }

            if (!found) {
                await sheet.addRows([
                    {
                        'Kategori': category,
                        'Budget Bulanan': amount,
                        'Terpakai': 0,
                        'Sisa': amount,
                        'Status': '✅ Aman'
                    }
                ])
            }
        } catch (error: any) {
            throw new Error(`Failed to set budget: ${error.message}`)
        }
    }

    /**
     * Get budget
     */
    async getBudget(category: string): Promise<number> {
        try {
            const sheet = await this.getBudgetSheet()
            const rows = await sheet.getRows()
            for (const row of rows) {
                if (row.get('Kategori') === category) {
                    return parseFloat(row.get('Budget Bulanan') || '0')
                }
            }

            return 0
        } catch {
            return 0
        }
    }
}