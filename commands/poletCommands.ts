import { CacheType, Client, EmbedBuilder, Interaction, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { vinmonopoletKey } from '../client-env'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { Languages } from '../helpers/languageHelpers'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
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

    static async fetchPoletData(rawInteraction?: Interaction<CacheType>, storeId?: string, checkExistance?: boolean) {
        let id = '416'
        if (storeId) id = storeId
        if (rawInteraction) {
            id = DatabaseHelper.getUser(rawInteraction.user.id).favoritePol ?? '416'
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
    private async getOpeningHours(rawInteraction?: Interaction<CacheType>, storeId?: string) {
        const poletData = await PoletCommands.fetchPoletData(rawInteraction, storeId)

        const fmMessage = new EmbedBuilder().setTitle(`${poletData.storeName} (${poletData.address.postalCode}, ${poletData.address.city}) `)

        if (poletData.openingHours.exceptionHours.length) {
            fmMessage.addFields({ name: 'Endre åpningstider', value: 'Det er endrede åpningstider denne uken' })
            poletData.openingHours.exceptionHours.forEach((h) => {
                fmMessage.addFields({
                    name: h.dayOfTheWeek,
                    value: (h.closed ? 'Stengt hele dagen' : `${h.openingTime} - ${h.closingTime}`) + `${h?.message ? '. ' + h.message : ''}`,
                })
            })
        } else {
            fmMessage.addFields({ name: 'Åpningstider', value: 'Polet holder åpent som normalt denne uken' })
        }
        let todayClosing: string = ''
        if (poletData.openingHours.regularHours) {
            poletData.openingHours.regularHours.forEach((rh) => {
                const day = Languages.weekdayTranslate(rh.dayOfTheWeek)
                const isToday = DateUtils.isDateNameToday(day)
                const dayHeader = `${day} ${isToday ? ' (i dag)' : ''}`
                fmMessage.addFields({ name: dayHeader, value: rh.closed ? 'Stengt' : `${rh.openingTime} - ${rh.closingTime}` })
                if (isToday) todayClosing = rh.closingTime
            })
        }
        fmMessage.setDescription(`${this.isStoreOpen(todayClosing)}`)
        this.messageHelper.sendFormattedMessage(rawInteraction?.channel as TextChannel, fmMessage)
    }

    private isStoreOpen(closingTime: string) {
        let split = closingTime.split(':')
        if (split.length === 2) {
            const hourMin: number[] = split.map((t) => Number(t))
            if (DateUtils.isHourMinuteBefore(hourMin[0], hourMin[1])) return 'Åpent'
        }

        return 'Stengt'
    }

    getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: ['polet', 'vinmonopolet', 'alkoholsalg'],
                description:
                    'Sjekk åpningstidene på polet. Bruker polet på Madla Amfi Stavanger som default hvis du ikke har satt et eget med "!mz mittpol" kommandoen',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    // this.getOpeningHours(rawMessage)
                },
                isReplacedWithSlashCommand: 'vinmonopolet',
                category: 'annet',
            },
            {
                commandName: 'mittpol',
                description:
                    'Sett din favorittpol til å brukes når du sjekker åpningstidene med "!mz polet". !mz mittpol <butikk id> (må hentes fra nettsiden)',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    // this.setFavoritePol(rawMessage, messageContent, args)
                },
                isReplacedWithSlashCommand: 'link',
                category: 'annet',
            },
        ]
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'vinmonopolet',
                command: (rawInteraction: Interaction<CacheType>) => {
                    this.getOpeningHours(rawInteraction)
                },
                category: 'drink',
            },
        ]
    }
}
