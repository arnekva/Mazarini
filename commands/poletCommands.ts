import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, Interaction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { vinmonopoletKey } from '../client-env'
import { ICommandElement, IInteractionElement } from '../general/commands'
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
    static baseStoreDataURL = 'https://apis.vinmonopolet.no/stores/v0/details'
    static baseProductURL = 'https://apis.vinmonopolet.no/products/v0/details-normal'
    static baseStoreID = '416'
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    static async fetchPoletData(rawInteraction?: Interaction<CacheType>, storeId?: string) {
        let id = PoletCommands.baseStoreID
        if (storeId) id = storeId
        if (rawInteraction) {
            id = DatabaseHelper.getUser(rawInteraction.user.id).favoritePol ?? '416'
        }

        const data = await fetch(`${PoletCommands.baseStoreDataURL}?storeId=${id}`, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': vinmonopoletKey,
            },
        })
        return (await data.json())[0] as PoletData
    }

    static async fetchProductData(productNameContains: string) {
        const data = await fetch(`${PoletCommands.baseProductURL}?productShortNameContains=${productNameContains}`, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': vinmonopoletKey,
            },
        })
        return (await data.json())[0] as PoletData
    }

    private async getOpeningHours(rawInteraction: ChatInputCommandInteraction<CacheType>, storeId?: string) {
        await rawInteraction.deferReply()
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
        this.messageHelper.replyToInteraction(rawInteraction, fmMessage, undefined, true)
    }

    private async handleVinmonopoletCommand(interaction: ChatInputCommandInteraction<CacheType>) {
        await this.getOpeningHours(interaction)
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
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'vinmonopolet',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.handleVinmonopoletCommand(rawInteraction)
                },
                category: 'drink',
            },
        ]
    }
}
