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
    InteractionResponse,
    Message
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { ImageGenerationHelper } from '../../helpers/imageGenerationHelper'
import {
    ICollectableSeries,
    ILootbox,
    ItemColor,
    ItemRarity,
    IUserCollectable,
    MazariniUser
} from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'

interface IPendingTrade {
    userId: string
    tradingIn: IUserCollectable[]
    receiving: ItemRarity
    series: string
}

interface IPendingChest {
    userId: string
    quality: string
    items: Map<string, IUserCollectable>
    message?: InteractionResponse<boolean> | Message<boolean>
    buttons?: ActionRowBuilder<ButtonBuilder>
}

export class LootboxCommands extends AbstractCommands {
    private imageGenerator: ImageGenerationHelper
    private lootboxes: ILootbox[]
    private lootboxesRefreshed: Date
    private series: ICollectableSeries[]
    private pendingTrades: Map<string, IPendingTrade>
    private pendingChests: Map<string, IPendingChest>

    constructor(client: MazariniClient) {
        super(client)
        this.imageGenerator = new ImageGenerationHelper(client)
        this.pendingTrades = new Map<string, IPendingTrade>()
        this.pendingChests = new Map<string, IPendingChest>()
    }

    static getLootRewardButton(userId: string, quality: string, isChest: boolean = false): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
                custom_id: `OPEN_LOOT;${userId};${quality};${isChest ? 'chest' : 'box'}`,
                style: ButtonStyle.Primary,
                label: `${isChest ? 'Open loot chest' : 'Open lootbox'}`,
                disabled: false,
                type: 2,
            })
        )
    }

    private async openLootFromButton(interaction: ButtonInteraction<CacheType>) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, {text: 'Noe gikk galt med interactionen. Prøv igjen.'})
        const lootboxOwnerId = interaction.customId.split(';')[1]
        if (interaction.user.id === lootboxOwnerId) {
            interaction.message.edit({ components: [] })
            const type = interaction.customId.split(';')[3]
            if (type === 'box') await this.openAndRegisterLootbox(interaction)
            else if (type === 'chest') await this.openAndRegisterLootChest(interaction)
        } else this.messageHelper.replyToInteraction(interaction, 'Det er ikke din boks dessverre', { ephemeral: true, hasBeenDefered: true })
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
        const rewardedItem = await this.calculateRewardItem(box, series, user)
        this.registerItemOnUser(user, rewardedItem)
        this.revealCollectable(interaction, rewardedItem)
    }

    private async openAndRegisterLootChest(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
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
        
        if (interaction.isChatInputCommand() && !this.checkBalanceAndTakeMoney(user, box, interaction, true)) return
        const chestItems: IUserCollectable[] = new Array<IUserCollectable>()
        chestItems.push(await this.calculateRewardItem(box, series, user))
        chestItems.push(await this.calculateRewardItem(box, series, user))
        chestItems.push(await this.calculateRewardItem(box, series, user))
        this.revealLootChest(interaction, chestItems, quality)
    }

    private isArneChest(items: IUserCollectable[]) {
        return items.every(item => item.rarity === ItemRarity.Common && item.color === ItemColor.None)
    }

    private async revealLootChest(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, items: IUserCollectable[], quality: string) {
        const chestEmoji = await EmojiHelper.getEmoji('chest_closed', interaction)
        const chestType = this.isArneChest(items) ? 'Arne' : (TextUtils.capitalizeFirstLetter(quality) + ' loot')
        const embed = EmbedUtils.createSimpleEmbed(`${chestType} chest`, `Hvilken lootbox vil du åpne og beholde?`).setThumbnail(`https://cdn.discordapp.com/emojis/${chestEmoji.urlId}.webp?size=96&quality=lossless`)
        const chestId = randomUUID()
        const chestItems: Map<string, IUserCollectable> = new Map<string, IUserCollectable>()
        const buttons = new ActionRowBuilder<ButtonBuilder>()
        for (const item of items) {
            const itemId = randomUUID()
            chestItems.set(itemId, item)
            const btn = lootChestButton(chestId, itemId, TextUtils.capitalizeFirstLetter(item.rarity))
            if (item.color !== ItemColor.None) {
                const color = this.getItemColorBadge(item)
                const badge = EmojiHelper.getGuildEmoji(color, interaction)                
                btn.setEmoji({name: badge.name, id: badge.id})
            }
            buttons.addComponents(btn)
        }
        const msg = await this.messageHelper.replyToInteraction(interaction, embed, {hasBeenDefered: true}, [buttons])
        const pendingChest: IPendingChest = {userId: interaction.user.id, quality: quality, items: chestItems, message: msg, buttons: buttons}
        this.pendingChests.set(chestId, pendingChest)
    }

    private getItemColorBadge(item: IUserCollectable) {
        let color = ''
        if (item.color === ItemColor.Silver) color = 'silver_badge'
        else if (item.color === ItemColor.Gold) color = 'gold_badge'
        else if (item.color === ItemColor.Diamond) color = 'diamond_badge'
        return color
    }

    private async selectChestItem(interaction: ButtonInteraction<CacheType>) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, {text: 'Noe gikk galt med interactionen. Prøv igjen.'})
        const user = await this.client.database.getUser(interaction.user.id)
        const pendingChest = this.getPendingChest(interaction)
        if (!pendingChest) return this.messageHelper.replyToInteraction(interaction, 'Denne er dessverre ikke gyldig lenger', {hasBeenDefered: true})
        if (!(pendingChest.userId === interaction.user.id)) {
            return this.messageHelper.replyToInteraction(interaction, 'nei', {hasBeenDefered: true})
        } 
        const chestEmoji = await EmojiHelper.getEmoji('chest_open', interaction)
        const chestType = this.isArneChest(Array.from(pendingChest.items.values())) ? 'Arne' : (TextUtils.capitalizeFirstLetter(pendingChest.quality) + ' loot')
        const embed = EmbedUtils.createSimpleEmbed(`${chestType} chest`, `Åpner lootboxen!`).setThumbnail(`https://cdn.discordapp.com/emojis/${chestEmoji.urlId}.webp?size=96&quality=lossless`)
        const disabledBtns = pendingChest.buttons.components.map(btn => {
            btn.setDisabled(true)
            const btnProps: any = btn.toJSON()
            if (btnProps.custom_id === interaction.customId) btn.setLabel('* ' + btnProps.label + ' *')
            return btn
        })
        const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledBtns)
        interaction.message.edit({ embeds: [embed], components: [btnRow] })
        const item = this.getChestItem(interaction, pendingChest)        
        this.registerItemOnUser(user, item)
        this.revealCollectable(interaction, item)
        this.deletePendingChest(interaction)
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
        this.lootboxes = lootboxes.filter(box => LootboxCommands.lootboxIsValid(box))
        this.lootboxesRefreshed = new Date()
        return this.lootboxes
    }

    static lootboxIsValid(box: ILootbox): boolean {
        const from = box.validFrom ? new Date(box.validFrom) : new Date()
        const to = box.validTo ? new Date(box.validTo) : new Date()
        const now = new Date()        
        return now >= from && now <= to 
    }

    private checkBalanceAndTakeMoney(user: MazariniUser, box: ILootbox, interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, isChest: boolean = false) {
        const moneyWasTaken = this.client.bank.takeMoney(user, (isChest ? box.price*2 : box.price))
        if (!moneyWasTaken) this.messageHelper.replyToInteraction(interaction, 'Du har kje råd te den', { ephemeral: true, hasBeenDefered: true })
        return moneyWasTaken
    }

    private async calculateRewardItem(box: ILootbox, series: string, user: MazariniUser) {
        const itemRoll = Math.random()
        const colorBuff = user.effects?.positive?.lootColorChanceMultiplier ?? 1
        const colored = Math.random() < (box.probabilities.color * colorBuff)
        if (itemRoll < box.probabilities.legendary) {
            return await this.getRandomItemForRarity(ItemRarity.Legendary, series, colored, user)
        } else if (itemRoll < box.probabilities.epic) {
            return await this.getRandomItemForRarity(ItemRarity.Epic, series, colored, user)
        } else if (itemRoll < box.probabilities.rare) {
            return await this.getRandomItemForRarity(ItemRarity.Rare, series, colored, user)
        } else {
            return await this.getRandomItemForRarity(ItemRarity.Common, series, colored, user)
        }
    }

    private async getRandomItemForRarity(rarity: ItemRarity, series: string, colored: boolean, user: MazariniUser): Promise<IUserCollectable> {
        const seriesOrDefault = await this.getSeriesOrDefault(series)
        const rarityItems = this.getRarityItems(seriesOrDefault, rarity)
        const item = RandomUtils.getRandomItemFromList(rarityItems)
        const color = this.getRandomColor(colored, user)        
        return { name: item, series: seriesOrDefault.name, rarity: rarity, color: color, amount: 1 }
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

    private getRandomColor(colored: boolean, user: MazariniUser): ItemColor {
        const flipped = user.effects?.positive?.lootColorsFlipped
        const roll = Math.random()
        if (!colored) return ItemColor.None
        else if (roll < 1 / 6) return flipped ? ItemColor.Silver : ItemColor.Diamond // 1/6 chance for diamond
        else if (roll < 1 / 2) return ItemColor.Gold // 2/6 chance for gold
        else return flipped ? ItemColor.Diamond : ItemColor.Silver // 3/6 chance for silver
    }

    private registerItemOnUser(user: MazariniUser, item: IUserCollectable) {        
        const itemAlreadyCollected = user.collectables?.some((collectible) => collectible.name === item.name && collectible.color === item.color)
        if (itemAlreadyCollected) {
            user.collectables = user.collectables.map((el) =>
                this.collectableToString(el) === this.collectableToString(item)
                    ? {...el, amount: el.amount + item.amount}
                    : el
            )
        } else {
            user.collectables = user.collectables ?? new Array<IUserCollectable>()
            user.collectables.push(item)
        }
        this.client.database.updateUser(user)
    }

    private removeItemsFromUser(items: IUserCollectable[], user: MazariniUser): IUserCollectable[] {
        let filtered = user.collectables
        items.forEach(item => {
            filtered = filtered.map((el) =>
                (this.collectableToString(el) === this.collectableToString(item))
                    ? {...el, amount: el.amount - item.amount}
                    : el
            )
        })
        return filtered.filter(item => item.amount > 0)
    }

    private registerTradeOnUser(itemsWithTradedRemoved: IUserCollectable[], rewardedItem: IUserCollectable, user: MazariniUser) {
        const itemAlreadyCollected = itemsWithTradedRemoved.some((collectible) => this.collectableToString(collectible) === this.collectableToString(rewardedItem))
        if (itemAlreadyCollected) {
            itemsWithTradedRemoved = itemsWithTradedRemoved.map((el) =>
                this.collectableToString(el) === this.collectableToString(rewardedItem)
                    ? {...el, amount: el.amount + rewardedItem.amount}
                    : el
            )
        } else {
            itemsWithTradedRemoved = itemsWithTradedRemoved ?? new Array<IUserCollectable>()
            itemsWithTradedRemoved.push(rewardedItem)
        }
        user.collectables = itemsWithTradedRemoved
        this.client.database.updateUser(user)
    }

    private collectableToString(item: IUserCollectable) {
        return `${item.series};${item.rarity};${item.name};${item.color}`
    }

    private async revealCollectable(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, item: IUserCollectable) {
        const path = this.getGifPath(item)
        const buffer = Buffer.from(await this.client.database.getFromStorage(path))
        const file = new AttachmentBuilder(buffer, {name: 'collectable.gif'})
        const reply = await this.messageHelper.replyToInteraction(interaction, '', {hasBeenDefered: true}, undefined, [file])
        this.addReaction(reply, item)    
    }

    private async addReaction(reply: Message | InteractionResponse, item: IUserCollectable) {
        const emoji = await this.getLootApplicationEmoji(item)
        let msg = undefined
        if (reply instanceof InteractionResponse) {
            msg = await reply.fetch()
        } else {
            msg = reply
        }
        setTimeout(() => {
            msg.react(emoji.emojiObject.identifier)
        }, 30000)
    }

    private async getLootApplicationEmoji(item: IUserCollectable) {
        const emojiName = `${item.series}_${item.name}_${item.color.charAt(0)}`.toLowerCase()
        return await EmojiHelper.getApplicationEmoji(emojiName, this.client)
    }

    private getGifPath(item: IUserCollectable): string {
        return `loot/${item.series}/${item.name}_${item.color}.gif`
    }

    private async qualityAutocomplete(interaction: AutocompleteInteraction<CacheType>, isChest: boolean = false) {
        const boxes = await this.getLootboxes()
		interaction.respond(
			boxes
            .map(box => ({ name: `${TextUtils.capitalizeFirstLetter(box.name)} ${(isChest ? 2 : 1)*(box.price/1000)}K`, value: box.name })) 
		)
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
        const user = await this.client.database.getUser(interaction.user.id)
        const seriesParam = interaction.options.get('series')?.value as string
        const series = await this.getSeriesOrDefault(seriesParam)
        const img = await this.imageGenerator.generateImageForCollectables(user.collectables?.filter(item => item.series === series.name).sort((a,b) => `${a.name}_${this.getColorOrder(a.color)}`.localeCompare(`${b.name}_${this.getColorOrder(b.color)}`)))
        const file = new AttachmentBuilder(img, { name: 'inventory.png' }) 
        this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, undefined, [file]) 
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
        const focused = optionList._hoistedOptions.find(option => option.focused)
        const isTradeUp = interaction.options.getSubcommand() === 'up'
        if (focused.name === 'item1') this.firstItemAutocomplete(interaction, user, isTradeUp)
        else this.secondaryItemsAutocomplete(interaction, user, isTradeUp)
    }

    private firstItemAutocomplete(interaction: AutocompleteInteraction<CacheType>, user: MazariniUser, filterOutLegendaries: boolean) {
        const optionList: any = interaction.options
        const collectables = this.getSortedCollectables(user, filterOutLegendaries)
        interaction.respond(
			collectables
            .filter(item => this.collectableToString(item).includes(optionList.getFocused().toLowerCase()))
            .slice(0,25)
            .map(item => ({ name: `${item.name} (${item.color}) x${item.amount}`, value: this.collectableToString(item) })) 
		)
    }

    private secondaryItemsAutocomplete(interaction: AutocompleteInteraction<CacheType>, user: MazariniUser, filterOutLegendaries: boolean) {
        const optionList: any = interaction.options
        const allItems = optionList._hoistedOptions
        const filter = this.getSortFilter(allItems.find(item => item.name === 'item1')?.value)        
        const collectables = this.getSortedCollectables(user, filterOutLegendaries, filter)
        const filteredCollectables = this.removeSelectedItems(collectables, allItems)
        interaction.respond(
			filteredCollectables
            .filter(item => this.collectableToString(item).includes(optionList.getFocused().toLowerCase()))
            .slice(0,25)
            .map(item => ({ name: `${item.name} (${item.color}) x${item.amount}`, value: this.collectableToString(item) })) 
		)
    } 

    private getSortedCollectables(user: MazariniUser, filterOutLegendaries: boolean, filter?: { series: string, rarity: string }) {
        // const allowColoredNonDups = user.userSettings?.allowNonDupesInTrade ?? false        
        const filtered = user.collectables
                // .map(item => (allowColoredNonDups || item.color === ItemColor.None) ? item : ({...item, amount: item.amount - 1}))
                // .filter(item => item.amount >= 1)
                .filter(item => !filter || (filter.series === item.series && filter.rarity === item.rarity))
                .sort((a,b) => this.collectableSortString(a).localeCompare(this.collectableSortString(b)))
        if (filterOutLegendaries) return filtered.filter(item => item.rarity !== ItemRarity.Legendary)
        else return filtered
    }

    private collectableSortString(item: IUserCollectable) {
        return `${item.series}_${this.getRarityOrder(item.rarity)}_${item.name}_${this.getColorOrder(item.color)}`
    }

    private getSortFilter(input: string): { series: string, rarity: string } {
        if (!input) return undefined
        const split = input.split(';')        
        if (split.length === 4) return { series: split[0], rarity: split[1] }
        else return undefined
    }

    private removeSelectedItems(collectables: IUserCollectable[], inputs: any[]) {
        let filtered = collectables.slice()
        inputs.filter(input => !input.focused).forEach(input => {
            const split = input.value.split(';')
            if (split.length === 4) {
                filtered = filtered.map((el) =>
                    (el.name === split[2] && el.color === split[3])
                        ? {...el, amount: el.amount - 1}
                        : el
                )
            }
        })
        return filtered.filter(item => item.amount > 0)
    }

    private verifyInputIsValid(inputs: any[], user: MazariniUser) {
        return this.formatIsCorrect(inputs)
            && this.isSameSeriesAndRarity(inputs)
            && this.allItemsAreOwned(this.inputsToIUserCollectables(inputs), user)
    }

    private formatIsCorrect(inputs: any[]) {
        return inputs.every(input => input.value.split(';').length === 4)
    }

    private isSameSeriesAndRarity(inputs: any[]) {
        const filter = this.getSortFilter(inputs.find(item => item.name === 'item1').value)
        if (!filter) return false
        return inputs.every(input => {
            const split = input.value.split(';')            
            return filter.series === split[0] && filter.rarity === split[1]
        })
    }

    private inputsToIUserCollectables(inputs: any[]): IUserCollectable[] {
        const collectables: IUserCollectable[] = new Array<IUserCollectable>()
        inputs.forEach(input => {
            const split = input.value.split(';')
            collectables.push({
                series: split[0],
                rarity: split[1],
                name: split[2],
                color: split[3],
                amount: 1
            })
        })
        return collectables
    }

    private allItemsAreOwned(inputs: IUserCollectable[], user: MazariniUser) {
        let collectables = user.collectables.slice()
        let foundAll = true
        inputs.forEach(input => {
            let found = false
            collectables = collectables.map((item) => {
                if (this.collectableToString(item) === this.collectableToString(input)) {
                    found = true
                    return {...item, amount: item.amount - 1}
                } else {
                    return item
                }
            })
            if (!found) foundAll = false
            collectables = collectables.filter(item => item.amount > 0)
        })
        return foundAll
    }

    private async tradeItems(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const optionList: any = interaction.options
        const allItems = optionList._hoistedOptions        
        if (!this.verifyInputIsValid(allItems, user)) {
            return this.messageHelper.replyToInteraction(interaction, 'Du har ugyldig input. Sørg for å velge fra de foreslåtte parameterne når du velger trade gjenstander.', {hasBeenDefered: true})
        }
        const inputAsCollectables = this.inputsToIUserCollectables(allItems)
        const tradingToRarity = this.getResultingTradeRarity(inputAsCollectables[0].rarity, allItems.length)
        const pendingTrade: IPendingTrade = { userId: interaction.user.id, receiving: tradingToRarity, tradingIn: inputAsCollectables, series: inputAsCollectables[0].series }
        const tradeID = randomUUID()
        this.pendingTrades.set(tradeID, pendingTrade)
        const collectableNames = this.getCollectableNamesPrintString(inputAsCollectables)
        const embed = EmbedUtils.createSimpleEmbed('Trade', `Er du sikker på at du vil bytte: \n${collectableNames}\nfor en ny ${tradingToRarity} gjenstand?`)
        const buttons = tradeButtons(tradeID)
        this.messageHelper.replyToInteraction(interaction, embed, {hasBeenDefered: true}, [buttons])
    }

    private getCollectableNamesPrintString(collectables: IUserCollectable[]): string {
        const mergedCollectables = collectables.reduce((acc, current) => {
            const existing = acc.find(item => this.collectableToString(item) === this.collectableToString(current))
            if (existing) existing.amount += current.amount          
            else acc.push({ ...current })
            return acc
        }, new Array<IUserCollectable>())
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
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, {text: 'Noe gikk galt med interactionen. Prøv igjen.'})
        const user = await this.client.database.getUser(interaction.user.id)
        const pendingTrade = this.getPendingTrade(interaction)
        if (!(pendingTrade.userId === interaction.user.id)) {
            const really = await EmojiHelper.getEmoji('geggireally', interaction)
            return this.messageHelper.replyToInteraction(interaction, `${really.id}`, {hasBeenDefered: true})
        } 
        if (!this.allItemsAreOwned(pendingTrade.tradingIn, user)) {
            await this.messageHelper.replyToInteraction(interaction, 'Du har ikke alle gjenstandene du prøver å bytte inn.', {hasBeenDefered: true})
            return this.cancelTrade(interaction)
        }
        const collectableNames = this.getCollectableNamesPrintString(pendingTrade.tradingIn)
        const embed = EmbedUtils.createSimpleEmbed('Trade', `Bytter inn: \n${collectableNames}\nfor en ${pendingTrade.receiving} gjenstand`)
        interaction.message.edit({ embeds: [embed], components: [] })
        const colorChance = this.getTradeColorChance(pendingTrade.tradingIn)
        const colorBuff = user.effects?.positive?.lootColorChanceMultiplier ?? 1

        const colored = Math.random() < (colorChance * colorBuff)
        const rewardedItem = await this.getRandomItemForRarity(pendingTrade.receiving, pendingTrade.series, colored, user) 
        const tradedItemsRemoved = this.removeItemsFromUser(pendingTrade.tradingIn, user)
        this.registerTradeOnUser(tradedItemsRemoved, rewardedItem, user)
        this.revealCollectable(interaction, rewardedItem)
        this.deletePendingTrade(interaction)
    }

    private getTradeColorChance(items: IUserCollectable[]) {
        const initalChance = items.length > 3 ? 1/5 : 1/4 // 20% for trade up, 25% for trade in
        const silvers = items.filter(item => item.color === ItemColor.Silver).length
        const golds = items.filter(item => item.color === ItemColor.Gold).length
        const diamonds = items.filter(item => item.color === ItemColor.Diamond).length
        return initalChance + (silvers * 1/20) + (golds * 1/10) + (diamonds * 1/5)
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

    private async executeLootSubCommand(interaction: ChatInputCommandInteraction<CacheType>) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, {text: 'Noe gikk galt med interactionen. Prøv igjen.'})
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
        const focused = optionList._hoistedOptions.find(option => option.focused)
        if (focused.name === 'series') this.seriesAutocomplete(interaction)
        else if (focused.name.includes('quality')) this.qualityAutocomplete(interaction, (cmd === 'chest'))
        else if (focused.name.includes('item')) this.itemAutocomplete(interaction)
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