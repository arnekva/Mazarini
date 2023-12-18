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
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { GameStateHandler } from '../handlers/gameStateHandler'
import { LudoPlayer } from './games/ludo/ludo'

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

const p1: LudoPlayer = {
    color: 'red',
    id: 1,
    diceroll: 0,
    pieces: undefined,
}
const p2: LudoPlayer = {
    color: 'blue',
    id: 2,
    diceroll: 0,
    pieces: undefined,
}
// NB: IKKE PUSH ENDRINGER I DENNE KLASSEN MED MINDRE DET ER GENERISKE HJELPEMETODER

// Skall-klasse for testing av alt mulig random shit.
// Fungerer også som en template for andre klasser

export class TestCommands extends AbstractCommands {
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>
    private gsh: GameStateHandler<LudoPlayer>


    constructor(client: MazariniClient) {
        super(client)
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = defaultButtonRow
        this.gsh = new GameStateHandler<LudoPlayer>()
    }

    private async test(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const test1 = this.gsh.isPlayersTurn(p1)
        console.log('test1: ', test1);
        this.gsh.addPlayer(p1)
        const test2 = this.gsh.isPlayersTurn(p1)
        console.log('test2: ', test2);
        const test3 = this.gsh.nextPlayer()
        console.log('test3: ', test3);
        this.gsh.addPlayer(p2)
        const test4 = this.gsh.isPlayersTurn(p2)
        console.log('test4: ', test4);
        const test5 = this.gsh.nextPlayer()
        console.log('test5: ', test5);
        const test6 = this.gsh.isPlayersTurn(p2)
        console.log('test6: ', test6);
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

    getAllInteractions() {
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
