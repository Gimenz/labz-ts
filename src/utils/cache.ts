import { existsSync, readFileSync, writeFileSync } from 'fs'

export const CACHE_PATH = './tmp/igstory.json'
export const MAX_AGE_STORY = 6 * 60 * 1000 // 30 menit
export const MAX_AGE_HIGHLIGHT = 168 * 60 * 60 * 1000 // 6 jam

export function loadCache() {
    if (!existsSync(CACHE_PATH)) return {}
    try {
        return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
    } catch {
        return {}
    }
}

export function saveCache(data: any) {
    writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2))
}