import { Channel, Client, DMChannel, Message, NewsChannel, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { actSSOCookie } from '../client-env'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { ICommandElement } from '../General/commands'
const API = require('call-of-duty-api')()

export interface CodStats {
    kills: number
    deaths: number
    kdRatio: number
    killsPerGame: number
    damageDone: number
    damageTaken: number | string
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

export class WarzoneCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    static statsToInclude: codStatsKeyHeader[] = [
        { key: 'kills', header: 'Kills' },
        { key: 'deaths', header: 'Deaths' },
        { key: 'kdRatio', header: 'K/D Ratio' },
        { key: 'killsPerGame', header: 'Kills per game' },
        { key: 'damageDone', header: 'Damage Done' },
        { key: 'damageTaken', header: 'Damage Taken' },
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

    private async getBRContent(message: Message, messageContent: string, isWeekly?: boolean) {
        const content = messageContent.split(' ')
        let gamertag = ''
        let platform = ''
        const isMe = content[0].toLowerCase() === 'me'
        if (isMe) {
            const WZUser = this.getWZUserStringFromDB(message).split(';')
            gamertag = WZUser[0]
            platform = WZUser[1]
        } else {
            gamertag = content[0]
            platform = content[1]
        }

        let filterMode: string = isMe ? content[1] ?? ' ' : content[2] ?? ' '

        let noSave = filterMode === 'nosave'
        let isRebirth = filterMode === 'rebirth'

        let sentMessage = await this.messageHelper.sendMessage(message.channelId, 'Logger inn...')
        let response = ''

        if (!sentMessage) sentMessage = await this.messageHelper.sendMessage(message.channelId, 'Henter data...')
        else await sentMessage.edit('Henter data...')
        if (isWeekly) {
            response += 'Weekly Warzone stats for <' + gamertag + '>'
            try {
                let data = await API.MWweeklystats(gamertag, platform)

                if (!data.wz.mode.br_all?.properties) {
                    if (sentMessage) sentMessage.edit('Du har ingen statistikk denne ukå')
                    else this.messageHelper.sendMessage(message.channelId, 'Du har ingen statistikk denne ukå')
                    return
                }

                if (isRebirth) {
                    let numKills = 0
                    let numDeaths = 0
                    let numDamage = 0
                    let numDamageTaken = 0
                    for (const [key, value] of Object.entries(data.wz.mode)) {
                        if (key.includes('rebirth')) {
                            const val = value as any
                            if (val?.properties?.kills) numKills += Number(val?.properties?.kills)
                            if (val?.properties?.deaths) numDeaths += Number(val?.properties?.deaths)
                            if (val?.properties?.damageTaken) numDamageTaken += Number(val?.properties?.damageTaken)
                            if (val?.properties?.damageDone) numDamage += Number(val?.properties?.damageDone)
                        }
                    }
                    let rebirthResponse = ` Weekly REBIRTH ONLY Stats for <${gamertag}>\nKills: ${numKills}\nDeaths: ${numDeaths}\nDamage Done: ${numDamage}\nDamage Taken: ${numDamageTaken}`
                    if (sentMessage) sentMessage.edit(rebirthResponse)
                    else this.messageHelper.sendMessage(message.channelId, rebirthResponse)
                    return
                }

                const statsTyped = data.wz.mode.br_all.properties as CodStats

                const orderedStats: Partial<CodStats> = {}
                for (let i = 0; i < WarzoneCommands.statsToInclude.length; i++) {
                    for (const [key, value] of Object.entries(statsTyped)) {
                        if (key === WarzoneCommands.statsToInclude[i].key) {
                            if (key === 'damageTaken' && Number(statsTyped['damageTaken']) > Number(statsTyped['damageDone'])) {
                                orderedStats['damageTaken'] = value + ' (flaut)'
                            } else orderedStats[WarzoneCommands.statsToInclude[i].key] = value
                        }
                    }
                    if (orderedStats.gulagDeaths && orderedStats.gulagKills)
                        //Inject gulag KD in
                        orderedStats['gulagKd'] = parseFloat((orderedStats?.gulagKills / orderedStats?.gulagDeaths).toFixed(3))
                }

                const oldData = JSON.parse(this.getUserStats(message))
                /** Time played og average lifetime krever egen formattering for å være lesbart */
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
                /** Gjør sammenligning og legg til i respons */
                for (const [key, value] of Object.entries(orderedStats)) {
                    if (key === 'gulagKd' && orderedStats.gulagDeaths && orderedStats.gulagKills)
                        response += `\nGulag KD: ${(orderedStats?.gulagKills / orderedStats?.gulagDeaths).toFixed(2)}`
                    else if (this.findHeaderFromKey(key))
                        response += `\n${this.findHeaderFromKey(key)}: ${getValueFormatted(key, value)} ${this.compareOldNewStats(
                            value,
                            oldData[key],
                            key === 'timePlayed' || key === 'avgLifeTime'
                        )}`
                    else if (key === 'gulagKd' && orderedStats.gulagDeaths && orderedStats.gulagKills)
                        response += `\nGulag KD: ${orderedStats?.gulagKills / orderedStats?.gulagDeaths}`
                }

                if (sentMessage) sentMessage.edit(response)
                else this.messageHelper.sendMessage(message.channelId, response)
                if (!noSave) this.saveUserStats(message, messageContent, statsTyped)
            } catch (error) {
                if (sentMessage) sentMessage.delete()
                this.messageHelper.sendMessageToActionLogWithCustomMessage(message, error, 'SSO Token er expired. Denne må byttest før stats kan hentes', true)
            }
        } else {
            /** BR */
            try {
                let data = await API.MWBattleData(gamertag, platform)

                let response = 'BR stats for <' + gamertag + '>'
                const statsTyped = data.br as CodBRStatsType

                const orderedStats: Partial<CodBRStats> = {}
                for (let i = 0; i < WarzoneCommands.BRstatsToInclude.length; i++) {
                    for (const [key, value] of Object.entries(statsTyped)) {
                        if (key === WarzoneCommands.BRstatsToInclude[i].key) {
                            orderedStats[WarzoneCommands.BRstatsToInclude[i].key] = Number(value)
                        }
                    }
                }
                orderedStats['winRatio'] = ((orderedStats?.wins ?? 0) / (orderedStats?.gamesPlayed ?? 1)) * 100
                const oldData = JSON.parse(this.getUserStats(message, true))
                const getValueFormatted = (key: string, value: Number) => {
                    if (key === 'timePlayed') return convertTime(Number(value))
                    return value.toFixed(3).replace(/\.000$/, '')
                }
                /** Gjør sammenligning og legg til i respons */
                for (const [key, value] of Object.entries(orderedStats)) {
                    if (this.findHeaderFromKey(key, true))
                        response += `\n${this.findHeaderFromKey(key, true)}: ${getValueFormatted(key, value)} ${this.compareOldNewStats(
                            value,
                            oldData[key],
                            key === 'timePlayed'
                        )}${key === 'winRatio' ? '%' : ''}`
                }
                if (sentMessage) sentMessage.edit(response)
                else this.messageHelper.sendMessage(message.channelId, response)
                if (!noSave) this.saveUserStats(message, messageContent, statsTyped, true)
            } catch (error) {
                message.reply(error + '')
            }
        }
    }

    private saveGameUsernameToDiscordUser(message: Message, content: string, args: string[]) {
        const game = args[0]
        const platform = args[1]
        const gamertag = args[2]
        let saveString = '' // gamertag + ';' + platform
        if (game === 'wz') {
            saveString = platform + ';' + gamertag
            DatabaseHelper.setValue('activisionUserString', message.author.username, saveString)
            this.messageHelper.reactWithThumbs(message, 'up')
        } else if (game === 'rocket') {
            saveString = platform + ';' + gamertag
            DatabaseHelper.setValue('rocketLeagueUserString', message.author.username, saveString)
            this.messageHelper.reactWithThumbs(message, 'up')
        }
    }

    private getWZUserStringFromDB(message: Message) {
        return DatabaseHelper.getValue('activisionUserString', message.author.username, message, true)
    }

    /**
     *
     * @param current Nåværende statistikk
     * @param storedData Gammel statistikk fra DB
     * @param ignoreCompare Noen stats skal ikke sammenliknes (e.g. time played og average lifetime)
     * @returns
     */
    private compareOldNewStats(current: string | Number, storedData: string | number, ignoreCompare?: boolean) {
        if (ignoreCompare) return ''
        const currentStats = Number(current)
        const oldStorageStats = Number(storedData)
        const value = currentStats - oldStorageStats
        if (currentStats > oldStorageStats) return ` (+${parseFloat(Number(value).toFixed(3))})`
        if (currentStats < oldStorageStats) return ` (${parseFloat(Number(value).toFixed(3))})`
        return ``
    }
    /** Beware of stats: any */
    private saveUserStats(message: Message, messageContent: string, stats: CodStats | CodBRStatsType, isBR?: boolean) {
        DatabaseHelper.setObjectValue(isBR ? 'codStatsBR' : 'codStats', message.author.username, JSON.stringify(stats))
    }
    private getUserStats(message: Message, isBr?: boolean) {
        return DatabaseHelper.getValue(isBr ? 'codStatsBR' : 'codStats', message.author.username, message)
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'br',
                description: "<gamertag> <plattform> (plattform: 'battle',  'psn', 'xbl'",
                command: (rawMessage: Message, messageContent: string) => {
                    this.getBRContent(rawMessage, messageContent)
                },
                category: 'gaming',
            },
            {
                commandName: 'weekly',
                description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
                command: (rawMessage: Message, messageContent: string) => {
                    this.getBRContent(rawMessage, messageContent, true)
                },
                category: 'gaming',
            },
            {
                commandName: 'link',
                description: "<plattform> <gamertag> (plattform: 'battle', 'psn', 'xbl', 'epic')",
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.saveGameUsernameToDiscordUser(rawMessage, messageContent, args)
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
