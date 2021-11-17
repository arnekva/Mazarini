import { Channel, Client, DMChannel, Message, NewsChannel, TextChannel } from 'discord.js'
import { actSSOCookie } from '../client-env'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { ICommandElement } from './commands'
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

interface codStatsKeyHeader {
    key: CodStatsType
    header: string
}

export class WarzoneCommands {
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

    static findHeaderFromKey(key: string) {
        return this.statsToInclude.filter((el) => el.key === key).pop()?.header
    }

    static async getBRContent(message: Message, messageContent: string, isWeekly?: boolean) {
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

        let sentMessage = await MessageHelper.sendMessage(message, 'Logger inn...')
        let response = ''

        if (!sentMessage) sentMessage = await MessageHelper.sendMessage(message, 'Henter data...')
        else await sentMessage.edit('Henter data...')
        if (isWeekly) {
            response += 'Weekly Warzone stats for <' + gamertag + '>'
            try {
                let data = await API.MWweeklystats(gamertag, platform)

                if (!data.wz.mode.br_all) {
                    if (sentMessage) sentMessage.edit('Her skjedde det noe galt. Statistikken kunne ikke leses. Prøv på ny ')
                    else MessageHelper.sendMessage(message, 'Her skjedde det noe galt. Statistikken kunne ikke leses. Prøv på ny ')
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
                    else MessageHelper.sendMessage(message, rebirthResponse)
                    return
                }

                const statsTyped = data.wz.mode.br_all.properties as CodStats

                const orderedStats: Partial<CodStats> = {}
                for (let i = 0; i < this.statsToInclude.length; i++) {
                    for (const [key, value] of Object.entries(statsTyped)) {
                        if (key === this.statsToInclude[i].key) {
                            if (key === 'damageTaken' && Number(orderedStats['damageTaken']) > Number(orderedStats['damageDone'])) {
                                orderedStats['damageTaken'] = value + ' (flaut)'
                            } else orderedStats[this.statsToInclude[i].key] = value
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
                        ).minutes.toFixed(0)} minutes`
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
                else MessageHelper.sendMessage(message, response)
                if (!noSave) this.saveUserStats(message, messageContent, statsTyped)
            } catch (error) {
                if (sentMessage) sentMessage.edit('Enten har du ingen statistikk for ukå eller så e SSO-tokenen expired. Stacktrace: ' + error)
                else MessageHelper.sendMessage(message, 'Enten har du ingen statistikk for ukå eller så e SSO-tokenen expired. Stacktrace: ' + error)
            }
            // MessageHelper.sendMessage(message.channel, response)
        } else {
            try {
                let data = await API.MWBattleData(gamertag, platform)
                response += 'Battle Royale stats for <' + gamertag + '>:'
                response += '\nWins: ' + data.br.wins
                response += '\nKills: ' + data.br.kills
                response += '\nDeaths: ' + data.br.deaths
                response += '\nK/D Ratio: ' + data.br.kdRatio.toFixed(3)
                response += '\nDowns: ' + data.br.downs
                response += '\nTop 25: ' + data.br.topTwentyFive
                response += '\nTop 10: ' + data.br.topTen
                response += '\nTop 5: ' + data.br.topFive
                response += '\nNumber of Contracts: ' + data.br.contracts
                response += '\nTime Played: ' + convertTime(data.br.timePlayed)
                response += '\nGames Played: ' + data.br.gamesPlayed
                if (sentMessage) sentMessage.edit(response)
                else MessageHelper.sendMessage(message, response)
            } catch (error) {
                MessageHelper.sendMessageToActionLogWithCustomMessage(
                    message,
                    error,
                    'Du har enten skrevet feil brukernavn eller ikke gjort statistikken din offentlig. *(Logg inn på https://my.callofduty.com/login og gjør den offentlig)*'
                )
            }
        }
    }

    static saveWZUsernameToDiscordUser(message: Message, content: string, args: string[]) {
        const platform = args.pop()
        const gamertag = args

        const saveString = gamertag + ';' + platform
        DatabaseHelper.setValue('activisionUserString', message.author.username, saveString)
        message.react('👍')
    }

    static getWZUserStringFromDB(message: Message) {
        return DatabaseHelper.getValue('activisionUserString', message.author.username, message, true)
    }

    /**
     *
     * @param current Nåværende statistikk
     * @param storedData Gammel statistikk fra DB
     * @param ignoreCompare Noen stats skal ikke sammenliknes (e.g. time played og average lifetime)
     * @returns
     */
    static compareOldNewStats(current: string | Number, storedData: string | number, ignoreCompare?: boolean) {
        if (ignoreCompare) return ''
        const currentStats = Number(current)
        const oldStorageStats = Number(storedData)
        const value = currentStats - oldStorageStats
        if (currentStats > oldStorageStats) return ` (+${parseFloat(Number(value).toFixed(3))})`
        if (currentStats < oldStorageStats) return ` (${parseFloat(Number(value).toFixed(3))})`
        return ``
    }
    /** Beware of stats: any */
    static saveUserStats(message: Message, messageContent: string, stats: CodStats) {
        DatabaseHelper.setObjectValue('codStats', message.author.username, JSON.stringify(stats))
    }
    static getUserStats(message: Message) {
        return DatabaseHelper.getValue('codStats', message.author.username, message)
    }

    static readonly getWZStats: ICommandElement = {
        commandName: 'br',
        description: "<gamertag> <plattform> (plattform: 'battle',  'psn', 'xbl'",
        command: (rawMessage: Message, messageContent: string) => {
            WarzoneCommands.getBRContent(rawMessage, messageContent)
        },
        category: 'gaming',
    }
    static readonly getWeeklyWZStats: ICommandElement = {
        commandName: 'weekly',
        description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
        command: (rawMessage: Message, messageContent: string) => {
            WarzoneCommands.getBRContent(rawMessage, messageContent, true)
        },
        category: 'gaming',
    }
    static readonly saveWZUsernameCommand: ICommandElement = {
        commandName: 'wzname',
        description: "<gamertag> <plattform> (plattform: 'battle', 'psn', 'xbl')",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            WarzoneCommands.saveWZUsernameToDiscordUser(rawMessage, messageContent, args)
        },
        category: 'gaming',
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

function getMode(mode: string) {
    let gameMode = ''
    switch (mode) {
        case 'br':
        case 'battleroyale':
        case 'battle':
            gameMode = 'br'
            break

        case 'pl':
        case 'plunder':
            gameMode = 'plunder'
            break

        case 'mr':
        case 'mini':
            gameMode = 'mini'
            break

        case 'resurgence':
        case 'rebirth':
        case 'rs':
            gameMode = 'resurgence'
            break
        default:
            gameMode = 'ugyldig'
            return gameMode
    }
}
