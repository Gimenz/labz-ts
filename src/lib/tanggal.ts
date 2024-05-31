/**
 * Author  : Gimenz
 * Name    : nganu
 * Version : 1.0
 * Update  : 09 Januari 2022
 * 
 * If you are a reliable programmer or the best developer, please don't change anything.
 * If you want to be appreciated by others, then don't change anything in this script.
 * Please respect me for making this tool from the beginning.
 */

import moment from 'moment-timezone'
moment.tz.setDefault('Asia/Jakarta').locale('jv');

// some part of this code is copied from => https://mumet.ndas.se/

export class Hijri {
    year: number;
    month: number;
    day: number;
    constructor(year = 1421, month = 11, day = 28) {
        this.year = year;
        this.month = month;
        this.day = day;
    }

    isGregLeapYear(year) {
        return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    }

    gregToFixed(year, month, day) {
        var a = Math.floor((year - 1) / 4);
        var b = Math.floor((year - 1) / 100);
        var c = Math.floor((year - 1) / 400);
        var d = Math.floor((367 * month - 362) / 12);
        var e;
        if (month <= 2) e = 0;
        else if (month > 2 && this.isGregLeapYear(year)) e = -1;
        else e = -2;
        return 1 - 1 + 365 * (year - 1) + a - b + c + d + e + day;
    }

    toFixed() {
        return (
            this.day +
            Math.ceil(29.5 * (this.month - 1)) +
            (this.year - 1) * 354 +
            Math.floor((3 + 11 * this.year) / 30) +
            227015 - 1
        );
    }

    hijriToString() {
        var months = new Array(
            'Suro',
            'Sapar',
            'Mulud',
            'Bakdo Mulud',
            'Jumadilawal',
            'Jumadilakhir',
            'Rejeb',
            'Ruwah',
            'Poso',
            'Sawal',
            "Dulkai'dah",
            'Besar'
        );
        return this.day + ' ' + months[this.month - 1] + ' ' + this.year;
    }

    fixedToHijri(f) {
        var i = new Hijri(1100, 1, 1);
        i.year = Math.floor((30 * (f - 227015) + 10646) / 10631);
        var i2 = new Hijri(i.year, 1, 1);
        var m = Math.ceil((f - 29 - i2.toFixed()) / 29.5) + 1;
        i.month = Math.min(m, 12);
        i2.year = i.year;
        i2.month = i.month;
        i2.day = 1;
        i.day = f - i2.toFixed() + 1;
        return i;
    }

    getFormattedDate = () => {
        // get hijriyah date
        let y = moment().year()
        let m = moment().month()
        let d = moment().date()
        m++
        const fixed = this.gregToFixed(y, m, d)
        const h = this.fixedToHijri(fixed)

        // get javanese date
        const pasaran = new Array('Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon');
        const hari = moment().format('dddd');
        const dino = moment().format('DD MMMM YYYY');
        const dinokapisan = moment('2014-01-27').toDate().getTime();
        const dinoKapindho = moment().toDate().getTime();
        const selisih = Math.floor(Math.abs(dinokapisan - dinoKapindho) / 86400000);
        const a = pasaran[selisih % 5];
        var tgl = `${hari} ${a}, ${dino}`;
        return {
            hijriyah: h.hijriToString(),
            jawa: tgl
        }
    }
}
