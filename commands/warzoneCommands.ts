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
}
export class WarzoneCommands {
    static async getBRContent(message: Message, messageContent: string, isWeekly?: boolean) {
        const content = messageContent.split(' ')
        const gamertag = content[0]
        const platform = content[1]
        const bewareMessage = '' //"**OBS!** *Bruker development-versjon av modulen (api@2.0.0-dev). Denne er ustabil, og kan bli stuck på innlogging eller henting av info.*\n";
        let sentMessage = await MessageHelper.sendMessage(message, 'Logger inn...' + '\n' + bewareMessage)

        let response = ''
        //Fjern denne når modulen er fikset.
        response += bewareMessage
        if (!sentMessage) sentMessage = await MessageHelper.sendMessage(message, 'Henter data...')
        else await sentMessage.edit(bewareMessage + '\n' + 'Henter data...')
        if (isWeekly) {
            response += 'Weekly Warzone stats for <' + gamertag + '>'

            try {
                let data = await API.MWweeklystats(gamertag, platform)

                const stats = data.wz.mode.br_all.properties
                const timePlayed = DateUtils.secondsToHoursAndMinutes(stats.timePlayed.toFixed(0))
                const averageTime = DateUtils.secondsToMinutesAndSeconds(stats.avgLifeTime.toFixed(0))
                const oldData = JSON.parse(this.getUserStats(message))

                response += '\nKills: ' + stats.kills + this.compareOldNewStats(stats.kills, oldData.kills)
                response += '\nDeaths: ' + stats.deaths + this.compareOldNewStats(stats.deaths, oldData.deaths)
                response += '\nK/D Ratio: ' + stats.kdRatio.toFixed(3) + this.compareOldNewStats(stats.kdRatio, oldData.kdRatio, true)
                response += '\nKills per game: ' + stats.killsPerGame.toFixed(3) + this.compareOldNewStats(stats.killsPerGame, oldData.killsPerGame, true)
                response += '\nDamage Done: ' + stats.damageDone + this.compareOldNewStats(stats.damageDone, oldData.damageDone)
                response += '\nDamage Taken: ' + stats.damageTaken + (stats.damageTaken > stats.damageDone ? ' (flaut) ' : '')
                response += '\nHeadshot percentage: ' + stats.headshotPercentage.toFixed(3)
                response += '\nGulag Deaths: ' + stats.gulagDeaths + this.compareOldNewStats(stats.gulagDeaths, oldData.gulagDeaths)
                response += '\nGulag Kills: ' + stats.gulagKills + this.compareOldNewStats(stats.gulagKills, oldData.gulagKills)
                response += '\nGulag K/D: ' + (stats.gulagKills / stats.gulagDeaths).toFixed(3)
                response += `\nTime played: ${timePlayed.hours} hours and ${timePlayed.minutes} minutes`
                response += `\nAverage Lifetime: ${averageTime.minutes} minutes and ${averageTime.seconds} seconds`
                response += '\nWall bangs: ' + stats.wallBangs + this.compareOldNewStats(stats.wallBangs, oldData.wallBangs)
                response += '\nHeadshots: ' + stats.headshots + this.compareOldNewStats(stats.headshots, oldData.headshots)
                response += '\nExecutions: ' + stats.executions + this.compareOldNewStats(stats.executions, oldData.executions)
                response += '\nNo. items bought at store: ' + stats.objectiveBrKioskBuy ?? '0'
                response += '\nMunition boxes used: ' + stats.objectiveMunitionsBoxTeammateUsed ?? '0'
                response += '\nMatches Played: ' + stats.matchesPlayed + this.compareOldNewStats(stats.matchesPlayed, oldData.matchesPlayed)
                response += '\nChests opened: ' + stats.objectiveBrCacheOpen
                response +=
                    '\nEnemies down (circle 1, 2, 3, 4, 5): ' +
                    (stats.objectiveBrDownEnemyCircle1 ?? '0') +
                    ', ' +
                    (stats.objectiveBrDownEnemyCircle2 ?? '0') +
                    ', ' +
                    (stats.objectiveBrDownEnemyCircle3 ?? '0') +
                    ', ' +
                    (stats.objectiveBrDownEnemyCircle4 ?? '0') +
                    ', ' +
                    (stats.objectiveBrDownEnemyCircle5 ?? '0') +
                    ' '
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
                }
                this.saveUserStats(message, messageContent, saveStatsObject)
            } catch (error) {
                if (sentMessage) sentMessage.edit('Du har ingen statistikk for denne ukå, bro (eller så funke ikkje koden). Stacktrace: ' + error)
                else MessageHelper.sendMessage(message, 'Du har ingen statistikk for denne ukå, bro (eller så funke ikkje koden). Stacktrace: ' + error)
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
        if (currentStats > oldStorageStats) return ` (+${value})`
        if (currentStats < oldStorageStats) return ` (${value})`
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
