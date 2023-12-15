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
import { EmbedUtils } from '../utils/embedUtils'
import { LanguageCodes } from '../utils/languageUtils'
import { VivinoCommands } from './vivinoCommands'

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

    constructor(client: MazariniClient) {
        super(client)
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = defaultButtonRow
    }

    private async test(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const vvc = new VivinoCommands(this.client)
        const data = await vvc.findData(interaction)

        const newestItem = data[0]
        const imageUrl = `https:${newestItem.object.image.location}`
        // const embed = EmbedUtils.createSimpleEmbed(
        //     `${newestItem.object.vintage.name} ${newestItem.object.vintage.year}`,
        //     `${newestItem.object.review.rating} - ${newestItem.object.review.note}`
        // )
        //     .setThumbnail(imageUrl)
        //     .setFooter({ text: `Totalt ${data.length} ratinger` })

        const thisYear = vvc.findRatingsThisYear(data)
        const allCountries = thisYear.reduce(function (value, value2) {
            return (
                value[value2.object.vintage.wine.region.country]
                    ? ++value[value2.object.vintage.wine.region.country]
                    : (value[value2.object.vintage.wine.region.country] = 1),
                value
            )
        }, {})
        const asValues = Object.entries(allCountries).sort((a, b) => (b[1] as number) - (a[1] as number))
        console.log(asValues)

        const embed = EmbedUtils.createSimpleEmbed(`Ditt vin-år`, `Du ratet ${thisYear.length} viner i 2023`)
        asValues.forEach((val) => {
            embed.addFields({
                name: LanguageCodes[val[0].toUpperCase()],
                value: val[1] + ' viner',
            })
        })

        this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true })
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
