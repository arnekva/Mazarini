import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
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
    id: number
    subject: {
        id: number
        seo_name: string
        alias: string
        is_featured: boolean
        is_premium: boolean
        visibility: string
        image: {
            location: string
            variations: any //OBJECT
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
    object: {
        id: number
        label_id: number
        vintage: {
            id: number
            seo_name: string
            year: string
            name: string
            statistics: any
            organic_certification_id: any
            certified_biodynamic: any
            image: any
            wine: {
                id: number
                name: string
                seo_name: string
                type_id: number
                region: {
                    id: number
                    name: string
                    country: string
                    class: {
                        id: number
                        country_code: string
                    }
                }
            }
            description: string
            wine_critic_reviews: any[]
            awards: any[]
        }
        image: {
            location: string
            variations: any[]
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

            const newestItem = data[0]
            const imageUrl = `https:${newestItem.object.image.location}`

            const thisYear = this.findRatingsThisYear(data)
            console.log(thisYear.length)

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
            const numRatings = thisYear.length
            console.log(thisYear[0])

            thisYear.forEach((vivinoRating) => {
                const review = vivinoRating?.object.review
                const rating = vivinoRating?.object.review.rating
                totalRatings += rating
                if (!highestRating || review.rating > highestRating.object.review.rating) highestRating = vivinoRating
                if (!lowestRating || review.rating < lowestRating.object.review.rating) lowestRating = vivinoRating
            })
            const ratingsAsValues = Object.entries(allRegions)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .flat()
            console.log(highestRating)

            const embed = EmbedUtils.createSimpleEmbed(`Dette er ditt vin-år ${interaction.user.username}`, `Du ratet ${numRatings} viner i 2023`)
            embed.addFields([
                {
                    name: 'Favorittregion',
                    value: `${regionsAsValues[0]} (${regionsAsValues[1]} viner fra denne regionen)`,
                },
                {
                    name: 'Gjennomsnittsrating',
                    value: `${(totalRatings / numRatings).toFixed(2)} `,
                },
                {
                    name: 'Høyest rating',
                    value: `Du ga ${highestRating.object.review.rating} som høyeste score til ${highestRating.object.vintage.name}. Om denne vinen skrev du: "${highestRating.object.review.note}"`,
                },
                {
                    name: 'Lavest rating',
                    value: `Du ga ${lowestRating.object.review.rating} som laveste score til ${highestRating.object.vintage.name}. Om denne vinen skrev du: "${lowestRating.object.review.note}"`,
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
        const url = `https://api.vivino.com/v/9.0.0/users/56751223/activities?app_phone=iPhone15%2C2&app_platform=iphone&app_version=2023.45.0&language=en&limit=40&os_version=17.1.2&start_from=0&user_id=56751223&uuid=7C052FA3-178D-4F44-BC33-5684557B5C15`
        const cleanUrl = `https://api.vivino.com/v/9.0.0/users/${vivinoId}/activities?limit=100&start_from=`
        const topUrl = `https://api.vivino.com/v/9.0.0/reviews/_best?app_phone=iPhone15%2C2&app_platform=iphone&app_version=2023.49.0&language=en&limit=1&os_version=17.1.2&user_id=56751223&uuid=670EE477-D619-4375-9B3C-1F1629EAF9B4&vintage_ids=146516735%2C150309268%2C173026826%2C2124186%2C53391157%2C169912694%2C159832380%2C2263553%2C160107996%2C173043296%2C167176761%2C156144365%2C156133711%2C87593357%2C146907852%2C159542148%2C159347092%2C159359818%2C87014453%2C159556756%2C156101231%2C1663386%2C162910337%2C104766821%2C150413277%2C164942800%2C157750442%2C17134923%2C14277431%2C164942842%2C159788686%2C160022134%2C156096614%2C86922337%2C100833715%2C91217393%2C14201617%2C113678070%2C19353268%2C150379399%2C2687111%2C129820572%2C14726171%2C150298470%2C14286520%2C2093215%2C164942645%2C1351543%2C11484288%2C156231844%2C150295041%2C1468908%2C85748969%2C160214289%2C1469112%2C151352145%2C16793198%2C1513937%2C14513009%2C14123720%2C156165580%2C14317603%2C3698778%2C2450122%2C4033840%2C87761776%2C14155244%2C3427530%2C1257984%2C1178780%2C87594828%2C86832986%2C164942647%2C1911164%2C103181296%2C1397011%2C2024073%2C164942597%2C164942636%2C160099999%2C164942599%2C2283609%2C162907328%2C149728035%2C1706269%2C1782659`

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

    getAllInteractions() {
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
