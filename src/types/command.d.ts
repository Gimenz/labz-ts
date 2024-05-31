import { Collection } from "@discordjs/collection";
import { proto, WAMessage, WASocket } from "@whiskeysockets/baileys";
import type { Axios } from "axios";
import type fs from 'fs'
import { MessageSerialize } from "./message";

interface opts {
    [_: string]: any
}

export type ICommand = {
    aliases?: any;
    name: string
    category: string
    description: string
    execute: (args: execArgs) => Promise<any>
}

declare type execArgs = {
    m: MessageSerialize
    client: WASocket
    commands: Collection<string, ICommand>
    msg: proto.IWebMessageInfo
    axios: Axios,
    fs: fs
    args: string[]
    [_: string]: any
}

export type IEvent = {
    execute: (obj: execArgs) => unknown
}