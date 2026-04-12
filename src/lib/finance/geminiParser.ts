import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseAmount } from './amountParser'

interface ParsedTransaction {
    type: 'income' | 'expense'
    category: string
    amount: number
    description: string
}

const EXPENSE_CATEGORIES = [
    'Makanan', 'Transportasi', 'Rumah Tangga', 'Belanja',
    'Kesehatan', 'Pendidikan', 'Hiburan', 'Fashion',
    'Komunikasi', 'Perawatan', 'Sosial', 'Lainnya'
]

const INCOME_CATEGORIES = [
    'Gaji', 'Freelance', 'Investasi', 'Hadiah', 'Transfer', 'Lainnya'
]

/**
 * Parse natural language financial input using Google Gemini AI
 * Better at recognizing Indonesian products and brands
 */
export async function parseFinanceWithGemini(input: string): Promise<ParsedTransaction[]> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured')
    }

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' })

    const systemPrompt = `Kamu adalah parser transaksi keuangan untuk pengguna Indonesia.
Parse input user dan ekstrak semua transaksi keuangan.
Kamu sangat tahu tentang produk, brand, dan slang Indonesia. jadi kamu harus validasi dan enhance deskripsi produk dengan nama yang umum dikenal di Indonesia

ATURAN PENTING:
1. Parse SEMUA transaksi yang disebutkan (bahkan multiple dalam satu pesan)
2. Tentukan tipe transaksi: "income" atau "expense" (default: expense)
3. Assign kategori dari list yang disediakan (match terdekat OK)
4. Extract jumlah dalam format apapun (50k, 1.5jt, 80ribu, 1000, 50.000, dll)
5. Deskripsi harus LENGKAP dan DESKRIPTIF - preserve nama produk sesuai yang disebutkan
6. Jika user sebutkan brand/nama produk, include lengkapnya di deskripsi
   Kamu wajib untuk recognize dan enhance nama produk Indonesia yang umum:
   Contoh: "aroma es teh ungu" → "Rokok Aroma Ice Berry Tea" (kamu harus/WAJIB!!! recognize produk yang valid)
   Contoh: "beli rokok" → "Rokok" (kalo gak ada brand spesifik)
   contoh lain
   "beli teh pucuk 3k" → "Beli Teh Pucuk Harum"
7. Output HANYA valid JSON array, TIDAK ada markdown atau text tambahan

Kategori Pengeluaran (Indonesia):
${EXPENSE_CATEGORIES.join(', ')}

Kategori Pemasukan (Indonesia):
${INCOME_CATEGORIES.join(', ')}

CONTOH:

Input: "beli rokok la ice mango 34k, stella refill lemon fresh 34k, batagor 5k"
Output:
[
  {"type": "expense", "category": "Makanan", "amount": "5000", "description": "Batagor"},
  {"type": "expense", "category": "Hiburan", "amount": "34000", "description": "Rokok LA Ice Mango Boost"},
  {"type": "expense", "category": "Hiburan", "amount": "34000", "description": "Stella Matic Refill Lemon Fresh"}
]

Input: "beli nasgor 25k, bensin 50k, rokok 25k"
Output:
[
  {"type": "expense", "category": "Makanan", "amount": "25000", "description": "Nasi Goreng"},
  {"type": "expense", "category": "Transportasi", "amount": "50000", "description": "Bensin"},
  {"type": "expense", "category": "Hiburan", "amount": "25000", "description": "Rokok"}
]`

    try {
        const message = await model.generateContent(
            systemPrompt + '\n\nUser transaction: ' + input
        )

        const content = message.response.text()

        let jsonStr = content

        // Remove markdown code blocks if present
        if (content.includes('```json')) {
            jsonStr = content.split('```json')[1].split('```')[0].trim()
        } else if (content.includes('```')) {
            jsonStr = content.split('```')[1].split('```')[0].trim()
        }

        const parsed = JSON.parse(jsonStr) as any[]

        // Validate and parse amounts
        const transactions: ParsedTransaction[] = parsed.map((item: any) => {
            const amount = typeof item.amount === 'string'
                ? parseAmount(item.amount)
                : item.amount

            const type = item.type?.toLowerCase() === 'income' ? 'income' : 'expense'
            const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

            let category = item.category || 'Lainnya'
            if (!categories.includes(category)) {
                category = 'Lainnya'
            }

            return {
                type,
                category,
                amount,
                description: (item.description || '').trim()
            }
        })

        return transactions
    } catch (error: any) {
        console.error('Gemini parsing error:', error.message)
        throw new Error(`Failed to parse transaction: ${error.message}`)
    }
}