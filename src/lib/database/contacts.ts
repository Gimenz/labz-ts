import { BaileysEventEmitter, isJidUser } from "@whiskeysockets/baileys"
import NodeCache from "node-cache"
import Database from "../database"
// import type { Contact } from "@whiskeysockets/baileys"

export const cachedContact = new NodeCache({
    stdTTL: 60 * 10, // 10 mins
    useClones: false
})
// const contacts: { [_: string]: Contact } = {}

// const contactsUpsert = (newContacts: Contact[]) => {
//     const oldContacts = new Set(Object.keys(contacts))
//     for (const contact of newContacts) {
//         oldContacts.delete(contact.id)
//         contacts[contact.id] = Object.assign(
//             contacts[contact.id] || {},
//             contact
//         )
//     }

//     return oldContacts
// }

export interface Contact {
    id: string
    lid?: string
    /** name of the contact, you have saved on your WA */
    name?: string
    /** name of the contact, the contact has set on their own on WA */
    notify?: string
    /** I have no idea */
    verifiedName?: string
    // Baileys Added
    /**
     * Url of the profile picture of the contact
     *
     * 'changed' => if the profile picture has changed
     * null => if the profile picture has not been set (default profile picture)
     * any other string => url of the profile picture
     */
    imgUrl?: string | null | 'changed'
    status?: string
}

export const contactsUpsert = async (contact: Contact) => {
    if (cachedContact.has(contact.id)) return cachedContact.get(contact.id) as Contact
    const c = await Database.contact.create({
        data: {
            ...contact,
            id: undefined,
            jid: contact.id,
            name: contact?.name || null,
            notify: contact?.notify || null,
            verifiedName: contact?.verifiedName || null,
            imgUrl: contact?.imgUrl || null,
            status: contact?.status || null
        }
    })

    if (c) cachedContact.set(contact.id, c)

    return c
}

export const contactUpdate = async (contact: Partial<Contact>) => {
    try {
        const newContact = await Database.contact.update({
            where: {
                id: undefined,
                jid: contact.id
            },
            data: { ...contact }
        })

        if (newContact) cachedContact.set(contact.id, newContact)

        return newContact
    } catch {
        return null
    }
}

export const getContacts = async (jid: string = '') => {
    if (cachedContact.has(jid)) return cachedContact.get(jid) as Contact
    if (jid) {
        const c = await Database.contact.findUnique({
            where: { id: jid }
        })
        if (c) cachedContact.set(jid, c)
        return c
    }
    return await Database.contact.findMany()
}

export default {
    bind: (ev: BaileysEventEmitter) => {
        ev.on('messaging-history.set', async ({
            chats: newChats,
            contacts: newContacts,
            messages: newMessages,
            isLatest
        }) => {

            for (const contact of newContacts) {
                if (!isJidUser(contact.id)) return
                const oldContact = await contactsUpsert(contact)
                if (isLatest) {
                    cachedContact.set(oldContact.id, oldContact)
                }
            }
        })
        ev.on('contacts.upsert', async contacts => {
            for (const contact of contacts) {
                if (!isJidUser(contact.id)) return
                console.log(contact);

                await contactsUpsert(contact)
            }
        })
        ev.on('contacts.update', async updates => {
            for (const update of updates) {
                if (!isJidUser(update.id)) return

                if (!cachedContact.has(update.id)) {
                    await contactUpdate(update)
                } else {
                    console.log(update, 'update for non-existant contact');

                }
            }
        })
    }
}