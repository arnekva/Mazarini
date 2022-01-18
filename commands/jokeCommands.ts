import { time } from 'console'
import { Message, User, TextChannel, Client } from 'discord.js'
import { globalArrays } from '../globals'
import { AchievementHelper } from '../helpers/achievementHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { countdownTime, DateUtils } from '../utils/dateUtils'
import { findFeseText, findLetterEmoji } from '../utils/miscUtils'
import {
    doesTextIncludeUsername,
    getUsernameInQuotationMarks,
    msToTime,
    replaceAtWithTextUsername,
    reverseMessageString,
    splitUsername,
} from '../utils/textUtils'
import { ICommandElement } from './commands'
import { EmojiHelper } from '../helpers/emojiHelper'
import { Languages } from '../helpers/languageHelpers'
import { AbstractCommands } from '../Abstracts/AbstractCommand'

export class JokeCommands extends AbstractCommands {
    constructor(client: Client) {
        super(client)
    }
    static async vaskHuset(message: Message) {
        await MessageHelper.sendMessage(message, Math.random() < 0.75 ? 'Øyvind, vask huset!' : 'Har ei jækla fine klokka')
    }

    static async kLikka(message: Message) {
        await MessageHelper.sendMessage(
            message,
            Math.random() < 0.5 ? 'Han ' + (Math.random() < 0.5 ? 'skaaahhæææææmmmmm' : '') + 'trunte på vei te buen ' : ' krækka open a kold one'
        )
    }

    static async thomasTing(message: Message) {
        await MessageHelper.sendMessage(
            message,
            Math.random() < 0.3 ? 'Har skamphese :)' : Math.random() < 0.5 ? 'Han hørte deg kje for han spiste jo :(' : 'Sovna på golve :)'
        )
    }

    static async mordi(message: Message) {
        const emoji = await EmojiHelper.getEmoji('eyebrows', message)

        await MessageHelper.sendMessage(message, Math.random() > 0.05 ? `E nais ${emoji.id}` : `E skamnais :eyebrows: ${emoji.id}`)
    }

    static async eivind(message: Message) {
        await MessageHelper.sendMessage(
            message,
            Math.random() < 0.7
                ? 'Lure på om most important news showe up på vår channel? Kan någen oppdatera han på server-bot-news-channel-fronten, faen ka'
                : 'Spsie pistasj :3'
        )
    }

    static async arne(message: Message) {
        await MessageHelper.sendMessage(message, 'Det vil alltid vær aldersdifferanse mellom folk av forskjellige alder')
    }

    static async isMaggiPlaying(message: Message, content: string, args: string[]) {
        let name = message.author.username
        if (args[0]) name = args[0]
        const guild = message.channel.client.guilds.cache.get('340626855990132747')
        if (guild) {
            const user = guild.members.cache.filter((u) => u.user.username.toLowerCase() === name.toLowerCase()).first()
            if (user && user.presence) {
                if (user.presence.clientStatus) {
                    if (user.presence.activities && user.presence.activities[0]) {
                        const activities = user.presence.activities.filter((a) => a.name.toLowerCase() !== 'custom status').map((act) => act.name)

                        await MessageHelper.sendMessage(
                            message,
                            `${name} drive me ${activities.length > 1 ? 'disse aktivitene' : 'aktiviteten'}: ${activities.join(', ')}`
                        )
                    } else {
                        await MessageHelper.sendMessage(message, 'Ingen aktivitet registrert på Discord.')
                    }
                }
            } else {
                await MessageHelper.sendMessage(message, 'Fant ikke brukeren. Husk at du må bruke **brukernavn** og *ikke* display name')
            }
        }
    }

    static async updateMygleStatus(message: Message, messageContent: string) {
        let content = messageContent
        const matchedUsrname = doesTextIncludeUsername(content)
        if (message.mentions.roles.size > 0) {
            message.reply('Du kan kje ha roller i statusen din, bro')
            return
        }
        let url
        if (message.attachments) {
            url = message.attachments.first()?.url
        }

        const count = messageContent.split('://')
        const count2 = messageContent.split('www')
        if (count.length > 2 || count2.length > 2) {
            message.reply('Max ein attachment, bro')
            return
        }
        content = content.replace(/(?:\r\n|\r|\n)/g, ' ')
        content = replaceAtWithTextUsername(content, message)

        if (content.length < 150 && content.trim().length > 0) {
            if (message.content.includes('!zm')) {
                content = reverseMessageString(content)
            }
            DatabaseHelper.setValue('mygling', message.author.username, content + (url ? ' ' + url : ''))
            MessageHelper.reactWithRandomEmoji(message)
        } else {
            MessageHelper.sendMessage(
                message,
                content.trim().length > 0 ? 'Du kan kje mygla så møye. Mindre enn 150 tegn, takk' : 'Du må sei koffor du mygle, bro'
            )
        }
    }
    static async getAllMygleStatus(message: Message) {
        const mygling = await DatabaseHelper.getAllValuesFromPrefix('mygling', message)
        let myglinger = ''
        mygling.forEach((status) => (myglinger += status.val ? status.key + ' ' + status.val + '\n' : ''))
        myglinger = myglinger.trim() ? myglinger : 'Ingen har satt statusen sin i dag'
        MessageHelper.sendMessage(message, myglinger)
        // const vals = await DatabaseHelper.getAllValuesFromPrefix("mygling")
    }

    static async eivindprideItAll(message: Message) {
        try {
            const channel = message.channel as TextChannel
            const react = message.guild?.emojis.cache.find((emoji) => emoji.name == 'eivindpride')

            if (message.client) {
                channel.messages
                    .fetch({ limit: 15 })
                    .then((el) => {
                        el.forEach((message) => {
                            if (react) message.react(react)
                        })
                    })
                    .catch((error: any) => {
                        MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                    })
            }
        } catch (error) {
            MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
        }
        if (message.guild) {
            const react = message.guild.emojis.cache.find((emoji) => emoji.name == 'eivindpride')
            if (react) {
            }
        }
    }
    /**
     * String sent must not contain repeat characters
     */
    static async reactWithLetters(message: Message, msgContent: string, args: string[] | undefined) {
        const splitTab = msgContent.split(' ')
        let msgId = ''
        let letterTab: string[] = []

        for (let i = 0; i < splitTab.length; i++) {
            let wasPreviousIndexWord = false
            if (splitTab[i].length > 10 && parseInt(splitTab[i])) {
                msgId = splitTab[i]
                wasPreviousIndexWord = false
            } else {
                const newWord = (i == 0 || !wasPreviousIndexWord ? '' : ' ') + splitTab[i]
                wasPreviousIndexWord = true
                letterTab = letterTab.concat(newWord.split(''))
            }
        }
        let messageToReactTo = message
        if (msgId) {
            let searchMessage = await MessageHelper.findMessageById(message, msgId)
            if (searchMessage) messageToReactTo = searchMessage
        }

        let usedLetter = ''
        let spaceCounter = 0
        letterTab.forEach((letter: string) => {
            if (usedLetter.includes(letter) && letter == ' ') {
                spaceCounter++
            }
            const emoji = usedLetter.includes(letter) ? findLetterEmoji(letter, true, spaceCounter) : findLetterEmoji(letter)
            usedLetter += letter
            try {
                messageToReactTo.react(emoji).catch((error) => console.log(error))
            } catch (error) {
                console.log(error)
            }
        })
    }
    static kanPersonen(message: Message, msgContent: string, args: string[]) {
        const name = splitUsername(args[0])
        MessageHelper.sendMessage(message, `${name} ` + ArrayUtils.randomChoiceFromArray(globalArrays.kanIkkjeTekster))
    }

    static async uWuIfyer(message: Message, msgContent: string, args: string[]) {
        let fMsg
        if (args && args[0] && args[0].length > 10 && parseInt(args[0])) {
            fMsg = await MessageHelper.sendMessage(message, 'Leter etter meldingen...')
            const msgToUwU = await (<Message>(<unknown>MessageHelper.findMessageById(message, msgContent)))
            if (msgToUwU) {
                const uwuIfiedText = JokeCommands.uwuText(msgToUwU.content)
                if (fMsg) fMsg.edit(uwuIfiedText)
                else MessageHelper.sendMessage(message, uwuIfiedText)
            }
            if (!msgToUwU && fMsg) fMsg.edit('Fant ikke meldingen :(')
        } else {
            let textToBeUwued = JokeCommands.uwuText(args.length > 0 ? args.join(' ') : 'Please skriv inn ein tekst eller id neste gang')
            MessageHelper.sendMessage(message, textToBeUwued)
        }
    }

    static harFese(message: Message, msgContent: string, args: string[]) {
        const channel = message.channel as TextChannel
        const role = this.getRoleBasedOnChannel(message.channelId)

        const randomUser = role ? channel.members.filter((m) => m.roles.cache.get(role) !== undefined).random() : channel.members.random()
        const authorName = message.member?.nickname ?? message.member?.displayName ?? message.author.username
        const randomName = randomUser?.nickname ?? randomUser?.displayName ?? randomUser?.user?.username
        const phese = findFeseText(authorName, randomName)
        const reply = `${phese}`

        MessageHelper.sendMessage(message, reply)
    }

    static getRoleBasedOnChannel(channelId: string) {
        switch (channelId) {
            case '705864445338845265':
                return '735253573025267883' //Cod
            case '822998979943071824':
                return '822999208445083668' //Valheim
            default:
                return undefined
        }
    }

    static async jaerskIfyer(message: Message, msgContent: string, args: string[]) {
        let fMsg
        if (args && args[0] && args[0].length > 10 && parseInt(args[0])) {
            fMsg = await MessageHelper.sendMessage(message, 'Leter etter meldingen...')
            const msgToJaersk = await (<Message>(<unknown>MessageHelper.findMessageById(message, msgContent)))
            if (msgToJaersk) {
                const uwuIfiedText = JokeCommands.jaerskText(msgToJaersk.content)
                if (fMsg) fMsg.edit(uwuIfiedText)
                else MessageHelper.sendMessage(message, uwuIfiedText)
            }
            if (!msgToJaersk && fMsg) fMsg.edit('Fant ikke meldingen :(')
        } else {
            let textToBeUwued = JokeCommands.jaerskText(args.length > 0 ? args.join(' ') : 'Please skriv inn ein tekst eller id neste gang')
            MessageHelper.sendMessage(message, textToBeUwued)
        }
    }

    static async sendBonk(message: Message, content: string, args: string[]) {
        const img = ArrayUtils.randomChoiceFromArray(globalArrays.bonkMemeUrls)
        let user
        let bkCounter
        if (args.length > 0) {
            user = args[0]
            if (DatabaseHelper.findUserByUsername(user, message)) {
                bkCounter = DatabaseHelper.getValue('bonkCounter', user, message)
                this.incrementBonkCounter(message, user, bkCounter)
                bkCounter = parseInt(bkCounter) + 1
                MessageHelper.sendMessage(
                    message,
                    (user ? user + ', du har blitt bonket. (' + `${bkCounter} ${bkCounter == 1 ? 'gang' : 'ganger'}) ` : '') + img
                )
            } else {
                message.reply('du har ikke oppgitt et gyldig brukernavn')
            }
        } else {
            MessageHelper.sendMessage(message, img)
        }
    }

    static incrementBonkCounter(message: Message, user: string, counter: string) {
        // const currentVal = DatabaseHelper.getValue("counterSpin", message.author.username, () => { });
        if (counter) {
            try {
                let cur = parseInt(counter)
                cur = cur += 1
                AchievementHelper.awardBonkingAch(user, cur.toString(), message)

                DatabaseHelper.setValue('bonkCounter', user, cur.toString())
                return cur
            } catch (error) {
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            }
        }
    }

    private static uwuText(t: string) {
        const firstChoice = ArrayUtils.randomChoiceFromArray(globalArrays.asciiEmojies)
        return firstChoice.concat(
            ' ' +
                t
                    .replace(/r/g, 'w')
                    .replace(/l/g, 'w')
                    .concat(' ', ArrayUtils.randomChoiceFromArray(globalArrays.asciiEmojies.filter((e) => e !== firstChoice)))
        )
    }
    private static jaerskText(t: string) {
        let reply = ''
        t.split(' ').forEach((word) => {
            reply += ' ' + Languages.translateToJaersk(word)
        })
        return reply
    }

    /*
    COMMAND ELEMENTS START

    */
    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'øyvind',
                description: 'Vask huset maen. Og husk å vask den fine klokkå',
                command: (rawMessage: Message, messageContent: string) => {
                    JokeCommands.vaskHuset(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'fese',
                description: 'Har någen fese?',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.harFese(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'bonk',
                description: 'Send en bonk. Kan brukes mot brukere.',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.sendBonk(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'spell',
                description:
                    'Stav ut en setning som emojier i reactions. Syntax: <ord/setning> <(optional) message-id>. Ordet bør ikke inneholde repeterte bokstaver; kun ABCIMOPRSTVX har to versjoner og kan repeteres. Hvis ingen message id gis reagerer den på sendt melding. ',
                command: (rawMessage: Message, messageContent: string, args: string[] | undefined) => {
                    JokeCommands.reactWithLetters(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'status',
                description: 'Sett din status',
                command: (rawMessage: Message, messageContent: string) => {
                    JokeCommands.updateMygleStatus(rawMessage, messageContent)
                },
                category: 'annet',
            },
            {
                commandName: 'statuser',
                description: 'Mygles det?',
                command: (rawMessage: Message, messageContent: string) => {
                    JokeCommands.getAllMygleStatus(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'thomas',
                description: 'Thomas svarer alltid ja',
                command: (rawMessage: Message, messageContent: string) => {
                    JokeCommands.thomasTing(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'kekw',
                description: 'kekw',
                command: async (rawMessage: Message, messageContent: string, args: string[]) => {
                    const kekw = await rawMessage.client.emojis.cache.find((emoji) => emoji.name == 'kekw_animated')
                    if (kekw) {
                        rawMessage.react(kekw)
                        rawMessage.reply('<a: kekw_animated: ' + kekw?.id + ' > .')
                    }
                },
                category: 'annet',
            },
            {
                commandName: 'aktivitet',
                description: 'Går det egentlig bra med masteren te Magnus?',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.isMaggiPlaying(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'eivind',
                description: 'Eivind sin feil',
                command: (rawMessage: Message, messageContent: string) => {
                    JokeCommands.eivind(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'david',
                description: 'nå klikke det snart',
                command: (rawMessage: Message, messageContent: string) => {
                    JokeCommands.kLikka(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'eivindpride',
                description: 'Eivindpride it. Eivindpride it ALL.',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    JokeCommands.eivindprideItAll(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'jærsk',
                description: 'Gjør teksten jærsk',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.jaerskIfyer(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'kan',
                description: 'Kan personen? Sikkert ikkje',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.kanPersonen(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'uwu',
                description: 'UwU-ify en melding',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.uWuIfyer(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'mordi',
                description: 'Mordi e nais',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.mordi(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'arne',
                description: 'Bare Arne being Arne',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    JokeCommands.arne(rawMessage)
                },
                category: 'annet',
            },
        ]
    }
}
