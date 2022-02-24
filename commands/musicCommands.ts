import { Client, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { lfKey } from '../client-env'
import { ICommandElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { replaceLast, splitUsername } from '../utils/textUtils'
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

    async findCommand(message: Message, content: string, args: string[], params?: IFindCommand) {
        if (!args[0]) {
            message.reply("Feilformattert. Mangler du f.eks 'topp'?")
            return
        }
        /** CHECKS at alt eksistere */
        const method = methods.filter((e) => e.command == args[0])[0]

        if (args[0] != 'user') {
            if (!method) {
                message.reply("Kommandoen eksisterer ikke. Bruk 'topp' eller 'weekly'")
                return
            }

            let username = this.getLastFMUsernameByDiscordUsername(params?.usernameToLookup ?? message.author.username, message)
            console.log(username)

            //Check if fourth ([3]) argument is a valid username - if so, override author.username. Otherwise, treat [3] as 'stats' option.
            let usernameFromArgs = this.getLastFMUsernameByDiscordUsername(splitUsername(args[2]) ?? '', message)
            if (usernameFromArgs) username = usernameFromArgs
            let limit = args[2] ?? '10'
            if (!username) {
                if (!params?.isSilent) message.reply("Du har ikke registrert brukernavnet ditt. Bruk '!mz musikk user <discordnavn> <last.fm navn>")
                return
            }
            const cmd = this.getCommand(method.command, args[1])

            if (method.command === 'siste' && args[2]) {
                const nyUser = this.getLastFMUsernameByDiscordUsername(args[2], message)
                if (nyUser) {
                    username = nyUser
                } else {
                    if (!params?.isSilent)
                        message.reply(
                            "du har oppgitt et brukernavn som ikke har tilknyttet Last.fm-kontoen sin ('!mz musikk user <discordnavn> <last.fm navn>')"
                        )
                    return
                }
            }
            limit = (Number(args[1]) ? args[1] : args[2]) ?? '5'
            if (!cmd) {
                message.reply("kommandoen mangler 'artist', 'songs' eller 'album' eller  bak 'topp', 'weekly' eller 'siste'")
                return
            }
            /** CHECKS END */

            const data: fetchData = {
                user: username,
                method: { cmd: cmd, desc: method.title },
                limit: limit,
                includeStats: usernameFromArgs ? !!args[4] : !!args[3], //If overriding username, stats index is pushed back by 1 index
                silent: params?.isSilent ?? false,
                includeNameInOutput: params?.includeUsername ?? false,
                username: args[2] ?? message.author.username,
            }
            console.log(data)

            const dataRet = await this.findLastFmData(message, data, params?.notWeeklyOrRecent, params?.isSilent)
            return dataRet
        } else {
            if (args[1] && args[2]) {
                if (args[1] !== message.author.username) {
                    message.reply('du kan kun knytte ditt eget brukernavn')
                    return
                }
                this.connectLastFmUsernameToUser(args[1], args[2], message)
                message.reply('Knyttet bruker ' + args[1] + ' til Last.fm brukernavnet ' + args[2])
            } else {
                message.reply("formattering skal være '!mz music user *DISCORDNAVN* *LAST.FMNAVN*")
            }
        }
    }

    private getCommand(c: commandTypes, s: string) {
        switch (c) {
            case 'topp':
                if (s as topMethods) return this.findTopMethod(s)
            case 'weekly':
                if (s as weeklyMethods) return this.findWeeklyMethod(s)
            case 'siste':
                if (s as weeklyMethods) return this.findLastPlayedSongs(s)
        }
    }

    private findLastPlayedSongs(m: string) {
        return 'user.' + 'getrecenttracks'
    }

    private findLastMethod(m: string) {}

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
                return undefined
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
                return undefined
        }
    }
    /*
Docs: https://www.last.fm/api/show/user.getInfo
    */
    /**
     * Finn last FM data
     * @param message
     * @param dataParam
     * @returns
     */
    private async findLastFmData(message: Message, dataParam: fetchData, notWeeklyOrRecent?: boolean, silent?: boolean) {
        if (parseInt(dataParam.limit) > 30) {
            message.reply('Litt for høg limit, deranes. Maks 30.')
            return
        } else if (!parseInt(dataParam.limit)) {
            dataParam.limit = '10'
            dataParam.includeStats = true
        }
        let msg: Message
        if (!silent) msg = (await this.messageHelper.sendMessage(message.channelId, 'Laster data fra Last.FM ...')) as Message
        const apiKey = lfKey
        const emoji = await EmojiHelper.getEmoji('catJAM', message)

        let artistString = ''

        /**Promise.all siden vi gjør 2 fetches og trenger at begge resolves samtidig */
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
                        /** Forskjellige metoder har litt forskjellig respons, så det ligger en del boolean verdier på toppen for å sjekke dette når det skal hentes ut */
                        if (!topData || !info['user']) {
                            if (msg) msg.edit('Fant ingen data fra Last.fm.')
                            setTimeout(() => {
                                if (msg) msg.delete()
                            }, 5000)
                            return
                        }

                        const isFormattedWithHashtag = notWeeklyOrRecent
                            ? true
                            : dataParam.method.cmd.includes('weekly') || dataParam.method.cmd.includes('recent')
                        const isWeekly = dataParam.method.cmd.includes('weekly')
                        const isNotRecent = !dataParam.method.cmd.includes('recent')
                        const totalPlaycount = info['user']?.playcount ?? '1'

                        let prop
                        /** En metode ser ut som typ user.getrecenttrack. Her fjerner vi user.get for å finne ut hvilken metode som er brukt. */
                        const strippedMethod = dataParam.method.cmd.replace('user.get', '')
                        /** Fjern unødvendige ting fra stringen for å finne kun metodenavnet */
                        const methodWithoutGet = isWeekly
                            ? strippedMethod.replace('weekly', '').replace('chart', '')
                            : replaceLast(strippedMethod.replace('top', '').replace('recent', ''), 's', '')
                        /** Prop er fulle dataen som hentes ut */
                        prop = topData[strippedMethod][methodWithoutGet] as { name: string; playcount: string; artist?: { name: string } }[]

                        let numPlaysInTopX = 0
                        if (prop) {
                            let hasCurrentlyPlaying = false
                            prop.forEach((element: any, index) => {
                                const isCurrentlyPlaying = !isNotRecent && element.hasOwnProperty('@attr')
                                if (hasCurrentlyPlaying && dataParam.includeNameInOutput) return
                                if (isCurrentlyPlaying) hasCurrentlyPlaying = true
                                numPlaysInTopX += parseInt(element.playcount)

                                /** Denne ser kanskje lang ut, men den lager hver linje. Først ser den etter artist (hentes forskjellig fra weekly), legger til bindestrek, sjekker etter sangnavn etc.  */
                                artistString +=
                                    `\n${dataParam.includeNameInOutput ? '(' + dataParam.username + ') ' : ''}${
                                        isFormattedWithHashtag && element.artist
                                            ? element.artist['#text'] + ' - '
                                            : element.artist
                                            ? element.artist.name + ' - '
                                            : ''
                                    }` +
                                    `${element.name} ${isNotRecent ? '(' + element.playcount + ' plays)' : ''} ` +
                                    `${dataParam.includeStats ? ((parseInt(element.playcount) / parseInt(totalPlaycount)) * 100).toFixed(1) + '%' : ''} ` +
                                    `${isCurrentlyPlaying ? '(Spiller nå) ' + emoji.id : ''} ` +
                                    /** Silent er når botten selv trigger metoden (f.eks. fra spotify-command). Da vil man ha med datostempelet. Ikke nødvendig ellers */
                                    `${
                                        dataParam.silent
                                            ? isCurrentlyPlaying
                                                ? ''
                                                : '(' + new Date(Number(element.date['uts']) * 1000).toLocaleString('nb-NO') + ')'
                                            : ''
                                    }`
                            })
                            /** Hvis prop-en er formattert med en # (eks. ['@attr']) så finnes ikke total plays. */
                            if (!isFormattedWithHashtag)
                                artistString += `\n*Totalt ${topData[strippedMethod]['@attr'].total} ${methodWithoutGet}s i biblioteket`
                        } else message.reply('Fant ingen data. Kanskje feilformattert?')
                        if (!isFormattedWithHashtag)
                            artistString += `, ${totalPlaycount} totale avspillinger. ${
                                dataParam.includeStats
                                    ? ((numPlaysInTopX / parseInt(totalPlaycount)) * 100).toFixed(1) +
                                      '% av avspillingene er fra dine topp ' +
                                      dataParam.limit +
                                      '.'
                                    : ''
                            }* `
                        let retMessage

                        if (!artistString.trim()) {
                            this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, `Meldingen som ble forsøkt sendt er tom: <${message}>`)
                            return
                        }
                        if (!silent) {
                            if (msg) msg.edit(artistString)
                            else retMessage = this.messageHelper.sendMessage(message.channelId, artistString)
                        }
                        arrayDataRet.push(artistString)
                        // return retMessage
                    })
                    .catch((error: any) => {
                        this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                    })
            })
            .catch((error: any) => {
                this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            })
        return arrayDataRet
    }

    private getLastFMUsernameByDiscordUsername(username: string, rawMessage: Message) {
        return DatabaseHelper.getValueWithoutMessage('lastFmUsername', username)
    }
    private connectLastFmUsernameToUser(username: string, lfUsername: string, rawMessage: Message) {
        return DatabaseHelper.setValue('lastFmUsername', username, lfUsername)
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'musikk',
                description:
                    "Bruk '!mz musikk <topp|weekly|siste> <songs|albums|artist> <limit?>(valgfri). Koble til Last.fm med '!mz music user *discord brukernavn* *Last.fm brukernavn*'",
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.findCommand(rawMessage, messageContent, args)
                },
                category: 'musikk',
            },
        ]
    }
}
