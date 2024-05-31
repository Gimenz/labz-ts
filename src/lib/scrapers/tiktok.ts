import axios from 'axios';

export const TikTokDL = async (url: string) => {
    const videoId = await axios.get(url, {
        maxRedirects: 10
    }).then(res => {
        return new URL(res.request?.res?.responseUrl).pathname.match(/\/(\d+)/)[1]
    })

    const params = {
        'aweme_id': videoId,
        'iid': '7318518857994389254',
        'device_id': '7318517321748022790',
        'device_platform': 'ios',
        'device_type': 'ngamaleMbahe',
    }

    const res = await axios.get(`https://api22-core-c-useast1a.tiktokv.com/aweme/v1/feed/?${new URLSearchParams(params).toString()}`, {
        headers: {
            'User-Agent': '5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
        }
    })
    return res.data.aweme_list.find((x: any) => x.aweme_id == videoId)
}
