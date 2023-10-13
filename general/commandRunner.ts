import {
    ButtonInteraction,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    ContextMenuCommandInteraction,
    Interaction,
    InteractionType,
    Message,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from 'discord.js'
import { Admin } from '../admin/admin'
import { environment } from '../client-env'
import { illegalCommandsWhileInJail } from '../commands/money/crimeCommands'
import { PoletCommands } from '../commands/poletCommands'
import { LockingHandler } from '../handlers/lockingHandler'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { MessageUtils } from '../utils/messageUtils'
import { MiscUtils } from '../utils/miscUtils'
import { UserUtils } from '../utils/userUtils'
import { Commands, IInteractionCommand } from './commands'
const fetch = require('node-fetch')

export class CommandRunner {
    private commands: Commands
    private messageHelper: MessageHelper

    lastUsedCommand = 'help'
    polseRegex = new RegExp(/(p)(ø|ö|y|e|o|a|u|i|ô|ò|ó|â|ê|å|æ|ê|è|é|à|á)*(ls)(e|a|å|o|i)|(pause)|(🌭)|(hotdog)|(sausage)|(hot-dog)/gi)
    helgeRegex = new RegExp(/(helg|Helg|hælj|hælg)(å|en|ene|a|e|æ)*|(weekend)/gi)

    constructor(client: Client, messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
        this.commands = new Commands(client, messageHelper)
    }
    async runCommands(message: Message) {
        try {
            /** Check if the bot is allowed to send messages in this channel */
            if (!this.isLegalChannel(message) || this.checkIfLockedPath(message)) return
            /**  Check message for text commands */
            await this.checkForCommand(message)
            /** Additional non-command checks */
            await this.checkMessageForJokes(message)

            PoletCommands.checkForVinmonopolContent(message, this.messageHelper)
        } catch (error) {
            this.messageHelper.sendLogMessage(
                `Det oppstod en feil under kjøring av en command. Meldingen var fra ${message.author.username} i kanalen ${MentionUtils.mentionChannel(
                    message.channelId
                )} med innholdet ${message.content}. Stacktrace: ` + error
            )
        }
    }

    checkIfLockedPath(interaction: Interaction<CacheType> | Message) {
        let uId = '0'
        let channelId = '0'
        if (interaction instanceof Message) {
            uId = interaction.author.id
        } else {
            uId = interaction.user.id
        }
        channelId = interaction?.channelId
        if (Admin.isAuthorAdmin(UserUtils.findMemberByUserID(uId, interaction)) || interaction.guildId === '1106124769797091338') {
            //Always allow admins to carry out interactions - this includes unlocking
            return false
        } else {
            const lm = LockingHandler
            if (lm.getbotLocked()) return true
            if (lm.getlockedThread().includes(channelId)) return true
            if (lm.getlockedUser().includes(uId)) return true
            return false
        }
    }
    async checkForCommandInInteraction(interaction: Interaction<CacheType>) {
        /** Check if any part of the interaction is currently locked - if it is, do not proceed. Answer with an ephemeral message explaining the lock */
        if (this.checkIfLockedPath(interaction)) {
            if (interaction.isRepliable()) {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Interaksjoner er låst. Prøv å se ${MentionUtils.mentionChannel(
                        MentionUtils.CHANNEL_IDs.BOT_UTVIKLING
                    )} for informasjon, eller tag bot-support`,
                    { ephemeral: true }
                )
            }
        } else if (this.isLegalChannel(interaction) && this.checkIfBlockedByJail(interaction)) {
            if (interaction.isRepliable()) {
                this.messageHelper.replyToInteraction(interaction, `Du e i fengsel, bro`, { ephemeral: true })
            }
        } else if (this.isLegalChannel(interaction)) {
            let hasAcknowledged = false
            //TODO: This might have to be refactored, by ContextMenuCommands are for now treated as regular ChatInputCommands, as they only have a commandName
            if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
                this.commands.getAllTextCommands().forEach((cmd) => {
                    if (cmd.commandName === interaction.commandName) {
                        this.runInteractionElement<ChatInputCommandInteraction<CacheType> | ContextMenuCommandInteraction<CacheType>>(cmd, interaction)
                        hasAcknowledged = true
                    }
                })
            } else if (interaction.type === InteractionType.ModalSubmit) {
                this.commands.getAllModalCommands().forEach((cmd) => {
                    if (cmd.commandName === interaction.customId.split(';')[0]) {
                        this.runInteractionElement<ModalSubmitInteraction<CacheType>>(cmd, interaction)
                        hasAcknowledged = true
                    }
                })
            } else if (interaction.isStringSelectMenu()) {
                this.commands.getAllSelectMenuCommands().forEach((cmd) => {
                    if (cmd.commandName === interaction.customId.split(';')[0]) {
                        this.runInteractionElement<StringSelectMenuInteraction<CacheType>>(cmd, interaction)
                        // this.runSelectMenuInteractionElement(cmd, interaction)
                        hasAcknowledged = true
                    }
                })
            } else if (interaction.isButton()) {
                this.commands.getAllButtonCommands().forEach((cmd) => {
                    if (cmd.commandName === interaction.customId.split(';')[0]) {
                        this.runInteractionElement<ButtonInteraction<CacheType>>(cmd, interaction)
                        // this.runButtonInteractionElement(cmd, interaction)
                        hasAcknowledged = true
                    }
                })
            }

            // New interactions are added online, so it is instantly available in the production version of the app, despite being on development
            // Therefore a command that doesnt yet "exist" could still be run.
            if (!hasAcknowledged) {
                interaction.isRepliable() ? interaction.reply(`Denne interaksjonen støttes ikke for øyeblikket`) : undefined
                if (environment === 'prod') {
                    const uncastInteraction = interaction as any

                    this.messageHelper.sendLogMessage(
                        `En interaksjon ble forsøkt brukt i ${MentionUtils.mentionChannel(interaction.channelId)} av ${
                            interaction.user.username
                        }. Denne interaksjonen støttes ikke i prod. Kommando: ${
                            uncastInteraction?.commandName ?? uncastInteraction?.customId ?? 'UKJENT - Commanden hadde ikke commandName eller customId'
                        }`
                    )
                }
            }

            return undefined
        }
    }

    /**
     *  TEXT COMMANDS ARE NO LONGER IN USE - keep info message in transition period
     */
    async checkForCommand(message: Message) {
        if (message.content.startsWith('!mz') && message.author.id === MentionUtils.User_IDs.BOT_HOIE) {
            message.reply('Eg leide ikkje itte mz lenger. Du finne alle kommandoene med å skriva ein skråstreg i tekstfelte')
        }
    }

    checkIfBlockedByJail(interaction: Interaction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        if (user.jail?.daysInJail && user.jail?.daysInJail > 0) {
            if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
                return illegalCommandsWhileInJail.includes(interaction.commandName)
            } else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.type === InteractionType.ModalSubmit) {
                return illegalCommandsWhileInJail.includes(interaction.customId.split(';')[0])
            }
        }
        return false
    }

    runInteractionElement<InteractionTypes>(runningInteraction: IInteractionCommand<InteractionTypes>, interaction: InteractionTypes) {
        runningInteraction.command(interaction)
    }

    /** Checks for pølse, eivindpride etc. */
    async checkMessageForJokes(message: Message) {
        if (!this.checkIfLockedPath(message)) {
            if (message.id === '802945796457758760') return

            let matches
            let polseCounter = 0
            this.polseRegex.lastIndex = 0
            while ((matches = this.polseRegex.exec(message.content))) {
                if (matches) {
                    polseCounter++
                }
            }
            const hasHelg = this.helgeRegex.test(message.content)
            this.helgeRegex.lastIndex = 0

            if (hasHelg) {
                const val = await this.commands.dateFunc.checkForHelg()
                this.messageHelper.sendMessage(message.channelId, val, { sendAsSilent: true })
            }

            if (message.attachments) {
                if (this.polseRegex.exec(message.attachments.first()?.name ?? '')) polseCounter++
            }

            if (polseCounter > 0)
                this.messageHelper.sendMessage(
                    message.channelId,
                    'Hæ, ' + (polseCounter > 1 ? polseCounter + ' ' : '') + 'pølse' + (polseCounter > 1 ? 'r' : '') + '?',
                    { sendAsSilent: true }
                )

            //If eivind, eivindpride him
            if (message.author.id == '239154365443604480' && message.guild) {
                const react = message.guild.emojis.cache.find((emoji) => emoji.name == (DateUtils.isDecember() ? 'eivindclausepride' : 'eivindpride'))
                //check for 10% chance of eivindpriding
                if (MiscUtils.doesThisMessageNeedAnEivindPride(message.content, polseCounter) && react) message.react(react)
            }

            //TODO: Refactor this
            if (message.author.id == '733320780707790898' && message.guild) {
                this.applyJoiijJokes(message)
            }
            const idJoke = MessageUtils.doesMessageIdHaveCoolNumber(message)
            if (idJoke == '1337') {
                this.messageHelper.replyToMessage(message, 'nice, id-en te meldingen din inneholde 1337. Gz, du har vonne 1.000 chips', { sendAsSilent: true })

                const user = DatabaseHelper.getUser(message.author.id)
                user.chips += 1000
                DatabaseHelper.updateUser(user)
            }
        }
    }

    applyJoiijJokes(message: Message) {
        //"733320780707790898" joiij
        const numbers = MessageUtils.doesMessageContainNumber(message)
        const kekw = message.client.emojis.cache.find((emoji) => emoji.name == 'kekw_animated')
        let arg1
        let arg2

        if (numbers.length == 1) {
            arg1 = numbers[0]
            arg2 = numbers[0] * 5
        } else if (numbers.length == 2) {
            arg1 = numbers[0] + '-' + numbers[1]
            arg2 = numbers[0] * 5 + '-' + numbers[1] * 5
        }
        const responses = [
            'hahaha, du meine ' + arg2 + ', sant?',
            arg2 + '*',
            'det va vel litt vel ambisiøst.. ' + arg2 + ' hørres mer rett ud',
            'hmm... ' + arg1 + ' ...føle eg har hørt den før 🤔',
            arg1 + ' ja.. me lyge vel alle litt på CVen, hæ?',
            arg1 + ' e det løgnaste eg har hørt',
            arg1 + '? Komman Joiij, alle vett du meine ' + arg2,
            `vedde hundre kroner på at du egentlig meine ${arg2}`,
            `https://tenor.com/view/donald-trump-fake-news-gif-11382583`,
        ]
        if (numbers.length > 0 && numbers.length < 3) {
            message.react(kekw ?? '😂')
            this.messageHelper.replyToMessage(message, ArrayUtils.randomChoiceFromArray(responses))
        }
        if (message.mentions.roles.find((e) => e.id === MentionUtils.ROLE_IDs.WARZONE)) {
            message.react(kekw ?? '😂')
            this.messageHelper.replyToMessage(message, 'lol')
        }
    }

    isLegalChannel(interaction: Interaction | Message) {
        return (
            (environment === 'dev' &&
                (interaction?.channel.id === MentionUtils.CHANNEL_IDs.LOKAL_BOT_SPAM ||
                    interaction?.channel.id === MentionUtils.CHANNEL_IDs.LOKAL_BOT_SPAM_DEV ||
                    interaction?.channel.id === MentionUtils.CHANNEL_IDs.STATS_SPAM ||
                    interaction?.channel.id === MentionUtils.CHANNEL_IDs.GODMODE)) ||
            (environment === 'prod' &&
                interaction?.channel.id !== MentionUtils.CHANNEL_IDs.LOKAL_BOT_SPAM &&
                interaction.channelId !== MentionUtils.CHANNEL_IDs.LOKAL_BOT_SPAM_DEV)
        )
    }
}
