import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Message,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'

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

// NB: IKKE PUSH ENDRINGER I DENNE KLASSEN MED MINDRE DET ER GENERISKE HJELPEMETODER

// Skall-klasse for testing av alt mulig random shit.
// Fungerer også som en template for andre klasser
export class TestCommands extends AbstractCommands {
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = defaultButtonRow
    }

    private async test(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {}

    private async testSelectMenu(selectMenu: StringSelectMenuInteraction<CacheType>) {
        const value = selectMenu.values[0]
        // Kode
        selectMenu.deferUpdate()
    }

    private async testButton(interaction: ButtonInteraction<CacheType>) {
        // Kode
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
            this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
            this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
        }
    }

    //Flytt embed ned til bunnen
    private async resendMessages(interaction: ButtonInteraction<CacheType>) {
        this.deleteMessages()
        this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
        this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
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
