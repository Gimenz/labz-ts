import { AnyMessageContent, GroupMetadata, MessageType, MiscMessageGenerationOptions, proto } from "@whiskeysockets/baileys"

/**
 * Message serialize
 */
export declare type MessageSerialize = {
    /** Properties of a Message. */
    message: proto.IMessage

    /** Properties of a MessageKey. */
    key: proto.IMessageKey

    /** Message Id */
    id: string

    /** Is message from Bot? */
    isBot: boolean

    /** Is message from group chats? */
    isGroup: boolean

    /** Message remoteJid */
    from: string

    /** is message fromMe? | bot message ? */
    fromMe: boolean

    /** Type of a message */
    type: MessageType

    /** Message sender */
    sender: string

    /** sender device */
    device: string

    /** Body / content message  */
    text: string

    /** Mentions user list */
    mentions: string[]

    /** Is message viewonce? */
    viewOnce: boolean

    reply: (text: string, options?: AnyMessageContent) => Promise<proto.WebMessageInfo | undefined>

    // additional properties
    /** Message timestamps */
    timestamps?: number
    /** Chat expiration for ephemeral message */
    expiration?: number
    /** Nickname for users */
    pushname?: string
    /** WebMessageInfo status */
    status?: number

    /** Properties of a Quoted Message. */
    quoted: MessageSerialize | null
}
// export interface MessageContext {
//     body: string
//     isGroup: boolean
//     from: string
//     id: string | null | undefined
//     fromMe: boolean | null | undefined
//     sender: string | null | undefined
//     pushname: string
//     device: string | null | undefined
//     timestamp: number
//     contextInfo: proto.IContextInfo | null | undefined

//     quoted: WAMessageContent | null | undefined
//     key: proto.IMessageKey
//     type: MessageType

//     reply: (text: string, options?: AnyMessageContent | MiscMessageGenerationOptions) => Promise<proto.WebMessageInfo | undefined>
//     download: () => Promise<Buffer>
// }

export type MsgOpts = {
    foceForward: boolean
}