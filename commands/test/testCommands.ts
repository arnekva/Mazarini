import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    Message,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'

const defaultButtonRow = new ActionRowBuilder<ButtonBuilder>()
defaultButtonRow.addComponents(
    new ButtonBuilder({
        custom_id: `TEST_BUTTON_1`,
        style: ButtonStyle.Primary,
        label: `Test`,
        disabled: false,
        type: 2,
    })
)
const fetch = require('node-fetch')

// NB: IKKE PUSH ENDRINGER I DENNE KLASSEN MED MINDRE DET ER GENERISKE HJELPEMETODER

// Skall-klasse for testing av alt mulig random shit.
// Fungerer også som en template for andre klasser

export class TestCommands extends AbstractCommands {
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>
    // private gsh: GameStateHandler<LudoPlayer>

    constructor(client: MazariniClient) {
        super(client)
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = defaultButtonRow
        // this.gsh = new GameStateHandler<LudoPlayer>()
    }

    private async test(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        // const winner = await this.client.database.findAndRewardWeeklyDeathrollWinner()
        // if (winner) {
        //     const embed = EmbedUtils.createSimpleEmbed(`:game_die: Ukens deathrollvinner er... :game_die:`, `${MentionUtils.mentionUser(winner.id)}!`
        //                 + `\nDu tapte ${winner.userStats.deathrollStats.weeklyLosses > 0 ? 'bare ' : 'faktisk '}${((winner.userStats.deathrollStats.weeklyLosses/winner.userStats.deathrollStats.weeklyGames)*100).toFixed(1)}% av spillene dine forrige uke.`
        //                 + `\n\n:moneybag: Det er lavest av alle, og du vinne ${100 * winner.userStats.deathrollStats.weeklyGames} chips! :moneybag:`)
        //     this.messageHelper.sendMessage(ThreadIds.LOCALHOST_TEST, {embed: embed})
        // }
        // this.client.database.resetWeeklyDeathrollStats()
        this.client.onRestart()
    }

    private async testSelectMenu(selectMenu: StringSelectMenuInteraction<CacheType>) {
        const value = selectMenu.values[0]
        // Kode
        selectMenu.deferUpdate()
    }

    private async testButton(interaction: ButtonInteraction<CacheType>) {
        // Kodedsddsad
        interaction.deferUpdate()
    }

    private async testModalSubmit(interaction: ModalSubmitInteraction<CacheType>) {
        const value = interaction.fields.getTextInputValue('someCustomFieldId')
        // Kode
        interaction.deferUpdate()
    }

    //Redigerer eksisterende embed hvis det er en knapp interaction, sender ny embed hvis ikke
    private async replyToInteraction(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) {
            this.embedMessage.edit({ embeds: [this.embed] })
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Test')
            this.embedMessage = await this.messageHelper.sendMessage(interaction?.channelId, { embed: this.embed })
            this.buttonsMessage = await this.messageHelper.sendMessage(interaction?.channelId, { components: [this.currentButtons] })
        }
    }

    //Flytt embed ned til bunnen
    private async resendMessages(interaction: ButtonInteraction<CacheType>) {
        this.deleteMessages()
        this.embedMessage = await this.messageHelper.sendMessage(interaction?.channelId, { embed: this.embed })
        this.buttonsMessage = await this.messageHelper.sendMessage(interaction?.channelId, { components: [this.currentButtons] })
    }

    //Slett meldingene
    private deleteMessages() {
        this.embedMessage.delete()
        this.buttonsMessage.delete()
        this.embedMessage = undefined
        this.buttonsMessage = undefined
    }

    private testSwitch(interaction: ChatInputCommandInteraction<CacheType>) {
        const action = interaction.options.getSubcommand()
        if (action) {
            switch (action.toLowerCase()) {
                case '-1-': {
                    this.test(interaction)
                    break
                }
                case '-2-': {
                    this.test(interaction)
                    break
                }
                case '-3-': {
                    this.test(interaction)
                    break
                }
                case '-4-': {
                    this.test(interaction)
                    break
                }
                default: {
                    this.messageHelper.replyToInteraction(interaction, 'Default test sub-command')
                }
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Ingen test sub-command angitt')
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'test',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.testSwitch(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'TEST_BUTTON_1',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.testButton(rawInteraction)
                        },
                    },
                ],
                modalInteractionCommands: [
                    {
                        commandName: 'TEST_MODAL_1',
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.testModalSubmit(rawInteraction)
                        },
                    },
                ],
                selectMenuInteractionCommands: [
                    {
                        commandName: 'TEST_SELECT_MENU_1',
                        command: (rawInteraction: StringSelectMenuInteraction<CacheType>) => {
                            this.testSelectMenu(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
