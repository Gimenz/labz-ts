import momen from "moment-timezone"
momen.locale('id')
momen.tz.setDefault('Asia/Jakarta')

export default momen


const rtf = new Intl.RelativeTimeFormat('jv', { numeric: "auto" })
/**
 * It is the caller's responsibility to handle cut-off logic
 * such as deciding between displaying "in 7 days" or "in 1 week".
 * This API does not support relative dates involving compound units.
 * e.g "in 5 days and 4 hours".
 *
 * @param value -  Numeric value to use in the internationalized relative time message
 *
 * @param unit - [Unit](https://tc39.es/ecma402/#sec-singularrelativetimeunit) to use in the relative time internationalized message.
 *
 * @return Internationalized relative time message as string
 *
 * [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat/format).
 */
export const rtfFormat = (value: number, unit: Intl.RelativeTimeFormatUnit) => {
    return rtf.format(value, unit)
}

export const monospace = (str: string) => {
    return '```' + str + '```'
}

export const inline = (str: string) => {
    return '`' + str + '`'
}

export const capitalize = (words: string) => {
    return words
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export const cutStr = (str: string) => {
    if (str.length >= 20) {
        return `${str.substring(0, 500)}`;
    } else {
        return `${str}`;
    }
};

export const convertTime = (seconds: number, hour = false) => {
    const format = (val: number) => `${Math.floor(val)}`.slice(-2)
    const hours = seconds / 3600
    const minutes = (seconds % 3600) / 60
    const res = hour ? [hours, minutes, seconds % 60] : [minutes, seconds % 60]

    return res.map(format)
}