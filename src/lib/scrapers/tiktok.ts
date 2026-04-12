import axios from 'axios';
import { randomUUID } from 'crypto';

export const TikTokDL = async (url: string) => {
    const videoId = await axios.get(url, {
        maxRedirects: 10
    }).then(res => {
        return new URL(res.request?.res?.responseUrl).pathname.match(/\/(\d+)/)[1]
    })


    const randomChar = (char: string, range: number) => {
        let chars = ""
        for (let i = 0; i < range; i++) {
            chars += char[Math.floor(Math.random() * char.length)]
        }
        return chars
    }

    const generateDeviceId = () => {
        // Generate 19-digit number
        const prefix = "7" // Common prefix for device_id
        const random = randomChar("0123456789", 18)
        return `${prefix}${random}`
    }

    const params = {
        manifest_version_code: "2018111632",
        update_version_code: "2018111632",
        version_name: "1.1.9",
        version_code: "2018111632",
        build_number: "1.1.9",
        'aweme_id': videoId,
        'iid': generateDeviceId(),
        device_id: generateDeviceId(),
        openudid: randomChar("0123456789abcdef", 16),
        uuid: randomChar("1234567890", 16),
        _rticket: Date.now() * 1000,
        channel: "googleplay",
        app_name: "musical_ly",
        device_brand: "Google",
        device_type: "Pixel 4",
        device_platform: "android",
        resolution: "1080*1920",
        dpi: 420,
        os_version: "10",
        os_api: "29",
        carrier_region: "US",
        sys_region: "US",
        region: "US",
        timezone_name: "America/New_York",
        timezone_offset: "-14400",
        ac: "wifi",
        mcc_mnc: "310260",
        is_my_cn: 0,
        ssmix: "a",
        as: "a1qwert123",
        cp: "cbfhckdckkde1"
    };

    const res = await axios.options(`https://api16-normal-useast5.tiktokv.us/aweme/v1/feed/?${new URLSearchParams(params).toString()}`, {
        headers: {
            'User-Agent': 'com.zhiliaoapp.musically/300904 (2018111632; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)',
            'Referer': 'https://www.tiktok.com/',
            'Cookie': process.env.TIKTOK_COOKIE
        }
    })
    return res.data.aweme_list.find((x: any) => x.aweme_id == videoId)
}
