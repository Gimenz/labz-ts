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