import { login, platforms, Warzone } from 'call-of-duty-api'
import { Client, Message, MessageEmbed, TextChannel } from 'discord.js'
import { Response } from 'node-fetch'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { actSSOCookie } from '../client-env'
import { ICommandElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
const fetch = require('node-fetch')

export interface CodStats {
    kills: number
    deaths: number
    kdRatio: number
    killsPerGame: number
    damageDone: number
    damageTaken: number | string
    damageDoneTakenRatio: number | string
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

    private async getLastMatchData(message: Message, messageContent: string, args: string[]) {
        const num = Number(args[1]) || 1
        const WZUser = this.getWZUserStringFromDB(message).split(';')
        if (!WZUser) return message.reply('Du må knytta brukernavn te brukeren din fysste')

        const gamertag = WZUser[0]
        const platform = this.translatePlatform(WZUser[1])

        try {
            const waitMsg = await this.messageHelper.sendMessage(message.channelId, 'Laster data ...')
            let data = await Warzone.combatHistory(gamertag, platform)
            let tries = 1
            while (!data?.data?.matches && tries < 3) {
                tries++
                if (waitMsg) waitMsg.edit('Fant ingen data. Forsøker på ny ... (' + tries + '/' + '3)')
                data = await Warzone.combatHistory(gamertag, platform)
            }
            if (!data?.data?.matches) {
                if (waitMsg) return waitMsg.edit(`Fant ingen data for ${gamertag} på ${platform} etter ${tries}/${tries} forsøk. Prøv igjen senere`)
                else return this.messageHelper.sendMessage(message.channelId, 'Fant ingen matches.')
            }
            const matchStart = Number(data?.data?.matches[0]?.utcStartSeconds) * 1000
            const matchStartDate = new Date(matchStart)

            const embedMsg = new MessageEmbed()
                .setTitle(`Siste match for ${gamertag}: ${data?.data?.matches[0]?.playerStats?.teamPlacement ?? 'Ukjent'}. plass `)
                .setDescription(`${matchStartDate ?? 'Ukjent dato og tid'}`)

            embedMsg.addField(`Kills:`, `${data?.data?.matches[0]?.playerStats?.kills ?? 'Ukjent'}`, true)
            embedMsg.addField(`Deaths:`, `${data?.data?.matches[0]?.playerStats?.deaths ?? 'Ukjent'}`, true)
            embedMsg.addField(`K/D Ratio:`, `${data?.data?.matches[0]?.playerStats?.kdRatio ?? 'Ukjent'}`, true)
            embedMsg.addField(`Assists:`, `${data?.data?.matches[0]?.playerStats?.assists ?? 'Ukjent'}`, true)
            embedMsg.addField(`Headshots:`, `${data?.data?.matches[0]?.playerStats?.headshots ?? 'Ukjent'}`, true)
            embedMsg.addField(`Longest streak:`, `${data?.data?.matches[0]?.playerStats?.longestStreak ?? 'Ukjent'}`, true)
            embedMsg.addField(`Damage done:`, `${data?.data?.matches[0]?.playerStats?.damageDone ?? 'Ukjent'}`, true)
            embedMsg.addField(`Damage taken:`, `${data?.data?.matches[0]?.playerStats?.damageTaken ?? 'Ukjent'}`, true)
            embedMsg.addField(`Distance traveled:`, `${data?.data?.matches[0]?.playerStats?.distanceTraveled ?? 'Ukjent'}`, true)
            embedMsg.addField(`Gulag kills:`, `${data?.data?.matches[0]?.playerStats?.gulagKills ?? 'Ukjent'}`, true)
            embedMsg.addField(`Gulag deaths:`, `${data?.data?.matches[0]?.playerStats?.gulagDeaths ?? 'Ukjent'}`, true)
            embedMsg.addField(`Mode:`, `${data?.data?.matches[0]?.mode ?? 'Ukjent'}`, true)
            embedMsg.addField(`Score XP:`, `${data?.data?.matches[0]?.playerStats?.scoreXp ?? 'Ukjent'}`, true)
            embedMsg.addField(`Players in match:`, `${data?.data?.matches[0]?.playerCount}`, true)
            embedMsg.addField(`Rank:`, `${data?.data?.matches[0]?.player?.rank ?? 'Ukjent'}`, true)

            this.messageHelper.sendFormattedMessage(message.channel as TextChannel, embedMsg)
            if (waitMsg) waitMsg.delete()
        } catch (error: any) {
            return message.reply('Klarte ikke hente data: ' + error)
        }
    }

    private async getBRContent(message: Message, messageContent: string, args: string[], isWeekly?: boolean) {
        let gamertag = ''
        let platform: platforms

        if (args[0] === 'siste') {
            return this.getLastMatchData(message, messageContent, args)
        }
        const WZUser = this.getWZUserStringFromDB(message).split(';')
        if (!WZUser) {
            return message.reply('Du må knytta brukernavn te brukeren din fysste')
        }
        gamertag = WZUser[0]
        platform = this.translatePlatform(WZUser[1])

        const filterMode: string = args[0] ?? ' '

        const noSave = filterMode === 'nosave'
        const isRebirth = filterMode === 'rebirth'

        let sentMessage = await this.messageHelper.sendMessage(message.channelId, 'Logger inn...')

        if (!sentMessage) sentMessage = await this.messageHelper.sendMessage(message.channelId, 'Henter data...')
        else await sentMessage.edit('Henter data...')
        if (isWeekly) {
            return this.findWeeklyData(gamertag, platform, message, sentMessage, { noSave: noSave, rebirth: isRebirth })
        } else {
            /** BR */
            return this.findOverallBRData(gamertag, platform, message, sentMessage, { noSave: noSave, rebirth: isRebirth })
        }
    }

    private async findOverallBRData(gamertag: string, platform: platforms, message: Message, editableMessage?: Message, options?: BRDataOptions) {
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
            const oldData = JSON.parse(this.getUserStats(message, true))
            const getValueFormatted = (key: string, value: number) => {
                if (key === 'timePlayed') return convertTime(value)
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
            if (editableMessage) editableMessage.edit(response)
            else this.messageHelper.sendMessage(message.channelId, response)
            if (!options?.noSave) this.saveUserStats(message, statsTyped, true)
        } catch (error) {
            message.reply(error + '.')
            if (editableMessage) editableMessage.edit(`Fant ingen data for ${gamertag}. Er profildataen din åpen? Hvis ja, prøv igjen om ca. ett minutt.`)
            else this.messageHelper.sendMessage(message.channelId, `Fant ingen data for ${gamertag}.`)
        }
    }

    private async findWeeklyData(gamertag: string, platform: platforms, message: Message, editableMessage?: Message, options?: BRDataOptions) {
        try {
            const data = await Warzone.fullData(gamertag, platform)
            let response = 'Weekly Warzone stats for <' + gamertag + '>'

            if (!data?.data?.weekly) {
                if (editableMessage) return editableMessage.edit('Du har ingen statistikk denne ukå, bro')
                return this.messageHelper.sendMessage(message.channelId, 'Du har ingen statistikk denne ukå, bro')
            }

            if (options?.rebirth && data.data.weekly.mode) {
                return this.findWeeklyRebirthOnly(gamertag, data, message, editableMessage)
            }

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
                if (key === 'gulagKd' && orderedStats.gulagDeaths && orderedStats.gulagKills) {
                    // response += `\nGulag KD: ${(orderedStats?.gulagKills / orderedStats?.gulagDeaths).toFixed(2)} ${this.compareOldNewStats(
                    //     orderedStats['gulagKd'],
                    //     oldData[key]
                    // )}`
                    statsTyped['gulagKd'] = orderedStats['gulagKd'] ?? 0
                }
                if (key === 'damageDoneTakenRatio' && orderedStats.damageDone && orderedStats.damageTaken) {
                    response += `\nDamage Done/Taken ratio: ${(Number(orderedStats?.damageDone) / parseInt(orderedStats?.damageTaken.toString())).toFixed(
                        3
                    )} ${this.compareOldNewStats(orderedStats['damageDoneTakenRatio'], oldData[key])}`

                    statsTyped['damageDoneTakenRatio'] = orderedStats['damageDoneTakenRatio'] ?? 0
                } else if (this.findHeaderFromKey(key))
                    response += `\n${this.findHeaderFromKey(key)}: ${getValueFormatted(key, value)} ${this.compareOldNewStats(
                        value,
                        oldData[key],
                        !this.isCorrectHeader({ key: key as CodStatsType, header: 'none' })
                    )}`
            }

            if (editableMessage) editableMessage.edit(response)
            else this.messageHelper.sendMessage(message.channelId, response)
            if (!options?.noSave) this.saveUserStats(message, statsTyped)
        } catch (error) {
            if (editableMessage) {
                editableMessage.edit(`Klarte ikke finne data for ${gamertag}. Hvis du vet at du ikke mangler data denne uken, prøv på ny om ca. ett minutt.`)
            } else {
                this.messageHelper.sendMessageToActionLogWithCustomMessage(message, error, 'Dataen kunne ikke hentes', true)
            }
        }
    }

    /** Sjekk om headeren finnes i stats som skal sammenlignes */
    private isCorrectHeader(key: codStatsKeyHeader) {
        return !!WarzoneCommands.statsToIncludeInSave.find((k) => k?.key === key?.key)?.header
    }

    private findWeeklyRebirthOnly(gamertag: string, data: any, message: Message, editableMessage?: Message) {
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
        let rebirthResponse = ` Weekly REBIRTH ONLY Stats for <${gamertag}>\nKills: ${numKills}\nDeaths: ${numDeaths}\nDamage Done: ${numDamage}\nDamage Taken: ${numDamageTaken}`
        if (editableMessage) editableMessage.edit(rebirthResponse)
        else this.messageHelper.sendMessage(message.channelId, rebirthResponse)
        return
    }

    private async findWeeklyPlaylist(message: Message, content: String, args: String[]) {
        let found = false
        let i = 0
        const now = new Date()
        let sentMessage = await this.messageHelper.sendMessage(message.channelId, 'Henter data...')
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
                                    if (sentMessage) sentMessage.edit(data.url)
                                    else this.messageHelper.sendMessage(message.channelId, data.url)
                                })
                        }
                    }
                    i += 1
                }
                if (!found) {
                    if (sentMessage) sentMessage.edit('Fant ikke playlist')
                    else this.messageHelper.sendMessage(message.channelId, 'Fant ikke playlist')
                }
            })
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
    private compareOldNewStats(current: string | Number | undefined, storedData: string | number | undefined, ignoreCompare?: boolean) {
        if (ignoreCompare) return ''
        const currentStats = Number(current)
        const oldStorageStats = Number(storedData)
        const value = currentStats - oldStorageStats
        if (currentStats > oldStorageStats) return ` (+${parseFloat(Number(value).toFixed(3))})`
        if (currentStats < oldStorageStats) return ` (${parseFloat(Number(value).toFixed(3))})`
        return ``
    }
    /** Beware of stats: any */
    private saveUserStats(message: Message, stats: CodStats | CodBRStatsType, isBR?: boolean) {
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
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.getBRContent(rawMessage, messageContent, args)
                },
                category: 'gaming',
            },
            {
                commandName: 'weekly',
                description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.getBRContent(rawMessage, messageContent, args, true)
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
            {
                commandName: 'playlist',
                description: 'playlist',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.findWeeklyPlaylist(rawMessage, messageContent, args)
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
