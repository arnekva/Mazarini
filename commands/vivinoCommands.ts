import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../interfaces/interactionInterface'
import { EmbedUtils } from '../utils/embedUtils'
import { LanguageCodes } from '../utils/languageUtils'
const fetch = require('node-fetch')

interface IVivinoReview {
    id: number
    rating: number
    note: string
    language: string
    created_at: string
    aggregated: boolean
}
interface IVivinoRating {
    /** Id of rating */
    id: number
    /** User who rated the wine */
    subject: {
        id: number
        seo_name: string
        alias: string
        is_featured: boolean
        is_premium: boolean
        visibility: string
        image: {
            location: string
            variations: any //TODO: Type this
        }
        statistics: {
            followers_count: number
            followings_count: number
            ratings_count: number
            ratings_sum: number
            reviews_count: number
            purchase_order_count: number
        }
        language: string
    }
    verb: string
    object_type: string
    /** The wine that was rated */
    object: {
        id: number
        label_id: number
        vintage: {
            id: number
            seo_name: string
            year: string
            name: string
            statistics: any
            organic_certification_id: any //TODO: Type this
            certified_biodynamic: any //TODO: Type this
            image: any //TODO: Type this
            /** The specific wine */
            wine: {
                id: number
                name: string
                seo_name: string
                type_id: number
                region: {
                    id: number
                    name: string
                    /** As language code, i.e. "It" for Italy */
                    country: string
                    class: {
                        id: number
                        country_code: string
                    }
                }
            }
            description: string
            wine_critic_reviews: any[] //TODO: Type this
            awards: any[] //TODO: Type this
        }
        image: {
            location: string
            variations: any[] //TODO: Type this
        }
        review: IVivinoReview
        updated_at: string
        created_at: string
        scanned_at: string
    }
}

export class VivinoCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async createYearInReview(interaction: ChatInputCommandInteraction<CacheType>) {
        interaction.deferReply()
        const user = await this.client.db.getUser(interaction.user.id)
        if (user.vivinoId) {
            const data = await this.findData(user.vivinoId)

            const thisYear = this.findRatingsThisYear(data)
            const allCountries = thisYear.reduce(function (value, value2) {
                return (
                    value[value2.object.vintage.wine.region.country]
                        ? ++value[value2.object.vintage.wine.region.country]
                        : (value[value2.object.vintage.wine.region.country] = 1),
                    value
                )
            }, {})
            const countriesAsValues = Object.entries(allCountries).sort((a, b) => (b[1] as number) - (a[1] as number))

            const allRegions = thisYear.reduce(function (value, value2) {
                return (
                    value[value2.object.vintage.wine.region.name]
                        ? ++value[value2.object.vintage.wine.region.name]
                        : (value[value2.object.vintage.wine.region.name] = 1),
                    value
                )
            }, {})
            const regionsAsValues = Object.entries(allRegions)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .flat()

            let totalRatings = 0
            let highestRating: IVivinoRating = undefined
            let lowestRating: IVivinoRating = undefined
            let oldestRating: IVivinoRating = undefined
            const numRatings = thisYear.length
            thisYear.forEach((vivinoRating) => {
                const review = vivinoRating?.object.review
                const rating = vivinoRating?.object.review.rating
                const year = Number(vivinoRating.object.vintage.year)
                totalRatings += rating
                if (!highestRating || review.rating > highestRating.object.review.rating) highestRating = vivinoRating
                if (!lowestRating || review.rating < lowestRating.object.review.rating) lowestRating = vivinoRating
                if (!oldestRating || (!!year && year < Number(oldestRating.object.vintage.year))) oldestRating = vivinoRating
            })

            const embed = EmbedUtils.createSimpleEmbed(`Dette er ditt vin-år ${interaction.user.username}`, `Du ratet ${numRatings} viner i 2023`)
            const img = highestRating.object.image?.location || lowestRating.object.image?.location
            if (img) {
                embed.setThumbnail(`https:${img}`)
            }
            embed.addFields([
                {
                    name: 'Favorittregion',
                    value: `${regionsAsValues[0]} (${regionsAsValues[1]} viner fra denne regionen)`,
                },
                {
                    name: 'Gjennomsnittsrating',
                    value: `${(totalRatings / numRatings).toFixed(2)}`,
                },
                {
                    name: 'Høyest rating',
                    value: `Du ga ${highestRating.object.review.rating} som høyeste score til ${highestRating.object.vintage.name}. Om denne vinen skrev du: "${highestRating.object.review.note}"`,
                },
                {
                    name: 'Lavest rating',
                    value: `Du ga ${lowestRating.object.review.rating} som laveste score til ${
                        highestRating.object.vintage.name
                    }. Om denne vinen skrev du: "${lowestRating.object.review.note.replace(/ *\@\[[^\]]*]/, '')}"`,
                },
                {
                    name: 'Eldste vin',
                    value: `Den eldste vinen du rated var fra ${oldestRating.object.vintage.year}`,
                },
                {
                    name: `Land og Regioner`,
                    value: `Du har drukket viner fra ${Object.keys(allCountries).length} land, og ${Object.keys(allRegions).length} forskjellige regioner`,
                },
            ])
            countriesAsValues.forEach((val) => {
                embed.addFields({
                    name: LanguageCodes[val[0].toUpperCase()],
                    value: val[1] + ` ${val[1] === 1 ? 'vin' : 'viner'}`,
                    inline: true,
                })
            })

            this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må linke Vivino-iden din ved å gjøre /link vivino`)
        }
    }
    async findData(vivinoId: string): Promise<IVivinoRating[]> {
        const url = `https://api.vivino.com/v/9.0.0/users/${vivinoId}/activities?app_phone=iPhone15%2C2&app_platform=iphone&language=en&limit=40&os_version=17.1.2&start_from=0&user_id=${vivinoId}`
        const cleanUrl = `https://api.vivino.com/v/9.0.0/users/${vivinoId}/activities?limit=100&start_from=`
        const topUrl = `https://api.vivino.com/v/9.0.0/reviews/_best?app_phone=iPhone15%2C2&app_platform=iphone&language=en&limit=1&os_version=17.1.2&user_id=${vivinoId}`

        const allData = [] as IVivinoRating[][]
        const fetchData = async (lastId?: any) => {
            return await fetch(`${cleanUrl}${lastId}`, {
                method: 'GET',
            })
        }

        let hasMore = true
        let lastId
        while (hasMore) {
            let nextPage = await fetchData(lastId)

            const localData = await nextPage.json()
            const localList = Object.values(localData) as IVivinoRating[]
            allData.push(localList)

            lastId = localList[localList.length - 1]?.id
            hasMore = localList.length >= 60
        }
        const flatList = allData.flat()
        return flatList
    }

    findRatingsThisYear(data: IVivinoRating[]) {
        const currYear = moment().year()

        return data.filter((d) => moment(d.object.review.created_at).year() === currYear)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'vivino',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.createYearInReview(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
