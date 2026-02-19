import { randomUUID } from 'crypto'
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, GuildMember } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ATCInteraction, BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import { DeckEditorCard, ICCGDeck, ItemRarity, IUserLootItem, MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { CCGDeckEditor_Info } from '../../templates/containerTemplates'
import { TextUtils } from '../../utils/textUtils'
import { CCGCard, CCGCardType, CCGSeries, DeckEditor, UsageFilter } from './ccgInterface'
import { CCGValidator } from './validator'

export class DeckCommands extends AbstractCommands {
    private editors: Map<string, DeckEditor>

    constructor(client: MazariniClient) {
        super(client)
        this.editors = new Map<string, DeckEditor>()
    }

    public async setDeck(interaction: ChatInteraction) {
        const user = await this.database.getUser(interaction.user.id)
        const deckChoice = interaction.options.get('deck')?.value as string
        const deck = user.ccg?.decks?.find((deck) => deck.name === deckChoice)
        if (!deck.valid)
            return this.messageHelper.replyToInteraction(
                interaction,
                `Deck **${deckChoice}** er ikke gyldig og må oppdateres før den kan settes som aktiv deck`,
                { ephemeral: true }
            )
        this.setActiveDeck(user, deckChoice)
        this.messageHelper.replyToInteraction(interaction, `Aktiv deck oppdatert til **${deckChoice}**`, { ephemeral: true })
    }

    private setActiveDeck(user: MazariniUser, deckChoice: string) {
        user.ccg.decks = user.ccg?.decks?.map((deck) => (deck.name === deckChoice ? { ...deck, active: true } : { ...deck, active: false }))
        this.database.updateUser(user)
    }

    private async activateCurrentDeck(interaction: BtnInteraction, editor: DeckEditor) {
        const user = await this.database.getUser(interaction.user.id)
        editor.deck.active = true
        this.setActiveDeck(user, editor.deck.name)
        this.updateDeckInfo(editor)
    }

    private async newDeck(interaction: ChatInteraction) {
        const name = interaction.options.get('name')?.value as string
        const user = await this.database.getUser(interaction.user.id)
        if (user.ccg?.decks?.some((deck) => deck.name === name))
            return this.messageHelper.replyToInteraction(interaction, `Du har allerede en deck med navnet ${name}`, { ephemeral: true })
        else this.newDeckEditor(interaction, name, user)
    }

    private async editDeck(interaction: ChatInteraction) {
        const name = interaction.options.get('deck')?.value as string
        const user = await this.database.getUser(interaction.user.id)
        this.newDeckEditor(interaction, name, user)
    }

    public async newDeckEditor(interaction: ChatInteraction, name: string, user: MazariniUser) {
        const deferred = await this.messageHelper.deferReply(interaction)
        if (!deferred) return this.messageHelper.sendMessage(interaction.channelId, { text: 'Noe gikk galt med interactionen. Prøv igjen.' })
        const editorId = randomUUID()
        const cards = await this.getUserCards(user)
        const deck: ICCGDeck = user.ccg?.decks?.find((deck) => deck.name === name) ?? {
            name: name,
            cards: [],
            valid: false,
            active: false,
        }
        const editor: DeckEditor = {
            id: editorId,
            userId: user.id,
            userColor: (interaction.member as GuildMember).displayColor,
            typeFilters: [],
            rarityFilters: [],
            usageFilters: [],
            seriesFilters: [],
            userCards: structuredClone(cards),
            filteredCards: structuredClone(cards),
            cardImages: new Map<string, Buffer>(),
            deck: deck,
            saved: false,
            deckInfo: {
                container: undefined,
                message: undefined,
            },
            cardView: {
                attachments: undefined,
                container: undefined,
                message: undefined,
            },
            page: 1,
        }
        const deckInfo = this.newDeckInfoContainer(editor)
        editor.deckInfo.container = deckInfo
        const cardView = await this.newCardViewContainer(editor, user)
        editor.cardView.container = cardView
        const deckInfoMsg = await this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, [deckInfo.container])
        const cardViewMsg = await this.messageHelper.sendMessage(
            interaction.channelId,
            { components: [cardView.container], files: editor.cardView.attachments },
            { isComponentOnly: true }
        )
        editor.deckInfo.message = deckInfoMsg
        editor.cardView.message = cardViewMsg
        this.editors.set(editorId, editor)
    }

    private newDeckInfoContainer(editor: DeckEditor) {
        const deckInfo = CCGDeckEditor_Info(editor)
        deckInfo.replaceComponent('save_button', saveAndCloseButtons(editor.id, editor.deck.valid && !editor.deck.active && editor.saved))
        deckInfo.replaceComponent('typeFilters', typeFilters(editor))
        deckInfo.replaceComponent('rarityFilters', rarityFilters(editor))
        deckInfo.replaceComponent('usageFilters', usageFilters(editor))
        if (GameValues.ccg.activeCCGseries.length > 1) {
            deckInfo.replaceComponent('seriesFilters', seriesFilters(editor))
        }
        deckInfo.setColor(editor.userColor)
        return deckInfo
    }

    private async newCardViewContainer(editor: DeckEditor, user: MazariniUser) {
        editor.cardView.attachments = new Array<AttachmentBuilder>()
        const cardView = new SimpleContainer()
        const cardPerPage = GameValues.ccg.deck.cardsPerPage
        const totalCards = editor.filteredCards.length
        const cardFilterInfo = `Cards ${Math.min(editor.page * cardPerPage - (cardPerPage - 1), totalCards)} - ${Math.min(
            editor.page * cardPerPage,
            totalCards
        )} (out of ${totalCards})`
        cardView.addComponent(ComponentsHelper.createTextComponent().setContent(cardFilterInfo), 'cardsInfo')
        const cards = editor.filteredCards.slice(editor.page * cardPerPage - cardPerPage, Math.min(editor.page * cardPerPage, editor.filteredCards.length))
        for (const card of cards) await this.addSingleCardView(editor, user, cardView, card)
        if (totalCards > cardPerPage) {
            cardView.addComponent(pageButtons(editor), 'page_buttons')
        }
        cardView.setColor(editor.userColor)
        return cardView
    }

    private async addSingleCardView(editor: DeckEditor, user: MazariniUser, container: SimpleContainer, card: CCGCard) {
        const cardImage = await this.getCardImage(editor, card)
        const attachment = new AttachmentBuilder(cardImage, { name: `${card.id}.png` })
        editor.cardView.attachments.push(attachment)
        const available = this.getCardAmountAvailable(user, card)
        const inDeck = editor.deck.cards?.find((instance) => instance.id === card.id)?.amount ?? 0
        const cardInfo = `**${card.name}**\n${TextUtils.capitalizeFirstLetter(card.type)}\n${TextUtils.capitalizeFirstLetter(
            card.rarity
        )}\n\nAvailable: ${available}\nIn deck: ${inDeck}`
        container.addComponent(
            ComponentsHelper.createSectionComponent()
                .addTextDisplayComponents(ComponentsHelper.createTextComponent().setContent(cardInfo))
                .setThumbnailAccessory((thumbnail) => thumbnail.setURL(`attachment://${card.id}.png`)),
            card.id
        )
        container.addComponent(ccgDeckCardAmount(editor.id, card.id, available, inDeck), `${card.id}_buttons`)
        container.addComponent(ComponentsHelper.createSeparatorComponent(), `${card.id}_separator`)
    }

    private async getCardImage(editor: DeckEditor, card: CCGCard) {
        if (!editor.cardImages.has(card.id)) {
            const path = `loot/${card.series}/${card.id}_small.png`
            const img = await this.database.getFromStorage(path)
            editor.cardImages.set(card.id, Buffer.from(img))
        }
        return editor.cardImages.get(card.id)
    }

    private getCardAmountAvailable(user: MazariniUser, card: CCGCard | DeckEditorCard) {
        const inventory: IUserLootItem[] = user.loot[card.series].inventory[card.rarity].items
        return inventory.find((item) => item.name === card.id)?.amount ?? 0
    }

    private async getUserCards(user: MazariniUser) {
        const loot = new Array<IUserLootItem>()
        const rarities = ['common', 'rare', 'epic', 'legendary']
        for (const series of GameValues.ccg.activeCCGseries) {
            for (const rarity of rarities) {
                const items = user.loot[series]?.inventory[rarity]?.items
                if (items) loot.push(...items)
            }
        }
        return await this.getFullCards(loot)
    }

    private async getFullCards(items: IUserLootItem[]) {
        const cards = (await this.database.getStorage()).ccg
        const userCards = new Array<CCGCard>()
        for (const item of items) {
            const series = cards[item.series] as CCGCard[]
            userCards.push(series.find((card) => card.id === item.name))
        }
        return userCards
    }

    private setFilter(interaction: BtnInteraction, editor: DeckEditor) {
        const filter = interaction.customId.split(';')[2]
        if (Object.values(ItemRarity).includes(filter as ItemRarity)) {
            const index = editor.rarityFilters.findIndex((rarity) => rarity === filter)
            if (index >= 0) editor.rarityFilters.splice(index, 1)
            else editor.rarityFilters.push(filter as ItemRarity)
        } else if (Object.values(CCGCardType).includes(filter as CCGCardType)) {
            const index = editor.typeFilters.findIndex((type) => type === filter)
            if (index >= 0) editor.typeFilters.splice(index, 1)
            else editor.typeFilters.push(filter as CCGCardType)
        } else if (Object.values(UsageFilter).includes(filter as UsageFilter)) {
            const index = editor.usageFilters.findIndex((usage) => usage === filter)
            if (index >= 0) editor.usageFilters.splice(index, 1)
            else editor.usageFilters.push(filter as UsageFilter)
        }
        this.updateFilterButtons(editor)
        this.filterCards(editor)
        editor.page = 1
        this.updateCardView(editor, interaction.user.id)
    }

    private updateFilterButtons(editor: DeckEditor) {
        editor.deckInfo.container.replaceComponent('typeFilters', typeFilters(editor))
        editor.deckInfo.container.replaceComponent('rarityFilters', rarityFilters(editor))
        editor.deckInfo.container.replaceComponent('usageFilters', usageFilters(editor))
        editor.deckInfo.message.edit({ components: [editor.deckInfo.container.container] })
    }

    private filterCards(editor: DeckEditor) {
        editor.filteredCards = structuredClone(editor.userCards).filter(
            (card) =>
                ((editor.typeFilters.length ?? 0) === 0 || editor.typeFilters.includes(card.type)) &&
                ((editor.rarityFilters.length ?? 0) === 0 || editor.rarityFilters.includes(card.rarity)) &&
                ((editor.usageFilters.length ?? 0) === 0 || this.checkUsageFilter(editor, card))
        )
    }

    private checkUsageFilter(editor: DeckEditor, card: CCGCard) {
        return (
            (editor.usageFilters.includes(UsageFilter.Used) && editor.deck.cards.some((instance) => instance.id === card.id)) ||
            (editor.usageFilters.includes(UsageFilter.Unused) && !editor.deck.cards.some((instance) => instance.id === card.id))
        )
    }

    private async updateCardAmount(interaction: BtnInteraction, editor: DeckEditor) {
        const cardId = interaction.customId.split(';')[2]
        const card = editor.filteredCards.find((card) => card.id === cardId)
        const changeValue = interaction.customId.split(';')[3] === 'more' ? 1 : -1
        const existingCard = editor.deck.cards.findIndex((card) => card.id === cardId)
        if (existingCard >= 0) editor.deck.cards[existingCard].amount = editor.deck.cards[existingCard].amount + changeValue
        else editor.deck.cards.push({ id: cardId, series: card.series, amount: 1, rarity: card.rarity })
        editor.deck.cards = editor.deck.cards.filter((card) => card.amount > 0)
        editor.saved = false
        await this.validateDeck(editor)
        this.updateDeckInfo(editor)
        this.updateCardView(editor, interaction.user.id)
    }

    private async validateDeck(editor: DeckEditor) {
        const user = await this.database.getUser(editor.userId)
        editor.deck.valid = true
        editor.validationErrors = new Array<string>()
        await CCGValidator.validateDeck(this.client, user, editor.deck, editor.validationErrors)
    }

    private updateCardPage(interaction: BtnInteraction, editor: DeckEditor) {
        const pageChange = interaction.customId.split(';')[2] === 'next' ? 1 : -1
        const totalPages = Math.ceil(editor.filteredCards.length / GameValues.ccg.deck.cardsPerPage)
        editor.page = this.mod(editor.page + pageChange - 1, totalPages) + 1
        this.updateCardView(editor, interaction.user.id)
    }

    private mod(n: number, m: number): number {
        return ((n % m) + m) % m
    }

    private updateDeckInfo(editor: DeckEditor) {
        editor.deckInfo.container = this.newDeckInfoContainer(editor)
        editor.deckInfo.message.edit({ components: [editor.deckInfo.container.container] })
    }

    private async updateCardView(editor: DeckEditor, userId: string) {
        const user = await this.database.getUser(userId)
        editor.cardView.container = await this.newCardViewContainer(editor, user)
        editor.cardView.message.edit({ components: [editor.cardView.container.container], files: editor.cardView.attachments })
    }

    private async renameDeck(interaction: ChatInteraction) {
        const deckChoice = interaction.options.get('deck')?.value as string
        const newDeckName = interaction.options.get('name')?.value as string
        const user = await this.database.getUser(interaction.user.id)
        if (user.ccg?.decks?.some((deck) => deck.name === newDeckName))
            return this.messageHelper.replyToInteraction(interaction, `Du har allerede en deck med navnet ${newDeckName}`, { ephemeral: true })
        user.ccg.decks = user.ccg?.decks?.map((deck) => (deck.name === deckChoice ? { ...deck, name: newDeckName } : deck))
        this.database.updateUser(user)
        this.messageHelper.replyToInteraction(interaction, `Endret navn på deck **${deckChoice}**, til **${newDeckName}**`, { ephemeral: true })
    }

    private async copyDeck(interaction: ChatInteraction) {
        const deckChoice = interaction.options.get('deck')?.value as string
        const newDeckName = interaction.options.get('name')?.value as string
        const user = await this.database.getUser(interaction.user.id)
        if (user.ccg?.decks?.some((deck) => deck.name === newDeckName))
            return this.messageHelper.replyToInteraction(interaction, `Du har allerede en deck med navnet ${newDeckName}`, { ephemeral: true })
        const toCopy = user.ccg?.decks?.find((deck) => deck.name === deckChoice)
        if (!toCopy) return this.messageHelper.replyToInteraction(interaction, `Du har ingen deck med navnet ${deckChoice}`, { ephemeral: true })
        const newDeck: ICCGDeck = { ...structuredClone(toCopy), name: newDeckName, active: false }
        user.ccg.decks.push(newDeck)
        this.database.updateUser(user)
        this.messageHelper.replyToInteraction(interaction, `Laget kopi av deck **${deckChoice}** med nytt navn **${newDeckName}**`, { ephemeral: true })
    }

    private deleteDeck(interaction: ChatInteraction) {
        const deckChoice = interaction.options.get('deck')?.value as string
        const deleteBtn = deleteDeckButton(interaction.user.id, deckChoice)
        this.messageHelper.replyToInteraction(interaction, `Er du sikker på at du vil slette **${deckChoice}**?`, undefined, [deleteBtn])
    }

    private async confirmDeleteDeck(interaction: BtnInteraction) {
        if (interaction.user.id !== interaction.customId.split(';')[1]) return interaction.deferUpdate()
        await interaction.message.delete()
        const user = await this.database.getUser(interaction.user.id)
        const deckToDelete = interaction.customId.split(';')[2]
        user.ccg.decks = user.ccg?.decks?.filter((deck) => deck.name !== deckToDelete)
        this.database.updateUser(user)
        this.messageHelper.replyToInteraction(interaction, `**${deckToDelete}** er slettet`, { ephemeral: true })
    }

    private async saveDeck(interaction: BtnInteraction, editor: DeckEditor) {
        const user = await this.database.getUser(interaction.user.id)
        if (user.ccg?.decks?.some((deck) => deck.name === editor.deck.name)) {
            user.ccg.decks = user.ccg.decks.map((deck) => (deck.name === editor.deck.name ? editor.deck : deck))
        } else {
            user.ccg = { ...user.ccg, decks: user.ccg?.decks ?? new Array<ICCGDeck>() }
            user.ccg.decks = user.ccg?.decks ?? new Array<ICCGDeck>()
            user.ccg.decks.push(editor.deck)
        }
        this.database.updateUser(user)
        editor.saved = true
        this.updateDeckInfo(editor)
    }

    private closeDeck(editor: DeckEditor) {
        editor.deckInfo.message.delete()
        editor.cardView.message.delete()
    }

    private async autocompleteDeck(interaction: ATCInteraction) {
        const user = await this.database.getUser(interaction.user.id)
        const response = user.ccg?.decks?.map((deck) => ({ name: `${deck.name} ${deck.active ? '(aktiv)' : ''}`, value: deck.name }))
        interaction.respond(response ?? [{ name: 'no decks found', value: 'NO_DECK_FOUND' }])
    }

    private executeSubCommand(interaction: ChatInteraction) {
        const cmd = interaction.options.getSubcommand()
        const deck = interaction.options.get('deck')?.value as string
        if (deck && deck === 'NO_DECK_FOUND') return this.messageHelper.replyToInteraction(interaction, 'Ugyldig deck.', { ephemeral: true })
        if (cmd === 'set') this.setDeck(interaction)
        else if (cmd === 'new') this.newDeck(interaction)
        else if (cmd === 'edit') this.editDeck(interaction)
        else if (cmd === 'copy') this.copyDeck(interaction)
        else if (cmd === 'rename') this.renameDeck(interaction)
        else if (cmd === 'delete') this.deleteDeck(interaction)
    }

    private verifyUserAndCallMethod(interaction: BtnInteraction, callback: (editor: DeckEditor) => void) {
        const editorId = interaction.customId.split(';')[1]
        const editor = this.editors.get(editorId)
        if (editor && editor.userId === interaction.user.id) {
            interaction.deferUpdate()
            callback(editor)
        } else this.messageHelper.replyToInteraction(interaction, 'nei', { ephemeral: true })
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'deck',
                        command: (interaction: ChatInteraction) => {
                            this.executeSubCommand(interaction)
                        },
                        autoCompleteCallback: (interaction: ATCInteraction) => {
                            this.autocompleteDeck(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'DECK_CARD',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (editor) => this.updateCardAmount(interaction, editor))
                        },
                    },
                    {
                        commandName: 'DECK_FILTER',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (editor) => this.setFilter(interaction, editor))
                        },
                    },
                    {
                        commandName: 'DECK_PAGE',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (editor) => this.updateCardPage(interaction, editor))
                        },
                    },
                    {
                        commandName: 'DECK_SAVE',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (editor) => this.saveDeck(interaction, editor))
                        },
                    },
                    {
                        commandName: 'DECK_CLOSE',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (editor) => this.closeDeck(editor))
                        },
                    },
                    {
                        commandName: 'DECK_ACTIVATE',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (editor) => this.activateCurrentDeck(interaction, editor))
                        },
                    },
                    {
                        commandName: 'DECK_DELETE',
                        command: (interaction: ButtonInteraction) => {
                            this.confirmDeleteDeck(interaction)
                        },
                    },
                ],
            },
        }
    }
}

const usageFilters = (editor: DeckEditor) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        filterButton(editor.id, UsageFilter.Used, editor.usageFilters?.includes(UsageFilter.Used)),
        filterButton(editor.id, UsageFilter.Unused, editor.usageFilters?.includes(UsageFilter.Unused))
    )
}

const seriesFilters = (editor: DeckEditor) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        GameValues.ccg.activeCCGseries.map((series) => {
            return filterButton(editor.id, series as CCGSeries, editor.seriesFilters?.includes(series as CCGSeries))
        })
    )
}

const typeFilters = (editor: DeckEditor) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        filterButton(editor.id, CCGCardType.Attack, editor.typeFilters?.includes(CCGCardType.Attack)),
        filterButton(editor.id, CCGCardType.Shield, editor.typeFilters?.includes(CCGCardType.Shield)),
        filterButton(editor.id, CCGCardType.Heal, editor.typeFilters?.includes(CCGCardType.Heal)),
        filterButton(editor.id, CCGCardType.Effect, editor.typeFilters?.includes(CCGCardType.Effect))
    )
}

const rarityFilters = (editor: DeckEditor) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        filterButton(editor.id, ItemRarity.Common, editor.rarityFilters?.includes(ItemRarity.Common)),
        filterButton(editor.id, ItemRarity.Rare, editor.rarityFilters?.includes(ItemRarity.Rare)),
        filterButton(editor.id, ItemRarity.Epic, editor.rarityFilters?.includes(ItemRarity.Epic)),
        filterButton(editor.id, ItemRarity.Legendary, editor.rarityFilters?.includes(ItemRarity.Legendary))
    )
}

const filterButton = (editorId: string, filter: CCGCardType | ItemRarity | UsageFilter | CCGSeries, filterIsActive = false) => {
    return new ButtonBuilder({
        custom_id: `DECK_FILTER;${editorId};${filter}`,
        style: filterIsActive ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: false,
        label: filter,
        type: 2,
    })
}

const saveAndCloseButtons = (editorId: string, canSetActive: boolean) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `DECK_SAVE;${editorId}`,
            style: ButtonStyle.Success,
            disabled: false,
            label: 'Save',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `DECK_CLOSE;${editorId}`,
            style: ButtonStyle.Danger,
            disabled: false,
            label: 'Close',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `DECK_ACTIVATE;${editorId}`,
            style: ButtonStyle.Primary,
            disabled: !canSetActive,
            label: 'Set as active deck',
            type: 2,
        })
    )
}

const deleteDeckButton = (userId: string, deckName: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `DECK_DELETE;${userId};${deckName}`,
            style: ButtonStyle.Danger,
            disabled: false,
            label: 'Bekreft',
            type: 2,
        })
    )
}

const ccgDeckCardAmount = (editorId: string, cardId: string, available: number, inDeck: number) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `DECK_CARD;${editorId};${cardId};less`,
            style: ButtonStyle.Danger,
            disabled: inDeck === 0,
            label: '-',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `DECK_CARD;${editorId};${cardId};more`,
            style: ButtonStyle.Success,
            disabled: available <= inDeck,
            label: '+',
            type: 2,
        })
    )
}

const pageButtons = (editor: DeckEditor) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `DECK_PAGE;${editor.id};previous`,
            style: ButtonStyle.Secondary,
            disabled: false,
            label: 'Previous',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `DECK_PAGE;${editor.id};next`,
            style: ButtonStyle.Secondary,
            disabled: false,
            label: 'Next',
            type: 2,
        })
    )
}
