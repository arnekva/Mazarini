import { CacheType, ChatInputCommandInteraction, Interaction, User } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { lfKey, musixMatchKey } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmbedUtils } from '../utils/embedUtils'
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
    period?: string
    formatAsEmbed?: boolean
}

export interface IFindCommand {
    isSilent?: boolean
    usernameToLookup?: string
    notWeeklyOrRecent?: boolean
    includeUsername?: boolean
}

export interface IMusicData {
    username: string
    artist: string
    track: string
    numPlays: string
    isCurrentlyPlaying: boolean
    datePlayed?: string
    info?: string
    totalNumPlaysInLibrary: string
    coverArtUrl?: string
}

export class Music extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
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
    async findLastFmData(dataParam: fetchData, notWeeklyOrRecent?: boolean): Promise<IMusicData[]> {
        if (!parseInt(dataParam.limit)) {
            dataParam.limit = '10'
            dataParam.includeStats = true
        }

        const apiKey = lfKey
        const data: IMusicData[] = []

        await Promise.all([
            fetch(
                this.baseUrl +
                    `?method=${dataParam.method.cmd}&user=${dataParam.user}&api_key=${apiKey}&format=json&limit=${dataParam.limit}${
                        dataParam.period ? '&period=' + dataParam.period : ''
                    }`,
                {
                    method: 'GET',
                }
            ),
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
                        if (!!prop) {
                            prop.forEach((element: any, index) => {
                                const isCurrentlyPlaying = !isNotRecent && element.hasOwnProperty('@attr')
                                const localData: IMusicData = {
                                    username: dataParam.username,
                                    artist: isFormattedWithHashtag && element.artist ? element.artist['#text'] : element.artist ? element.artist.name : '',
                                    track: element?.name,
                                    numPlays: element?.playcount,
                                    isCurrentlyPlaying: isCurrentlyPlaying,
                                    datePlayed: element?.date?.uts ? `${new Date(Number(element?.date?.uts) * 1000).toLocaleString('nb-NO')}` : undefined,
                                    coverArtUrl: element?.image[1]['#text'],
                                    totalNumPlaysInLibrary: `\nTotalt ${topData[strippedMethod]['@attr'].total} ${methodWithoutGet}s i biblioteket`,
                                }

                                data.push(localData)
                            })
                        }

                        // return retMessage
                    })
                    .catch((error: any) => {})
            })
            .catch((error: any) => {})
        return data
    }

    private prettyprintPeriod(p: string) {
        if (p === 'overall') return 'All-time'
        else if (p === 'week') return 'Siste uke'
        else if (p === '1month') return 'Siste måned'
        else if (p === '3month') return 'Siste 3 måneder'
        else if (p === '6month') return 'Siste 6 måneder'
        else if (p === '12month') return 'Siste 12 måneder'
    }

    private async handleMusicInteractions(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            const options = interaction.options.get('data')?.value as string
            const user = interaction.options.get('user')?.user
            const timePeriod = interaction.options.get('periode')?.value as string
            const isTracks = options === 'toptensongs'
            const isArtist = options === 'toptenartist'
            const isLastPlayed = options === 'lasttensongs'
            const isTags = options === 'toptentags'
            const isSongs = options === 'toptensongs' || isLastPlayed || options === 'toptenalbum'
            const canHaveTimePriod = !!timePeriod && !isLastPlayed
            const data = await this.findCommandForInteraction(interaction, options, user instanceof User ? user : undefined, timePeriod)
            const findDataDescription = () => {
                if (isArtist) return 'Topp 10 artister'
                if (isLastPlayed) return 'Siste 10 sanger'
                if (isTracks) return 'Topp 10 sanger'
                if (isTags) return 'Topp 10 tags'
                else return 'Topp 10 album'
            }
            const emb = EmbedUtils.createSimpleEmbed(
                `Last.fm`,
                `${findDataDescription()} for ${user instanceof User ? user.username : interaction.user.username} ${
                    timePeriod && canHaveTimePriod ? '\n' + this.prettyprintPeriod(timePeriod) : ''
                }`
            )
            if (typeof data === 'string') {
                emb.addFields({
                    name: 'Felt',
                    value: data,
                })
            } else if (data.length) {
                let additionalData = data.forEach((d, idx) => {
                    const datePlayed = d.datePlayed ? d.datePlayed : ''
                    d
                    const additionalData = isLastPlayed ? datePlayed : d.numPlays + ' avspillinger'
                    let extraData = !!additionalData ? `(${additionalData})` : ''
                    if (d.isCurrentlyPlaying) extraData = '(spiller nå)'
                    emb.addFields({
                        name: d.track, //Last.fm returns artist in the track place, so it's always track here
                        value: `${isArtist ? d.numPlays + ' avspillinger' : d.artist} ${isArtist ? '' : extraData}`,
                    })
                })
                if (data && data[0]?.totalNumPlaysInLibrary) emb.setFooter({ text: `${data[0].totalNumPlaysInLibrary}` })
            } else {
                //
            }
            if (emb.data.fields?.length) this.messageHelper.replyToInteraction(interaction, emb)
            else this.messageHelper.replyToInteraction(interaction, `Fant ingen data`)
        }
    }

    async findCommandForInteraction(interaction: Interaction<CacheType>, options: string, user?: User, period?: string): Promise<IMusicData[] | string> {
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
                period: period,
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
            } else if (options === 'toptentags') {
                data.method = { cmd: this.getCommand('topp', 'tags'), desc: 'Topp sjangere/tags' }
                data.header = `Topp 10 tags`
            } else if (options === 'lasttensongs') {
                data.method = { cmd: this.getCommand('siste', '10'), desc: 'Siste 10 sanger' }
                data.header = `Siste 10 sanger`
                data.includeStats = false
            }
            const lastFmData = await this.findLastFmData(data)
            return lastFmData
        } else return `Brukeren ${user?.username} har ikke knyttet til et Last.fm-brukernavn`
    }

    private async findLyrics(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const artist = interaction.options.get('artist')?.value as string
        const track = interaction.options.get('sang')?.value as string
        const timeStamp = interaction.options.get('tid')?.value as string
        const numLines = interaction.options.get('linjer')?.value as string

        const lyrics = await Music.fetchLyrcs(track, artist)
        if (lyrics) {
            this.messageHelper.replyToInteraction(interaction, lyrics, { hasBeenDefered: true })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Fant ikke lyrics for ${track} av ${artist}`, { hasBeenDefered: true })
        }
    }

    static async fetchLyrcs(track: string, artist: string) {
        const searchTrack = await fetch(
            `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?format=json&q_track=${track}&q_artist=${artist}&apikey=${musixMatchKey}`,
            {
                method: 'GET',
            }
        )
        const data = await searchTrack.json()
        let lyrics = data.message?.body?.lyrics?.lyrics_body as string
        if (lyrics) {
            //Remove commercial use tag
            lyrics = lyrics.replace('******* This Lyrics is NOT for Commercial use *******', '')
            //Remove ellipsis and song id that is at the end of the string
            const idx = lyrics.lastIndexOf('...')
            if (idx) lyrics = lyrics.slice(0, idx + 3)
        }
        return lyrics
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
                    {
                        commandName: 'lyrics',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.findLyrics(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
