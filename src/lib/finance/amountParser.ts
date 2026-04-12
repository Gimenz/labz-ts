/**
 * Parse Indonesian amount format
 * Examples: "50k", "1.5jt", "80ribu", "1000", "50.000"
 */
export function parseAmount(input: string): number {
    const raw = input.toLowerCase().trim()
        .replace(/rp\.?\s*/g, '')
        .replace(/idr\s*/g, '')
        .replace(/\s+/g, '')

    let multiplier = 1
    let value = raw

    // Check suffixes
    if (value.match(/juta|jt$/)) {
        multiplier = 1_000_000
        value = value.replace(/juta|jt$/g, '')
    } else if (value.match(/ribu|rb|k$/)) {
        multiplier = 1_000
        value = value.replace(/ribu|rb|k$/g, '')
    }

    // Handle decimal separators (European or Indonesian style)
    if (value.includes(',') && value.includes('.')) {
        const lastComma = value.lastIndexOf(',')
        const lastDot = value.lastIndexOf('.')
        if (lastComma > lastDot) {
            // Format: 1.000,50 (Indonesian)
            value = value.replace(/\./g, '').replace(',', '.')
        } else {
            // Format: 1,000.50 (English)
            value = value.replace(/,/g, '')
        }
    } else if (value.includes(',')) {
        value = value.replace(',', '.')
    } else if (value.includes('.')) {
        const parts = value.split('.')
        if (parts.length === 2 && parts[1].length === 3) {
            // Thousands separator: 1.000
            value = value.replace(/\./g, '')
        } else if (parts.length > 2) {
            // Multiple dots, remove all except last
            const lastPart = parts[parts.length - 1]
            value = parts.slice(0, -1).join('').replace(/\./g, '') + '.' + lastPart
        }
    }

    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) {
        throw new Error(`Invalid amount: ${input}`)
    }

    return num * multiplier
}

/**
 * Format amount to IDR string
 * Examples: 50000 => "Rp50.000"
 */
export function formatAmount(amount: number): string {
    return `Rp${amount.toLocaleString('id-ID')}`
}