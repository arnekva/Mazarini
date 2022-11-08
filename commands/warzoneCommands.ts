import { login, platforms, Warzone } from 'call-of-duty-api'
import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, Interaction, User } from 'discord.js'
import { Response } from 'node-fetch'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { actSSOCookie } from '../client-env'
import { ICommandElement, IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { ObjectUtils } from '../utils/objectUtils'

const fetch = require('node-fetch')

export interface CodStats {
    kills: number
    deaths: number
    kdRatio: number
    killsPerGame: number
    damageDone: number
    damageTaken: number | string
    damageDoneTakenRatio: number
    headshotPercentage: number
    gulagDeaths: number
    gulagKills: number
    wallBangs: number
    executions: number
    headshots: number
    matchesPlayed: number
    gulagKd: number
    assists: number
    objectiveMunitionsBoxTeammateUsed: number //Muniton Boxes used
    objectiveBrCacheOpen: number //Chests opened
    objectiveBrKioskBuy: number //Items bought at store
    avgLifeTime: number
    timePlayed: number
    distanceTraveled: number
}
export interface CodBRStats {
    kills: number
    deaths: number
    kdRatio: number
    timePlayed: number
    wins: number
    downs: number
    topTwentyFive: number
    topTen: number
    topFive: number
    contracts: number
    gamesPlayed: number
    winRatio: number
}
export type CodStatsType =
    | 'kills'
    | 'deaths'
    | 'kdRatio'
    | 'killsPerGame'
    | 'damageDone'
    | 'damageTaken'
    | 'damageDoneTakenRatio'
    | 'headshotPercentage'
    | 'gulagDeaths'
    | 'gulagKills'
    | 'gulagKd'
    | 'headshots'
    | 'wallBangs'
    | 'executions'
    | 'objectiveBrKioskBuy'
    | 'assists'
    | 'avgLifeTime'
    | 'objectiveMunitionsBoxTeammateUsed'
    | 'objectiveBrCacheOpen'
    | 'objectiveBrKioskBuy'
    | 'timePlayed'
    | 'matchesPlayed'
    | 'distanceTraveled'

export type CodBRStatsType =
    | 'wins'
    | 'kills'
    | 'deaths'
    | 'kdRatio'
    | 'downs'
    | 'topTwentyFive'
    | 'topTen'
    | 'topFive'
    | 'contracts'
    | 'timePlayed'
    | 'gamesPlayed'
    | 'winRatio'

interface codStatsKeyHeader {
    key: CodStatsType
    header: string
}
interface codBRStatsKeyHeader {
    key: CodBRStatsType
    header: string
}

interface BRDataOptions {
    rebirth?: boolean
    noSave?: boolean
}

export class WarzoneCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)

        login(actSSOCookie)
    }

    static statsToInclude: codStatsKeyHeader[] = [
        { key: 'kills', header: 'Kills' },
        { key: 'deaths', header: 'Deaths' },
        { key: 'kdRatio', header: 'K/D Ratio' },
        { key: 'killsPerGame', header: 'Kills per game' },
        { key: 'damageDone', header: 'Damage Done' },
        { key: 'damageTaken', header: 'Damage Taken' },
        { key: 'damageDoneTakenRatio', header: 'Damage Done/Taken Ratio' },
        { key: 'headshotPercentage', header: 'Headshot Percentage' },
        { key: 'gulagDeaths', header: 'Gulag Deaths' },
        { key: 'gulagKills', header: 'Gulag Kills' },
        { key: 'gulagKd', header: 'Gulag K/D' },
        { key: 'headshots', header: 'Headshots' },
        { key: 'wallBangs', header: 'Wallbangs' },
        { key: 'executions', header: 'Executions' },
        { key: 'objectiveBrKioskBuy', header: 'Items bought' },
        { key: 'assists', header: 'Assists' },
        { key: 'avgLifeTime', header: 'Average Lifetime' },
        { key: 'timePlayed', header: 'Time Played' },
        { key: 'distanceTraveled', header: 'Distance Traveled' },
        { key: 'matchesPlayed', header: 'Matches Played' },
    ]
    static statsToIncludeInSave: codStatsKeyHeader[] = [
        { key: 'kdRatio', header: 'K/D Ratio' },
        { key: 'damageDoneTakenRatio', header: 'Damage Done/Taken ratio' },
        { key: 'killsPerGame', header: 'Kills per game' },
        { key: 'headshotPercentage', header: 'Headshot Percentage' },
        { key: 'gulagKd', header: 'Gulag K/D' },
        { key: 'matchesPlayed', header: 'Matches Played' },
    ]
    static BRstatsToInclude: codBRStatsKeyHeader[] = [
        { key: 'wins', header: 'Wins' },
        { key: 'kills', header: 'Kills' },
        { key: 'deaths', header: 'Deaths' },
        { key: 'kdRatio', header: 'K/D Ratio' },
        { key: 'downs', header: 'Downs' },
        { key: 'topTwentyFive', header: 'Top 25' },
        { key: 'topTen', header: 'Top 10' },
        { key: 'topFive', header: 'Top 5' },
        { key: 'gamesPlayed', header: 'Games Played' },
        { key: 'timePlayed', header: 'Time Played' },
        { key: 'winRatio', header: 'Win ratio' },
        { key: 'contracts', header: 'Number of contracts' },
    ]

    private findHeaderFromKey(key: string, isBr?: boolean) {
        return isBr
            ? WarzoneCommands.BRstatsToInclude.filter((el) => el.key === key).pop()?.header
            : WarzoneCommands.statsToInclude.filter((el) => el.key === key).pop()?.header
    }

    private translatePlatform(s: string) {
        switch (s) {
            case 'battle':
                return platforms.Battlenet
            case 'psn':
                return platforms.PSN
            case 'xbl':
                return platforms.XBOX
            default:
                return platforms.All
        }
    }

    private async getLastMatchData(interaction: Interaction<CacheType>, user?: User): Promise<string | EmbedBuilder> {
        const WZUser = user ? this.getWZUserStringFromDB(user)?.split(';') : this.getWZUserStringFromDB(interaction.user)?.split(';')
        if (!WZUser) return user ? `Brukeren har ikkje kobla te brukernavn` : 'Du må knytta brukernavn te brukeren din fysste'
        else {
            const gamertag = WZUser[1]
            const platform = this.translatePlatform(WZUser[0])

            try {
                let data = await Warzone.combatHistory(gamertag, platform)

                let tries = 1
                while (!data?.data?.matches && tries < 3) {
                    tries++

                    data = await Warzone.combatHistory(gamertag, platform)
                }
                if (!data?.data?.matches) {
                    return 'Fant ingen data på 3/3 forsøk. Prøv igjen senere.'
                } else {
                    const matchStart = Number(data?.data?.matches[0]?.utcStartSeconds) * 1000
                    const matchStartDate = new Date(matchStart)

                    const embedMsg = new EmbedBuilder()
                        .setTitle(`Siste match for ${gamertag}: ${data?.data?.matches[0]?.playerStats?.teamPlacement ?? 'Ukjent'}. plass `)
                        .setDescription(`${matchStartDate ?? 'Ukjent dato og tid'}`)
                    const isFlaut = () => {
                        return Number(data?.data?.matches[0]?.playerStats?.damageDone) / Number(data?.data?.matches[0]?.playerStats?.damageTaken) < 1
                            ? '(flaut)'
                            : ''
                    }
                    embedMsg.addFields([
                        { name: `Kills:`, value: `${data?.data?.matches[0]?.playerStats?.kills ?? 'Ukjent'}`, inline: true },
                        { name: `Deaths:`, value: `${data?.data?.matches[0]?.playerStats?.deaths ?? 'Ukjent'}`, inline: true },
                        { name: `K/D Ratio:`, value: `${data?.data?.matches[0]?.playerStats?.kdRatio ?? 'Ukjent'}`, inline: true },
                        { name: `Assists:`, value: `${data?.data?.matches[0]?.playerStats?.assists ?? 'Ukjent'}`, inline: true },
                        { name: `Headshots:`, value: `${data?.data?.matches[0]?.playerStats?.headshots ?? 'Ukjent'}`, inline: true },
                        { name: `Longest streak:`, value: `${data?.data?.matches[0]?.playerStats?.longestStreak ?? 'Ukjent'}`, inline: true },
                        { name: `Damage done:`, value: `${data?.data?.matches[0]?.playerStats?.damageDone ?? 'Ukjent'}`, inline: true },
                        { name: `Damage taken:`, value: `${data?.data?.matches[0]?.playerStats?.damageTaken ?? 'Ukjent'} ${isFlaut()}`, inline: true },
                        { name: `Distance traveled:`, value: `${data?.data?.matches[0]?.playerStats?.distanceTraveled ?? 'Ukjent'}`, inline: true },
                        { name: `Gulag kills:`, value: `${data?.data?.matches[0]?.playerStats?.gulagKills ?? 'Ukjent'}`, inline: true },
                        { name: `Gulag deaths:`, value: `${data?.data?.matches[0]?.playerStats?.gulagDeaths ?? 'Ukjent'}`, inline: true },
                        { name: `Mode`, value: `${data?.data?.matches[0]?.mode ?? 'Ukjent'}`, inline: true },
                        { name: `Score XP:`, value: `${data?.data?.matches[0]?.playerStats?.scoreXp ?? 'Ukjent'}`, inline: true },
                        { name: `Players in match:`, value: `${data?.data?.matches[0]?.playerCount}`, inline: true },
                        { name: `Deaths`, value: `${data?.data?.matches[0]?.playerStats?.deaths ?? 'Ukjent'}`, inline: true },
                    ])

                    return embedMsg
                }
            } catch (error: any) {
                return 'Klarte ikke hente noe data'
            }
        }
    }

    private async getBRContent(rawInteraction: Interaction<CacheType>, wantedType: string, user?: User, rebirthOnly?: boolean) {
        let gamertag = ''
        let platform: platforms

        const WZUser = user ? this.getWZUserStringFromDB(user)?.split(';') : this.getWZUserStringFromDB(rawInteraction.user)?.split(';')
        if (!WZUser) {
            return user ? `Brukeren har ikkje kobla opp brukernavn` : 'Du må knytta brukernavn te brukeren din fysste'
        }
        gamertag = WZUser[1]
        platform = this.translatePlatform(WZUser[0])

        const filterMode: string = ' ' //TODO: Legg til support for dette igjen

        const noSave = filterMode === 'nosave' || !!user
        const isRebirth = filterMode == 'rebirth' || rebirthOnly

        if (wantedType === 'weekly' || wantedType === 'rebirth') {
            return this.findWeeklyData(gamertag, platform, rawInteraction, { noSave: noSave, rebirth: isRebirth })
        } else {
            /** BR */
            return this.findOverallBRData(gamertag, platform, rawInteraction, { noSave: noSave, rebirth: isRebirth })
        }
    }

    private async findOverallBRData(gamertag: string, platform: platforms, interaction: Interaction<CacheType>, options?: BRDataOptions) {
        try {
            const data = await Warzone.fullData(gamertag, platform)
            let response = 'BR stats for <' + gamertag + '>'

            const statsTyped = data.data.lifetime.mode.br.properties as CodBRStatsType

            const orderedStats: Partial<CodBRStats> = {}
            for (let i = 0; i < WarzoneCommands.BRstatsToInclude.length; i++) {
                for (const [key, value] of Object.entries(statsTyped)) {
                    if (key === WarzoneCommands.BRstatsToInclude[i].key) {
                        orderedStats[WarzoneCommands.BRstatsToInclude[i].key] = Number(value)
                    }
                }
            }

            orderedStats['winRatio'] = ((orderedStats?.wins ?? 0) / (orderedStats?.gamesPlayed ?? 1)) * 100
            const userStats = this.getUserStats(interaction, true)
            const oldData = userStats

            const getValueFormatted = (key: string, value: number) => {
                if (key === 'timePlayed') return convertTime(value)
                return value.toFixed(3).replace(/\.000$/, '')
            }

            for (const [key, value] of Object.entries(orderedStats)) {
                const compareDataString = () => {
                    if (oldData && ObjectUtils.isObjKey(key, oldData) && !!oldData[key]) {
                        return `${this.compareOldNewStats(value, oldData[key], key === 'timePlayed')}`
                    }
                    return ''
                }
                if (this.findHeaderFromKey(key, true))
                    response += `\n${this.findHeaderFromKey(key, true)}: ${getValueFormatted(key, value)} ${compareDataString()}`
            }
            this.saveUserStats(interaction, statsTyped, true)
            return response
        } catch (error) {
            return `Fant ingen data for ${gamertag}.`
        }
    }

    private async findWeeklyData(gamertag: string, platform: platforms, interaction: Interaction<CacheType>, options?: BRDataOptions) {
        try {
            const data = await Warzone.fullData(gamertag, platform)
            let response = 'Weekly Warzone stats for <' + gamertag + '>'

            if (!data?.data?.weekly) {
                return 'Ingen data funnet for denne uken'
            } else if (options?.rebirth && data.data.weekly.mode) {
                return this.findWeeklyRebirthOnly(gamertag, data)
            } else {
                const statsTyped = data?.data?.weekly?.all?.properties as CodStats

                const orderedStats: Partial<CodStats> = {}
                for (let i = 0; i < WarzoneCommands.statsToInclude.length; i++) {
                    for (const [key, value] of Object.entries(statsTyped)) {
                        if (key === WarzoneCommands.statsToInclude[i].key) {
                            if (key === 'damageTaken' && Number(statsTyped['damageTaken']) > Number(statsTyped['damageDone'])) {
                                orderedStats['damageTaken'] = value + ' (flaut)'
                            } else {
                                orderedStats[WarzoneCommands.statsToInclude[i].key] = value
                            }
                        }
                    }
                    if (orderedStats.gulagDeaths && orderedStats.gulagKills) {
                        //Inject gulag KD in
                        orderedStats['gulagKd'] = parseFloat((orderedStats?.gulagKills / orderedStats?.gulagDeaths).toFixed(3))
                    }
                    if (orderedStats.damageDone && orderedStats.damageTaken) {
                        orderedStats['damageDoneTakenRatio'] = Number(orderedStats.damageDone) / Number(orderedStats.damageTaken)
                    }
                }
                const userStats = this.getUserStats(interaction)
                const oldData = userStats

                const getValueFormatted = (key: string, value: string | Number) => {
                    if (key === 'avgLifeTime')
                        return `${DateUtils.secondsToMinutesAndSeconds(Number(value)).minutes.toFixed(0)} minutes and ${DateUtils.secondsToMinutesAndSeconds(
                            Number(value)
                        ).seconds.toFixed(0)} seconds`
                    if (key === 'timePlayed')
                        return `${DateUtils.secondsToHoursAndMinutes(Number(value)).hours.toFixed(0)} hours and ${DateUtils.secondsToHoursAndMinutes(
                            Number(value)
                        ).minutes.toFixed(0)} minutes.`
                    if (key === 'damageTaken') return value
                    return parseFloat(Number(value).toFixed(3))
                }

                for (const [key, value] of Object.entries(orderedStats)) {
                    if (key === 'gulagKd' && orderedStats.gulagDeaths && orderedStats.gulagKills) {
                        statsTyped['gulagKd'] = orderedStats['gulagKd'] ?? 0
                    }
                    if (key === 'damageDoneTakenRatio' && orderedStats.damageDone && orderedStats.damageTaken) {
                        const compareDataString = () => {
                            if (oldData && ObjectUtils.isObjKey(key, oldData) && !!oldData[key]) {
                                return `${this.compareOldNewStats(value, oldData[key], key === 'timePlayed')}`
                            }
                            return ''
                        }
                        if (this.findHeaderFromKey(key, true))
                            response += `\n${this.findHeaderFromKey(key, true)}: ${getValueFormatted(key, value)} ${compareDataString()}`
                        response += `\nDamage Done/Taken ratio: ${(Number(orderedStats?.damageDone) / parseInt(orderedStats?.damageTaken.toString())).toFixed(
                            3
                        )} ${compareDataString()}`

                        statsTyped['damageDoneTakenRatio'] = orderedStats['damageDoneTakenRatio'] ?? 0
                    } else if (this.findHeaderFromKey(key)) {
                        const compareDataString = () => {
                            if (oldData && ObjectUtils.isObjKey(key, oldData) && !!oldData[key]) {
                                return `${this.compareOldNewStats(value, oldData[key], !this.isCorrectHeader({ key: key as CodStatsType, header: 'none' }))}`
                            }
                            return ''
                        }
                        response += `\n${this.findHeaderFromKey(key)}: ${getValueFormatted(key, value)} ${compareDataString()}`
                    }
                }

                if (!options?.noSave) this.saveUserStats(interaction, statsTyped)
                return response
            }
        } catch (error) {
            return `Fant ingen data (${gamertag} ${platform}). Hvis du vet at du ikke mangler data denne uken, prøv på ny om ca. ett minutt.`
        }
    }

    private isCorrectHeader(key: codStatsKeyHeader) {
        return !!WarzoneCommands.statsToIncludeInSave.find((k) => k?.key === key?.key)?.header
    }

    private findWeeklyRebirthOnly(gamertag: string, data: any): string {
        let numKills = 0
        let numDeaths = 0
        let numDamage = 0
        let numDamageTaken = 0
        for (const [key, value] of Object.entries(data.data.weekly.mode)) {
            if (key.includes('rebirth')) {
                const val = value as any
                if (val?.properties?.kills) numKills += Number(val?.properties?.kills)
                if (val?.properties?.deaths) numDeaths += Number(val?.properties?.deaths)
                if (val?.properties?.damageTaken) numDamageTaken += Number(val?.properties?.damageTaken)
                if (val?.properties?.damageDone) numDamage += Number(val?.properties?.damageDone)
            }
        }
        return ` Weekly REBIRTH ONLY Stats for <${gamertag}>\nKills: ${numKills}\nDeaths: ${numDeaths}\nDamage Done: ${numDamage}\nDamage Taken: ${numDamageTaken}`
    }

    private async findWeeklyPlaylist(interaction: ChatInputCommandInteraction<CacheType>) {
        let found = false
        let i = 0
        const now = new Date()
        await interaction.deferReply()

        fetch('https://api.trello.com/1/boards/ZgSjnGba/cards')
            .then((response: Response) => response.json())
            .then((data: any) => {
                while (!found && i < data.length) {
                    if (data[i].name == 'Playlist Update') {
                        let start = new Date(data[i].start)
                        let end = new Date(data[i].due)
                        if (now > start && now < end) {
                            found = true
                            let cardId = data[i].id
                            let attachmentId = data[i].idAttachmentCover
                            fetch('https://api.trello.com/1/cards/' + cardId + '/attachments/' + attachmentId)
                                .then((response: Response) => response.json())
                                .then((data: any) => {
                                    this.messageHelper.replyToInteraction(interaction, data.url, undefined, true)
                                })
                        }
                    }
                    i += 1
                }
                if (!found) {
                    this.messageHelper.replyToInteraction(interaction, 'Fant ikke playlist', undefined, true)
                }
            })
            .catch((error) => {
                this.messageHelper.replyToInteraction(interaction, 'Fetchen for playlist feilet', undefined, true)
            })
    }

    private async handleWZInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        if (interaction) {
            const wantedType = interaction.options.getString('mode') //"br", "weekly", "siste" or "rebirth" or "mw2mp"
            const checkAnotherUser = interaction.options.get('bruker')?.user

            if (wantedType === 'br' || wantedType === 'weekly' || wantedType === 'rebirth') {
                const content = await this.getBRContent(interaction, wantedType, checkAnotherUser, wantedType === 'rebirth')
                this.messageHelper.replyToInteraction(interaction, content, undefined, true)
            } else if (wantedType === 'siste') {
                const content = await this.getLastMatchData(interaction, checkAnotherUser)

                this.messageHelper.replyToInteraction(interaction, content, undefined, true)
            } else if (wantedType === 'mw2mp') {
                this.findMultiplayerStats(interaction, checkAnotherUser)
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Kunne ikke finne data på valgte modus', undefined, true)
        }
    }

    private findMultiplayerStats(interaction: ChatInputCommandInteraction<CacheType>, user?: User) {
        this.messageHelper.replyToInteraction(
            interaction,
            `Stats for MW2 Multiplayer er ikke tilgjengelig enda. Forventet tilgjengelig 16. November`,
            false,
            true
        )
    }

    private getWZUserStringFromDB(user: User) {
        return DatabaseHelper.getUser(user.id)?.activisionUserString
    }

    /**
     *
     * @param current Nåværende statistikk
     * @param storedData Gammel statistikk fra DB
     * @param ignoreCompare Noen stats skal ikke sammenliknes (e.g. time played og average lifetime)
     * @returns
     */
    private compareOldNewStats(current?: string | Number | undefined, storedData?: string | number | undefined, ignoreCompare?: boolean) {
        if (!current || !storedData) return ''
        if (ignoreCompare) return ''
        const currentStats = Number(current)
        const oldStorageStats = Number(storedData)
        const value = currentStats - oldStorageStats
        if (currentStats > oldStorageStats) return ` (+${parseFloat(Number(value).toFixed(3))})`
        if (currentStats < oldStorageStats) return ` (${parseFloat(Number(value).toFixed(3))})`
        return ``
    }

    /** Beware of stats: any */
    private saveUserStats(interaction: Interaction<CacheType>, stats: CodStats | CodBRStatsType, isBR?: boolean) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        if (isBR) user.codStatsBR = stats
        else user.codStats = stats
        DatabaseHelper.updateUser(user)
    }

    private getUserStats(interaction: Interaction<CacheType>, isBr?: boolean) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        if (isBr) {
            if ((user.codStatsBR as any) === 'undefined') return {}
            return user.codStatsBR
        }
        if ((user.codStats as any) === 'undefined') return {}
        return user.codStats
    }

    public getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'stats',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.handleWZInteraction(rawInteraction)
                },
                category: 'gaming',
            },
            {
                commandName: 'playlist',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.findWeeklyPlaylist(rawInteraction)
                },
                category: 'gaming',
            },
        ]
    }
}

function convertTime(seconds: number) {
    let days = Math.floor(seconds / 86400)
    let remainingSeconds = seconds % 86400
    let hours = Math.floor(remainingSeconds / 3600)
    let remainingSeconds2 = remainingSeconds % 3600
    let minutes = Math.floor(remainingSeconds2 / 60)
    let timeString = days + 'D ' + hours + 'H ' + minutes + 'M'
    return timeString
}
