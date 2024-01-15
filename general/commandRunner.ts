import {
    ButtonInteraction,
    CacheType,
    ChatInputCommandInteraction,
    ContextMenuCommandInteraction,
    Interaction,
    InteractionType,
    Message,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from 'discord.js'
import { environment } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { illegalCommandsWhileInJail } from '../commands/money/crimeCommands'
import { PoletCommands } from '../commands/poletCommands'
import { IInteractionCommand } from '../interfaces/interactionInterface'
import { ChannelIds, MentionUtils } from '../utils/mentionUtils'
import { MessageUtils } from '../utils/messageUtils'

import { Commands } from './commands'
import { MessageChecker } from './messageChecker'

export class CommandRunner {
    private commands: Commands

    private client: MazariniClient
    messageChecker: MessageChecker

    lastUsedCommand = 'help'

    constructor(client: MazariniClient) {
        this.client = client
        this.commands = new Commands(client)
        this.messageChecker = new MessageChecker(this.client)
    }
    async runCommands(message: Message) {
        try {
            /** Check if the bot is allowed to send messages in this channel */
            if (!MessageUtils.isLegalChannel(message.channelId) || this.client.lockHandler.checkIfLockedPath(message)) return undefined
            /** Additional non-command checks */
            await this.messageChecker.checkMessageForJokes(message)

            await this.client.tracker.trackEmojiStats(message)

            if (message.channelId === ChannelIds.VINMONOPOLET || environment === "dev") PoletCommands.checkForVinmonopolContent(message, this.client.messageHelper)
        } catch (error) {
            this.client.messageHelper.sendLogMessage(
                `Det oppstod en feil under kjøring av en command. Meldingen var fra ${message.author.username} i kanalen ${MentionUtils.mentionChannel(
                    message.channelId
                )} med innholdet ${message.content}. Stacktrace: ` + error
            )
        }
    }

    async checkForCommandInInteraction(interaction: Interaction<CacheType>) {
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
                this.commands.getAllTextCommands().forEach((cmd) => {
                    if (cmd.commandName === interaction.commandName) {
                        if (interaction.isAutocomplete()) {
                            //Need to also check if autoCompleteCallback is present, since AutoComplete can trigger on normal input fields.
                            if (cmd.autoCompleteCallback) cmd.autoCompleteCallback(interaction)
                        } else {
                            this.runInteractionElement<ChatInputCommandInteraction<CacheType> | ContextMenuCommandInteraction<CacheType>>(cmd, interaction)
                        }
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

    async checkIfBlockedByJail(interaction: Interaction<CacheType>) {
        const user = await this.client.db.getUser(interaction.user.id)
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
        if (runningInteraction.disabled && environment === 'prod')
            this.client.messageHelper.replyToInteraction(interaction as ChatInputCommandInteraction, `Denne kommandoen er ikke tilgjengelig`)
        else runningInteraction.command(interaction)
    }
}
