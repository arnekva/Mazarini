import { Client, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { globalArrays } from '../globals'
import { AchievementHelper } from '../helpers/achievementHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { Languages } from '../helpers/languageHelpers'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { findFeseText, findLetterEmoji } from '../utils/miscUtils'
import { getRandomPercentage, getRndInteger } from '../utils/randomUtils'
import { doesTextIncludeUsername, replaceAtWithTextUsername, reverseMessageString, splitUsername } from '../utils/textUtils'

export class JokeCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async vaskHuset(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, Math.random() < 0.75 ? 'Øyvind, vask huset!' : 'Har ei jækla fine klokka')
    }

    private async kLikka(message: Message) {
        await this.messageHelper.sendMessage(
            message.channelId,
            Math.random() < 0.5 ? 'Han ' + (Math.random() < 0.5 ? 'skaaahhæææææmmmmm' : '') + 'trunte på vei te buen ' : ' krækka open a kold one'
        )
    }

    private async thomasTing(message: Message) {
        await this.messageHelper.sendMessage(
            message.channelId,
            Math.random() < 0.3 ? 'Har skamphese :)' : Math.random() < 0.5 ? 'Han hørte deg kje for han spiste jo :(' : 'Sovna på golve :)'
        )
    }

    private async darri(message: Message) {
        await this.messageHelper.sendMessage(
            message.channelId,
            Math.random() < 0.3 ? 'Chatte me indere om prodtilgang' : Math.random() < 0.5 ? 'E på jobb på ein lørdag' : 'Han kuge i prod'
        )
    }

    private async mordi(message: Message) {
        const emoji = await EmojiHelper.getEmoji('eyebrows', message)

        await this.messageHelper.sendMessage(message.channelId, Math.random() > 0.05 ? `E nais ${emoji.id}` : `E skamnais :eyebrows: ${emoji.id}`)
    }

    private async eivind(message: Message) {
        await this.messageHelper.sendMessage(
            message.channelId,
            Math.random() < 0.7
                ? 'Lure på om most important news showe up på vår channel? Kan någen oppdatera han på server-bot-news-channel-fronten, faen ka'
                : 'Spsie pistasj :3'
        )
    }

    private async arne(message: Message) {
        await this.messageHelper.sendMessage(message.channelId, 'Det vil alltid vær aldersdifferanse mellom folk av forskjellige alder')
    }

    private async geggien(message: Message) {
        await this.messageHelper.sendMessage(
            message.channelId,
            getRandomPercentage(50) ? `Knuse maggi i Rocket League` : `Bler knust av maggi i Rocket League :(`
        )
    }
    private async joiij(message: Message) {
        const hr = getRndInteger(0, 3)
        const min = getRndInteger(1, 59)
        await this.messageHelper.sendMessage(message.channelId, `Joiij e der om ${hr === 0 ? '' : hr + ' timer og '}${min} minutt!`)
    }

    private async isMaggiPlaying(message: Message, content: string, args: string[]) {
        let name = message.author.username
        if (args[0]) name = args[0]
        const guild = message.channel.client.guilds.cache.get('340626855990132747')
        if (guild) {
            const user = guild.members.cache.filter((u) => u.user.username.toLowerCase() === name.toLowerCase()).first()
            if (user && user.presence) {
                if (user.presence.clientStatus) {
                    if (user.presence.activities && user.presence.activities[0]) {
                        const activities = user.presence.activities
                            .filter((a) => (user.user.username.toLowerCase() === 'mazarinibot' ? a : a.name.toLowerCase() !== 'custom status'))
                            .map((act) => act.name)

                        await this.messageHelper.sendMessage(
                            message.channelId,
                            `${name} drive me ${activities.length > 1 ? 'disse aktivitene' : 'aktiviteten'}: ${activities.join(', ')}`
                        )
                    } else {
                        await this.messageHelper.sendMessage(message.channelId, 'Ingen aktivitet registrert på Discord.')
                    }
                }
            } else {
                await this.messageHelper.sendMessage(message.channelId, 'Fant ikke brukeren. Husk at du må bruke **brukernavn** og *ikke* display name')
            }
        }
    }

    private async updateMygleStatus(message: Message, messageContent: string) {
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
            this.messageHelper.reactWithRandomEmoji(message)
        } else {
            this.messageHelper.sendMessage(
                message.channelId,
                content.trim().length > 0 ? 'Du kan kje mygla så møye. Mindre enn 150 tegn, takk' : 'Du må sei koffor du mygle, bro'
            )
        }
    }
    private async getAllMygleStatus(message: Message) {
        const mygling = await DatabaseHelper.getAllValuesFromPrefix('mygling', message)
        let myglinger = ''
        mygling.forEach((status) => (myglinger += status.val ? status.key + ' ' + status.val + '\n' : ''))
        myglinger = myglinger.trim() ? myglinger : 'Ingen har satt statusen sin i dag'
        this.messageHelper.sendMessage(message.channelId, myglinger)
        // const vals = await DatabaseHelper.getAllValuesFromPrefix("mygling")
    }

    private async reactToManyMessages(message: Message, emojiName: string) {
        try {
            const channel = message.channel as TextChannel
            const react = message.guild?.emojis.cache.find((emoji) => emoji.name == emojiName)

            if (message.client) {
                channel.messages
                    .fetch({ limit: 15 })
                    .then((el) => {
                        el.forEach((message) => {
                            if (react) message.react(react)
                        })
                    })
                    .catch((error: any) => {
                        this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                    })
            }
        } catch (error) {
            this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
        }
        if (message.guild) {
            const react = message.guild.emojis.cache.find((emoji) => emoji.name == 'eivindpride')
            if (react) {
            }
        }
    }

    private async reactWithLetters(message: Message, msgContent: string, args: string[] | undefined) {
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

    private kanPersonen(message: Message, msgContent: string, args: string[]) {
        const name = splitUsername(args[0])
        this.messageHelper.sendMessage(message.channelId, `${name} ` + ArrayUtils.randomChoiceFromArray(globalArrays.kanIkkjeTekster))
    }

    private async uWuIfyer(message: Message, msgContent: string, args: string[]) {
        let fMsg
        if (args && args[0] && args[0].length > 10 && parseInt(args[0])) {
            fMsg = await this.messageHelper.sendMessage(message.channelId, 'Leter etter meldingen...')
            const msgToUwU = <Message>(<unknown>MessageHelper.findMessageById(message, msgContent))
            if (msgToUwU) {
                const uwuIfiedText = JokeCommands.uwuText(msgToUwU.content)
                if (fMsg) fMsg.edit(uwuIfiedText)
                else this.messageHelper.sendMessage(message.channelId, uwuIfiedText)
            }
            if (!msgToUwU && fMsg) fMsg.edit('Fant ikke meldingen :(')
        } else {
            let textToBeUwued = JokeCommands.uwuText(args.length > 0 ? args.join(' ') : 'Please skriv inn ein tekst eller id neste gang')
            this.messageHelper.sendMessage(message.channelId, textToBeUwued)
        }
    }

    private harFese(message: Message, msgContent: string, args: string[]) {
        const channel = message.channel as TextChannel
        const role = this.getRoleBasedOnChannel(message.channelId)

        const randomUser = role ? channel.members.filter((m) => m.roles.cache.get(role) !== undefined).random() : channel.members.random()
        const authorName = message.member?.nickname ?? message.member?.displayName ?? message.author.username
        const randomName = randomUser?.nickname ?? randomUser?.displayName ?? randomUser?.user?.username
        const phese = findFeseText(authorName, randomName)
        const reply = `${phese}`

        this.messageHelper.sendMessage(message.channelId, reply)
    }

    private getRoleBasedOnChannel(channelId: string) {
        switch (channelId) {
            case '705864445338845265':
                return '735253573025267883' //Cod
            case '822998979943071824':
                return '822999208445083668' //Valheim
            default:
                return undefined
        }
    }

    private async jaerskIfyer(message: Message, msgContent: string, args: string[]) {
        let fMsg
        if (args && args[0] && args[0].length > 10 && parseInt(args[0])) {
            fMsg = await this.messageHelper.sendMessage(message.channelId, 'Leter etter meldingen...')
            const msgToJaersk = await (<Message>(<unknown>MessageHelper.findMessageById(message, msgContent)))
            if (msgToJaersk) {
                const uwuIfiedText = JokeCommands.jaerskText(msgToJaersk.content)
                if (fMsg) fMsg.edit(uwuIfiedText)
                else this.messageHelper.sendMessage(message.channelId, uwuIfiedText)
            }
            if (!msgToJaersk && fMsg) fMsg.edit('Fant ikke meldingen :(')
        } else {
            let textToBeUwued = JokeCommands.jaerskText(args.length > 0 ? args.join(' ') : 'Please skriv inn ein tekst eller id neste gang')
            this.messageHelper.sendMessage(message.channelId, textToBeUwued)
        }
    }

    private async sendBonk(message: Message, content: string, args: string[]) {
        const img = ArrayUtils.randomChoiceFromArray(globalArrays.bonkMemeUrls)
        let user
        let bkCounter
        if (args.length > 0) {
            user = args[0]
            if (DatabaseHelper.findUserByUsername(user, message)) {
                bkCounter = DatabaseHelper.getValue('bonkCounter', user, message)
                this.incrementBonkCounter(message, user, bkCounter)
                bkCounter = parseInt(bkCounter) + 1
                this.messageHelper.sendMessage(
                    message.channelId,
                    (user ? user + ', du har blitt bonket. (' + `${bkCounter} ${bkCounter == 1 ? 'gang' : 'ganger'}) ` : '') + img
                )
            } else {
                message.reply('du har ikke oppgitt et gyldig brukernavn')
            }
        } else {
            this.messageHelper.sendMessage(message.channelId, img)
        }
    }

    private incrementBonkCounter(message: Message, user: string, counter: string) {
        if (counter) {
            try {
                let cur = parseInt(counter)
                cur = cur += 1
                AchievementHelper.awardBonkingAch(user, cur.toString(), message)

                DatabaseHelper.setValue('bonkCounter', user, cur.toString())
                return cur
            } catch (error) {
                this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
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

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'øyvind',
                description: 'Vask huset maen. Og husk å vask den fine klokkå',
                command: (rawMessage: Message, messageContent: string) => {
                    this.vaskHuset(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'fese',
                description: 'Har någen fese?',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.harFese(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'bonk',
                description: 'Send en bonk. Kan brukes mot brukere.',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.sendBonk(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'spell',
                description:
                    'Stav ut en setning som emojier i reactions. Syntax: <ord/setning> <(optional) message-id>. Ordet bør ikke inneholde repeterte bokstaver; kun ABCIMOPRSTVX har to versjoner og kan repeteres. Hvis ingen message id gis reagerer den på sendt melding. ',
                command: (rawMessage: Message, messageContent: string, args: string[] | undefined) => {
                    this.reactWithLetters(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'status',
                description: 'Sett din status',
                command: (rawMessage: Message, messageContent: string) => {
                    this.updateMygleStatus(rawMessage, messageContent)
                },
                category: 'annet',
            },
            {
                commandName: 'statuser',
                description: 'Mygles det?',
                command: (rawMessage: Message, messageContent: string) => {
                    this.getAllMygleStatus(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: ['sivert', 'geggien', 'trackpad', 'steve'],
                description: 'Geggien e på an igjen',
                command: (rawMessage: Message, messageContent: string) => {
                    this.geggien(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'thomas',
                description: 'Thomas svarer alltid ja',
                command: (rawMessage: Message, messageContent: string) => {
                    this.thomasTing(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'darri',
                description: 'Hæ, darri?',
                command: (rawMessage: Message, messageContent: string) => {
                    this.darri(rawMessage)
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
                    this.isMaggiPlaying(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'eivind',
                description: 'Eivind sin feil',
                command: (rawMessage: Message, messageContent: string) => {
                    this.eivind(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'david',
                description: 'nå klikke det snart',
                command: (rawMessage: Message, messageContent: string) => {
                    this.kLikka(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'eivindpride',
                description: 'Eivindpride it. Eivindpride it ALL.',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.reactToManyMessages(rawMessage, 'eivindpride')
                },
                category: 'annet',
            },
            {
                commandName: 'putinpride',
                description: 'Eivindpride it. Eivindpride it ALL.',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.reactToManyMessages(rawMessage, 'putinpride')
                },
                category: 'annet',
            },
            {
                commandName: 'jærsk',
                description: 'Gjør teksten jærsk',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.jaerskIfyer(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'kan',
                description: 'Kan personen? Sikkert ikkje',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.kanPersonen(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'uwu',
                description: 'UwU-ify en melding',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.uWuIfyer(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'mordi',
                description: 'Mordi e nais',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.mordi(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'arne',
                description: 'Bare Arne being Arne',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.arne(rawMessage)
                },
                category: 'annet',
            },
            {
                commandName: 'joiij',
                description: 'Kor lenge e det te Joiij e der?',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.joiij(rawMessage)
                },
                category: 'annet',
            },
        ]
    }
}
