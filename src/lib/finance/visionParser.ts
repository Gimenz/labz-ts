import { GoogleGenerativeAI } from '@google/generative-ai'
import * as fs from 'fs'
import * as path from 'path'

interface ParsedItem {
    description: string
    quantity: number
    price: number
    category: string
}

export interface ReceiptData {
    merchant: string
    items: ParsedItem[]
    totalAmount: number
}

const ITEM_CATEGORIES = [
    'Elektronik', 'Otomotif', 'Makanan', 'Fashion',
    'Belanja', 'Transportasi', 'Kesehatan', 'Lainnya'
]

/**
 * Parse receipt/payment screenshot using Gemini Vision AI
 * Handles: Struk kasir, QRIS, Dana, Shopee, OVO, GCash, etc
 */
export async function parseReceiptImage(imageSource: string): Promise<ReceiptData> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured')
    }

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' })

    // Convert image to base64 untuk Gemini
    let imageData: string

    try {
        if (imageSource.startsWith('data:')) {
            // Already base64
            imageData = imageSource.split(',')[1]
        } else if (!imageSource.startsWith('http')) {
            // Local file
            const buffer = fs.readFileSync(imageSource)
            imageData = buffer.toString('base64')
        } else {
            // URL - fetch dulu
            const response = await fetch(imageSource)
            const buffer = await response.arrayBuffer()
            imageData = Buffer.from(buffer).toString('base64')
        }
    } catch (error: any) {
        throw new Error(`Failed to read image: ${error.message}`)
    }

    const systemPrompt = `Kamu adalah parser struk/invoice/payment screenshot untuk Indonesia.
Analyze gambar dan ekstrak informasi transaksi.

EXTRACT:
1. Merchant name (Shopee/Tokopedia/TikTok Shop/Indomaret/Alfamart/Dana/QRIS/OVO/GCash/etc)
2. Items dengan: description, quantity, price, category
3. Total amount

KATEGORI UNTUK ITEMS:
${ITEM_CATEGORIES.join(', ')}

ATURAN:
- Jika quantity tidak terlihat, assume 1
- Extract prices dalam IDR
- Assign kategori yang PALING COCOK
- totalAmount = sum dari (price × quantity)
- Jika merchant tidak jelas, guess dari context (default: "Online")
- Description harus LENGKAP dan JELAS
- IGNORE: tax, discount, shipping (hanya items!)
- Recognize nama produk Indonesia yang umum dan enhance jika perlu
- Jika struk payment app (Dana, QRIS, OVO), extract: merchant/toko, nominal, dan deskripsi
- Jika ada indikasi/detail dipotong voucher/diskon, ambil value total setelah diskon, contoh harga 100k ada detail diskon/voucher 20k, price jadi 80k

OUTPUT HANYA VALID JSON (no markdown):
{
  "merchant": "Shopee",
  "items": [
    {
      "description": "USB Kabel Type C",
      "quantity": 1,
      "price": 25000,
      "category": "Elektronik"
    }
  ],
  "totalAmount": 25000
}`

    try {
        console.log('🖼️  Analyzing receipt image with Gemini Vision...')

        const response = await model.generateContent([
            systemPrompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageData
                }
            }
        ])

        const content = response.response.text()

        let jsonStr = content
        if (content.includes('```json')) {
            jsonStr = content.split('```json')[1].split('```')[0].trim()
        } else if (content.includes('```')) {
            jsonStr = content.split('```')[1].split('```')[0].trim()
        }

        const parsed = JSON.parse(jsonStr) as ReceiptData

        if (!parsed.merchant || !parsed.items || parsed.items.length === 0) {
            throw new Error('Invalid parsed data from receipt')
        }

        // Validate categories
        for (const item of parsed.items) {
            if (!item.category || !ITEM_CATEGORIES.includes(item.category)) {
                item.category = 'Belanja'
            }
        }

        console.log('✅ Receipt parsed successfully')
        return parsed
    } catch (error: any) {
        console.error('Vision parsing error:', error.message)
        throw new Error(`Failed to parse receipt: ${error.message}`)
    }
}

/**
 * Keep extractTextFromImage untuk compatibility (opsional)
 */
export async function extractTextFromImage(imageSource: string): Promise<string> {
    console.log('⚠️  extractTextFromImage deprecated, use parseReceiptImage instead')
    return ''
}