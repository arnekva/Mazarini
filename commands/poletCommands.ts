import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    Interaction,
    Message,
} from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { vinmonopoletKey } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'

import { Languages } from '../helpers/languageHelpers'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'

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
        gpsCoord: string
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
    static pressProductURL = 'https://www.vinmonopolet.no/vmpws/v2/vmp/products'
    static baseStoreID = '416'

    constructor(client: MazariniClient) {
        super(client)
    }

    static async fetchPoletData(storeId: string, rawInteraction?: Interaction<CacheType>) {
        let id = PoletCommands.baseStoreID
        if (storeId) id = storeId

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
                accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'upgrade-insecure-requests': '1',
                'sec-fetch-site': 'same-site',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                scheme: 'https',
                redirect: 'follow',
                encoding: 'null',
            },
        })
        return await data.json()
    }

    private async fetchProductStock(productId: string, latitude: string, longitude: string) {
        const data = await fetch(
            `${PoletCommands.pressProductURL}/${productId}/stock?pageSize=10&currentPage=0&fields=BASIC&latitude=${latitude}&longitude=${longitude}`,
            {
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': vinmonopoletKey,
                    'sec-ch-ua-mobile': '?0',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'accept-encoding': 'gzip, deflate, br',
                    accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'upgrade-insecure-requests': '1',
                    'sec-fetch-site': 'same-site',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-user': '?1',
                    'sec-fetch-dest': 'document',
                    scheme: 'https',
                    redirect: 'follow',
                    encoding: 'null',
                },
            }
        )
        return await data.json()
    }

    public async getProductStockForUser(interaction: ButtonInteraction<CacheType>) {
        const params = interaction.customId.split(';')
        const productId = params[1]
        const user = await this.client.db.getUser(interaction.user.id)
        const favoritePol = user.favoritePol
        if (favoritePol && favoritePol.latitude && favoritePol.longitude) {
            const stockData = await this.fetchProductStock(productId, favoritePol.latitude, favoritePol.longitude)
            const embed = new EmbedBuilder().setTitle(`${params[2]}`)
            const stores = stockData.stores.slice(0, 3)
            if (stores?.length === 0) {
                embed.setDescription(`${interaction.user.username} har ingen vinmonopol i nærheten med varen på lager`)
            } else {
                embed.setDescription(`${interaction.user.username} sine ${stores?.length ?? 0} nærmeste vinmonopol`)
            }
            stores.forEach((store) => {
                embed.addFields({ name: store.pointOfService.displayName, value: `Antall: ${store.stockInfo.stockLevel}`, inline: false })
            })
            this.messageHelper.replyToInteraction(interaction, embed)
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Du må linka polet ditt')
        }
    }

    private async getOpeningHours(rawInteraction: ChatInputCommandInteraction<CacheType>, storeId?: string) {
        await rawInteraction.deferReply()
        const user = await this.client.db.getUser(rawInteraction.user.id)
        const poletData = await PoletCommands.fetchPoletData(storeId ?? user.favoritePol.id, rawInteraction)

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
                        ? `Stenger om ${timeUntil.hours} timer og ${timeUntil.minutes} minutter`
                        : 'Stengt'
                if (isToday) fmMessage.setDescription(`${timeToCloseText}`)
                const dayHeader = `${day} ${isToday ? ` (i dag)` : ''}`
                fmMessage.addFields({ name: dayHeader, value: rh.closed ? 'Stengt' : `${rh.openingTime} - ${rh.closingTime}` })
                if (isToday) todayClosing = rh.closingTime
            })
        }
        // fmMessage.setDescription(`${this.isStoreOpen(todayClosing)}`)
        this.messageHelper.replyToInteraction(rawInteraction, fmMessage, { hasBeenDefered: true })
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

    //TODO & FIXME: Move this out of commandRunner - also remove commented fields
    static async checkForVinmonopolContent(message: Message, messageHelper: MessageHelper) {
        const content = message.content
        if (content.includes('https://www.vinmonopolet.no/')) {
            const id = content.split('/p/')[1]
            if (id && !isNaN(Number(id))) {
                // try {
                const data = await PoletCommands.fetchProductDataFromId(id)

                if (data) {
                    const hasDesc = !!data.description.trim()
                    const embed = EmbedUtils.createSimpleEmbed(`${data.name}`, `${hasDesc ? data.description : data.taste}`, [
                        { name: `Lukt`, value: `${data.smell}` },
                        { name: `Pris`, value: `${data.price.formattedValue}`, inline: true },
                        { name: `Type`, value: `${data.main_category.name}`, inline: true },
                        { name: `Årgang`, value: `${data.year === '0000' ? 'Ukjent' : data.year}`, inline: true },
                        { name: `Volum`, value: `${data.volume.formattedValue}`, inline: true },
                        { name: `Land`, value: `${data.main_country.name}`, inline: true },
                        { name: `Alkohol`, value: `${data.alcohol.formattedValue}`, inline: true },

                        { name: `Stil`, value: `${data.style?.name}`, inline: true },
                    ])
                    /** In case of wines, it will be something like [Pinot Noir 80%, Merlot 20%]
                     * For liquers, ciders, etc. it may only be "Plommer, epler", since they dont display the percentage of the mix.
                     */
                    if (data.raastoff) {
                        embed.addFields({
                            name: `Innhold`,
                            value: `${data.raastoff.map((rs) => `${rs.name} ${rs.percentage ? '(' + rs.percentage + '%)' : ''}`).join(', ')}`,
                            inline: true,
                        })
                    }

                    //Make sure to add some text if field does not exist, since the embed will crash if a field is empty
                    //Also, in case a data value doesn't exist, we set it to "ukjent" for a better look
                    embed?.data?.fields.forEach((f) => {
                        if (!f.value) f.value = 'Ukjent'
                        if (f.value.includes('undefined')) f.value = f.value.replace('undefined', 'Ukjent')
                    })

                    //Possible formats: product, thumbnail, zoom, cartIcon and superZoom (some may be identical or not exist at all.)
                    //"zoom" seems to be the version used on the website, but still not all products have photos so it might be undefined
                    const imageUrl = data.images.filter((img: any) => img.format === 'zoom')[0]?.url
                    if (imageUrl) embed.setThumbnail(imageUrl)
                    embed.setURL(`https://www.vinmonopolet.no${data.url}`)

                    embed.setFooter({
                        text: `Produsent: ${data.main_producer.name}, Distrikt: ${data.district?.name}, Sub-distrikt: ${data.sub_District?.name}`,
                    })
                    const poletStockButton = new ActionRowBuilder<ButtonBuilder>()
                    poletStockButton.addComponents(
                        new ButtonBuilder({
                            custom_id: `POLET_STOCK;${data.code};${data.name}`,
                            style: ButtonStyle.Primary,
                            label: `Varelagerstatus`,
                            disabled: false,
                            type: 2,
                        })
                    )
                    message.suppressEmbeds()
                    messageHelper.sendMessage(message.channelId, { embed: embed })
                    messageHelper.sendMessage(message.channelId, { components: [poletStockButton] })
                }
                // }
                //  catch (error) {

                //     messageHelper.sendLogMessage(`Klarte ikke hente produktinfo for id ${id}.\n${error}`)
                // }
            }
        }
    }

    getAllInteractions() {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'vinmonopolet',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleVinmonopoletCommand(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'POLET_STOCK',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.getProductStockForUser(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
