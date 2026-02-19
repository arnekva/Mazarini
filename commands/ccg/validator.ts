import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { DeckEditorCard, ICCGDeck, ICCGSystem, ItemRarity, IUserLootItem, MazariniUser } from '../../interfaces/database/databaseInterface'
import { CCGCard, CCGEffectType } from './ccgInterface'

export class CCGValidator {
    public static async validateDeck(client: MazariniClient, user: MazariniUser, deck: ICCGDeck, validationErrors: string[]) {
        deck.valid = true
        this.validateDeckSize(deck, validationErrors)
        this.validateRarityCaps(deck, validationErrors)
        await this.validateTypeCaps(client, deck, validationErrors)
        this.validateUserHasAllCards(user, deck, validationErrors)
        // this.validateMaxDupes?
    }

    public static validateUserHasAllCards(user: MazariniUser, deck: ICCGDeck, validationErrors: string[]) {
        for (const card of deck.cards) {
            if (card.amount > this.getCardAmountAvailable(user, card)) {
                deck.valid = false
                validationErrors.push(`:warning: You have selected too many of card ${card.id}`)
            }
        }
    }

    public static validateDeckSize(deck: ICCGDeck, validationErrors: string[]) {
        const numberOfCards = deck.cards?.reduce((sum, instance) => sum + instance.amount, 0) ?? 0
        if (numberOfCards != GameValues.ccg.deck.size) deck.valid = false
        if (numberOfCards > GameValues.ccg.deck.size) validationErrors.push(':warning: Too many cards')
    }

    public static validateRarityCaps(deck: ICCGDeck, validationErrors: string[]) {
        for (const rarity of [ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]) {
            const amount = deck.cards?.filter((card) => card.rarity === rarity).reduce((sum, instance) => sum + instance.amount, 0) ?? 0
            const limit = GameValues.ccg.deck.rarityCaps[rarity]
            if (amount > limit) {
                deck.valid = false
                validationErrors.push(`:warning: Max ${limit} card${limit > 1 ? 's' : ''} of ${rarity} quality allowed`)
            }
        }
    }

    public static async validateTypeCaps(client: MazariniClient, deck: ICCGDeck, validationErrors: string[]) {
        const allCards = (await client.database.getStorage()).ccg
        const types: CCGEffectType[] = GameValues.ccg.deck.validationTypes
        for (const type of types) {
            const amount = deck.cards?.filter((card) => this.cardHasEffectOfType(allCards, card, type)).reduce((sum, instance) => sum + instance.amount, 0) ?? 0
            const limit = GameValues.ccg.deck.typeCaps[type]
            if (amount > limit) {
                deck.valid = false
                validationErrors.push(`:warning: Max ${limit} card${limit > 1 ? 's' : ''} of ${type} type allowed`)
            }
        }
    }

    public static getCardAmountAvailable(user: MazariniUser, card: CCGCard | DeckEditorCard) {
        const inventory: IUserLootItem[] = user.loot[card.series]?.inventory[card.rarity]?.items
        return inventory?.find((item) => item.name === card.id)?.amount ?? 0
    }

    public static cardHasEffectOfType(allCards: ICCGSystem, card: DeckEditorCard, type: CCGEffectType) {
        const series = allCards[card.series] as CCGCard[]
        const fullCard = series.find((item) => item.id === card.id)
        return fullCard.effects?.some((effect) => effect.type === type) ?? false
    }
}
