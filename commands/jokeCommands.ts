import { CacheType, ChatInputCommandInteraction, Client, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { globalArrays } from '../globals'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { Languages } from '../helpers/languageHelpers'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { MiscUtils } from '../utils/miscUtils'
import { TextUtils } from '../utils/textUtils'
import { UserUtils } from '../utils/userUtils'

export class JokeCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async mordi(message: Message) {
        const emoji = await EmojiHelper.getEmoji('eyebrows', message)

        await this.messageHelper.sendMessage(message.channelId, Math.random() > 0.05 ? `E nais ${emoji.id}` : `E skamnais :eyebrows: ${emoji.id}`)
    }

    private async findUserActivity(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const paramUser = interaction.options.get('bruker')?.user

        const member = UserUtils.findMemberByUserID(paramUser.id, interaction)
        if (member && member?.presence && member?.presence?.clientStatus) {
            if (member.presence.activities && member.presence.activities[0]) {
                const activities = member.presence.activities.filter((a) =>
                    member.id === UserUtils.User_IDs.BOT_HOIE ? a : a.name.toLowerCase() !== 'custom status'
                )

                if (activities.length > 0) {
                    console.log(activities[0])
                    const timeSince = DateUtils.getTimeSince(activities[0].timestamps?.start ?? new Date())
                    const embd = EmbedUtils.createSimpleEmbed(
                        `${member.user.username} - ${activities[0].name}`,
                        `${activities[0]?.details ?? ''} ${activities[0]?.state ? ' - ' + activities[0]?.state : ''}`,
                        [{ name: 'Åpent i', value: timeSince ? `${timeSince.hours} timer og ${timeSince.minutes} minutter` : 'Ane ikkje' }]
                    )
                    if (activities[0].url) embd.setThumbnail(`${activities[0].url}`)
                    if (activities[0].assets) {
                        const urlSlashFix = activities[0].assets.largeImage.replace('https/', 'https://')
                        const urlMatch = urlSlashFix.match(/\bhttps?:\/\/\S+/gi)
                        if (activities[0].assets.largeText) embd.setDescription(`${activities[0].assets.largeText}`)
                        if (urlMatch) embd.setThumbnail(`${urlMatch}`)
                    }
                    this.messageHelper.replyToInteraction(interaction, embd, undefined, true)
                } else {
                    this.messageHelper.replyToInteraction(interaction, `Drive ikkje me någe spess`, undefined, true)
                }
            } else {
                this.messageHelper.replyToInteraction(interaction, 'Ingen aktivitet registrert på Discord.', undefined, true)
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Fant ikke brukeren. Husk at du må bruke **brukernavn** og *ikke* display name', true, true)
        }
    }

    private async reactToManyMessages(interaction: ChatInputCommandInteraction<CacheType>, emojiName: string) {
        this.messageHelper.replyToInteraction(interaction, 'Eivindprider sendt', true)
        try {
            const channel = interaction.channel as TextChannel
            const react = interaction.guild?.emojis.cache.find((emoji) => emoji.name == emojiName)

            if (interaction.client) {
                channel.messages
                    .fetch({ limit: 15 })
                    .then((el) => {
                        el.forEach((message) => {
                            if (react) message.react(react)
                        })
                    })
                    .catch((error: any) => {})
            }
        } catch (error) {}
        if (interaction.guild) {
            const react = interaction.guild.emojis.cache.find((emoji) => emoji.name == 'eivindpride')
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
            const emoji = usedLetter.includes(letter) ? MiscUtils.findLetterEmoji(letter, true, spaceCounter) : MiscUtils.findLetterEmoji(letter)
            usedLetter += letter
            try {
                messageToReactTo.react(emoji).catch((error) => console.log(error))
            } catch (error) {
                console.log(error)
            }
        })
    }

    private kanPersonen(message: Message, msgContent: string, args: string[]) {
        const name = TextUtils.splitUsername(args[0])
        if (!args[0] || !name) message.reply('Du kan jaffal ikkje skriva denne kommandoen rett')
        else this.messageHelper.sendMessage(message.channelId, `${name} ` + ArrayUtils.randomChoiceFromArray(globalArrays.kanIkkjeTekster))
    }

    private async uWuIfyer(message: Message, msgContent: string, args: string[]) {
        let fMsg
        if (args && args[0] && args[0].length > 10 && parseInt(args[0])) {
            fMsg = await this.messageHelper.sendMessage(message.channelId, 'Leter etter meldingen...')
            const msgToUwU = await MessageHelper.findMessageById(message, msgContent)
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

    private harFese(interaction: ChatInputCommandInteraction<CacheType>) {
        const channel = interaction.channel as TextChannel
        const role = this.getRoleBasedOnChannel(interaction.channelId)

        const randomUser = role ? channel.members.filter((m) => m.roles.cache.get(role) !== undefined).random() : channel.members.random()
        const authorName = interaction.user.username
        const randomName = randomUser.user.username
        const phese = MiscUtils.findFeseText(authorName, randomName)
        const reply = `${phese}`

        this.messageHelper.replyToInteraction(interaction, reply)
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
                const foundUser = DatabaseHelper.findUserByUsername(args[0], message)
                if (foundUser) {
                    const user = DatabaseHelper.getUser(foundUser.id)
                    bkCounter = user.bonkCounter
                    user.bonkCounter++
                    DatabaseHelper.updateUser(user)

                    bkCounter++
                    this.messageHelper.sendMessage(
                        message.channelId,
                        (user ? user.displayName + ', du har blitt bonket. (' + `${bkCounter} ${bkCounter == 1 ? 'gang' : 'ganger'}) ` : '') + img
                    )
                }
            } else {
                message.reply('du har ikke oppgitt et gyldig brukernavn')
            }
        } else {
            this.messageHelper.sendMessage(message.channelId, img)
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
                commandName: 'fese',
                description: 'Har någen fese?',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {},
                isReplacedWithSlashCommand: 'fese',
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
                description: 'Sett din status. Resettes 06:00 hver dag',
                command: (rawMessage: Message, messageContent: string) => {},
                category: 'annet',
                isReplacedWithSlashCommand: 'status',
            },
            {
                commandName: 'statuser',
                description: 'Se alle satte statuser.Mygles det?',
                command: (rawMessage: Message, messageContent: string) => {},
                isReplacedWithSlashCommand: 'status',
                category: 'annet',
            },

            {
                commandName: 'aktivitet',
                description: 'Går det egentlig bra med masteren te Magnus?',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {},
                isReplacedWithSlashCommand: 'aktivitet',
                category: 'annet',
            },

            {
                commandName: 'eivindpride',
                description: 'Eivindpride it. Eivindpride it ALL.',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    // this.reactToManyMessages(rawMessage, 'eivindpride')
                },
                isReplacedWithSlashCommand: 'eivindpride',
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
        ]
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'fese',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.harFese(rawInteraction)
                },
                category: 'gaming',
            },
            {
                commandName: 'aktivitet',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.findUserActivity(rawInteraction)
                },
                category: 'gaming',
            },
            {
                commandName: 'eivindpride',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.reactToManyMessages(rawInteraction, 'eivindpride')
                },
                category: 'gaming',
            },
        ]
    }
}
