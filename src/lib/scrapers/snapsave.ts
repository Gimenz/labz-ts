import axios from "axios";
import { load } from "cheerio";

const decodeSnapsave = (params: any) => {
    function _0xe8c(d: string, e: number | any, f: number) {
        var g = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/".split("");
        var h = g.slice(0, e);
        var i = g.slice(0, f);
        var j = d.split("").reverse().reduce(function (a: number, b: string, c: number) {
            if (h.indexOf(b) !== -1) return a += h.indexOf(b) * Math.pow(e, c);
        }, 0);
        var k = "";
        while (j > 0) {
            k = i[j % f] + k;
            j = (j - j % f) / f;
        }
        return k || "0";
    }

    function ev(h: string | any[], u: undefined, n: string | any[], t: number, e: string | number, r: string) {
        r = "";
        for (var i = 0, len = h.length; i < len; i++) {
            var s = "";
            while (h[i] !== n[e]) {
                s += h[i];
                i++
            }
            // @ts-ignore
            for (var j = 0; j < n.length; j++) s = s.replace(new RegExp(n[j], "g"), j);
            // @ts-ignore
            r += String.fromCharCode(_0xe8c(s, e, 10) - t)
        }
        return decodeURIComponent(escape(r))
    }

    // @ts-ignore
    return ev(...params)
}

export const SnapSave = async (url: string) => {
    const res = await axios.post(
        'https://snapsave.app/action.php',
        'url=' + encodeURIComponent(url),
        {
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'content-type': 'application/x-www-form-urlencoded',
                origin: 'https://snapsave.app',
                referer: 'https://snapsave.app/id',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
            }
        }
    )

    const codes = res.data.split('}(')[1].split('))')[0]
        .split(',')
        .map((v: string) => v.replace(/"/g, '').trim())
    const decoded = await decodeSnapsave(codes)

    const trimmed = decoded.split('getElementById("download-section").innerHTML = "')[1]
        .split('"; document.getElementById("inputData").remove(); ')[0]
        .replace(/\\(\\)?/g, '')

    let $ = load(trimmed);
    let list = []
    const thumb = $('p.image.is-64x64 > img').attr('src')
    $('tbody > tr').each((i, el) => {
        const td = $(el).find('td')
        let url = td.eq(2).find('a').attr('href') || td.eq(2).find('button').attr('onclick')
        const shouldRender = /get_progressApi/ig.test(url || '')
        if (shouldRender) {
            url = /get_progressApi\('(.*?)'\)/.exec(url || '')?.[1] || url
        }

        list.push({
            quality: td.eq(0).text(),
            url,
            shouldRender
        })
    })
    return {
        thumb,
        list
    };
}