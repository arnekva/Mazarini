import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, Interaction, User } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { lfKey } from '../client-env'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { TextUtils } from '../utils/textUtils'
const fetch = require('node-fetch')
export type musicCommand = 'top'

export type topMethods = 'songs' | 'artist' | 'album' | 'tags'
export type weeklyMethods = 'songs' | 'artist'
export type commandTypes = 'topp' | 'weekly' | 'siste'
interface musicMethod {
    description: string
    title: string
    command: commandTypes
}

export const methods: musicMethod[] = [
    { title: 'Topp', description: 'Hent ut en toppliste (Artist, album, sanger eller tags)', command: 'topp' },
    { title: 'Siste 7 dager', description: 'Hent ut en toppliste (Artist, album, sanger eller tags)', command: 'weekly' },
    { title: 'Siste sanger', description: 'Siste X sanger avspilt', command: 'siste' },
]

interface fetchData {
    user: string
    method: {
        cmd: string
        desc: string
    }
    limit: string
    includeStats: boolean
    silent: boolean
    includeNameInOutput: boolean
    username: string
    header: string
    formatAsEmbed?: boolean
}

export interface IFindCommand {
    isSilent?: boolean
    usernameToLookup?: string
    notWeeklyOrRecent?: boolean
    includeUsername?: boolean
}

export class Music extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private readonly baseUrl = 'http://ws.audioscrobbler.com/2.0/'

    getCommand(c: commandTypes, s: string) {
        switch (c) {
            case 'topp':
                if (s as topMethods) return this.findTopMethod(s)
            case 'weekly':
                if (s as weeklyMethods) return this.findWeeklyMethod(s)
            case 'siste':
                if (s as weeklyMethods) return this.findLastPlayedSongs(s)
        }
        return this.findTopMethod(s)
    }

    private findLastPlayedSongs(m: string) {
        return 'user.' + 'getrecenttracks'
    }

    private findTopMethod(m: string) {
        const base = 'user.'
        switch (m) {
            case 'album':
                return base + 'gettopalbums'
            case 'artist':
                return base + 'gettopartists'
            case 'songs':
                return base + 'gettoptracks'
            case 'tags':
                return base + 'gettoptags'
            case 'weekly':
                return base + 'getweeklytrackchart'
            default:
                return base + 'getweeklytrackchart'
        }
    }

    private findWeeklyMethod(m: string) {
        const base = 'user.'
        switch (m) {
            case 'artist':
                return base + 'getweeklyartistchart'
            case 'songs':
                return base + 'getweeklytrackchart'
            default:
                return base + 'getweeklyartistchart'
        }
    }

    /**
     * Finn last FM data
     * @param dataParam
     * @returns
     *  Docs: https://www.last.fm/api/show/user.getInfo
     */
    async findLastFmData(dataParam: fetchData, notWeeklyOrRecent?: boolean) {
        if (!parseInt(dataParam.limit)) {
            dataParam.limit = '10'
            dataParam.includeStats = true
        }

        const apiKey = lfKey

        let musicData = ''

        const arrayDataRet: string[] = []
        await Promise.all([
            fetch(this.baseUrl + `?method=${dataParam.method.cmd}&user=${dataParam.user}&api_key=${apiKey}&format=json&limit=${dataParam.limit}`, {
                method: 'GET',
            }),
            fetch(this.baseUrl + `?method=user.getinfo&user=${dataParam.user}&api_key=${apiKey}&format=json`),
        ])
            .then(async ([resTop, resInfo]) => {
                await Promise.all([resTop.json(), resInfo.json()])
                    .then(([topData, info]) => {
                        const isFormattedWithHashtag = notWeeklyOrRecent
                            ? true
                            : dataParam.method.cmd.includes('weekly') || dataParam.method.cmd.includes('recent')
                        const isWeekly = dataParam.method.cmd.includes('weekly')
                        const isNotRecent = !dataParam.method.cmd.includes('recent')
                        const totalPlaycount = info['user']?.playcount ?? '1'

                        let prop

                        const strippedMethod = dataParam.method.cmd.replace('user.get', '')

                        const methodWithoutGet = isWeekly
                            ? strippedMethod.replace('weekly', '').replace('chart', '')
                            : TextUtils.replaceLast(strippedMethod.replace('top', '').replace('recent', ''), 's', '')

                        prop = topData[strippedMethod][methodWithoutGet] as { name: string; playcount: string; artist?: { name: string } }[]

                        let numPlaysInTopX = 0
                        if (prop) {
                            const zeroWidthSpace = '\u200B'
                            const lineSeperator = `${zeroWidthSpace}\n${zeroWidthSpace}`
                            musicData += `${dataParam.header ? '\n' : ''}`
                            if (dataParam.limit === '1' && prop.length > 1) {
                                prop = prop.slice(0, 1)
                            }
                            prop.forEach((element: any, index) => {
                                const isCurrentlyPlaying = !isNotRecent && element.hasOwnProperty('@attr')

                                numPlaysInTopX += parseInt(element.playcount)

                                musicData +=
                                    `${dataParam.includeNameInOutput ? '(' + dataParam.username + ') ' : ''}` +
                                    `${
                                        isFormattedWithHashtag && element.artist
                                            ? element.artist['#text'] + ' - '
                                            : element.artist
                                            ? element.artist.name + ' - '
                                            : ''
                                    }` +
                                    `${element?.name} ${isNotRecent ? '(' + element.playcount + ' plays)' : ''} ` +
                                    `${dataParam.includeStats ? ((parseInt(element.playcount) / parseInt(totalPlaycount)) * 100).toFixed(1) + '%' : ''} ` +
                                    `${isCurrentlyPlaying ? '(spiller nå)' : ''} `

                                if (dataParam.silent) musicData += `${'(' + new Date(Number(element.date['uts']) * 1000).toLocaleString('nb-NO') + ')'}`

                                musicData += lineSeperator
                            })

                            if (!isFormattedWithHashtag) musicData += `\n*Totalt ${topData[strippedMethod]['@attr'].total} ${methodWithoutGet}s i biblioteket`
                        }
                        if (!isFormattedWithHashtag)
                            musicData += `, ${totalPlaycount} totale avspillinger. ${
                                dataParam.includeStats
                                    ? ((numPlaysInTopX / parseInt(totalPlaycount)) * 100).toFixed(1) +
                                      '% av avspillingene er fra dine topp ' +
                                      dataParam.limit +
                                      '.'
                                    : ''
                            }* `

                        arrayDataRet.push(musicData)

                        // return retMessage
                    })
                    .catch((error: any) => {})
            })
            .catch((error: any) => {})

        return arrayDataRet
    }

    private async handleMusicInteractions(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            const options = interaction.options.get('data')?.value as string
            const user = interaction.options.get('user')?.user

            const data = await this.findCommandForInteraction(interaction, options, user instanceof User ? user : undefined)
            if (data instanceof EmbedBuilder) {
                this.messageHelper.replyToInteraction(interaction, data)
            } else {
                this.messageHelper.replyToInteraction(interaction, data)
            }
        }
    }

    async findCommandForInteraction(interaction: Interaction<CacheType>, options: string, user?: User): Promise<string | EmbedBuilder> {
        const fmUser = DatabaseHelper.getUser(user ? user?.id : interaction.user.id)
        if (fmUser.lastFMUsername) {
            let data: fetchData = {
                user: fmUser.lastFMUsername,
                method: { cmd: '', desc: '' },
                limit: '10',
                includeStats: true, //If overriding username, stats index is pushed back by 1 index
                silent: false,
                includeNameInOutput: false,
                username: user ? user.username : interaction.user.username,
                header: '',
            }

            if (options === 'toptenartist') {
                data.method = { cmd: this.getCommand('topp', 'artist'), desc: 'Topp artist' }
                data.header = `Topp 10 artister\n`
            } else if (options === 'toptenalbum') {
                data.method = { cmd: this.getCommand('topp', 'album'), desc: 'Topp album' }
                data.header = `Topp 10 album`
            } else if (options === 'toptensongs') {
                data.method = { cmd: this.getCommand('topp', 'songs'), desc: 'Topp sanger' }
                data.header = `Topp 10 sanger`
            } else if (options === 'lasttensongs') {
                data.method = { cmd: this.getCommand('siste', '10'), desc: 'Siste 10 sanger' }
                data.header = `Siste 10 sanger`
                data.includeStats = false
            }
            const lastFmData = (await this.findLastFmData(data)).join('\n')

            return `${user ? `Data for ${user.username}\n` : ''}` + lastFmData
        } else return `Brukeren ${user?.username} har ikke knyttet til et Last.fm-brukernavn`
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'musikk',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleMusicInteractions(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
