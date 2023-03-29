import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, Interaction } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { vinmonopoletKey } from '../client-env'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { Languages } from '../helpers/languageHelpers'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
const fetch = require('node-fetch')

interface exceptionHours {
    date: string
    openingTime: string
    closingTime: string
    closed: boolean
    message?: string
}
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
        exceptionHours: exceptionHours[]
    }
}
export class PoletCommands extends AbstractCommands {
    static baseStoreDataURL = 'https://apis.vinmonopolet.no/stores/v0/details'
    static baseProductURL = 'https://apis.vinmonopolet.no/products/v0/details-normal'
    static pressProductURL = 'https://www.vinmonopolet.no/api/products'
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
    static async fetchProductDataFromId(productId: string) {
        const data = await fetch(`${PoletCommands.pressProductURL}/${productId}?fields=FULL`, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': vinmonopoletKey,
                'sec-ch-ua-mobile': '?0',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                'accept-encoding': 'gzip, deflate, br',
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'upgrade-insecure-requests': '1',
                'sec-fetch-site': 'same-site',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                scheme: 'https',
                redirect: 'follow',
                encoding: 'null',
                gzip: true,
            },
        })
        return await data.json()
    }

    private async getOpeningHours(rawInteraction: ChatInputCommandInteraction<CacheType>, storeId?: string) {
        await rawInteraction.deferReply()
        const poletData = await PoletCommands.fetchPoletData(rawInteraction, storeId)

        const fmMessage = new EmbedBuilder().setTitle(`${poletData.storeName} (${poletData.address.postalCode}, ${poletData.address.city}) `)

        if (poletData.openingHours.exceptionHours.length) {
            fmMessage.addFields({ name: 'Endre åpningstider', value: 'Det er endrede åpningstider denne måneden' })

            poletData.openingHours.exceptionHours.forEach((h, index) => {
                const dateName = moment(h?.date).format('dddd')
                if (h.openingTime !== '10:00' || h.closingTime !== '18:00') {
                    let message = ''
                    if (h.openingTime && h.closingTime) {
                        //Some times days with normal opening hours are added to the exception list, so check if the hours actually deviate
                        message = `Forkortet åpningstid. Det er åpent mellom ${h.openingTime} - ${h.closingTime}`
                    } else {
                        message = h?.message ? h.message : 'Ingen forklaring'
                    }
                    fmMessage.addFields({
                        name: dateName ? `${dateName} (${h?.date})` : 'Ukjent dag',
                        value: `${message}`,
                    })
                }
            })
        } else {
            fmMessage.addFields({ name: 'Åpningstider', value: `Polet holder åpent som normalt denne uken` })
        }
        let todayClosing: string = ''
        if (poletData.openingHours.regularHours) {
            poletData.openingHours.regularHours.forEach((rh) => {
                const day = Languages.weekdayTranslate(rh.dayOfTheWeek)
                const isToday = DateUtils.isDateNameToday(day)

                const hr = Number(rh.closingTime.split(':')[0])
                const mn = Number(rh.closingTime.split(':')[1])
                const closingTime = moment().hour(hr).minutes(mn)
                const timeUntil = {
                    hours: closingTime.diff(moment(), 'hour'),
                    minutes: closingTime.diff(moment(), 'minute') % 60,
                }

                const timeToCloseText =
                    timeUntil.hours > 0 || (timeUntil.hours === 0 && timeUntil.minutes > 0)
                        ? `, stenger om ${timeUntil.hours} timer og ${timeUntil.minutes} minutter`
                        : 'Stengt'
                const dayHeader = `${day} ${isToday ? ` (i dag ${timeToCloseText})` : ''}`
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

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'vinmonopolet',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.handleVinmonopoletCommand(rawInteraction)
                },
            },
        ]
    }
}
