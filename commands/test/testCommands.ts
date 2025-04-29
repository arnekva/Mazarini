/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    ActionRowBuilder,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
    ModalSubmitInteraction,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuInteraction,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { environment } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'
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

    private async testing(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const user = await this.database.getUser(interaction.user.id)
        const item = user.collectables[10]
        const link = await this.database.getLootGifLink(`loot/${item.series}/${item.name}_${item.color}.gif`)
        console.log(link)
        this.messageHelper.replyToInteraction(interaction, link)
    }

    private async test(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const a = new SimpleContainer()
        const text1 = new TextDisplayBuilder().setContent(['# Dette er en test', '-# liten tekst', '## Mindre headline'].join('\n'))
        // a.addTextDisplayComponents(text1)
        const mg = new MediaGalleryBuilder()
        for (let i = 0; i < 9; i++) {
            const mgItemBuilder = new MediaGalleryItemBuilder()
            mgItemBuilder.setURL('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQbZDZ9PFJ26ymhBEy2eu-I_RwcSN6f59Wgbg&s')
            mgItemBuilder.setSpoiler(i % 2 === 0)
            mg.addItems(mgItemBuilder)
        }
        const mg2 = new MediaGalleryBuilder()
        for (let i = 0; i < 9; i++) {
            const mgItemBuilder = new MediaGalleryItemBuilder()
            mgItemBuilder.setURL('https://www.daringgourmet.com/wp-content/uploads/2018/01/Breakfast-Sausages-5-square-lighter-2-500x500.jpg')
            mg2.addItems(mgItemBuilder)
        }
        const thumbnaik = new ThumbnailBuilder({
            description: 'some text',
            media: {
                url: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnZnYTltbW5nYm12dTViZmhlYnZqYTVnbDVxbGlseTR5Y2E5Ymt6ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/N3W7S8DdgCM879Q7Hb/giphy.gif',
            },
        })
        const mg3 = new MediaGalleryBuilder()
        const mgItemBuilder = new MediaGalleryItemBuilder()
        mgItemBuilder.setURL(
            'https://firebasestorage.googleapis.com/v0/b/mazarini-384411.appspot.com/o/loot%2Fsw%2Fbattle_droid_silver.gif?alt=media&token=05aa5f73-115d-4180-9ad5-0b3f363e53e3'
        )
        mg3.addItems(mgItemBuilder)

        const section2 = new SectionBuilder().addTextDisplayComponents(text1).setThumbnailAccessory(thumbnaik) //.setButtonAccessory(defaultBtn('test'))
        const separator = new SeparatorBuilder({
            spacing: SeparatorSpacingSize.Small,
            divider: true,
        })

        const color = (interaction.member as GuildMember).displayColor
        a.addComponent(text1, 'header')
        a.addComponent(separator, 'separator1')
        a.addComponent(text1, 'sub-text')
        a.addComponent(defaultButtonRow.addComponents(defaultBtn('replace')), 'buttons')
        // a.spliceComponents(0, 0, text1)
        // // a.addMediaGalleryComponents(mg)
        // a.addTextDisplayComponents(text1)
        // a.addSeparatorComponents(separator)
        // a.addTextDisplayComponents(text1)
        // // a.addSectionComponents(section2)
        // a.addActionRowComponents(defaultButtonRow.addComponents(defaultBtn('1'), defaultBtn('2')))
        // // a.addMediaGalleryComponents(mg3)
        // a.setAccentColor(color)
        // console.log(a.components)
        this.container = a

        // a.addMediaGalleryComponents(mg2)
        //Note that isComponentOnly MUST be sent when using this, as componentV2 flag must be set
        // But that flag cannot always be set, as the server expects a message with components if set.
        const msg = await this.messageHelper.sendMessage(interaction.channelId, { components: [this.container.container] }, { isComponentOnly: true })
        this.msg = msg
        // await this.messageHelper.replyToInteraction(interaction, 'Test', {}, [a])
    }

    private async testSelectMenu(selectMenu: StringSelectMenuInteraction<CacheType>) {
        // const value = selectMenu.values[0]
        // Kode
        await selectMenu.deferUpdate()
    }

    private async testButton(interaction: ButtonInteraction<CacheType>) {
        // Kodedsddsad
        await interaction.deferUpdate()
        const text2 = new TextDisplayBuilder().setContent(['# Dette er en ny test', '-# mindre tekst', '## Enda mindre headline'].join('\n'))
        this.container.replaceComponent('sub-text', text2)
        this.msg.edit({ components: [this.container.container] })
    }

    private async testModalSubmit(interaction: ModalSubmitInteraction<CacheType>) {
        // const value = interaction.fields.getTextInputValue('someCustomFieldId')
        // Kode
        await interaction.deferUpdate()
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

    private itemAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
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
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            if (environment === 'prod')
                                this.messageHelper.replyToInteraction(rawInteraction, 'Denne kan kun brukes i dev-miljø', { ephemeral: true })
                            else this.testSwitch(rawInteraction)
                        },
                        autoCompleteCallback: (interaction: AutocompleteInteraction<CacheType>) => {
                            this.itemAutocomplete(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'TEST_BUTTON',
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

// LA STÅ
// GENERATE GIFs FOR LOOT SERIES: (copy to test() and run)

// const igh = new ImageGenerationHelper(this.client)
// this.messageHelper.replyToInteraction(interaction, 'Snakkes om 30min når alle gifene er lastet opp')
// const series = (await this.client.database.getLootboxSeries())[0] // CHANGE THIS FOR DIFFERENT SERIES

// console.log('Common items')
// for (let item of series.common) {
//     console.log(`Generating gifs for ${item}`);
//     const none = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Common, inventory: {none: 1, silver: 0, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_none`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_none.gif`, none)
//     const silver = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Common, inventory: {none: 0, silver: 1, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_silver`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_silver.gif`, silver)
//     const gold = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Common, inventory: {none: 0, silver: 0, gold: 1, diamond: 0} })
//     console.log(`Uploading ${item}_gold`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_gold.gif`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Common, inventory: {none: 0, silver: 0, gold: 0, diamond: 1} })
//     console.log(`Uploading ${item}_diamond`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_diamond.gif`, diamond)
// }
// console.log('Rare items')
// for (let item of series.rare) {
//     console.log(`Generating gifs for ${item}`);
//     const none = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Rare, inventory: {none: 1, silver: 0, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_none`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_none.gif`, none)
//     const silver = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Rare, inventory: {none: 0, silver: 1, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_silver`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_silver.gif`, silver)
//     const gold = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Rare, inventory: {none: 0, silver: 0, gold: 1, diamond: 0} })
//     console.log(`Uploading ${item}_gold`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_gold.gif`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Rare, inventory: {none: 0, silver: 0, gold: 0, diamond: 1} })
//     console.log(`Uploading ${item}_diamond`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_diamond.gif`, diamond)
// }
// console.log('Epic items')
// for (let item of series.epic) {
//     console.log(`Generating gifs for ${item}`);
//     const none = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Epic, inventory: {none: 1, silver: 0, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_none`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_none.gif`, none)
//     const silver = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Epic, inventory: {none: 0, silver: 1, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_silver`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_silver.gif`, silver)
//     const gold = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Epic, inventory: {none: 0, silver: 0, gold: 1, diamond: 0} })
//     console.log(`Uploading ${item}_gold`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_gold.gif`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Epic, inventory: {none: 0, silver: 0, gold: 0, diamond: 1} })
//     console.log(`Uploading ${item}_diamond`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_diamond.gif`, diamond)
// }
// console.log('Legendary items')
// for (let item of series.legendary) {
//     console.log(`Generating gifs for ${item}`);
//     const none = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Legendary, inventory: {none: 1, silver: 0, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_none`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_none.gif`, none)
//     const silver = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Legendary, inventory: {none: 0, silver: 1, gold: 0, diamond: 0} })
//     console.log(`Uploading ${item}_silver`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_silver.gif`, silver)
//     const gold = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Legendary, inventory: {none: 0, silver: 0, gold: 1, diamond: 0} })
//     console.log(`Uploading ${item}_gold`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_gold.gif`, gold)
//     const diamond = await igh.generateRevealGifForCollectable({ name: item, series: 'mazarini', rarity: ItemRarity.Legendary, inventory: {none: 0, silver: 0, gold: 0, diamond: 1} })
//     console.log(`Uploading ${item}_diamond`);
//     this.client.database.uploadLootGif(`loot/mazarini/${item}_diamond.gif`, diamond)
// }
// console.log('DOOOOOOOOOOOOOOONE');

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
