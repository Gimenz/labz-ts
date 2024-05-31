import axios from "axios";
import moment from "moment-timezone";
import { ICommand } from "../../types";
import { capitalize, inline, monospace } from "../../utils";
import momen from "../../utils/format";
import { BMKG, kodeAngin, kodeCuaca } from 'bmkg-api'

export default <ICommand>{
    name: 'cuaca',
    aliases: ['c'],
    category: 'tools',
    description: 'cuaca masseh',
    execute: async ({ m }) => {
        try {
            const { lokasi, cuaca } = await BMKG.cuacaApp('5010174');

            let _text = `*> Prakiraan Cuaca*\n`
            for (let a of Object.entries(lokasi[0]).filter(v => v[0] == 'kec' || v[0] == 'kabkota').concat([['date', momen(cuaca[0].tgl).format('dddd')]])) {
                _text += `${inline(capitalize(a[0]))} : ${(a[1])}\n`
            }

            for (let d of cuaca[0]) {
                _text += `\n*${moment(d.local_datetime).format('HH:mm')}*\n`
                _text += `├ ${d.weather_desc} ${kodeCuaca[d.weather]}\n`
                _text += `├ Hum : ${d.hu} %\n`
                _text += `├ Temp : ${d.t} ℃\n`
                _text += `└ Wind : ${d.ws}km/h _${kodeAngin[d.wd]}_\n`
            }

            _text += `\n_source: bmkg.go.id_`
            m.reply(_text)
        } catch (error) {
            console.log(error);

        }
    }
}