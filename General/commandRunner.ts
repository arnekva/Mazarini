import { CacheType, ChatInputCommandInteraction, Client, Interaction, InteractionType, Message } from 'discord.js'
import { Admin } from '../admin/admin'
import { environment } from '../client-env'
import { globalArrays } from '../globals'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { MessageUtils } from '../utils/messageUtils'
import { MiscUtils } from '../utils/miscUtils'
import { UserUtils } from '../utils/userUtils'
import { Commands, ICommandElement, IInteractionElement } from './commands'
import { LockingManager } from './lockingManager'

export class CommandRunner {
    private commands: Commands
    private messageHelper: MessageHelper

    lastUsedCommand = 'help'
    polseRegex = new RegExp(/(p)(ø|ö|y|e|o|a|u|i|ô|ò|ó|â|ê|å|æ|ê|è|é|à|á)*(ls)(e|a|å|o|i)|(pause)|(🌭)|(hotdog)|(sausage)|(hot-dog)/gi)
    helgeRegex = new RegExp(/(helg)(å|en|ene|a|e)*/gi)

    constructor(client: Client, messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
        this.commands = new Commands(client, messageHelper)
    }
    async runCommands(message: Message) {
        try {
            /** Check if the bot is allowed to send messages in this channel */
            if (!this.isLegalChannel(message)) return
            if (this.checkForGetCommands(message)) return
            /**  Check message for commands */
            await this.checkForCommand(message)
            /** Additional non-command checks */
            this.checkMessageForJokes(message)
        } catch (error) {
            this.messageHelper.sendMessageToActionLogWithCustomMessage(message, error, 'Her har det skjedd en feil', true)
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
        channelId = interaction.channelId
        if (Admin.isAuthorAdmin(UserUtils.findMemberByUserID(uId, interaction))) {
            //Always allow admins to carry out interactions - this includes unlocking
            return false
        } else {
            const lm = LockingManager
            if (lm.getbotLocked()) return true
            if (lm.getlockedThread().includes(channelId)) return true
            if (lm.getlockedUser().includes(uId)) return true
            return false
        }
    }
    async checkForCommandInInteraction(interaction: Interaction<CacheType>) {
        /** Check if any part of the interaction is currently locked - if it is, do not proceed. Answer with an ephemeral message explaining the lock */
        if (this.checkIfLockedPath(interaction))
            return interaction.isRepliable()
                ? interaction.reply(
                      `Interaksjoner er låst. Prøv å se ${MentionUtils.mentionChannel(
                          MentionUtils.CHANNEL_IDs.BOT_UTVIKLING
                      )} for informasjon, eller tag bot-support`
                  )
                : undefined

        if (!this.isLegalChannel(interaction)) return

        const commands = this.commands.getAllInteractionCommands()
        let hasAcknowledged = false

        if (interaction.isChatInputCommand()) {
            commands.forEach((cmd) => {
                if (cmd.commandName === interaction.commandName) {
                    this.runInteractionElement(cmd, interaction)
                    hasAcknowledged = true
                }
            })
        } else if (interaction.type === InteractionType.ModalSubmit) {
            hasAcknowledged = this.commands.handleModalInteractions(interaction)
        } else if (interaction.isSelectMenu()) {
            hasAcknowledged = this.commands.handleSelectMenus(interaction)
        }
        if (!hasAcknowledged) interaction.isRepliable() ? interaction.reply(`Denne interaksjonen støttes ikke for øyeblikket`) : undefined
        return undefined
    }

    async checkForCommand(message: Message) {
        if (message.author.id === '802945796457758760') return undefined

        if (message.content.toLowerCase().startsWith('!mz ')) {
            let cmdFound = false
            const command = message.content.toLowerCase().replace('!mz ', '').replace('!mz', '').replace('!zm ', '').split(' ')[0].toLowerCase()
            const messageContent = message.content.split(' ').slice(2).join(' ')
            const args = !!messageContent ? messageContent.split(' ') : []
            const commands = this.commands.getAllCommands()
            commands.forEach((cmd) => {
                if (
                    Array.isArray(cmd.commandName) ? cmd.commandName.includes(command.toLowerCase()) : cmd.commandName.toLowerCase() === command.toLowerCase()
                ) {
                    cmdFound = this.runCommandElement(cmd, message, messageContent, args)
                }
            })
            if (!cmdFound) {
                return message.reply('Eg leide ikkje itte mz lenger. Du finne alle kommandoene med å skriva ein skråstreg i tekstfelte')
            }

            return undefined
        } else if (message.content.startsWith('!mz')) {
            return message.reply('Eg leide ikkje itte mz lenger. Du finne alle kommandoene med å skriva ein skråstreg i tekstfelte')
        } else return undefined
    }

    runInteractionElement(runningInteraction: IInteractionElement, interaction: ChatInputCommandInteraction<CacheType>) {
        runningInteraction.command(interaction)
    }

    runCommandElement(cmd: ICommandElement, message: Message, messageContent: string, args: string[]) {
        if (cmd.isAdmin) {
            if (Admin.isAuthorAdmin(message.member)) {
                cmd.command(message, messageContent, args)
            } else {
                this.messageHelper.sendMessageToActionLogWithInsufficientRightsMessage(message)
            }
        } else {
            message.reply(`Alle kommandoene er nå erstattet av slash-commandoer.`)
        }
        return true
    }

    checkForGetCommands(message: Message) {
        const args = message.content.split(' ')
        if (message.content.startsWith('!get')) {
            if (args[1] === 'username') {
                const searchName = args.slice(2).join(' ')

                const user = message?.guild?.members?.cache?.find((member) => (member?.displayName ?? 'undefined') == (searchName ?? 'tester'))
                if (user) message.reply(user.user.username)
            }
            return true
        }
        return false
    }

    logIncorectCommandUsage(message: Message, messageContent: string, args: string[]) {
        let command = message.content.split(' ')[1]
        if (environment === 'prod') {
            const numberOfFails = DatabaseHelper.getNonUserValue('incorrectCommand', command)
            let newFailNum = 1
            if (numberOfFails && Number(numberOfFails)) newFailNum = Number(numberOfFails) + 1
            if (command === '' || command.trim() === '') command = '<tom command>'
            this.messageHelper.sendMessageToActionLog(
                `Kommandoen '${command}' ble forsøkt brukt av ${message.author.username}, men den finnes ikke. Denne kommandoen er forsøkt brukt ${newFailNum} ganger`
            )
            DatabaseHelper.setNonUserValue('incorrectCommand', command, newFailNum.toString())
        }
    }

    /** Checks for pølse, eivindpride etc. */
    checkMessageForJokes(message: Message) {
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
            const hasHelg = this.helgeRegex.exec(message.content)
            if (hasHelg) {
                const val = this.commands.dateFunc.checkForHelg()
                this.messageHelper.sendMessage(message.channelId, val)
            }

            if (message.attachments) {
                if (this.polseRegex.exec(message.attachments.first()?.name ?? '')) polseCounter++
            }

            if (polseCounter > 0) message.channel.send('Hæ, ' + (polseCounter > 1 ? polseCounter + ' ' : '') + 'pølse' + (polseCounter > 1 ? 'r' : '') + '?')

            //If eivind, eivindpride him
            if (message.author.id == '239154365443604480' && message.guild) {
                const react = message.guild.emojis.cache.find((emoji) => emoji.name == 'eivindpride')
                //check for 10% chance of eivindpriding
                if (MiscUtils.doesThisMessageNeedAnEivindPride(message.content, polseCounter) && react) message.react(react)
            }

            //TODO: Refactor this
            if (message.author.id == '733320780707790898' && message.guild) {
                this.applyJoiijJokes(message)
            }
            const idJoke = MessageUtils.doesMessageIdHaveCoolNumber(message)
            if (idJoke == '1337') {
                message.reply('nice, id-en te meldingen din inneholde 1337. Gz, du har vonne 1.000 chips')
                const user = DatabaseHelper.getUser(message.author.id)
                user.chips += 1000
                DatabaseHelper.updateUser(user)
            }

            if (message.content.toLowerCase().startsWith('kan') && message.content.toLowerCase().endsWith('?')) {
                const name = message.content.split(' ')[1] ?? 'Han'
                const texts = globalArrays.kanIkkjeTekster(name.toLowerCase() === 'eg')
                this.messageHelper.sendMessage(message.channelId, `${name} ` + ArrayUtils.randomChoiceFromArray(texts))
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
            arg1 + '? Komman Joiij, alle vett du meine ' + arg2,
            `vedde hundre kroner på at du egentlig e klar ${arg2}`,
            `glede meg te å sidda i lobby å venta te når du faktisk e klar om ${arg2}`,
        ]
        if (numbers.length > 0 && numbers.length < 3 && !MessageUtils.messageHasCommand(message)) {
            message.react(kekw ?? '😂')
            message.reply(ArrayUtils.randomChoiceFromArray(responses))
        }
        if (message.mentions.roles.find((e) => e.name == 'Jævla Drittspel')) {
            message.react(kekw ?? '😂')
            message.reply('lol')
        }
    }

    isLegalChannel(interaction: Interaction | Message) {
        return (
            (environment === 'dev' &&
                (interaction.channel.id === MessageUtils.CHANNEL_IDs.LOKAL_BOT_SPAM ||
                    interaction.channel.id === MessageUtils.CHANNEL_IDs.STATS_SPAM ||
                    interaction.channel.id === MessageUtils.CHANNEL_IDs.GODMODE)) ||
            (environment === 'prod' && interaction.channel.id !== MessageUtils.CHANNEL_IDs.LOKAL_BOT_SPAM)
        )
    }
}
