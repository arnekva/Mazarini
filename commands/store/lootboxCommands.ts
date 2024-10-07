import {
    ActionRowBuilder,
    AttachmentBuilder,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { ImageGenerationHelper } from '../../helpers/imageGenerationHelper'
import {
    ICollectableSeries,
    ICollectibleColorCounter,
    ILootbox,
    ItemColor,
    ItemRarity,
    IUserCollectable,
    LootboxQuality,
    MazariniUser,
} from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { RandomUtils } from '../../utils/randomUtils'

export class LootboxCommands extends AbstractCommands {
    private imageGenerator: ImageGenerationHelper
    private lootboxes: ILootbox[]
    private series: ICollectableSeries[]

    constructor(client: MazariniClient) {
        super(client)
        this.imageGenerator = new ImageGenerationHelper(client)
    }

    static getDailyLootboxRewardButton(userId: string, quality: string): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
                custom_id: `OPEN_LOOTBOX;${userId};${quality}`,
                style: ButtonStyle.Primary,
                label: `Open lootbox`,
                disabled: false,
                type: 2,
            })
        )
    }

    private async openLootboxFromButton(interaction: ButtonInteraction<CacheType>) {
        const lootboxOwnerId = interaction.customId.split(';')[1]
        if (interaction.user.id === lootboxOwnerId) {
            interaction.message.edit({ components: [] })
            await this.openAndRegisterLootbox(interaction)
        } else this.messageHelper.replyToInteraction(interaction, 'Det er ikke din boks dessverre', { ephemeral: true })
    }

    private async openAndRegisterLootbox(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        let quality = ''
        let series = ''
        if (interaction.isChatInputCommand()) {
            quality = interaction.options.get('quality')?.value as string
            series = interaction.options.get('series')?.value as string
        } else if (interaction.isButton()) {
            quality = interaction.customId.split(';')[2]
        }
        const box = await this.resolveLootbox(quality)
        if (interaction.isChatInputCommand() && !this.checkBalanceAndTakeMoney(user, box, interaction)) return
        const rewardedItem = await this.calculateRewardItem(box, series)
        this.registerItemOnUser(user, rewardedItem)
        this.revealCollectable(interaction, rewardedItem)
    }

    private async resolveLootbox(quality: string): Promise<ILootbox> {
        if (!this.lootboxes) this.lootboxes = await this.client.database.getLootboxes()
        return this.lootboxes.find((box) => box.quality === quality)
    }

    private checkBalanceAndTakeMoney(user: MazariniUser, box: ILootbox, interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const moneyWasTaken = this.client.bank.takeMoney(user, box.price)
        if (!moneyWasTaken) this.messageHelper.replyToInteraction(interaction, 'Du har kje råd te den', { ephemeral: true })
        return moneyWasTaken
    }

    private async calculateRewardItem(box: ILootbox, series: string) {
        const itemRoll = Math.random()
        const colored = Math.random() < box.probabilities.color
        if (itemRoll < box.probabilities.legendary) {
            return await this.getRandomItemForRarity(ItemRarity.Legendary, series, colored)
        } else if (itemRoll < box.probabilities.epic) {
            return await this.getRandomItemForRarity(ItemRarity.Epic, series, colored)
        } else if (itemRoll < box.probabilities.rare) {
            return await this.getRandomItemForRarity(ItemRarity.Rare, series, colored)
        } else {
            return await this.getRandomItemForRarity(ItemRarity.Common, series, colored)
        }
    }

    private async getRandomItemForRarity(rarity: ItemRarity, series: string, colored: boolean): Promise<IUserCollectable> {
        const seriesOrDefault = await this.getSeriesOrDefault(series)
        const rarityItems = this.getRarityItems(seriesOrDefault, rarity)
        const item = RandomUtils.getRandomItemFromList(rarityItems)
        const inventory = this.getRandomColor(colored)
        return { name: item, series: seriesOrDefault.name, rarity: rarity, inventory: inventory }
    }

    private async getSeriesOrDefault(series: string): Promise<ICollectableSeries> {
        const lootboxSeries = await this.getSeries()
        const seriesName = series && series !== '' ? series : lootboxSeries.sort((a, b) => b.added.getTime() - a.added.getTime())[0].name
        return lootboxSeries.find((x) => x.name === seriesName) ?? lootboxSeries[0]
    }

    private async getSeries(): Promise<ICollectableSeries[]> {
        if (!this.series) this.series = await this.client.database.getLootboxSeries()
        return this.series
    }

    private getRarityItems(series: ICollectableSeries, rarity: ItemRarity): string[] {
        if (rarity === ItemRarity.Common) return series.common
        else if (rarity === ItemRarity.Rare) return series.rare
        else if (rarity === ItemRarity.Epic) return series.epic
        else if (rarity === ItemRarity.Legendary) return series.legendary
        else return undefined
    }

    private getRandomColor(colored: boolean): ICollectibleColorCounter {
        const roll = Math.random()
        let color: ItemColor = undefined
        if (!colored) {
            color = ItemColor.None
        } else if (roll < 1 / 6) {
            color = ItemColor.Diamond // 1/6 chance for diamond
        } else if (roll < 1 / 3) {
            color = ItemColor.Gold // 2/6 chance for gold
        } else {
            color = ItemColor.Silver // 3/6 chance for silver
        }
        return {
            none: color === ItemColor.None ? 1 : 0,
            silver: color === ItemColor.Silver ? 1 : 0,
            gold: color === ItemColor.Gold ? 1 : 0,
            diamond: color === ItemColor.Diamond ? 1 : 0,
        }
    }

    private registerItemOnUser(user: MazariniUser, item: IUserCollectable) {
        const itemAlreadyCollected = user.collectables?.some((collectible) => collectible.name === item.name)
        if (itemAlreadyCollected) {
            user.collectables = user.collectables.map((el) =>
                el.name === item.name
                    ? {
                          ...el,
                          inventory: {
                              none: el.inventory.none + item.inventory.none,
                              silver: el.inventory.silver + item.inventory.silver,
                              gold: el.inventory.gold + item.inventory.gold,
                              diamond: el.inventory.diamond + item.inventory.diamond,
                          },
                      }
                    : el
            )
        } else {
            user.collectables = user.collectables ?? new Array<IUserCollectable>()
            user.collectables.push(item)
        }
        this.client.database.updateUser(user)
    }

    private async revealCollectable(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, item: IUserCollectable) {
        await interaction.deferReply()
        const path = this.getGifPath(item)
        const buffer = Buffer.from(await this.client.database.getFromStorage(path))
        const file = new AttachmentBuilder(buffer, {name: 'collectable.gif'})
        this.messageHelper.replyToInteraction(interaction, '', {hasBeenDefered: true}, undefined, [file])
    }

    private getGifPath(item: IUserCollectable): string {
        const color = this.getColorForNewItem(item)
        return `loot/${item.series}/${item.name}_${color}.gif`
    }

    private getColorForNewItem(item: IUserCollectable): ItemColor {
        if (item.inventory.diamond === 1) return ItemColor.Diamond
        else if (item.inventory.gold === 1) return ItemColor.Gold
        else if (item.inventory.silver === 1) return ItemColor.Silver
        else return ItemColor.None
    }

    private async seriesAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
        const series = await this.getSeries()
        const optionList: any = interaction.options
        const input = optionList.getFocused().toLowerCase()
		interaction.respond(
			series
            .filter(series => series.name.toLowerCase().includes(input))
            .map(series => ({ name: series.name, value: series.name })) 
		)
    }

    private async printInventory(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const user = await this.client.database.getUser(interaction.user.id)
        const seriesParam = interaction.options.get('series')?.value as string
        const series = await this.getSeriesOrDefault(seriesParam)
        const img = await this.imageGenerator.generateImageForCollectables(user.collectables?.filter(item => item.series === series.name).sort((a,b) => a.name.localeCompare(b.name)))
        const file = new AttachmentBuilder(img, { name: 'inventory.png' }) 
        this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, undefined, [file]) 
    }

    private executeLootSubCommand(interaction: ChatInputCommandInteraction<CacheType>) {
        const cmdGroup = interaction.options.getSubcommandGroup()
        const cmd = interaction.options.getSubcommand()
        if (!cmdGroup && cmd === 'box') this.openAndRegisterLootbox(interaction)
        else if (!cmdGroup && cmd === 'inventory') this.printInventory(interaction)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'loot',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.executeLootSubCommand(rawInteraction)
                        },
                        autoCompleteCallback: (interaction: AutocompleteInteraction<CacheType>) => {
                            this.seriesAutocomplete(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'OPEN_LOOTBOX',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.openLootboxFromButton(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

export const basicLootbox: ILootbox = {
    quality: LootboxQuality.Basic,
    price: 5000,
    probabilities: {
        common: 100 / 100, // 75%
        rare: 25 / 100, // 15%
        epic: 10 / 100, //8%
        legendary: 2 / 100, // 2%
        color: 1 / 5, // 20%
    },
}

export const premiumLootbox: ILootbox = {
    quality: LootboxQuality.Premium,
    price: 20000,
    probabilities: {
        common: 100 / 100, // 50%
        rare: 50 / 100, // 30%
        epic: 20 / 100, // 16%
        legendary: 4 / 100, // 4%
        color: 1 / 3, // 33%
    },
}

export const eliteLootbox: ILootbox = {
    quality: LootboxQuality.Elite,
    price: 50000,
    probabilities: {
        common: 0, // 0%
        rare: 100 / 100, // 60%
        epic: 40 / 100, // 30%
        legendary: 10 / 100, // 10%
        color: 1 / 2, // 50%
    },
}

export const lootboxMock: ILootbox[] = [basicLootbox, premiumLootbox, eliteLootbox]

export const lootSeriesMock: ICollectableSeries[] = [
    {
        name: 'mazarini',
        added: new Date(),
        common: ['arne_satisfied', 'fole', 'geggi_satisfied', 'arne_superior', 'crycatthumbsup'],
        rare: ['choke', 'maggi_scared', 'arne', 'geggi_excited', 'hhhhheeehhhhhh'],
        epic: ['pointerbrothers1', 'pointerbrothers2', 'shrekstare'],
        legendary: ['polse', 'hoie', 'eivindpride'],
    },
]
