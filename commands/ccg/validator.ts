import { GameValues } from '../../general/values'
import { DeckEditorCard, ICCGDeck, ICCGSystem, ItemRarity, IUserLootItem, MazariniUser } from '../../interfaces/database/databaseInterface'
import { CCGCard, CCGEffectType } from './ccgInterface'
import { hpCCG } from './cards/hpCCG'
import { mazariniCCG } from './cards/mazariniCCG'
import { swCCG } from './cards/swCCG'

export class CCGValidator {
    public static validateDeck(user: MazariniUser, deck: ICCGDeck, validationErrors: string[]) {
        const allCards = { mazariniCCG, swCCG, hpCCG }
        return this.validateDeckWithCards(user, deck, validationErrors, allCards)
    }

    public static validateDeckWithCards(user: MazariniUser, deck: ICCGDeck, validationErrors: string[], allCards: ICCGSystem, standardOnly = false) {
        deck.valid = true
        this.validateDeckSize(deck, validationErrors)
        this.validateRarityCaps(deck, validationErrors, allCards)
        this.validateTypeCaps(deck, validationErrors, allCards)
        this.validateUserHasAllCards(user, deck, validationErrors, allCards)
        this.validateMaxDuplicates(deck, validationErrors, allCards)
        if (standardOnly) this.validateStandardSet(deck, validationErrors)
    }

    public static validateStandardSet(deck: ICCGDeck, validationErrors: string[]) {
        const allowed = GameValues.ccg.standardSeries
        const invalidCards = deck.cards.filter((card) => !allowed.includes(card.series))
        if (invalidCards.length > 0) {
            deck.valid = false
            const names = invalidCards.map((c) => c.id).join(', ')
            validationErrors.push(`:warning: Standard mode only allows cards from: ${allowed.join(', ')}. Invalid: ${names}`)
        }
    }

    public static validateUserHasAllCards(user: MazariniUser, deck: ICCGDeck, validationErrors: string[], allCards: ICCGSystem) {
        for (const card of deck.cards) {
            if (card.amount > this.getCardAmountAvailable(user, card, allCards)) {
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

    public static validateRarityCaps(deck: ICCGDeck, validationErrors: string[], allCards: ICCGSystem) {
        for (const rarity of [ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]) {
            const amount =
                deck.cards
                    ?.filter((card) => {
                        const series = allCards[card.series] as CCGCard[]
                        return series?.find((c) => c.id === card.id)?.rarity === rarity
                    })
                    .reduce((sum, instance) => sum + instance.amount, 0) ?? 0
            const limit = GameValues.ccg.deck.rarityCaps[rarity]
            if (amount > limit) {
                deck.valid = false
                validationErrors.push(`:warning: Max ${limit} card${limit > 1 ? 's' : ''} of ${rarity} quality allowed`)
            }
        }
    }

    public static validateMaxDuplicates(deck: ICCGDeck, validationErrors: string[], allCards: ICCGSystem) {
        for (const card of deck.cards) {
            const series = allCards[card.series] as CCGCard[]
            const fullCard = series?.find((c) => c.id === card.id)

            if (!fullCard) continue

            const maxAllowed = fullCard.rarity === ItemRarity.Legendary ? 1 : 2

            if (card.amount > maxAllowed) {
                deck.valid = false
                const cardName = fullCard.name || card.id
                validationErrors.push(`:warning: Max ${maxAllowed} of "${cardName}" allowed per deck`)
            }
        }
    }

    public static validateTypeCaps(deck: ICCGDeck, validationErrors: string[], allCards: ICCGSystem) {
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

    public static getCardAmountAvailable(user: MazariniUser, card: CCGCard | DeckEditorCard, allCards?: ICCGSystem) {
        // Sum across every rarity bucket, not just the card's current rarity: a copy earned
        // before a rarity change (e.g. Hermione Epic -> Legendary) can still be filed under the
        // old bucket, and it's still a legitimately owned copy. Mirrors deck.ts's getCardAmountAvailable.
        const inventory = user.loot[card.series]?.inventory
        if (!inventory) return 0
        return Object.keys(inventory).reduce((sum, rarity) => {
            const match = inventory[rarity]?.items?.find((item: IUserLootItem) => item.name === card.id)
            return sum + (match?.amount ?? 0)
        }, 0)
    }

    public static cardHasEffectOfType(allCards: ICCGSystem, card: DeckEditorCard, type: CCGEffectType) {
        const series = allCards[card.series] as CCGCard[]
        const fullCard = series?.find((item) => item.id === card.id)
        return fullCard?.effects?.some((effect) => effect.type === type) ?? false
    }
}
