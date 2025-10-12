import { randomUUID } from 'crypto'
import {
    ActionRowBuilder,
    AttachmentBuilder,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    GuildMember,
    InteractionResponse,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { MazariniClient } from '../../client/MazariniClient'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { ImageGenerationHelper } from '../../helpers/imageGenerationHelper'
import { LootStatsHelper } from '../../helpers/statsHelper'
import { ILootbox, ILootSeries, ItemColor, ItemRarity, IUserEffects, IUserLootItem, MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../../interfaces/interactionInterface'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'
import { DealOrNoDeal } from '../games/dealOrNoDeal'

const { request } = require('undici')

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
    effect?: IEffectItem
    message?: InteractionResponse<boolean> | Message<boolean>
    buttons?: ActionRowBuilder<ButtonBuilder>
}

export interface IEffectItem {
    label: string
    message: string //følger formatet "Din kalendergave for {dato} er {message}"
    effect(user: MazariniUser): undefined | ActionRowBuilder<ButtonBuilder>[]
}

interface InventoryUpdate {
    userId: string
    series: string
    rarity: ItemRarity
}

export class LootboxCommands extends AbstractCommands {
    private imageGenerator: ImageGenerationHelper
    private lootboxes: ILootbox[]
    private lootboxesRefreshed: Date
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

    private async openLootFromButton(interaction: ButtonInteraction<CacheType>) {
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

    private async openAndRegisterLootbox(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const quality = this.resolveLootQuality(interaction)
        const series = this.resolveLootSeries(user, interaction)
        const seriesObj = await this.getSeriesOrDefault(series)
        const box = await this.resolveLootbox(quality)
        const sh = new LootStatsHelper(user.loot[seriesObj.name].stats)
        sh.registerPurchase(box, false, interaction.isChatInputCommand())

        if (interaction.isChatInputCommand() && !this.checkBalanceAndTakeMoney(user, box, interaction)) return
        const rewardedItem = await this.calculateRewardItem(box, seriesObj, user)
        this.registerItemOnUser(user, rewardedItem)
        this.generateInventoryParts(user, rewardedItem.series, [rewardedItem.rarity])
        this.revealCollectable(interaction, rewardedItem, user.userSettings.lootReactionTimer)
    }

    private async openAndRegisterLootChest(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, pendingChest?: IPendingChest) {
        const user = await this.client.database.getUser(interaction.user.id)
        const quality = this.resolveLootQuality(interaction, pendingChest)
        const series = this.resolveLootSeries(user, interaction, pendingChest)
        const seriesObj = await this.getSeriesOrDefault(series)

        const box = await this.resolveLootbox(quality)
        const sh = new LootStatsHelper(user.loot[seriesObj.name].stats)
        sh.registerPurchase(box, true, interaction.isChatInputCommand())

        if (interaction.isChatInputCommand() && !this.checkBalanceAndTakeMoney(user, box, interaction, true)) return
        const chestItems: IUserLootItem[] = new Array<IUserLootItem>()
        chestItems.push(await this.calculateRewardItem(box, seriesObj, user))
        chestItems.push(await this.calculateRewardItem(box, seriesObj, user))
        chestItems.push(await this.calculateRewardItem(box, seriesObj, user))
        this.database.updateUser(user) //update in case of effect change
        const existingChestId = pendingChest && interaction.isButton() ? interaction.customId.split(';')[1] : undefined
        this.revealLootChest(interaction, chestItems, quality, seriesObj.name, existingChestId)
    }

    private resolveLootSeries(
        user: MazariniUser,
        interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>,
        pendingChest?: IPendingChest
    ) {
        if (pendingChest) return pendingChest.series
        else if (interaction.isChatInputCommand()) return (interaction.options.get('series')?.value as string) ?? user.userSettings.activeLootSeries
        else if (interaction.isButton()) return interaction.customId.split(';')[4] ? interaction.customId.split(';')[4] : user.userSettings.activeLootSeries
    }

    private resolveLootQuality(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, pendingChest?: IPendingChest) {
        if (pendingChest) return pendingChest.quality
        else if (interaction.isChatInputCommand()) return interaction.options.get('quality')?.value as string
        else if (interaction.isButton()) return interaction.customId.split(';')[2]
    }

    private isArneChest(items: IUserLootItem[]) {
        return items.every((item) => item.rarity === ItemRarity.Common && item.color === ItemColor.None)
    }

    private async revealLootChest(
        interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>,
        items: IUserLootItem[],
        quality: string,
        series: string,
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
            const btn = lootChestButton(chestId, itemId, TextUtils.capitalizeFirstLetter(item.rarity))
            if (item.color !== ItemColor.None) {
                const color = this.getItemColorBadge(item)
                const badge = EmojiHelper.getGuildEmoji(color, interaction)
                btn.setEmoji({ name: badge.name, id: badge.id })
            }
            buttons.addComponents(btn)
        }
        let effect: IEffectItem = undefined
        if (Math.random() < this.getChestEffectOdds(quality)) {
            effect = RandomUtils.getRandomItemFromList(effects)
            let btn: ButtonBuilder = undefined
            if (effect.label === 'deal_or_no_deal') {
                btn = DealOrNoDeal.getDealOrNoDealButton(interaction.user.id)
            } else if (effect.label === 'redeal_chest') {
                btn = reDealChestButton(chestId)
            } else btn = lootChestButton(chestId, 'effect', effect.label)
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
            pendingChest = { userId: interaction.user.id, quality: quality, series: series, items: chestItems, effect: effect, message: msg, buttons: buttons }
        }
        this.pendingChests.set(chestId, pendingChest)
    }

    private getChestEffectOdds(quality: string) {
        if (quality.toLowerCase() === 'basic') return 0.2
        else if (quality.toLowerCase() === 'premium') return 0.5
        else if (quality.toLowerCase() === 'elite') return 1
        else return 0
    }

    private getItemColorBadge(item: IUserLootItem) {
        let color = ''
        if (item.color === ItemColor.Silver) color = 'silver_badge'
        else if (item.color === ItemColor.Gold) color = 'gold_badge'
        else if (item.color === ItemColor.Diamond) color = 'diamond_badge'
        return color
    }

    private async selectChestItem(interaction: ButtonInteraction<CacheType>) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const user = await this.client.database.getUser(interaction.user.id)
        const pendingChest = this.getPendingChest(interaction)
        if (!pendingChest) return this.messageHelper.replyToInteraction(interaction, 'Denne er dessverre ikke gyldig lenger', { hasBeenDefered: true })
        if (!(pendingChest.userId === interaction.user.id)) {
            return this.messageHelper.replyToInteraction(interaction, 'nei', { hasBeenDefered: true })
        }
        const chestEmoji = await EmojiHelper.getEmoji('chest_open', interaction)
        const chestType = this.isArneChest(Array.from(pendingChest.items.values())) ? 'Arne' : TextUtils.capitalizeFirstLetter(pendingChest.quality) + ' loot'
        const embed = EmbedUtils.createSimpleEmbed(`${chestType} chest`, `Åpner lootboxen!`).setThumbnail(
            `https://cdn.discordapp.com/emojis/${chestEmoji.urlId}.webp?size=96&quality=lossless`
        )
        const disabledBtns = pendingChest.buttons.components.map((btn) => {
            btn.setDisabled(true)
            const btnProps: any = btn.toJSON()
            if (btnProps.custom_id === interaction.customId) btn.setLabel('* ' + btnProps.label + ' *')
            return btn
        })
        const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledBtns)
        interaction.message.edit({ embeds: [embed], components: [btnRow] })
        if (interaction.customId.split(';')[2] === 'effect') {
            const effect = pendingChest.effect
            effect.effect(user)
            this.database.updateUser(user)
            this.messageHelper.replyToInteraction(interaction, `Du valgte ${effect.message}`, { hasBeenDefered: true })
        } else {
            const item = this.getChestItem(interaction, pendingChest)
            this.registerItemOnUser(user, item)
            this.generateInventoryParts(user, item.series, [item.rarity])
            this.revealCollectable(interaction, item, user.userSettings.lootReactionTimer)
            this.deletePendingChest(interaction)
        }
    }

    private getPendingChest(interaction: ButtonInteraction<CacheType>) {
        const chestId = interaction.customId.split(';')[1]
        return this.pendingChests.get(chestId)
    }

    private deletePendingChest(interaction: ButtonInteraction<CacheType>) {
        const chestId = interaction.customId.split(';')[1]
        this.pendingChests.delete(chestId)
    }

    private getChestItem(interaction: ButtonInteraction<CacheType>, chest: IPendingChest) {
        const chestId = interaction.customId.split(';')[2]
        return chest.items.get(chestId)
    }

    private async resolveLootbox(quality: string): Promise<ILootbox> {
        const boxes = await this.getLootboxes()
        return boxes.find((box) => box.name === quality)
    }

    private async getLootboxes(): Promise<ILootbox[]> {
        if (this.lootboxes && DateUtils.dateIsWithinLastHour(this.lootboxesRefreshed)) return this.lootboxes
        const lootboxes = await this.client.database.getLootboxes()
        this.lootboxes = lootboxes.filter((box) => LootboxCommands.lootboxIsValid(box))
        this.lootboxesRefreshed = new Date()
        return this.lootboxes
    }

    static lootboxIsValid(box: ILootbox): boolean {
        const from = box.validFrom ? new Date(box.validFrom) : new Date()
        const to = box.validTo ? new Date(box.validTo) : new Date()
        const now = new Date()
        return now >= from && now <= to
    }

    private checkBalanceAndTakeMoney(
        user: MazariniUser,
        box: ILootbox,
        interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>,
        isChest: boolean = false
    ) {
        const moneyWasTaken = this.client.bank.takeMoney(user, isChest ? box.price * 2 : box.price)
        if (!moneyWasTaken) this.messageHelper.replyToInteraction(interaction, 'Du har kje råd te den', { ephemeral: true, hasBeenDefered: true })
        return moneyWasTaken
    }

    private async calculateRewardItem(box: ILootbox, series: ILootSeries, user: MazariniUser) {
        const itemRoll = Math.random()
        let colored = Math.random() < box.probabilities.color
        if ((user.effects?.positive?.guaranteedLootColor ?? 0) > 0) {
            colored = true
            user.effects.positive.guaranteedLootColor -= 1
        }
        if (series.hasUnobtainable && itemRoll < (box.probabilities.unobtainable ?? 0)) {
            return await this.getRandomItemForRarity(ItemRarity.Legendary, series.name, colored, user)
        } else if (itemRoll < box.probabilities.legendary) {
            return await this.getRandomItemForRarity(ItemRarity.Legendary, series.name, colored, user)
        } else if (itemRoll < box.probabilities.epic) {
            return await this.getRandomItemForRarity(ItemRarity.Epic, series.name, colored, user)
        } else if (itemRoll < box.probabilities.rare) {
            return await this.getRandomItemForRarity(ItemRarity.Rare, series.name, colored, user)
        } else {
            return await this.getRandomItemForRarity(ItemRarity.Common, series.name, colored, user)
        }
    }

    private async getRandomItemForRarity(rarity: ItemRarity, series: string, colored: boolean, user: MazariniUser): Promise<IUserLootItem> {
        const seriesOrDefault = await this.getSeriesOrDefault(series)
        const rarityItems = this.getRarityItems(seriesOrDefault, rarity)
        const item = RandomUtils.getRandomItemFromList(rarityItems)
        const color = this.getRandomColor(colored && seriesOrDefault.hasColor, user)
        return { name: item, series: seriesOrDefault.name, rarity: rarity, color: color, amount: 1 }
    }

    private async getSeriesOrDefault(series: string): Promise<ILootSeries> {
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

    private async revealCollectable(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, item: IUserLootItem, timer?: number) {
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

    private async qualityAutocomplete(interaction: AutocompleteInteraction<CacheType>, isChest: boolean = false) {
        const boxes = await this.getLootboxes()
        interaction.respond(
            boxes
                .filter((box) => !box.rewardOnly)
                .map((box) => ({ name: `${TextUtils.capitalizeFirstLetter(box.name)} ${(isChest ? 2 : 1) * (box.price / 1000)}K`, value: box.name }))
        )
    }

    private async seriesAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
        const series = await this.getSeries()
        const optionList: any = interaction.options
        const input = optionList.getFocused().toLowerCase()
        interaction.respond(series.filter((series) => series.name.toLowerCase().includes(input)).map((series) => ({ name: series.name, value: series.name })))
    }

    private async printInventory(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) interaction.deferUpdate()
        let user = await this.client.database.getUser(interaction.user.id)
        const seriesParam = this.resolveLootSeries(user, interaction)
        const series = await this.getSeriesOrDefault(seriesParam)
        let attempts = 0
        const intervalId = setInterval(async () => {
            attempts++
            if (attempts > 20) {
                this.messageHelper.replyToInteraction(interaction, 'Klarte ikke å hente inventory', { hasBeenDefered: true })
                clearInterval(intervalId)
            }
            if (!this.userHasInventoryInQueue(user.id, seriesParam)) {
                clearInterval(intervalId)
                user = await this.client.database.getUser(interaction.user.id)
                if (!(await this.verifyUserHasInventoryImages(user, series.name))) {
                    return this.printInventory(interaction)
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

    /* LEAVE THIS FOR NOW - can revisit if containers can set image size
    
    private async printInventoryV2(interaction: ChatInputCommandInteraction<CacheType>) {
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

    private async generateInventoryParts(user: MazariniUser, series: string, rarities: Array<ItemRarity>) {
        const updates: InventoryUpdate[] = rarities.map((rarity) => ({ userId: user.id, series: series, rarity: rarity }))
        this.inventoryUpdateQueue.push(...updates)
        for (const rarity of rarities) {
            const img = await this.imageGenerator.generateImageForCollectablesRarity(user, series, rarity)
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

    private async itemAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const optionList: any = interaction.options
        const focused = optionList._hoistedOptions.find((option) => option.focused)
        const isTradeUp = interaction.options.getSubcommand() === 'up'
        if (focused.name === 'item1') this.firstItemAutocomplete(interaction, user, isTradeUp)
        else this.secondaryItemsAutocomplete(interaction, user, isTradeUp)
    }

    private firstItemAutocomplete(interaction: AutocompleteInteraction<CacheType>, user: MazariniUser, filterOutLegendaries: boolean) {
        const optionList: any = interaction.options
        const collectables = this.getSortedCollectables(user, filterOutLegendaries)
        interaction.respond(
            collectables
                .filter((item) => this.collectableToString(item).includes(optionList.getFocused().toLowerCase()))
                .slice(0, 25)
                .map((item) => ({ name: `${item.name} (${item.color}) x${item.amount}`, value: this.collectableToString(item) }))
        )
    }

    private secondaryItemsAutocomplete(interaction: AutocompleteInteraction<CacheType>, user: MazariniUser, filterOutLegendaries: boolean) {
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
        const filtered = user.collectables
            .map((item) => (onlyShowDups ? { ...item, amount: item.amount - 1 } : item))
            .filter((item) => item.amount >= 1)
            .filter((item) => !filter || (filter.series === item.series && filter.rarity === item.rarity))
            .sort((a, b) => this.collectableSortString(a, activeSeries).localeCompare(this.collectableSortString(b, activeSeries)))
        if (filterOutLegendaries) return filtered.filter((item) => item.rarity !== ItemRarity.Legendary)
        else return filtered
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
        let collectables = user.collectables.slice()
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

    private async tradeItems(interaction: ChatInputCommandInteraction<CacheType>) {
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

    private async confirmTrade(interaction: ButtonInteraction<CacheType>) {
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
        let rewardedItem = await this.getRandomItemForRarity(pendingTrade.receiving, pendingTrade.series, colored, user)
        while (this.itemIsSameAsTradedIn(rewardedItem, pendingTrade.tradingIn)) {
            rewardedItem = await this.getRandomItemForRarity(pendingTrade.receiving, pendingTrade.series, colored, user)
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

    private cancelTrade(interaction: ButtonInteraction<CacheType>) {
        const pendingTrade = this.getPendingTrade(interaction)
        if (!(pendingTrade.userId === interaction.user.id)) return interaction.deferUpdate()
        interaction.message.delete()
        this.deletePendingTrade(interaction)
    }

    private getPendingTrade(interaction: ButtonInteraction<CacheType>) {
        const tradeID = interaction.customId.split(';')[1]
        return this.pendingTrades.get(tradeID)
    }

    private deletePendingTrade(interaction: ButtonInteraction<CacheType>) {
        const tradeID = interaction.customId.split(';')[1]
        return this.pendingTrades.delete(tradeID)
    }

    private async handleChestReDeal(interaction: ButtonInteraction<CacheType>) {
        const deferred = await this.messageHelper.deferUpdate(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const pendingChest = this.getPendingChest(interaction)
        if (pendingChest.userId === interaction.user.id) {
            this.openAndRegisterLootChest(interaction, pendingChest)
        }
    }

    private async executeLootSubCommand(interaction: ChatInputCommandInteraction<CacheType>) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const cmdGroup = interaction.options.getSubcommandGroup()
        const cmd = interaction.options.getSubcommand()
        if (!cmdGroup && cmd === 'box') this.openAndRegisterLootbox(interaction)
        else if (!cmdGroup && cmd === 'chest') this.openAndRegisterLootChest(interaction)
        else if (!cmdGroup && cmd === 'inventory') this.printInventory(interaction)
        else if (cmdGroup && cmdGroup === 'trade') this.tradeItems(interaction)
    }

    private delegateAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
        const cmd = interaction.options.getSubcommand()
        const optionList: any = interaction.options
        const focused = optionList._hoistedOptions.find((option) => option.focused)
        if (focused.name === 'series') this.seriesAutocomplete(interaction)
        else if (focused.name.includes('quality')) this.qualityAutocomplete(interaction, cmd === 'chest')
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
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.executeLootSubCommand(rawInteraction)
                        },
                        autoCompleteCallback: (interaction: AutocompleteInteraction<CacheType>) => {
                            this.delegateAutocomplete(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'OPEN_LOOT',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.openLootFromButton(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_TRADE_CONFIRM',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.confirmTrade(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_TRADE_CANCEL',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.cancelTrade(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_CHEST_SELECT',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.selectChestItem(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LOOT_CHEST_REDEAL',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.handleChestReDeal(rawInteraction)
                        },
                    },
                    {
                        commandName: 'REFRESH_INVENTORY',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
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

const lootChestButton = (chestId: string, itemId: string, label: string) => {
    return new ButtonBuilder({
        custom_id: `LOOT_CHEST_SELECT;${chestId};${itemId}`,
        style: ButtonStyle.Primary,
        label: `${label}`,
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
