import { GameValues } from '../../general/values'
import { RandomUtils } from '../../utils/randomUtils'
import { CCGCard, CCGEffectType, CCGGame, CCGPlayer, CCGTarget } from './ccgInterface'

export class BotResolver {
    constructor() {}
    public chooseBotCards(game: CCGGame): boolean {
        const bot = game.player2

        // Check if bot should mulligan before selecting cards
        if (this.shouldMulligan(game, bot)) {
            this.selectCardsToDiscard(game, bot)
            return true // returning true indicates bot is discarding
        }

        const playable = bot.hand.filter((card) => !!card).map((card) => ({ card: card, score: 1 }))
        this.buffCardsOfType(playable, 'DAMAGE', 1, 'OPPONENT')
        this.checkLethal(game, playable)
        this.checkSurvival(game, playable)
        this.checkReflect(game, playable)
        this.checkSteal(game, playable)
        this.checkRemoveStatus(game, playable)
        this.sortPlayable(playable)
        this.checkGainEnergy(game, playable)
        this.sortPlayable(playable)

        if (this.shouldSaveEnergy(game, playable)) {
            bot.submitted = true
            return false // returning false indicates bot is playing cards (or passing)
        } else this.selectCards(game, bot, playable)

        return false // returning false indicates bot is playing cards
    }

    /**
     * Determines if the bot should discard cards (mulligan)
     * Returns true if:
     * - Bot has 0-1 energy
     * - Fewer than 2 cards in hand are playable with current energy
     */
    private shouldMulligan(game: CCGGame, bot: CCGPlayer): boolean {
        // Only consider mulligan if energy is very low
        if (bot.energy > 1) return false

        const hand = bot.hand.filter((card) => !!card)
        if (hand.length < 2) return false

        // Count how many cards are playable with current energy
        const playableCount = hand.filter((card) => this.getCardCost(game, card) <= bot.energy).length

        // Mulligan if fewer than 2 cards are playable
        return playableCount < 2
    }

    /**
     * Selects cards to discard, prioritizing:
     * 1. High-cost cards (3+ energy)
     * 2. Cards without immediate energy generation
     * 3. Keeping at least 1-2 cards to avoid discarding everything
     */
    private selectCardsToDiscard(game: CCGGame, bot: CCGPlayer) {
        const hand = bot.hand.filter((card) => !!card)

        // Score cards based on what we want to keep vs discard
        const scoredCards = hand.map((card) => {
            let discardScore = 0
            const cost = this.getCardCost(game, card)

            // Prioritize discarding high-cost cards
            if (cost >= 3) discardScore += 3
            else if (cost === 2) discardScore += 2
            else discardScore += 1

            // Keep energy-generating cards (negative score = less likely to discard)
            const hasImmediateEnergy = card.effects?.some((effect) => effect.type === 'GAIN_ENERGY' && effect.target === 'SELF' && (effect.turns ?? 0) === 0)
            if (hasImmediateEnergy) discardScore -= 10

            // Keep low-cost cards that might become playable
            if (cost <= 1) discardScore -= 2

            return { card, discardScore }
        })

        // Sort by discard score (highest = most likely to discard)
        scoredCards.sort((a, b) => b.discardScore - a.discardScore)

        // Discard 1-3 cards depending on hand size, but keep at least 1-2 cards
        const numToDiscard = Math.min(Math.max(1, Math.floor(hand.length / 2)), hand.length - 1)

        for (let i = 0; i < numToDiscard; i++) {
            scoredCards[i].card.selected = true
        }

        bot.submitted = true
    }

    private selectCards(game: CCGGame, bot: CCGPlayer, playable: { card: CCGCard; score: number }[]) {
        let energy = bot.energy
        let selected = 0
        for (const { card, score } of playable) {
            const cost = this.getCardCost(game, card)
            if (selected < GameValues.ccg.gameSettings.maxCardsPlayed && cost <= energy && score > 0) {
                selected += 1
                card.selected = true
                energy -= cost
            }
        }
        bot.submitted = true
    }

    private shouldSaveEnergy(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        return !playable.some(({ card }) => this.getCardCost(game, card) <= game.player2.energy)
    }

    private sortPlayable(playable: { card: CCGCard; score: number }[]) {
        playable.sort((a, b) => b.card.cost + b.score - (a.card.cost + a.score))
    }

    private checkLethal(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        playable.sort((a, b) => (this.getAttackEffect(b.card)?.value ?? 0) - (this.getAttackEffect(a.card)?.value ?? 0))
        for (let i = 0; i < playable.length; i++) {
            const card = playable[i].card
            const cost = this.getCardCost(game, card)
            const attack = this.getAttackEffect(card)
            if (attack) {
                if (attack.value >= game.player1.hp && cost <= game.player2.energy) {
                    playable[i].score += 10
                    return
                } else {
                    for (let y = i; y < playable.length; y++) {
                        const card2 = playable[y].card
                        const cost2 = this.getCardCost(game, card2)
                        const attack2 = this.getAttackEffect(card2)
                        if (attack2 && attack2.value + attack.value >= game.player1.hp && cost + cost2 <= game.player2.energy) {
                            playable[i].score += 10
                            playable[y].score += 10
                            return
                        }
                    }
                }
            }
        }
    }

    private getAttackEffect(card: CCGCard) {
        return card.effects?.find((effect) => effect.type === 'DAMAGE' && effect.target === 'OPPONENT')
    }

    private checkSurvival(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        if (game.player2.hp <= RandomUtils.getRandomInteger(7, 12) && game.player2.hp > 5) {
            this.buffCardsOfType(playable, 'HEAL', 5, 'SELF')
        } else if (game.player2.hp <= 5) {
            this.buffCardsOfType(playable, 'HEAL', 8, 'SELF')
        } else if (game.player2.hp >= GameValues.ccg.gameSettings.startingHP - 3) {
            this.buffCardsOfType(playable, 'HEAL', -10, 'SELF')
        }
    }

    private checkGainEnergy(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        if (this.shouldSaveEnergy(game, playable)) {
            this.buffCardsOfType(playable, 'GAIN_ENERGY', 50, 'SELF', true)
        } else if (game.player2.energy < 4) {
            this.buffCardsOfType(playable, 'GAIN_ENERGY', 5, 'SELF', true)
        }
    }

    private checkRemoveStatus(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const hasStatusConditions = game.state.statusConditions.some((condition) => condition.ownerId === game.player2.id && condition.remainingTurns > 1)
        if (hasStatusConditions) {
            this.buffCardsOfType(playable, 'REMOVE_STATUS', 7, 'SELF')
        }
    }

    private checkReflect(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        if (game.player1.energy > 2) {
            this.buffCardsOfType(playable, 'REFLECT', 5, 'SELF')
        }
    }

    private checkSteal(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const lastCard = game.player1.usedCards[game.player1.usedCards.length - 1]
        if (lastCard && lastCard.id === 'kms2') {
            this.buffCardsOfType(playable, 'STEAL_CARD', 5, 'OPPONENT')
        }
    }

    private buffCardsOfType(
        playable: { card: CCGCard; score: number }[],
        type: CCGEffectType,
        buffAmount: number,
        target: CCGTarget,
        immediate: boolean = false
    ) {
        for (const card of playable) {
            if (card.card.effects?.some((effect) => effect.type === type && effect.target === target && (!immediate || (effect.turns ?? 0) === 0))) {
                card.score += buffAmount
            }
        }
    }

    private getCardCost(game: CCGGame, card: CCGCard) {
        const costReductionEffects = game.state.statusEffects.filter((effect) => effect.ownerId === game.player2.id && effect.type === 'REDUCE_COST')
        const botCostReduction = costReductionEffects.reduce((sum, effect) => (sum += effect.value), 0)
        return Math.max(0, card.cost - botCostReduction)
    }
}
