/* eslint-disable @typescript-eslint/no-unused-vars */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, TextDisplayBuilder } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ATCInteraction, BtnInteraction, ChatInteraction, ModalInteraction, SelectStringInteraction } from '../../Abstracts/MazariniInteraction'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { environment } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { Scripts } from '../../scripts/scripts'
import { LootboxCommands } from '../store/lootboxCommands'

const defaultBtn = (id: string) => {
    return new ButtonBuilder({
        custom_id: `TEST_BUTTON;${id}`,
        style: ButtonStyle.Primary,
        label: `${id}`,
        disabled: false,
        type: 2,
    })
}
const defaultButtonRow = new ActionRowBuilder<ButtonBuilder>()
// const fetch = require('node-fetch')
// var fs = require('fs')
// NB: IKKE PUSH ENDRINGER I DENNE KLASSEN MED MINDRE DET ER GENERISKE HJELPEMETODER

// Skall-klasse for testing av alt mulig random shit.
// Fungerer også som en template for andre klasser

export class TestCommands extends AbstractCommands {
    private msg: Message
    private embedMessage: Message
    private buttonsMessage: Message
    private container: SimpleContainer
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>
    private lootCmmds: LootboxCommands
    // private gsh: GameStateHandler<LudoPlayer>

    constructor(client: MazariniClient) {
        super(client)
        this.msg = undefined
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.container = undefined
        this.currentButtons = defaultButtonRow
        this.lootCmmds = new LootboxCommands(client)
        // this.gsh = new GameStateHandler<LudoPlayer>()
    }

    private async testing(interaction: ChatInteraction | BtnInteraction) {
        const user = await this.database.getUser(interaction.user.id)
        const item = user.collectables[10]
        const link = await this.database.getLootGifLink(`loot/${item.series}/${item.name}_${item.color}.gif`)
        console.log(link)
        this.messageHelper.replyToInteraction(interaction, link)
    }

    private async test(interaction: ChatInteraction | BtnInteraction) {
        const scripts = new Scripts(this.client)
        // scripts.setCCGCards()
        // scripts.setLootPacks()
        this.messageHelper.replyToInteraction(interaction, 'oppdaterer ccg greier (i prod)')
    }

    private async testSelectMenu(selectMenu: SelectStringInteraction) {
        // const value = selectMenu.values[0]
        // Kode
        await selectMenu.deferUpdate()
    }

    private async testButton(interaction: BtnInteraction) {
        // Kodedsddsad
        await interaction.deferUpdate()
        const text2 = new TextDisplayBuilder().setContent(['# Dette er en ny test', '-# mindre tekst', '## Enda mindre headline'].join('\n'))
        this.container.replaceComponent('sub-text', text2)
        this.msg.edit({ components: [this.container.container] })
    }

    private async testModalSubmit(interaction: ModalInteraction) {
        // const value = interaction.fields.getTextInputValue('someCustomFieldId')
        // Kode
        await interaction.deferUpdate()
    }

    //Redigerer eksisterende embed hvis det er en knapp interaction, sender ny embed hvis ikke
    private async replyToInteraction(interaction: ChatInteraction | BtnInteraction) {
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
    private async resendMessages(interaction: BtnInteraction) {
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

    private testSwitch(interaction: ChatInteraction) {
        const action = interaction.options.getSubcommand()
        interaction.user
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

    private itemAutocomplete(interaction: ATCInteraction) {
        const optionList: any = interaction.options
        const input = optionList.getFocused().toLowerCase()
        console.log(optionList._hoistedOptions)
        console.log(input)

        // interaction.respond(
        // 	series
        //     .filter(series => series.name.toLowerCase().includes(input))
        //     .map(series => ({ name: series.name, value: series.name }))
        // )
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'test',
                        command: (rawInteraction: ChatInteraction) => {
                            if (environment === 'prod')
                                this.messageHelper.replyToInteraction(rawInteraction, 'Denne kan kun brukes i dev-miljø', { ephemeral: true })
                            else this.testSwitch(rawInteraction)
                        },
                        autoCompleteCallback: (interaction: ATCInteraction) => {
                            this.itemAutocomplete(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'TEST_BUTTON',
                        command: (rawInteraction: BtnInteraction) => {
                            this.testButton(rawInteraction)
                        },
                    },
                ],
                modalInteractionCommands: [
                    {
                        commandName: 'TEST_MODAL_1',
                        command: (rawInteraction: ModalInteraction) => {
                            this.testModalSubmit(rawInteraction)
                        },
                    },
                ],
                selectMenuInteractionCommands: [
                    {
                        commandName: 'TEST_SELECT_MENU_1',
                        command: (rawInteraction: SelectStringInteraction) => {
                            this.testSelectMenu(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

// LA STÅ
// GENERATE GIFs FOR LOOT SERIES: (copy to test() and run)

// const hp_series: ILootSeries = {
//     name: 'hp',
//     added: new Date(),
//     common: ['myrtle', 'rita_skeeter', 'umbridge', 'filch', 'lockhart'],
//     rare: ['ron', 'madeye', 'draco', 'neville', 'slughorn'],
//     epic: ['bellatrix', 'hermione', 'mcgonagall', 'dobby', 'hagrid'],
//     legendary: ['harry_potter', 'dumbledore', 'snape', 'voldemort', 'sirius'],
// }

// this.database.addLootboxSeries(hp_series)

// const channelId = interaction.channelId
// const igh = new ImageGenerationHelper(this.client)
// this.messageHelper.replyToInteraction(interaction, 'Snakkes om 30min når alle webp-ene er lastet opp')
// const series = (await this.client.database.getLootboxSeries())[2] // CHANGE THIS FOR DIFFERENT SERIES

// console.log('Common items')
// for (const item of series.common) {
//     console.log(`Generating gifs for ${item}`)
//     const none = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Common,
//         color: ItemColor.None,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_none`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_none.webp`, none)
//     const silver = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Common,
//         color: ItemColor.Silver,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_silver`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_silver.webp`, silver)
//     const gold = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Common,
//         color: ItemColor.Gold,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_gold`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_gold.webp`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Common,
//         color: ItemColor.Diamond,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_diamond`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_diamond.webp`, diamond)
// }
// console.log('Rare items')

// for (const item of series.rare) {
//     console.log(`Generating gifs for ${item}`)
//     const none = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Rare,
//         color: ItemColor.None,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_none`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_none.webp`, none)
//     const silver = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Rare,
//         color: ItemColor.Silver,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_silver`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_silver.webp`, silver)
//     const gold = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Rare,
//         color: ItemColor.Gold,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_gold`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_gold.webp`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Rare,
//         color: ItemColor.Diamond,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_diamond`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_diamond.webp`, diamond)
// }
// console.log('Epic items')
// for (const item of series.epic) {
//     console.log(`Generating gifs for ${item}`)
//     const none = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Epic,
//         color: ItemColor.None,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_none`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_none.webp`, none)
//     const silver = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Epic,
//         color: ItemColor.Silver,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_silver`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_silver.webp`, silver)
//     const gold = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Epic,
//         color: ItemColor.Gold,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_gold`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_gold.webp`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Epic,
//         color: ItemColor.Diamond,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_diamond`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_diamond.webp`, diamond)
// }
// console.log('Legedary items')
// for (const item of series.legendary) {
//     console.log(`Generating gifs for ${item}`)
//     const none = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Legendary,
//         color: ItemColor.None,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_none`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_none.webp`, none)
//     const silver = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Legendary,
//         color: ItemColor.Silver,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_silver`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_silver.webp`, silver)
//     const gold = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Legendary,
//         color: ItemColor.Gold,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_gold`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_gold.webp`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({
//         name: item,
//         series: 'hp',
//         rarity: ItemRarity.Legendary,
//         color: ItemColor.Diamond,
//         amount: 1,
//     })
//     console.log(`Uploading ${item}_diamond`)
//     this.client.database.uploadLootGif(`loot/hp/${item}_diamond.webp`, diamond)
// }
// this.messageHelper.sendMessage(channelId, { text: '<:pointerbrothers1:1177653110852825158>' })

// const memes = await this.database.getMemes()
// memes.push(memeTemplate)
// const updates = {}
// updates[`/memes`] = memes
// this.database.updateData(updates)

// this.messageHelper.replyToInteraction(interaction, `Laster opp nytt meme template`)

// const memeTemplate: Meme = {
//     id: '',
//     name: '',
//     url: '',
//     width: ,
//     height: ,
//     box_count: ,
//     captions: ,
//     tags: [''],
// //     boxes: [{
// //         x: ,
// //         y: ,
// //         width: ,
// //         height: ,
// //         color: '#ffffff'
// //     },
// //     {
// //         x: ,
// //         y: ,
// //         width: ,
// //         height: ,
// //         color: '#ffffff'
// //     },
// //     {
// //         x: ,
// //         y: ,
// //         width: ,
// //         height: ,
// //         color: '#ffffff'
// //     },
// //     ]
// }
