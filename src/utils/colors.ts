import chalk from 'chalk';
import moment from 'moment';

/**
 * 
 * @param text text what you want to print
 * @param color color of the text, can be colorhex o
 * @returns 
 */
export const colorize = (text: any, color?: string) => {
    return !color
        ? chalk.green(text)
        : color.startsWith('#')
            ? chalk.hex(color)(text)
            : chalk.keyword(color)(text);
};

export const bgColor = (text: any, color?: string) => {
    return !color
        ? chalk.bgGreen(text)
        : color.startsWith('#')
            ? chalk.bgHex(color)(text)
            : chalk.keyword(color)(text);
}

// ===== WARNA =====
export const cHex = {
    timestamp: '#f8fa80',
    group: '#0067ee',   // teks pendukung, label "in", "from", "›"
    user: '#74c0ff',   // nama orang, info utama
    msg: '#e6e6e6',   // isi pesan (cutStr)

    sys: '#56a8ff',
    success: '#54d666',   // sama kayak muted, sengaja redup
    cmd: '#10ff58',
    warn: '#ff9100',
    err: '#fc6d6d',
}