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
    damageTaken: number
    headshotPerc: number
    gulagDeaths: number
    gulagKills: number
    wallBangs: number
    executions: number
    headshots: number
    matchesPlayed: number
    gulagKd: number
    objectiveMunitionsBoxTeammateUsed: number //Muniton Boxes used
    objectiveBrCacheOpen: number //Chests opened
    objectiveBrKioskBuy: number //Items bought at store
}

interface codStatsKeyHeader {
    key: string
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
        const gamertag = content[0]
        const platform = content[1]

        let sentMessage = await MessageHelper.sendMessage(message, 'Logger inn...')

        let response = ''

        if (!sentMessage) sentMessage = await MessageHelper.sendMessage(message, 'Henter data...')
        else await sentMessage.edit('Henter data...')
        if (isWeekly) {
            response += 'Weekly Warzone stats for <' + gamertag + '>'
            try {
                let data = await API.MWweeklystats(gamertag, platform)

                const stats = data.wz.mode.br_all.properties
                const statsTyped = stats as CodStats

                const oldData = JSON.parse(this.getUserStats(message))

                /** Noen stats krever formattering, som f.eks time played som kommer i sekund. */
                const getValueFormatted = (key: string, value: string) => {
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

                for (const [key, value] of Object.entries(statsTyped)) {
                    if (this.findHeaderFromKey(key))
                        response += `\n${this.findHeaderFromKey(key)}: ${getValueFormatted(key, value)} ${this.compareOldNewStats(value, oldData[key])}`
                }
                if (sentMessage) sentMessage.edit(response)
                else MessageHelper.sendMessage(message, response)

                const saveStatsObject: CodStats = {
                    kills: Number(stats.kills),
                    deaths: Number(stats.deaths),
                    damageDone: Number(stats.damageDone),
                    damageTaken: Number(stats.damageTaken),
                    executions: Number(stats.executions),
                    gulagDeaths: Number(stats.gulagDeaths),
                    gulagKills: Number(stats.gulagKills),
                    headshotPerc: Number(stats.headshotPercentage),
                    headshots: Number(stats.headshots),
                    kdRatio: Number(stats.kdRatio),
                    killsPerGame: Number(stats.killsPerGame),
                    matchesPlayed: Number(stats.matchesPlayed),
                    wallBangs: Number(stats.wallBangs),
                    objectiveBrCacheOpen: Number(stats.objectiveBrCacheOpen),
                    gulagKd: Number(stats.gulagKills / Number(stats.gulagDeaths)),
                    objectiveBrKioskBuy: Number(stats.objectiveBrKioskBuy),
                    objectiveMunitionsBoxTeammateUsed: Number(stats.objectiveMunitionsBoxTeammateUsed),
                }
                this.saveUserStats(message, messageContent, saveStatsObject)
            } catch (error) {
                if (sentMessage)
                    sentMessage.edit(
                        'Du har ingen statistikk for denne ukå, bro (eller så e ikkje statistikken din offentlig. *Logg inn på https://my.callofduty.com/login og gjør den offentlig*). Stacktrace: ' +
                            error
                    )
                else
                    MessageHelper.sendMessage(
                        message,
                        'Du har ingen statistikk for denne ukå, bro (eller så e ikkje statistikken din offentlig. *Logg inn på https://my.callofduty.com/login og gjør den offentlig*). Stacktrace: ' +
                            error
                    )
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

    static compareOldNewStats(current: string, storedData: string | number, isFloat?: boolean) {
        const currentStats = Number(current)
        const oldStorageStats = Number(storedData)
        const value = isFloat ? (currentStats - oldStorageStats).toFixed(3) : currentStats - oldStorageStats
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
        description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
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
