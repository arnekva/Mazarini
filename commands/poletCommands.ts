import { Client, Message, MessageEmbed, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { vinmonopoletKey } from '../client-env'
import { ICommandElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
const fetch = require('node-fetch')
interface openingHours {
    validFromDate: string
    dayOfTheWeek: string
    openingTime: string
    closingTime: string
    closed: boolean
    message?: string
}
interface PoletData {
    storeId: string
    storeName: string
    status: string
    address: {
        street: string
        postalCode: string
        city: string
    }
    telephone: string
    email: string
    openingHours: {
        regularHours: openingHours[]
        exceptionHours: openingHours[]
    }
}
export class PoletCommands extends AbstractCommands {
    static baseURL = 'https://apis.vinmonopolet.no/stores/v0/details'
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    static async fetchPoletData(rawMessage?: Message, storeId?: string, checkExistance?: boolean) {
        let id = '416'
        if (storeId) id = storeId
        if (rawMessage) {
            id = DatabaseHelper.getUser(rawMessage.author.id).favoritePol ?? '416'
        }

        const data = await fetch(`${PoletCommands.baseURL}?storeId=${id}`, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': vinmonopoletKey,
            },
        })
        return (await data.json())[0] as PoletData
    }
    /** Brukerens pol fra DB overstyrer storeId som sendes inn */
    private async getOpeningHours(rawMessage?: Message, storeId?: string) {
        const poletData = await PoletCommands.fetchPoletData(rawMessage, storeId)
        const translateStatus = (s: string) => {
            if (s === 'Open') return 'Åpent'
            else return 'Stengt'
        }
        const fmMessage = new MessageEmbed()
            .setTitle(`${poletData.storeName} (${poletData.address.postalCode}, ${poletData.address.city}) `)
            .setDescription(`${translateStatus(poletData.status)}`)

        if (poletData.openingHours.exceptionHours.length) {
            fmMessage.addField('Endre åpningstider', 'Det er endrede åpningstider denne uken')
            poletData.openingHours.exceptionHours.forEach((h) => {
                fmMessage.addField(
                    h.dayOfTheWeek,
                    (h.closed ? 'Stengt hele dagen' : `${h.openingTime} - ${h.closingTime}`) + `${h?.message ? '. ' + h.message : ''}`
                )
            })
        } else {
            fmMessage.addField('Åpningstider', 'Polet holder åpent som normalt denne uken')
        }
        if (poletData.openingHours.regularHours) {
            poletData.openingHours.regularHours.forEach((rh) => {
                fmMessage.addField(rh.dayOfTheWeek, rh.closed ? 'Stengt' : `${rh.openingTime} - ${rh.closingTime}`)
            })
        }
        this.messageHelper.sendFormattedMessage(rawMessage?.channel as TextChannel, fmMessage)
    }

    private async setFavoritePol(message: Message, content: string, args: string[]) {
        const storeId = parseInt(args[0])
        if (!isNaN(storeId) && storeId < 1000) {
            const store = await PoletCommands.fetchPoletData(undefined, storeId.toString(), true)
            if (!store) return message.reply('Det finnes ingen butikk med id ' + storeId)
            const user = DatabaseHelper.getUser(message.author.id)
            user.favoritePol = storeId.toString()
            DatabaseHelper.updateUser(user)
        } else {
            message.reply('ID-en er ikke gyldig')
        }
    }

    getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: ['polet', 'vinmonopolet', 'alkoholsalg'],
                description:
                    'Sjekk åpningstidene på polet. Bruker polet på Madla Amfi Stavanger som default hvis du ikke har satt et eget med "!mz mittpol" kommandoen',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.getOpeningHours(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'mittpol',
                description:
                    'Sett din favorittpol til å brukes når du sjekker åpningstidene med "!mz polet". !mz mittpol <butikk id> (må hentes fra nettsiden)',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.setFavoritePol(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
        ]
    }
}
