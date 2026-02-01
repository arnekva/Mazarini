import { randomUUID } from 'crypto'
import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    InteractionResponse,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ATCInteraction, BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { DatabaseHelper } from '../../helpers/databaseHelper'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { ImageGenerationHelper } from '../../helpers/imageGenerationHelper'
import { LootStatsHelper } from '../../helpers/statsHelper'
import {
    ILootbox,
    ILootSeries,
    ILootSeriesInventoryArt,
    ItemColor,
    ItemRarity,
    IUserEffects,
    IUserLootItem,
    MazariniUser,
} from '../../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'
import { CCGCard } from '../ccg/ccgInterface'
import { DealOrNoDeal } from '../games/dealOrNoDeal'

interface IPendingTrade {
    userId: string
    tradingIn: IUserLootItem[]
    receiving: ItemRarity
    series: string
}

interface IPendingChest {
    userId: string
    quality: string
    series: string
    items: Map<string, IUserLootItem>
    isCCG: boolean
    effect?: IEffectItem
    message?: InteractionResponse<boolean> | Message<boolean>
    buttons?: ActionRowBuilder<ButtonBuilder>
}

export interface IEffectItem {
    label: string
    message: string //følger formatet "Din kalendergave for {dato} er {message}"
    effect(user: MazariniUser, db?: DatabaseHelper): undefined | ActionRowBuilder<ButtonBuilder>[] | 'client-update'
}

interface InventoryUpdate {
    userId: string
    series: string
    rarity: ItemRarity
}

//TODO
const ccgBack =
    'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/fed3bb24-454f-4bdf-a721-6aa8f23e7cef/d9gnihf-ec16caeb-ec9c-4870-9480-57c7711d844f.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi9mZWQzYmIyNC00NTRmLTRiZGYtYTcyMS02YWE4ZjIzZTdjZWYvZDlnbmloZi1lYzE2Y2FlYi1lYzljLTQ4NzAtOTQ4MC01N2M3NzExZDg0NGYucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.I2prcITP_1w7rBQicZPc24PYcBaj3IZzXbCiCNOB4rE'

export class LootboxCommands extends AbstractCommands {
    private imageGenerator: ImageGenerationHelper
    private series: ILootSeries[]
    private newestSeries: ILootSeries
    private pendingTrades: Map<string, IPendingTrade>
    private pendingChests: Map<string, IPendingChest>
    private inventoryUpdateQueue: Array<InventoryUpdate>

    constructor(client: MazariniClient) {
        super(client)
        this.imageGenerator = new ImageGenerationHelper(client)
        this.pendingTrades = new Map<string, IPendingTrade>()
        this.pendingChests = new Map<string, IPendingChest>()
        this.inventoryUpdateQueue = new Array<InventoryUpdate>()
    }

    async onReady(): Promise<void> {
        const series = await this.getSeries()
        this.series = series
        this.newestSeries = series.sort((a, b) => new Date(b.added).getTime() - new Date(a.added).getTime())[0]
    }

    static getLootRewardButton(
        userId: string,
        quality: string,
        isChest: boolean = false,
        customLabel?: string,
        series: string = ''
    ): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
                custom_id: `OPEN_LOOT;${userId};${quality};${isChest ? 'chest' : 'box'};${series}`,
                style: ButtonStyle.Primary,
                label: customLabel || `${isChest ? 'Open loot chest' : 'Open lootbox'}`,
                disabled: false,
                type: 2,
            })
        )
    }

    private async openLootFromButton(interaction: BtnInteraction) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const lootboxOwnerId = interaction.customId.split(';')[1]
        if (interaction.user.id === lootboxOwnerId) {
            const type = interaction.customId.split(';')[3]
            interaction.message.edit({ components: [], content: `${type} er åpnet.` })
            if (type === 'box') await this.openAndRegisterLootbox(interaction)
            else if (type === 'chest') await this.openAndRegisterLootChest(interaction)
        } else this.messageHelper.replyToInteraction(interaction, 'Den er ikke din dessverre', { ephemeral: true, hasBeenDefered: true })
    }

    private async purchaseLootArt(interaction: ChatInteraction | BtnInteraction) {
        const user = await this.client.database.getUser(interaction.user.id)
        const series = this.resolveLootSeries(user, interaction)
        const seriesObj = await this.getSeriesOrDefault(series)
        if (interaction.isChatInputCommand()) {
            const moneyWasTaken = this.client.bank.takeMoney(user, GameValues.loot.artPrice)
            if (!moneyWasTaken) return this.messageHelper.replyToInteraction(interaction, 'Du har kje råd te den', { hasBeenDefered: true })
        }
        const sh = new LootStatsHelper(user.loot[seriesObj.name].stats)
        sh.registerArt()

        const art = await this.getRandomInventoryArt(user, seriesObj)
        user.loot[seriesObj.name].inventoryArt = art
        await this.database.updateUser(user)
        this.generateInventoryParts(user, series, [ItemRarity.Common, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary])
        const fs = require('fs')
        const image = fs.readFileSync(`graphics/background/inventory_art/${art.name}.png`)
        const file = new AttachmentBuilder(image, { name: 'background.png' })
        this.messageHelper.replyToInteraction(interaction, 'Gratulerer med ny inventory-bakgrunn!', { hasBeenDefered: true }, undefined, [file])
    }

    private async openAndRegisterLootbox(interaction: ChatInteraction | BtnInteraction) {
        const user = await this.client.database.getUser(interaction.user.id)
        const quality = this.resolveLootQuality(interaction)
        const series = this.resolveLootSeries(user, interaction)
        const seriesObj = await this.getSeriesOrDefault(series)
        const box = await this.resolveLootbox(quality)
        if (interaction.isChatInputCommand() && !this.checkBalanceAndTakeMoney(user, box, interaction)) return
        const sh = new LootStatsHelper(user.loot[seriesObj.name].stats)
        sh.registerPurchase(box, false, interaction.isChatInputCommand())

        const rewardedItem = this.calculateRewardItem(box, seriesObj, user)
        this.registerItemOnUser(user, rewardedItem)
        if (!(rewardedItem.rarity === ItemRarity.Unobtainable)) this.generateInventoryParts(user, rewardedItem.series, [rewardedItem.rarity])
        this.revealCollectable(interaction, rewardedItem, user.userSettings.lootReactionTimer)
    }

    private async openAndRegisterLootChest(interaction: ChatInteraction | BtnInteraction, pendingChest?: IPendingChest) {
        const isPack = interaction.isChatInputCommand() && interaction.options.getSubcommand() === 'pack'
        const user = await this.client.database.getUser(interaction.user.id)
        const quality = this.resolveLootQuality(interaction, pendingChest)
        const series = this.resolveLootSeries(user, interaction, pendingChest)
        const seriesObj = await this.getSeriesOrDefault(series, isPack)

        const box = await this.resolveLootbox(quality, isPack)
        if (interaction.isChatInputCommand() && !this.checkBalanceAndTakeMoney(user, box, interaction, true)) return
        const sh = new LootStatsHelper(user.loot[seriesObj.name].stats)
        sh.registerPurchase(box, true, interaction.isChatInputCommand())

        const chestItems: IUserLootItem[] = new Array<IUserLootItem>()
        for (let i = 0; i < 3; i++) {
            let item = this.calculateRewardItem(box, seriesObj, user)
            while (isPack && this.itemIsDuplicate(item, chestItems)) {
                item = this.calculateRewardItem(box, seriesObj, user)
            }
            chestItems.push(item)
        }

        if (seriesObj.hasColor) this.database.updateUser(user) //update in case of effect change
        const existingChestId = pendingChest && interaction.isButton() ? interaction.customId.split(';')[1] : undefined
        if (seriesObj.isCCG) this.revealCCGChest(interaction, chestItems, quality, seriesObj, user, existingChestId)
        else this.revealLootChest(interaction, chestItems, quality, seriesObj, existingChestId)
    }

    private itemIsDuplicate(newItem: IUserLootItem, items: IUserLootItem[]) {
        return items?.some((item) => item.name === newItem.name)
    }

    private resolveLootSeries(user: MazariniUser, interaction: ChatInteraction | BtnInteraction, pendingChest?: IPendingChest) {
        if (pendingChest) return pendingChest.series
        else if (interaction.isChatInputCommand()) return (interaction.options.get('series')?.value as string) ?? user.userSettings.activeLootSeries
        else if (interaction.isButton()) return interaction.customId.split(';')[4] ? interaction.customId.split(';')[4] : user.userSettings.activeLootSeries
    }

    private resolveLootQuality(interaction: ChatInteraction | BtnInteraction, pendingChest?: IPendingChest) {
        if (pendingChest) return pendingChest.quality
        else if (interaction.isChatInputCommand()) return (interaction.options.get('quality')?.value as string) ?? 'basic'
        else if (interaction.isButton()) return interaction.customId.split(';')[2] ?? 'basic'
    }

    private isArneChest(items: IUserLootItem[]) {
        return items.every((item) => item.rarity === ItemRarity.Common && item.color === ItemColor.None)
    }

    private async revealLootChest(
        interaction: ChatInteraction | BtnInteraction,
        items: IUserLootItem[],
        quality: string,
        series: ILootSeries,
        existingChestId?: string
    ) {
        const chestEmoji = await EmojiHelper.getEmoji('chest_closed', interaction)
        const chestType = this.isArneChest(items) ? 'Arne' : TextUtils.capitalizeFirstLetter(quality) + ' loot'
        const embed = EmbedUtils.createSimpleEmbed(`${chestType} chest`, `Hvilken lootbox vil du åpne og beholde?`).setThumbnail(
            `https://cdn.discordapp.com/emojis/${chestEmoji.urlId}.webp?size=96&quality=lossless`
        )
        const chestId = existingChestId ?? randomUUID()
        const chestItems: Map<string, IUserLootItem> = new Map<string, IUserLootItem>()
        const buttons = new ActionRowBuilder<ButtonBuilder>()
        for (const item of items) {
            const itemId = randomUUID()
            chestItems.set(itemId, item)
            const btn = lootChestButton(chestId, itemId)
            if (!series.hasColor) {
                const emoji = (await EmojiHelper.getApplicationEmoji(`${item.rarity}_button`, this.client)).emojiObject
                btn.setEmoji({ name: emoji.name, id: emoji.id })
                btn.setStyle(ButtonStyle.Secondary)
            } else if (item.color !== ItemColor.None) {
                const color = this.getItemColorBadge(item)
                const badge = EmojiHelper.getGuildEmoji(color, interaction)
                btn.setEmoji({ name: badge.name, id: badge.id })
            }
            if (series.hasColor) btn.setLabel(TextUtils.capitalizeFirstLetter(item.rarity))
            buttons.addComponents(btn)
        }
        let effect: IEffectItem = undefined
        if (Math.random() < this.getChestEffectOdds(quality)) {
            effect = RandomUtils.getRandomItemFromList(effects.filter((effect) => series.hasColor || !effect.label.includes('color')))
            let btn: ButtonBuilder = undefined
            if (effect.label === 'deal_or_no_deal') {
                btn = DealOrNoDeal.getDealOrNoDealButton(interaction.user.id)
            } else if (effect.label === 'redeal_chest') {
                btn = reDealChestButton(chestId)
            } else btn = lootChestButton(chestId, 'effect').setLabel(effect.label)
            buttons.addComponents(btn)
        }
        let pendingChest: IPendingChest = undefined
        if (existingChestId) {
            pendingChest = this.pendingChests.get(existingChestId)
            pendingChest.buttons = buttons
            pendingChest.items = chestItems
            pendingChest.effect = effect
            await pendingChest.message.edit({ embeds: [embed], components: [buttons] })
        } else {
            const msg = await this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true }, [buttons])
            pendingChest = {
                userId: interaction.user.id,
                quality: quality,
                series: series.name,
                items: chestItems,
                isCCG: false,
                effect: effect,
                message: msg,
                buttons: buttons,
            }
        }
        this.pendingChests.set(chestId, pendingChest)
    }

    private async revealCCGChest(
        interaction: ChatInteraction | BtnInteraction,
        items: IUserLootItem[],
        quality: string,
        series: ILootSeries,
        user: MazariniUser,
        existingChestId?: string
    ) {
        const cardbacks = await this.getCardbackImage(user)
        const attachment = new AttachmentBuilder(cardbacks, { name: 'cardbacks.png' })
        const embed = EmbedUtils.createSimpleEmbed('CCG card pack', ' ').setImage('attachment://cardbacks.png')
        const color = (interaction.member as GuildMember).displayColor
        embed.setColor(color)
        const chestId = existingChestId ?? randomUUID()
        const chestItems: Map<string, IUserLootItem> = new Map<string, IUserLootItem>()
        const cards = await this.getFullCards(items)
        const buttons = new ActionRowBuilder<ButtonBuilder>()
        for (const item of items) {
            const itemId = randomUUID()
            chestItems.set(itemId, item)
            const btn = lootChestButton(chestId, itemId)
            const card = cards.find((card) => card.id === item.name)
            const emoji = await EmojiHelper.getApplicationEmoji(`${card.series}_${card.id}`, this.client)
            btn.setLabel(' ').setEmoji({ name: emoji.emojiObject.name, id: emoji.emojiObject.id })
            buttons.addComponents(btn)
        }
        // buttons.components[2].setLabel('?')
        let pendingChest: IPendingChest = undefined
        if (existingChestId) {
            pendingChest = this.pendingChests.get(existingChestId)
            pendingChest.buttons = buttons
            pendingChest.items = chestItems
            await pendingChest.message.edit({ embeds: [embed] })
        } else {
            const msg = await this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true }, undefined, [attachment])
            pendingChest = {
                userId: interaction.user.id,
                quality: quality,
                series: series.name,
                items: chestItems,
                isCCG: true,
                message: msg,
                buttons: buttons,
            }
        }
        this.pendingChests.set(chestId, pendingChest)
        setTimeout(async () => {
            const cardImage = await this.getCCGChestImage(cards)
            const attachment = new AttachmentBuilder(cardImage, { name: 'cards.png' })
            const embed = EmbedUtils.createSimpleEmbed('CCG card pack', ' ').setImage('attachment://cards.png')
            embed.setColor(color)
            pendingChest.message.edit({ embeds: [embed], components: [pendingChest.buttons], files: [attachment] })
        }, 3000)
    }

    private async getCCGChestImage(cards: CCGCard[]) {
        const buffers = await Promise.all(
            cards.map(async (card) => {
                return Buffer.from(await this.getCCGCardImage(card))
            })
        )
        return await this.imageGenerator.stitchImages(buffers, 'horizontal')
    }

    private async getCCGCardImage(card: CCGCard) {
        const path = `loot/${card.series}/${card.id}_small.png`
        return await this.database.getFromStorage(path)
    }

    private async getCardbackImage(user: MazariniUser) {
        const cardback = Buffer.from(await this.getCCGCardback(user))
        return await this.imageGenerator.stitchImages([cardback, cardback, cardback], 'horizontal')
    }

    private async getCCGCardback(user: MazariniUser) {
        const cardback = user.ccg?.cardback ?? GameValues.ccg.defaultCardback
        const path = `loot/cardbacks/${cardback}_small.png`
        return await this.database.getFromStorage(path)
    }

    private async getFullCards(items: IUserLootItem[]) {
        const cards = (await this.database.getStorage()).ccg
        const userCards = new Array<CCGCard>()
        for (const item of items) {
            const series = cards[item.series] as CCGCard[]
            userCards.push(series.find((card) => card.id === item.name))
            // userCards.push(cards.find((card) => card.id === item.name))
        }
        return userCards
    }

    private getChestEffectOdds(quality: string) {
        if (['basic', 'premium', 'elite'].includes(quality.toLowerCase())) return GameValues.loot.chestEffectOdds[quality.toLowerCase()]
        else return 0
    }

    private getItemColorBadge(item: IUserLootItem) {
        let color = ''
        if (item.color === ItemColor.Silver) color = 'silver_badge'
        else if (item.color === ItemColor.Gold) color = 'gold_badge'
        else if (item.color === ItemColor.Diamond) color = 'diamond_badge'
        return color
    }

    private async selectChestItem(interaction: BtnInteraction) {
        const pendingChest = this.getPendingChest(interaction)
        const user = await this.client.database.getUser(interaction.user.id)
        if (!pendingChest) return this.messageHelper.replyToInteraction(interaction, 'Denne er dessverre ikke gyldig lenger')
        if (!(pendingChest.userId === interaction.user.id)) {
            return this.messageHelper.replyToInteraction(interaction, 'nei')
        }
        if (pendingChest.isCCG) return this.selectCCGChestItem(interaction, pendingChest, user)
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const chestEmoji = await EmojiHelper.getEmoji('chest_open', interaction)
        const chestType = this.isArneChest(Array.from(pendingChest.items.values())) ? 'Arne' : TextUtils.capitalizeFirstLetter(pendingChest.quality) + ' loot'
        const embed = EmbedUtils.createSimpleEmbed(`${chestType} chest`, `Åpner lootboxen!`).setThumbnail(
            `https://cdn.discordapp.com/emojis/${chestEmoji.urlId}.webp?size=96&quality=lossless`
        )
        const disabledBtns = pendingChest.buttons.components.map((btn) => {
            btn.setDisabled(true)
            const btnProps: any = btn.toJSON()
            if (btnProps.custom_id === interaction.customId) btn.setLabel((btnProps.label ?? '') + ' *')
            return btn
        })
        const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledBtns)
        interaction.message.edit({ embeds: [embed], components: [btnRow] })
        if (interaction.customId.split(';')[2] === 'effect') {
            const effect = pendingChest.effect
            const completedEffect = effect.effect(user, this.database)

            this.database.updateUser(user)
            this.messageHelper.replyToInteraction(interaction, `Du valgte ${effect.message}`, { hasBeenDefered: true })
        } else {
            const item = this.getChestItem(interaction, pendingChest)
            this.registerItemOnUser(user, item)
            if (!(item.rarity === ItemRarity.Unobtainable)) this.generateInventoryParts(user, item.series, [item.rarity])
            this.revealCollectable(interaction, item, user.userSettings.lootReactionTimer)
            this.deletePendingChest(interaction)
        }
    }

    private selectCCGChestItem(interaction: BtnInteraction, pendingChest: IPendingChest, user: MazariniUser) {
        interaction.deferUpdate()
        const item = this.getChestItem(interaction, pendingChest)
        this.registerItemOnUser(user, item)
        const disabledBtns = pendingChest.buttons.components.map((btn) => {
            btn.setDisabled(true)
            const btnProps: any = btn.toJSON()
            if (btnProps.custom_id === interaction.customId) btn.setStyle(ButtonStyle.Success)
            else btn.setStyle(ButtonStyle.Secondary)
            return btn
        })
        const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledBtns)
        interaction.message.edit({ components: [btnRow] })
        if (!(item.rarity === ItemRarity.Unobtainable)) this.generateInventoryParts(user, item.series, [item.rarity], true)
        this.deletePendingChest(interaction)
    }

    private getPendingChest(interaction: BtnInteraction) {
        const chestId = interaction.customId.split(';')[1]
        return this.pendingChests.get(chestId)
    }

    private deletePendingChest(interaction: BtnInteraction) {
        const chestId = interaction.customId.split(';')[1]
        this.pendingChests.delete(chestId)
    }

    private getChestItem(interaction: BtnInteraction, chest: IPendingChest) {
        const chestId = interaction.customId.split(';')[2]
        return chest.items.get(chestId)
    }

    private async resolveLootbox(quality: string, isPack: boolean = false): Promise<ILootbox> {
        const boxes = isPack ? await this.getLootpacks() : await this.getLootboxes()
        return boxes.find((box) => box.name === quality)
    }

    private async getLootboxes(): Promise<ILootbox[]> {
        const lootboxes = await this.client.database.getLootboxes()
        return lootboxes.filter((box) => LootboxCommands.lootboxIsValid(box))
    }

    private async getLootpacks(): Promise<ILootbox[]> {
        const lootboxes = await this.client.database.getLootpacks()
        return lootboxes.filter((box) => LootboxCommands.lootboxIsValid(box))
    }

    static lootboxIsValid(box: ILootbox): boolean {
        const from = box.validFrom ? new Date(box.validFrom) : new Date()
        const now = new Date()
        const to = box.validTo ? new Date(box.validTo) : new Date()
        return now >= from && now <= to
    }

    private checkBalanceAndTakeMoney(user: MazariniUser, box: ILootbox, interaction: ChatInteraction, isChest: boolean = false) {
        const moneyWasTaken = box.isCCG ? this.client.bank.takeShards(user, box.price) : this.client.bank.takeMoney(user, isChest ? box.price * 2 : box.price)
        if (!moneyWasTaken) this.messageHelper.replyToInteraction(interaction, 'Du har kje råd te den', { ephemeral: true, hasBeenDefered: true })
        return moneyWasTaken
    }

    private calculateRewardItem(box: ILootbox, series: ILootSeries, user: MazariniUser) {
        const itemRoll = Math.random()
        let colored = Math.random() < box.probabilities.color
        if (series.hasColor && (user.effects?.positive?.guaranteedLootColor ?? 0) > 0) {
            colored = true
            user.effects.positive.guaranteedLootColor -= 1
        }
        if (series.hasUnobtainable && itemRoll < (box.probabilities.unobtainable ?? 0) && (series.unobtainableHolder ?? '') !== user.id) {
            return this.getRandomItemForRarity(ItemRarity.Unobtainable, series, colored, user)
        } else if (itemRoll < box.probabilities.legendary) {
            return this.getRandomItemForRarity(ItemRarity.Legendary, series, colored, user)
        } else if (itemRoll < box.probabilities.epic) {
            return this.getRandomItemForRarity(ItemRarity.Epic, series, colored, user)
        } else if (itemRoll < box.probabilities.rare) {
            return this.getRandomItemForRarity(ItemRarity.Rare, series, colored, user)
        } else {
            return this.getRandomItemForRarity(ItemRarity.Common, series, colored, user)
        }
    }

    private getRandomItemForRarity(rarity: ItemRarity, series: ILootSeries, colored: boolean, user: MazariniUser): IUserLootItem {
        const rarityItems = this.getRarityItems(series, rarity)
        const item = RandomUtils.getRandomItemFromList(rarityItems)
        const color = this.getRandomColor(colored && series.hasColor, user)
        return { name: item, series: series.name, rarity: rarity, color: color, amount: 1, isCCG: series.isCCG ?? false }
    }

    private getRandomInventoryArt(user: MazariniUser, series: ILootSeries) {
        let art: ILootSeriesInventoryArt = RandomUtils.getRandomItemFromList(series.inventoryArts)
        while (art.name === user.loot[series.name].inventoryArt.name) {
            art = RandomUtils.getRandomItemFromList(series.inventoryArts)
        }
        return art
    }

    private async getSeriesOrDefault(series: string, isPack: boolean = false): Promise<ILootSeries> {
        const lootboxSeries = (await this.getSeries()).filter((serie) => (isPack && serie.isCCG) || (!isPack && (!serie.isCCG || GameValues.ccg.isLootable)))
        const seriesName = series && series !== '' ? series : lootboxSeries.sort((a, b) => new Date(b.added).getTime() - new Date(a.added).getTime())[0].name
        return lootboxSeries.find((x) => x.name === seriesName) ?? lootboxSeries[0]
    }

    private async getSeriesOrDefaultForInventory(series: string): Promise<ILootSeries> {
        const lootboxSeries = await this.getSeries()
        const seriesName = series && series !== '' ? series : lootboxSeries.sort((a, b) => new Date(b.added).getTime() - new Date(a.added).getTime())[0].name
        return lootboxSeries.find((x) => x.name === seriesName) ?? lootboxSeries[0]
    }

    private async getSeries(): Promise<ILootSeries[]> {
        if (!this.series) this.series = await this.client.database.getLootboxSeries()
        return this.series
    }

    private getRarityItems(series: ILootSeries, rarity: ItemRarity): string[] {
        if (rarity === ItemRarity.Common) return series.common
        else if (rarity === ItemRarity.Rare) return series.rare
        else if (rarity === ItemRarity.Epic) return series.epic
        else if (rarity === ItemRarity.Legendary) return series.legendary
        else if (rarity === ItemRarity.Unobtainable) return ['unobtainable']
        else return undefined
    }

    private getRandomColor(colored: boolean, user: MazariniUser): ItemColor {
        const flipped = user.effects?.positive?.lootColorsFlipped
        const roll = Math.random()
        if (!colored) return ItemColor.None
        else if (roll < 1 / 6) return flipped ? ItemColor.Silver : ItemColor.Diamond // 1/6 chance for diamond
        else if (roll < 1 / 2) return ItemColor.Gold // 2/6 chance for gold
        else return flipped ? ItemColor.Diamond : ItemColor.Silver // 3/6 chance for silver
    }

    private registerItemOnUser(user: MazariniUser, newItem: IUserLootItem) {
        if (newItem.rarity === ItemRarity.Unobtainable) return this.updateUnobtainableHolder(newItem.series, user)
        let items = (user.loot[newItem.series][`inventory`][newItem.rarity]['items'] as IUserLootItem[]) ?? new Array<IUserLootItem>()
        const itemAlreadyCollected = items.some((item) => this.equalItems(item, newItem))
        if (itemAlreadyCollected) {
            items = this.incrementItemCount(items, newItem)
        } else {
            items.push(newItem)
        }
        user.loot[newItem.series][`inventory`][newItem.rarity]['img'] = ''
        user.loot[newItem.series][`inventory`][newItem.rarity]['items'] = items
        const sh = new LootStatsHelper(user.loot[newItem.series].stats)
        sh.registerItem(newItem)
        this.client.database.updateUser(user)
    }

    private async updateUnobtainableHolder(seriesName: string, user: MazariniUser) {
        const allSeries = await this.getSeries()
        const updateSeries = allSeries.find((x) => x.name === seriesName)
        updateSeries.unobtainableHolder = user.id
        this.series = allSeries.map((s) => (s.name === seriesName ? updateSeries : s))
        this.database.updateLootboxSeries(updateSeries)
    }

    equalItems = (item1: IUserLootItem, item2: IUserLootItem) => item1.name === item2.name && item1.color === item2.color

    private incrementItemCount(items: IUserLootItem[], newItem: IUserLootItem) {
        return items.map((item) => (this.equalItems(item, newItem) ? { ...item, amount: item.amount + newItem.amount } : item))
    }

    private removeItemsFromUser(itemsToRemove: IUserLootItem[], user: MazariniUser) {
        let items = user.loot[itemsToRemove[0].series][`inventory`][itemsToRemove[0].rarity]['items'] as IUserLootItem[]
        itemsToRemove.forEach((item) => {
            items = items.map((el) => (this.equalItems(el, item) ? { ...el, amount: el.amount - item.amount } : el))
        })
        user.loot[itemsToRemove[0].series][`inventory`][itemsToRemove[0].rarity]['img'] = ''
        items.filter((item) => item.amount > 0)
        user.loot[itemsToRemove[0].series][`inventory`][itemsToRemove[0].rarity]['items'] = items
    }

    private collectableToString(item: IUserLootItem) {
        return `${item.series};${item.rarity};${item.name};${item.color}`
    }

    private async revealCollectable(interaction: ChatInteraction | BtnInteraction, item: IUserLootItem, timer?: number) {
        if (item.isCCG) return this.revealCCGLoot(interaction, item)
        const path = this.getGifPath(item)
        const url = await this.client.database.getLootGifLink(path)
        const container = new SimpleContainer()
        const mg = new MediaGalleryBuilder()
        const mgItemBuilder = new MediaGalleryItemBuilder()
        mgItemBuilder.setURL(url)
        mg.addItems(mgItemBuilder)
        container.addComponent(mg, 'loot-gif')
        const color = (interaction.member as GuildMember).displayColor
        container.setColor(color)
        const reply = await this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, [container.container])
        this.addReaction(reply, item, timer)
    }

    private async revealCCGLoot(interaction: ChatInteraction | BtnInteraction, item: IUserLootItem) {
        //TODO
    }

    private async addReaction(reply: Message | InteractionResponse, item: IUserLootItem, timer?: number) {
        const emoji = await this.getLootApplicationEmoji(item)
        let msg = undefined
        if (reply instanceof InteractionResponse) {
            msg = await reply.fetch()
        } else {
            msg = reply
        }
        setTimeout(
            () => {
                msg.react(emoji.emojiObject.identifier)
            },
            timer ? timer * 1000 : 30000
        )
    }

    private async getLootApplicationEmoji(item: IUserLootItem) {
        let emojiName = `${item.series}_${item.name}_${item.color.charAt(0)}`.toLowerCase()
        if (item.rarity === ItemRarity.Unobtainable) emojiName = `${item.series}_unobtainable`
        return await EmojiHelper.getApplicationEmoji(emojiName, this.client)
    }

    private getGifPath(item: IUserLootItem): string {
        if (item.rarity === ItemRarity.Unobtainable) return `loot/${item.series}/unobtainable.webp`
        let fileFormat = '.webp'
        if (['mazarini', 'sw'].includes(item.series)) fileFormat = '.gif'
        return `loot/${item.series}/${item.name}_${item.color}${fileFormat}`
    }

    private async qualityAutocomplete(interaction: ATCInteraction) {
        const cmd = interaction.options.getSubcommand()
        const boxes = cmd === 'pack' ? await this.getLootpacks() : await this.getLootboxes()
        const price = (box: ILootbox) => (cmd === 'pack' ? `${box.price} shards` : `${(cmd === 'chest' ? 2 : 1) * (box.price / 1000)}K`)
        interaction.respond(
            boxes.filter((box) => !box.rewardOnly).map((box) => ({ name: `${TextUtils.capitalizeFirstLetter(box.name)} ${price(box)}`, value: box.name }))
        )
    }

    private async seriesAutocomplete(interaction: ATCInteraction) {
        const cmd = interaction.options.getSubcommand()
        const series = await this.getSeries()
        let filteredSeries = series
        if (cmd === 'art') filteredSeries = filteredSeries.filter((serie) => serie.inventoryArts && serie.inventoryArts.length > 0)
        else if (cmd === 'pack') filteredSeries = filteredSeries.filter((serie) => serie.isCCG)
        else filteredSeries = filteredSeries.filter((series) => !series.isCCG || GameValues.ccg.isLootable)
        const optionList: any = interaction.options
        const input = optionList.getFocused().toLowerCase()
        interaction.respond(
            filteredSeries.filter((series) => series.name.toLowerCase().includes(input)).map((series) => ({ name: series.name, value: series.name }))
        )
    }

    private async printInventory(interaction: ChatInteraction | BtnInteraction) {
        if (interaction.isButton()) {
            interaction.deferUpdate()
            if (interaction.customId.split(';')[1] !== interaction.user.id) return
        }
        let user = await this.client.database.getUser(interaction.user.id)
        const seriesParam = this.resolveLootSeries(user, interaction)
        const series = await this.getSeriesOrDefaultForInventory(seriesParam)
        let attempts = 0
        const intervalId = setInterval(async () => {
            attempts++
            if (attempts > 20) {
                this.messageHelper.replyToInteraction(interaction, 'Klarte ikke å hente inventory', { hasBeenDefered: true })
                clearInterval(intervalId)
            }
            if (!this.userHasInventoryInQueue(user.id, series.name)) {
                clearInterval(intervalId)
                user = await this.client.database.getUser(interaction.user.id)
                if (!(await this.verifyUserHasInventoryImages(user, series.name))) {
                    return this.printInventory(interaction)
                }
                if (!(await this.userHasValidInventoryLinks(user, series.name))) {
                    user = await this.client.database.getUser(interaction.user.id)
                }
                const unobtainableSeries = (series.unobtainableHolder ?? '') === user.id ? series.name : ''
                const img = await this.imageGenerator.stitchInventory(user.loot[series.name].inventory, unobtainableSeries)
                const file = new AttachmentBuilder(img, { name: 'inventory.png' })
                const refreshBtn = refreshInventoryBtn(user.id, series.name)
                if (interaction.isButton()) {
                    interaction.message.edit({ files: [file], components: [refreshBtn] })
                }
                this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, [refreshBtn], [file])
            }
        }, 1500)
    }

    private userHasInventoryInQueue(userid: string, series: string) {
        return this.inventoryUpdateQueue.some((update) => update.userId === userid && update.series === series)
    }

    private async verifyUserHasInventoryImages(user: MazariniUser, series: string) {
        let inventoryComplete = true
        const rarities = [ItemRarity.Common, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]
        for (const rarity of rarities) {
            const url = user.loot[series].inventory[rarity].img
            if (!url || url.length === 0) {
                inventoryComplete = false
                await this.generateInventoryParts(user, series, [rarity])
            }
        }
        return inventoryComplete
    }

    private async userHasValidInventoryLinks(user: MazariniUser, series: string) {
        let allLinksValid = true
        const rarities = [ItemRarity.Common, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]
        for (const rarity of rarities) {
            const url = user.loot[series].inventory[rarity].img
            let hasValidImage = true
            const res = await fetch(url)
            if (!res.ok) hasValidImage = false
            if (!hasValidImage) {
                allLinksValid = true
                const imgUrl = await this.database.getUserInventory(user, series, rarity)
                user.loot[series]['inventory'][rarity]['img'] = imgUrl
            }
        }
        if (!allLinksValid) await this.database.updateUser(user)
        return allLinksValid
    }

    /* LEAVE THIS FOR NOW - can revisit if containers can set image size
    
    private async printInventoryV2(interaction: ChatInteraction) {
        const user = await this.client.database.getUser(interaction.user.id)
        const seriesParam = this.resolveLootSeries(user, interaction)
        const series = await this.getSeriesOrDefault(seriesParam)
        const inventory = user.loot[series.name]['inventory']
        const container = inventoryContainer()
        const notUpdated = this.updateInventoryContainer(container, ['common', 'rare', 'epic', 'legendary'], inventory)

        // MediaGallery approach
        const msg = await this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, [container.container])

        // File approach
        // const attachments = await this.getInventoryAttachements(['common', 'rare', 'epic', 'legendary'], inventory)
        // const msg = await this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, [container.container], attachments)

        if (notUpdated && notUpdated.length > 0) this.updateInventoryAfterSent(container, series.name, notUpdated, msg, user.id)
    }

    Needed for file approach
    private async getInventoryAttachements(rarities: string[], inventory: IUserLootSeriesInventory): Promise<AttachmentBuilder[]> {
        const attachments = new Array<AttachmentBuilder>()
        for (const rarity of rarities) {
            const { body } = await request(inventory[rarity]['img'])
            const buffer = Buffer.from(await body.arrayBuffer())

            // wrap in attachment
            const attachment = new AttachmentBuilder(buffer, { name: `${rarity}.png` })
            attachments.push(attachment)
        }
        return attachments
    }

    private updateInventoryContainer(container: SimpleContainer, rarities: string[], inventory: IUserLootSeriesInventory): string[] {
        const notUpdated = []
        for (const rarity of rarities) {
            if (inventory[rarity]['img']) {
                // MediaGallery approach
                const inventoryPart = ComponentsHelper.createMediaGalleryComponent().addItems([
                    ComponentsHelper.createMediaItemComponent().setURL(inventory[rarity]['img']),
                ])

                // File approach
                // const inventoryPart = new FileBuilder({
                //     file: { url: `attachment://${rarity}.png` },
                // })

                container.replaceComponent(rarity, inventoryPart)
            } else {
                notUpdated.push(rarity)
            }
        }
        return notUpdated
    }

    private updateInventoryAfterSent(container: SimpleContainer, series: string, rarities: string[], msg: Message | InteractionResponse, userId: string) {
        let toUpdate = rarities
        let attempts = 0
        const intervalId = setInterval(async () => {
            attempts++
            const user = await this.client.database.getUser(userId)
            const inventory = user.loot[series]['inventory']
            toUpdate = this.updateInventoryContainer(container, toUpdate, inventory)
            if (!toUpdate || toUpdate.length === 0) {
                msg.edit({ components: [container.container] })
                clearInterval(intervalId)
            }
            if (attempts > 5) clearInterval(intervalId)
        }, 5000)
    }
    */

    private async generateInventoryParts(user: MazariniUser, series: string, rarities: Array<ItemRarity>, isCCG: boolean = false) {
        const updates: InventoryUpdate[] = rarities.map((rarity) => ({ userId: user.id, series: series, rarity: rarity }))
        this.inventoryUpdateQueue.push(...updates)
        const seriesObj = await this.getSeriesOrDefault(series, isCCG)
        for (const rarity of rarities) {
            const img = await this.imageGenerator.generateImageForCollectablesRarity(user, seriesObj, rarity)
            await this.database.uploadUserInventory(user, `${series}/${rarity}.png`, img)
        }
        await this.updateUserInventoryLinks(user.id, series, rarities)
    }

    private async updateUserInventoryLinks(userId: string, series: string, rarities: Array<ItemRarity>) {
        const user = await this.client.database.getUser(userId)
        for (const rarity of rarities) {
            const imgUrl = await this.database.getUserInventory(user, series, rarity)
            user.loot[series]['inventory'][rarity]['img'] = imgUrl
        }
        await this.database.updateUser(user)
        const updates: InventoryUpdate[] = rarities.map((rarity) => ({ userId: user.id, series: series, rarity: rarity }))
        this.removeInventoryUpdatesFromQueue(updates)
    }

    private removeInventoryUpdatesFromQueue(updates: InventoryUpdate[]) {
        for (const update of updates) {
            const index = this.inventoryUpdateQueue.findIndex((obj) => Object.entries(update).every(([key, value]) => (obj as any)[key] === value))
            if (index !== -1) this.inventoryUpdateQueue.splice(index, 1)
        }
    }

    private getColorOrder(color: ItemColor) {
        if (color === ItemColor.None) return 1
        else if (color === ItemColor.Silver) return 2
        else if (color === ItemColor.Gold) return 3
        else if (color === ItemColor.Diamond) return 4
    }

    private getRarityOrder(rarity: ItemRarity) {
        if (rarity === ItemRarity.Common) return 1
        else if (rarity === ItemRarity.Rare) return 2
        else if (rarity === ItemRarity.Epic) return 3
        else if (rarity === ItemRarity.Legendary) return 4
    }

    private async itemAutocomplete(interaction: ATCInteraction) {
        const user = await this.client.database.getUser(interaction.user.id)
        const optionList: any = interaction.options
        const focused = optionList._hoistedOptions.find((option) => option.focused)
        const isTradeUp = interaction.options.getSubcommand() === 'up'
        if (focused.name === 'item1') this.firstItemAutocomplete(interaction, user, isTradeUp)
        else this.secondaryItemsAutocomplete(interaction, user, isTradeUp)
    }

    private firstItemAutocomplete(interaction: ATCInteraction, user: MazariniUser, filterOutLegendaries: boolean) {
        const optionList: any = interaction.options
        const collectables = this.getSortedCollectables(user, filterOutLegendaries)
        interaction.respond(
            collectables
                .filter((item) => this.collectableToString(item).includes(optionList.getFocused().toLowerCase()))
                .slice(0, 25)
                .map((item) => ({ name: `${item.name} (${item.color}) x${item.amount}`, value: this.collectableToString(item) }))
        )
    }

    private secondaryItemsAutocomplete(interaction: ATCInteraction, user: MazariniUser, filterOutLegendaries: boolean) {
        const optionList: any = interaction.options
        const allItems = optionList._hoistedOptions
        const filter = this.getSortFilter(allItems.find((item) => item.name === 'item1')?.value)
        const collectables = this.getSortedCollectables(user, filterOutLegendaries, filter)
        const filteredCollectables = this.removeSelectedItems(collectables, allItems)
        interaction.respond(
            filteredCollectables
                .filter((item) => this.collectableToString(item).includes(optionList.getFocused().toLowerCase()))
                .slice(0, 25)
                .map((item) => ({ name: `${item.name} (${item.color}) x${item.amount}`, value: this.collectableToString(item) }))
        )
    }

    private getSortedCollectables(user: MazariniUser, filterOutLegendaries: boolean, filter?: { series: string; rarity: string }) {
        const onlyShowDups = user.userSettings?.onlyShowDupesOnTrade ?? false
        const activeSeries = user.userSettings?.activeLootSeries ?? ''
        const allItems = this.getUserLoot(user, filter)
        const filtered = allItems
            .map((item) => (onlyShowDups ? { ...item, amount: item.amount - 1 } : item))
            .filter((item) => item.amount >= 1)
            .sort((a, b) => this.collectableSortString(a, activeSeries).localeCompare(this.collectableSortString(b, activeSeries)))
        if (filterOutLegendaries) return filtered.filter((item) => item.rarity !== ItemRarity.Legendary)
        else return filtered
    }

    private getUserLoot(user: MazariniUser, filter?: { series: string; rarity: string }) {
        const loot = new Array<IUserLootItem>()
        const series = filter ? [filter.series] : ['mazarini', 'sw', 'hp', 'lotr'] // Don't add CCG series here
        const rarities = filter ? [filter.rarity] : ['common', 'rare', 'epic', 'legendary']
        for (const serie of series) {
            for (const rarity of rarities) {
                const items = user.loot[serie].inventory[rarity].items
                if (items) loot.push(...items)
            }
        }
        return loot
    }

    private collectableSortString(item: IUserLootItem, activeSeries?: string) {
        let num = item.series === this.newestSeries.name ? 1 : 2
        if (activeSeries && activeSeries === item.series) num = 0
        return `${num}_${item.series}_${this.getRarityOrder(item.rarity)}_${item.name}_${this.getColorOrder(item.color)}`
    }

    private getSortFilter(input: string): { series: string; rarity: string } {
        if (!input) return undefined
        const split = input.split(';')
        if (split.length === 4) return { series: split[0], rarity: split[1] }
        else return undefined
    }

    private removeSelectedItems(collectables: IUserLootItem[], inputs: any[]) {
        let filtered = collectables.slice()
        inputs
            .filter((input) => !input.focused)
            .forEach((input) => {
                const split = input.value.split(';')
                if (split.length === 4) {
                    filtered = filtered.map((el) => (el.name === split[2] && el.color === split[3] ? { ...el, amount: el.amount - 1 } : el))
                }
            })
        return filtered.filter((item) => item.amount > 0)
    }

    private verifyInputIsValid(inputs: any[], user: MazariniUser) {
        return this.formatIsCorrect(inputs) && this.isSameSeriesAndRarity(inputs) && this.allItemsAreOwned(this.inputsToIUserLootItems(inputs), user)
    }

    private formatIsCorrect(inputs: any[]) {
        return inputs.every((input) => input.value.split(';').length === 4)
    }

    private isSameSeriesAndRarity(inputs: any[]) {
        const filter = this.getSortFilter(inputs.find((item) => item.name === 'item1').value)
        if (!filter) return false
        return inputs.every((input) => {
            const split = input.value.split(';')
            return filter.series === split[0] && filter.rarity === split[1]
        })
    }

    private inputsToIUserLootItems(inputs: any[]): IUserLootItem[] {
        const collectables: IUserLootItem[] = new Array<IUserLootItem>()
        inputs.forEach((input) => {
            const split = input.value.split(';')
            collectables.push({
                series: split[0],
                rarity: split[1],
                name: split[2],
                color: split[3],
                amount: 1,
            })
        })
        return collectables
    }

    private allItemsAreOwned(inputs: IUserLootItem[], user: MazariniUser) {
        let collectables = user.loot[inputs[0].series].inventory[inputs[0].rarity].items
        let foundAll = true
        inputs.forEach((input) => {
            let found = false
            collectables = collectables.map((item) => {
                if (this.collectableToString(item) === this.collectableToString(input)) {
                    found = true
                    return { ...item, amount: item.amount - 1 }
                } else {
                    return item
                }
            })
            if (!found) foundAll = false
            collectables = collectables.filter((item) => item.amount > 0)
        })
        return foundAll
    }

    private async tradeItems(interaction: ChatInteraction) {
        const user = await this.client.database.getUser(interaction.user.id)
        const optionList: any = interaction.options
        const allItems = optionList._hoistedOptions
        if (!this.verifyInputIsValid(allItems, user)) {
            return this.messageHelper.replyToInteraction(
                interaction,
                'Du har ugyldig input. Sørg for å velge fra de foreslåtte parameterne når du velger trade gjenstander.',
                { hasBeenDefered: true }
            )
        }
        const inputAsCollectables = this.inputsToIUserLootItems(allItems)
        const tradingToRarity = this.getResultingTradeRarity(inputAsCollectables[0].rarity, allItems.length)
        const pendingTrade: IPendingTrade = {
            userId: interaction.user.id,
            receiving: tradingToRarity,
            tradingIn: inputAsCollectables,
            series: inputAsCollectables[0].series,
        }
        const tradeID = randomUUID()
        this.pendingTrades.set(tradeID, pendingTrade)
        const collectableNames = this.getCollectableNamesPrintString(inputAsCollectables)
        const embed = EmbedUtils.createSimpleEmbed('Trade', `Er du sikker på at du vil bytte: \n${collectableNames}\nfor en ny ${tradingToRarity} gjenstand?`)
        const buttons = tradeButtons(tradeID)
        this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true }, [buttons])
    }

    private getCollectableNamesPrintString(collectables: IUserLootItem[]): string {
        const mergedCollectables = collectables.reduce((acc, current) => {
            const existing = acc.find((item) => this.collectableToString(item) === this.collectableToString(current))
            if (existing) existing.amount += current.amount
            else acc.push({ ...current })
            return acc
        }, new Array<IUserLootItem>())
        return mergedCollectables.reduce((acc, current) => {
            return acc + `${current.amount}x ${current.name} (${current.color})\n`
        }, '\n')
    }

    private getResultingTradeRarity(rarity: ItemRarity, paramLength: number): ItemRarity {
        if (paramLength === 3) return rarity
        else if (rarity === ItemRarity.Common) return ItemRarity.Rare
        else if (rarity === ItemRarity.Rare) return ItemRarity.Epic
        else if (rarity === ItemRarity.Epic) return ItemRarity.Legendary
    }

    private async confirmTrade(interaction: BtnInteraction) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const user = await this.client.database.getUser(interaction.user.id)
        const pendingTrade = this.getPendingTrade(interaction)
        if (!(pendingTrade.userId === interaction.user.id)) {
            const really = await EmojiHelper.getEmoji('geggireally', interaction)
            return this.messageHelper.replyToInteraction(interaction, `${really.id}`, { hasBeenDefered: true })
        }
        if (!this.allItemsAreOwned(pendingTrade.tradingIn, user)) {
            await this.messageHelper.replyToInteraction(interaction, 'Du har ikke alle gjenstandene du prøver å bytte inn.', { hasBeenDefered: true })
            return this.cancelTrade(interaction)
        }
        const collectableNames = this.getCollectableNamesPrintString(pendingTrade.tradingIn)
        const embed = EmbedUtils.createSimpleEmbed('Trade', `Bytter inn: \n${collectableNames}\nfor en ${pendingTrade.receiving} gjenstand`)
        interaction.message.edit({ embeds: [embed], components: [] })
        const colorChance = this.getTradeColorChance(pendingTrade.tradingIn)

        const colored = Math.random() < colorChance
        const seriesObj = await this.getSeriesOrDefault(pendingTrade.series)
        let rewardedItem = this.getRandomItemForRarity(pendingTrade.receiving, seriesObj, colored, user)
        while (this.itemIsSameAsTradedIn(rewardedItem, pendingTrade.tradingIn)) {
            rewardedItem = this.getRandomItemForRarity(pendingTrade.receiving, seriesObj, colored, user)
        }
        const sh = new LootStatsHelper(user.loot[rewardedItem.series].stats)
        sh.registerTrade(pendingTrade.tradingIn.length === 5)
        this.removeItemsFromUser(pendingTrade.tradingIn, user)
        this.registerItemOnUser(user, rewardedItem)
        this.generateInventoryParts(user, pendingTrade.series, [...new Set([pendingTrade.receiving, pendingTrade.tradingIn[0].rarity])])
        this.revealCollectable(interaction, rewardedItem)
        this.deletePendingTrade(interaction)
    }

    private itemIsSameAsTradedIn(newItem: IUserLootItem, tradingIn: IUserLootItem[]) {
        return tradingIn.some((item) => item.name === newItem.name && item.color === newItem.color)
    }

    private getTradeColorChance(items: IUserLootItem[]) {
        const initalChance = items.length > 3 ? 1 / 5 : 1 / 3 // 20% for trade up, 25% for trade in
        const silvers = items.filter((item) => item.color === ItemColor.Silver).length
        const golds = items.filter((item) => item.color === ItemColor.Gold).length
        const diamonds = items.filter((item) => item.color === ItemColor.Diamond).length
        return initalChance + (silvers * 1) / 10 + (golds * 1) / 5 + (diamonds * 1) / 3.33
    }

    private cancelTrade(interaction: BtnInteraction) {
        const pendingTrade = this.getPendingTrade(interaction)
        if (!(pendingTrade.userId === interaction.user.id)) return interaction.deferUpdate()
        interaction.message.delete()
        this.deletePendingTrade(interaction)
    }

    private getPendingTrade(interaction: BtnInteraction) {
        const tradeID = interaction.customId.split(';')[1]
        return this.pendingTrades.get(tradeID)
    }

    private deletePendingTrade(interaction: BtnInteraction) {
        const tradeID = interaction.customId.split(';')[1]
        return this.pendingTrades.delete(tradeID)
    }

    private async handleChestReDeal(interaction: BtnInteraction) {
        const deferred = await this.messageHelper.deferUpdate(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const pendingChest = this.getPendingChest(interaction)
        if (pendingChest.userId === interaction.user.id) {
            this.openAndRegisterLootChest(interaction, pendingChest)
        }
    }

    private async executeLootSubCommand(interaction: ChatInteraction) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const cmdGroup = interaction.options.getSubcommandGroup()
        const cmd = interaction.options.getSubcommand()
        if (!cmdGroup && cmd === 'box') this.openAndRegisterLootbox(interaction)
        else if (!cmdGroup && cmd === 'chest') this.openAndRegisterLootChest(interaction)
        else if (!cmdGroup && cmd === 'pack') this.openAndRegisterLootChest(interaction)
        else if (!cmdGroup && cmd === 'inventory') this.printInventory(interaction)
        else if (!cmdGroup && cmd === 'art') this.purchaseLootArt(interaction)
        else if (cmdGroup && cmdGroup === 'trade') this.tradeItems(interaction)
    }

    private delegateAutocomplete(interaction: ATCInteraction) {
        const optionList: any = interaction.options
        const focused = optionList._hoistedOptions.find((option) => option.focused)
        if (focused.name === 'series') this.seriesAutocomplete(interaction)
        else if (focused.name.includes('quality')) this.qualityAutocomplete(interaction)
        else if (focused.name.includes('item')) this.itemAutocomplete(interaction)
    }

    // eslint-disable-next-line require-await
    async onTimedEvent(): Promise<IOnTimedEvent> {
        return { daily: [() => this.resetPendingChests(), () => this.incrementUnobtainable()], weekly: [], hourly: [] }
    }

    private resetPendingChests() {
        this.pendingChests.forEach((chest) => {
            const msg = chest.message
            if (msg) msg.delete()
        })
        this.pendingChests.clear()
        return true
    }

    private async incrementUnobtainable() {
        const allSeries = (await this.getSeries()).filter((series) => series.hasUnobtainable)
        for (const series of allSeries) {
            const holder = series.unobtainableHolder
            if (holder && holder.length > 0) {
                const user = await this.database.getUser(holder)
                if (user) {
                    user.loot[series.name].stats.achievements.daysWithUnobtainable++
                    this.database.updateUser(user)
                }
            }
        }
        return true
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'loot',
                        command: (rawInteraction: ChatInteraction) => {
                            this.executeLootSubCommand(rawInteraction)
                        },
                        autoCompleteCallback: (interaction: ATCInteraction) => {
                            this.delegateAutocomplete(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'OPEN_LOOT',
                        command: (rawInteraction: BtnInteraction) => {
                            this.openLootFromButton(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_TRADE_CONFIRM',
                        command: (rawInteraction: BtnInteraction) => {
                            this.confirmTrade(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_TRADE_CANCEL',
                        command: (rawInteraction: BtnInteraction) => {
                            this.cancelTrade(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_CHEST_SELECT',
                        command: (rawInteraction: BtnInteraction) => {
                            this.selectChestItem(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_CHEST_REDEAL',
                        command: (rawInteraction: BtnInteraction) => {
                            this.handleChestReDeal(rawInteraction)
                        },
                    },
                    {
                        commandName: 'REFRESH_INVENTORY',
                        command: (rawInteraction: BtnInteraction) => {
                            this.printInventory(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

const tradeButtons = (tradeID: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `LOOT_TRADE_CONFIRM;${tradeID}`,
            style: ButtonStyle.Primary,
            label: `Bekreft`,
            disabled: false,
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `LOOT_TRADE_CANCEL;${tradeID}`,
            style: ButtonStyle.Secondary,
            label: `Avbryt`,
            disabled: false,
            type: 2,
        })
    )
}

const lootChestButton = (chestId: string, itemId: string) => {
    return new ButtonBuilder({
        custom_id: `LOOT_CHEST_SELECT;${chestId};${itemId}`,
        style: ButtonStyle.Primary,
        disabled: false,
        type: 2,
    })
}

const reDealChestButton = (chestId: string) => {
    return new ButtonBuilder({
        custom_id: `LOOT_CHEST_REDEAL;${chestId}`,
        style: ButtonStyle.Primary,
        label: `Re-roll items`,
        disabled: false,
        type: 2,
    })
}

const refreshInventoryBtn = (userId: string, series: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `REFRESH_INVENTORY;${userId};;;${series}`,
            style: ButtonStyle.Secondary,
            label: `Refresh`,
            disabled: false,
            type: 2,
        })
    )
}

const effects: Array<IEffectItem> = [
    {
        label: 'redeal_chest',
        message: '',
        effect: () => {},
    },
    {
        label: '10 spins',
        message: '10 ekstra /spin rewards!',
        effect: (user: MazariniUser) => {
            user.dailySpins = 1
            return undefined
        },
    },
    {
        label: '3x doubled potwins',
        message: 'at dine tre neste hasjwins dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 3
            return undefined
        },
    },
    {
        label: '10 free rolls',
        message: '10 gratis /roll!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 10
            return undefined
        },
    },
    {
        label: 'Flipped color odds',
        message: 'at loot-farge-sannsynlighetene snus på hodet! Du har nå større sannsynlighet for å få diamond enn silver ut dagen!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.lootColorsFlipped = true
            return undefined
        },
    },
    {
        label: '5x lootbox odds in deathroll',
        message: 'at du har 5x større sannsynlighet for å heller få en lootbox som reward ved hasjinnskudd - ut dagen!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.deahtrollLootboxChanceMultiplier = 5
            return undefined
        },
    },
    {
        label: '5x doubled pot additions',
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 5
            return undefined
        },
    },
    {
        label: '3x guaranteed colors',
        message: 'at dine neste 3 loot-items har garantert farge (gjelder ikke trade)',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.guaranteedLootColor = (user.effects.positive.guaranteedLootColor ?? 0) + 3
            return undefined
        },
    },
    // {
    //     label: '5x guaranteed colors',
    //     message: 'at dine neste 5 loot-items har garantert farge (gjelder ikke trade)',
    //     effect: (user: MazariniUser) => {
    //         user.effects = user.effects ?? defaultEffects
    //         user.effects.positive.guaranteedLootColor = (user.effects.positive.guaranteedLootColor ?? 0) + 5
    //         return undefined
    //     },
    // },
    {
        label: '3 Blackjack re-deal',
        message: 'tre ekstra deal på nytt i blackjack!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 3
            return undefined
        },
    },
    {
        label: 'deal_or_no_deal',
        message: '',
        effect: () => {},
    },
]

const defaultEffects: IUserEffects = {
    positive: {},
    negative: {},
}
