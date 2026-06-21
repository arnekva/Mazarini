import { CacheType, ChatInputCommandInteraction, ContextMenuCommandInteraction, Interaction, InteractionType, Message } from 'discord.js'
import { BaseInteraction, BtnInteraction, ChatInteraction, ModalInteraction, SelectStringInteraction } from '../Abstracts/MazariniInteraction'
import { environment } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { PoletCommands } from '../commands/drinks/poletCommands'
import { illegalCommandsWhileInJail } from '../commands/money/crimeCommands'
import { IInteractionCommand } from '../interfaces/interactionInterface'
import { ChannelIds, MentionUtils } from '../utils/mentionUtils'
import { MessageUtils } from '../utils/messageUtils'

import { Commands, TimedEvent } from './commands'
import { MessageChecker } from './messageChecker'

export class CommandRunner {
    private commands: Commands | undefined
    private commandsReady = false

    private client: MazariniClient
    messageChecker: MessageChecker

    lastUsedCommand = 'help'

    constructor(client: MazariniClient) {
        this.client = client
        this.messageChecker = new MessageChecker(this.client)
    }

    initCommands() {
        this.commands = new Commands(this.client)
        this.commandsReady = true
    }
    async runCommands(message: Message) {
        try {
            /** Check if the bot is allowed to send messages in this channel */
            if (!MessageUtils.isLegalChannel(message.channelId) || this.client.lockHandler.checkIfLockedPath(message)) return undefined
            /** Additional non-command checks */
            await this.messageChecker.checkMessageForJokes(message)

            this.messageChecker.checkMessageForHolidays(message)

            if (message.author.id === MentionUtils.User_IDs.WORDLE_BOT) await this.messageChecker.checkWordleResults(message)

            await this.client.tracker.trackEmojiStats(message)

            if (message.channelId === ChannelIds.VINMONOPOLET || (environment === 'dev' && message.channelId === ChannelIds.LOCALHOST))
                // legg til  {|| environment === 'dev'} i if-en hvis bilder skal sjekkes i localhost
                PoletCommands.checkForVinmonopolContent(message, this.client.messageHelper)
        } catch (error) {
            this.client.messageHelper.sendLogMessage(
                `Det oppstod en feil under kjøring av en command. Meldingen var fra ${message.author.username} i kanalen ${MentionUtils.mentionChannel(
                    message.channelId
                )} med innholdet ${message.content}. Stacktrace: ` + error
            )
        }
    }

    async checkForCommandInInteraction(interaction: Interaction<CacheType>) {
        if (!this.commandsReady) {
            if (interaction.isRepliable()) {
                interaction.reply({ content: 'Boten starter opp – kommandoene er ikke klare ennå. Prøv igjen om et øyeblikk. 🔄', ephemeral: true })
            }
            return
        }
        /** Check if any part of the interaction is currently locked - if it is, do not proceed. Answer with an ephemeral message explaining the lock */
        if (this.client.lockHandler.checkIfLockedPath(interaction)) {
            if (interaction.isRepliable()) {
                this.client.messageHelper.replyToInteraction(
                    interaction,
                    `Interaksjoner er låst. Prøv å se ${MentionUtils.mentionChannel(ChannelIds.BOT_UTVIKLING)} for informasjon, eller tag bot-support`,
                    { ephemeral: true }
                )
            }
        } else if (MessageUtils.isLegalChannel(interaction.channelId) && (await this.checkIfBlockedByJail(interaction))) {
            if (interaction.isRepliable()) {
                this.client.messageHelper.replyToInteraction(interaction, `Du e i fengsel, bro`, { ephemeral: true })
            }
        } else if (MessageUtils.isLegalChannel(interaction.channelId)) {
            let hasAcknowledged = false
            //TODO: This might have to be refactored, but ContextMenuCommands are for now treated as regular ChatInputCommands, as they only have a commandName
            //Autocomplete Interactions are also handled by this block, since they are triggered by ChatInputs.
            if (interaction.isChatInputCommand() || interaction.isContextMenuCommand() || interaction.isAutocomplete()) {
                const cmd = this.commands!.allTextCommands.get(interaction.commandName)
                if (cmd) {
                    if (interaction.isAutocomplete()) {
                        //Need to also check if autoCompleteCallback is present, since AutoComplete can trigger on normal input fields.
                        if (cmd.autoCompleteCallback) cmd.autoCompleteCallback(interaction)
                    } else {
                        this.runInteractionElement<ChatInteraction | ContextMenuCommandInteraction<CacheType>>(cmd, interaction)
                    }
                    hasAcknowledged = true
                }
            } else if (interaction.type === InteractionType.ModalSubmit) {
                const cmd = this.commands!.allModalCommands.get(interaction.customId.split(';')[0])
                if (cmd) {
                    this.runInteractionElement<ModalInteraction>(cmd, interaction)
                    hasAcknowledged = true
                }
            } else if (interaction.isStringSelectMenu()) {
                const cmd = this.commands!.allSelectMenuCommands.get(interaction.customId.split(';')[0])
                if (cmd) {
                    this.runInteractionElement<SelectStringInteraction>(cmd, interaction)
                    hasAcknowledged = true
                }
            } else if (interaction.isButton()) {
                const cmd = this.commands!.allButtonCommands.get(interaction.customId.split(';')[0])
                if (cmd) {
                    this.runInteractionElement<BtnInteraction>(cmd, interaction)
                    hasAcknowledged = true
                }
            }

            // New interactions are added online, so it is instantly available in the production version of the app, despite being on development
            // Therefore a command that doesnt yet "exist" could still be run.
            if (!hasAcknowledged) {
                interaction.isRepliable() ? interaction.reply(`Denne interaksjonen støttes ikke for øyeblikket`) : undefined
                if (environment === 'prod') {
                    const uncastInteraction = interaction as any

                    this.client.messageHelper.sendLogMessage(
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

    async runSave() {
        return this.commands ? await this.commands.doSaveAllCommands() : undefined
    }

    async runRefresh() {
        return this.commands ? await this.commands.doRefreshAllCommands() : undefined
    }

    async runJobs(timing: TimedEvent) {
        return this.commands ? await this.commands.doJobs(timing) : undefined
    }

    runOnReady() {
        return this.commands?.doOnReadyAllCommands()
    }

    async checkIfBlockedByJail(interaction: BaseInteraction) {
        const user = await this.client.database.getUser(interaction.user.id)
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
        if (runningInteraction.disabled)
            this.client.messageHelper.replyToInteraction(interaction as ChatInputCommandInteraction, `Denne kommandoen er ikke tilgjengelig`)
        else runningInteraction.command(interaction)
    }

    /** @deprecated To be removed */
    get commandsList() {
        return this.commands!
    }
}
