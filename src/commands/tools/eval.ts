import util from 'util'
import { ICommand } from "../../types";

export default <ICommand>{
    name: '>',
    category: 'tools',
    description: 'ngeval masseh',
    execute: async ({ m, client, msg, axios, fs }) => {
        let syntaxerror = require('syntax-error');
        let _return;
        let _syntax = '';
        let _text = m.text.slice(2);
        try {
            let i = 15
            //@ts-expect-error
            let exec = new (async () => { }).constructor('print', 'msg', 'require', 'client', 'm', 'axios', 'fs', 'exec', _text);
            _return = await exec.call(client, (...args: any) => {
                if (--i < 1) return
                console.log(...args)
                return m.reply(util.format(...args))
            }, msg, require, client, m, axios, fs, exec);
        } catch (e) {
            let err = syntaxerror(_text, 'Execution Function', {
                allowReturnOutsideFunction: true,
                allowAwaitOutsideFunction: true
            })
            if (err) _syntax = '```' + err + '```\n\n'
            _return = e
        } finally {
            m.reply(_syntax + util.format(_return))
        }
    }
}