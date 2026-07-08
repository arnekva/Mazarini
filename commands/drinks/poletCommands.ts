import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { environment, vinBearer, vinKey, vinmonopoletKey, vinUserAgent } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { EmojiHelper } from '../../helpers/emojiHelper'

import { Languages } from '../../helpers/languageHelpers'
import { MessageHelper } from '../../helpers/messageHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { BarcodeUtils } from '../../utils/barcodeUtils'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'
import { FetchUtils } from '../../utils/fetchUtils'
import { MentionUtils } from '../../utils/mentionUtils'
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
        gpsCoord: string
    }
    telephone: string
    email: string
    openingHours: {
        regularHours: openingHours[]
        exceptionHours: exceptionHours[]
    }
}
/** Only implemented used variables - can be expanded if needed */
interface VGRating {
    lead: string
    grade_num: number
    score_num: number
    product_id: string
    created_at: string
    author_description: string
}
export class PoletCommands extends AbstractCommands {
    static baseStoreDataURL = 'https://apis.vinmonopolet.no/stores/v0/details'
    static baseProductURL = 'https://apis.vinmonopolet.no/products/v0/details-normal'
    static pressProductURL = 'https://www.vinmonopolet.no/vmpws/v3/vmp/products'
    static stockURL = 'https://www.vinmonopolet.no/vmpws/v2/vmp/products'
    static barCodeURL = 'https://www.vinmonopolet.no/vmpws/v3/vmp/products/barCodeSearch'
    static vgRatingUrl = 'https://api.vg.no/insanity-cms/wines'
    static baseStoreID = '416'

    constructor(client: MazariniClient) {
        super(client)
    }

    static async fetchPoletData(storeId: string) {
        let id = PoletCommands.baseStoreID
        if (storeId) id = storeId

        const data = await FetchUtils.fetchWithTimeout(`${PoletCommands.baseStoreDataURL}?storeId=${id}`, {
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
    static async fetchProductDataFromId(productId: string, isBarCode?: boolean) {
        const data = await fetch(`${isBarCode ? PoletCommands.barCodeURL : PoletCommands.pressProductURL}/${productId}?fields=FULL`, {
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
                gzip: true,
            },
        })

        return await data.json()
    }

    static async fetchScore(barCode: string) {
        //TODO: Allow normal search if no barcode (i.e. search for product id) https://wines-ws.vinify.app/wines/search/4878001

        const data = await FetchUtils.fetchWithTimeout(`https://wines-ws.vinify.app/wines?gtin=${barCode}`, {
            method: 'GET',
            headers: {
                method: 'GET',
                path: `/wines?gtin=${barCode}`,
                'x-device-type': 'ios',
                'x-api-key': vinKey,
                'user-agent': vinUserAgent,
                authorization: `Bearer ${vinBearer}`,
            },
        })

        return await data.json()
    }

    private async fetchProductStock(productId: string, latitude: string, longitude: string) {
        const data = await fetch(
            `${PoletCommands.stockURL}/${productId}/stock?pageSize=10&currentPage=0&fields=BASIC&latitude=${latitude}&longitude=${longitude}`,
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
                    gzip: true,
                },
            }
        )
        return await data.json()
    }

    public async getProductStockForUser(interaction: BtnInteraction) {
        const params = interaction.customId.split(';')
        const productId = params[1]
        const user = await this.client.database.getUser(interaction.user.id)
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

    private async getOpeningHours(rawInteraction: ChatInteraction, storeId?: string) {
        await rawInteraction.deferReply()
        const user = await this.client.database.getUser(rawInteraction.user.id)
        const poletData = await PoletCommands.fetchPoletData(storeId ?? user.favoritePol.id)

        const fmMessage = new EmbedBuilder().setTitle(`${poletData.storeName} (${poletData.address.postalCode}, ${poletData.address.city}) `)

        if (poletData.openingHours.exceptionHours.length) {
            fmMessage.addFields({ name: 'Endrede åpningstider', value: 'Det er endrede åpningstider denne måneden' })

            poletData.openingHours.exceptionHours.forEach((h) => {
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
            })
        }
        // fmMessage.setDescription(`${this.isStoreOpen(todayClosing)}`)
        this.messageHelper.replyToInteraction(rawInteraction, fmMessage, { hasBeenDefered: true })
    }

    private async handleVinmonopoletCommand(interaction: ChatInteraction) {
        await this.getOpeningHours(interaction)
    }

    private isStoreOpen(closingTime: string) {
        const split = closingTime.split(':')
        if (split.length === 2) {
            const hourMin: number[] = split.map((t) => Number(t))
            if (DateUtils.isHourMinuteBefore(hourMin[0], hourMin[1])) return 'Åpent'
        }
        return 'Stengt'
    }

    private static async fetchVGRating(productId: string): Promise<VGRating | undefined> {
        const response = await fetch(`${PoletCommands.vgRatingUrl}?skip=0&take=30&query=${productId}`, { method: 'GET' })

        if (!response.ok) return undefined

        const rating = (await response.json()) as VGRating[]
        return rating[0]
    }

    //TODO & FIXME: Is this the best placement for this function?
    static async checkForVinmonopolContent(message: Message, messageHelper: MessageHelper) {
        const content = message.content
        const barCodeRegex = /\d{9,15}/gi
        const productIdRegex = /(?<!.)\d{6,8}(?!.)/gi
        const hasUrl = content.includes('https://www.vinmonopolet.no/')
        let hasBarCode = barCodeRegex.test(content)
        const hasProductId = productIdRegex.test(content)
        let barcodes: any = content
        if (!hasUrl && !hasBarCode && !hasProductId && message.attachments?.first()?.url && environment === 'prod') {
            const msg = await messageHelper.sendLogMessage('Sjekker bilde for strekkode...')
            barcodes = await BarcodeUtils.decodeImage(message.attachments.first().url, msg)
            msg.edit(`Fant ${barcodes ? '' : 'ikke '}strekkode i bilde sendt i kanalen ${MentionUtils.mentionChannel(message.channelId)}`)
            hasBarCode = !!barcodes
        }
        if (hasUrl || hasBarCode || hasProductId) {
            let id = ''
            if (hasBarCode) id = barcodes[0]
            else if (hasProductId) id = content.match(productIdRegex)[0]
            else id = content.split('/p/')[1].split('/')[0] as string

            if (id && !isNaN(Number(id))) {
                let data: any = undefined
                let barcode: any = undefined
                if (hasProductId) data = await PoletCommands.fetchProductDataFromId(content, false)
                else if (hasUrl) data = await PoletCommands.fetchProductDataFromId(content.split('/p/')[1], false)
                else {
                    let found = false
                    for (let i = 0; !found && i < barcodes?.length; i++) {
                        data = await PoletCommands.fetchProductDataFromId(barcodes[i], true)
                        barcode = barcodes[i]
                        found = !data?.errors
                    }
                    data = await PoletCommands.fetchProductDataFromId(data.code, false)
                }

                if (data && !data?.errors) {
                    const hasDesc = !!data.description?.trim()
                    let description = `${hasDesc ? data.description : data.taste}`
                    if (hasBarCode) {
                        try {
                            const fetchedScore = await PoletCommands.fetchScore(barcode)

                            if (fetchedScore && fetchedScore?.payload?.rows?.length > 0) {
                                description += `\nVinify score: ${fetchedScore.payload.rows[0].mainProfile.averagePoints} poeng (${fetchedScore.payload.rows[0].mainProfile.numberOfRates} ratinger)`
                            }
                        } catch (error) {
                            messageHelper.sendLogMessage(`Score fetch was aborted after 6000ms. Error: ${error}`)
                        }
                    }
                    // Vinmonopolet moved alcohol % and ingredients off the top-level fields and into
                    // `content.traits` / `content.ingredients` at some point; the old fields are kept
                    // as a fallback in case a response (e.g. barcode search) still uses the old shape.
                    const alcoholTrait = data.content?.traits?.find((t) => t.name === 'Alkohol')
                    const ingredients = data.content?.ingredients ?? data.raastoff

                    const embed = EmbedUtils.createSimpleEmbed(`${data.name}`, description, [
                        { name: `Lukt`, value: `${data.smell}` },
                        { name: `Pris`, value: `${data.price.formattedValue}`, inline: true },
                        { name: `Type`, value: `${data.main_category.name}`, inline: true },
                        { name: `Årgang`, value: `${data.year === '0000' ? 'Ukjent' : data.year}`, inline: true },
                        { name: `Volum`, value: `${data.volume?.formattedValue}`, inline: true },
                        { name: `Land`, value: `${data.main_country?.name}`, inline: true },
                        { name: `Alkohol`, value: `${data.alcohol?.formattedValue ?? alcoholTrait?.formattedValue}`, inline: true },

                        { name: `Stil`, value: `${data.style?.name}`, inline: true },
                    ])

                    /** In case of wines, it will be something like [Pinot Noir 80%, Merlot 20%]
                     * For liquers, ciders, etc. it may only be "Plommer, epler", since they dont display the percentage of the mix.
                     */
                    if (ingredients?.length) {
                        embed.addFields({
                            name: `Innhold`,
                            value: `${ingredients.map((rs) => rs.formattedValue ?? `${rs.name} ${rs.percentage ? '(' + rs.percentage + '%)' : ''}`).join(', ')}`,
                            inline: true,
                        })
                    }

                    //Make sure to add some text if field does not exist, since the embed will crash if a field is empty
                    //Also, in case a data value doesn't exist, we set it to "ukjent" for a better look
                    embed?.data?.fields.forEach((f) => {
                        if (!f.value) f.value = 'Ukjent'
                        if (f.value.includes('undefined')) f.value = f.value.replace('undefined', 'Ukjent')
                    })

                    const rating = await PoletCommands.fetchVGRating(id)
                    if (rating) {
                        const diceRoll = EmbedUtils.createField(
                            `VG Terningkast`,
                            `${EmojiHelper.getEmoji('dice_' + rating.grade_num, message).emojiObject ?? rating.grade_num} `,
                            true
                        )
                        const wineScore = EmbedUtils.createField(`VG Rating`, `${rating.score_num} poeng`, true)
                        const description = EmbedUtils.createField(
                            `VG anmeldelse`,
                            `*${rating.lead ?? ''}*: ${rating?.author_description ? rating.author_description : 'Ingen anmeldelse'}`
                        )
                        embed.addFields(diceRoll, wineScore, description)


                    }

                    //Possible formats: product, thumbnail, zoom, cartIcon and superZoom (some may be identical or not exist at all.)
                    //"zoom" seems to be the version used on the website, but still not all products have photos so it might be undefined
                    const imageUrl = data.images.filter((img: any) => img.format === 'zoom')[0]?.url
                    if (imageUrl) embed.setThumbnail(imageUrl)
                    embed.setURL(`https://www.vinmonopolet.no${data.url}`)

                    embed.setFooter({
                        text: `Produsent: ${data.main_producer?.name}${data.district?.name ? `, Distrikt: ${data.district?.name}` : ''}${
                            data.sub_District?.name ? `, Sub-distrikt: ${data.sub_District?.name}` : ''
                        }`,
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
                } else {
                    messageHelper.sendLogMessage(
                        `En strekkode ble sendt i ${MentionUtils.mentionChannel(message.channelId)}, men ingen vare ble funnet på id ${content}. Feil: ${
                            data?.errors[0]?.message
                        }`
                    )
                }
            }
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'vinmonopolet',
                        command: (rawInteraction: ChatInteraction) => {
                            this.handleVinmonopoletCommand(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'POLET_STOCK',
                        command: (rawInteraction: BtnInteraction) => {
                            this.getProductStockForUser(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
