import { GameValues } from '../../general/values'
import { RandomUtils } from '../../utils/randomUtils'
import { CCGCard, CCGCondition, CCGEffectType, CCGGame, CCGPlayer, CCGStatusEffectType, CCGTarget, Difficulty } from './ccgInterface'

export class BotResolver {
    constructor() {}
    public chooseBotCards(game: CCGGame): boolean {
        const bot = game.player2
        const difficulty = this.getDifficultyLevel(game)

        // Check if bot should mulligan before selecting cards
        if (this.shouldMulligan(game, bot)) {
            this.selectCardsToDiscard(game, bot)
            return true // returning true indicates bot is discarding
        }

        const playable = bot.hand.filter((card) => !!card).map((card) => ({ card: card, score: 1 }))
        this.buffCardsOfType(playable, ['DAMAGE', 'DAMAGE_PER_IDENTIFIER', 'DAMAGE_PER_CARD_PLAYED', 'SHOOT'], 2, 'OPPONENT')
        this.checkLethal(game, playable)
        this.checkSurvival(game, playable)
        this.checkRemoveStatus(game, playable)
        this.sortPlayable(playable)
        this.checkGainEnergy(game, playable)
        this.sortPlayable(playable)
        if (difficulty >= 1) {
            this.applyConditionAwareness(game, playable)
            this.checkPlayOrderSynergies(game, playable)
            this.sortPlayable(playable)
        }
        if (difficulty >= 2) {
            this.checkOpponentHand(game, playable)
            this.sortPlayable(playable)
        }

        this.selectCards(game, bot, playable)
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

    private sortPlayable(playable: { card: CCGCard; score: number }[]) {
        playable.sort((a, b) => b.card.cost + b.score - (a.card.cost + a.score))
    }

    private checkLethal(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        playable.sort((a, b) => this.getCardDamageEstimate(b.card) - this.getCardDamageEstimate(a.card))
        for (let i = 0; i < playable.length; i++) {
            const card = playable[i].card
            const cost = this.getCardCost(game, card)
            const dmg = this.getCardDamageEstimate(card)
            if (dmg > 0) {
                if (dmg >= game.player1.hp && cost <= game.player2.energy) {
                    playable[i].score += 10
                    return
                } else {
                    for (let y = i + 1; y < playable.length; y++) {
                        const card2 = playable[y].card
                        const cost2 = this.getCardCost(game, card2)
                        const dmg2 = this.getCardDamageEstimate(card2)
                        if (dmg2 > 0 && dmg2 + dmg >= game.player1.hp && cost + cost2 <= game.player2.energy) {
                            playable[i].score += 10
                            playable[y].score += 10
                            return
                        }
                    }
                }
            }
        }
    }

    /** Estimates the heal a card provides to self. Used for waste detection in checkSurvival. */
    private getCardHealEstimate(card: CCGCard): number {
        return (card.effects ?? []).filter((e) => e.type === 'HEAL' && e.target === 'SELF').reduce((sum, e) => sum + (e.value ?? 0), 0)
    }

    /** Estimates the damage a card deals to the opponent, used for lethal detection and sorting.
     *  SHOOT uses expected value (value × shots × accuracy). Variable-damage types use their base. */
    private getCardDamageEstimate(card: CCGCard): number {
        return (card.effects ?? [])
            .filter((e) => e.target === 'OPPONENT')
            .reduce((sum, e) => {
                if (e.type === 'DAMAGE') return sum + (e.value ?? 0)
                if (e.type === 'SHOOT') return sum + Math.floor((e.value ?? 0) * (e.amount ?? 1) * ((e.accuracy ?? 100) / 100))
                if (e.type === 'DAMAGE_PER_CARD_PLAYED' || e.type === 'DAMAGE_PER_IDENTIFIER') return sum + (e.base ?? 0)
                return sum
            }, 0)
    }

    private checkSurvival(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const bot = game.player2
        const maxHP = GameValues.ccg.gameSettings.startingHP
        const room = maxHP - bot.hp

        // HP urgency: boost heals when low
        if (bot.hp <= RandomUtils.getRandomInteger(7, 12) && bot.hp > 5) {
            this.buffCardsOfType(playable, 'HEAL', 5, 'SELF')
        } else if (bot.hp <= 5) {
            this.buffCardsOfType(playable, 'HEAL', 8, 'SELF')
        }

        // Per-card waste check: penalize only when the heal would be mostly or fully wasted
        for (const item of playable) {
            const healValue = this.getCardHealEstimate(item.card)
            if (healValue <= 0) continue
            if (room <= 0) {
                item.score -= 8 // already at max HP — entirely wasted
            } else if (healValue > room) {
                const wasteFraction = (healValue - room) / healValue
                if (wasteFraction >= 0.5) {
                    item.score -= 4 // more than half wasted
                }
                // less than half wasted — still meaningful, no penalty
            }
        }
    }

    private checkGainEnergy(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        // Energy cards are almost always worth playing; boost harder when running low
        const boost = game.player2.energy < 5 ? 8 : 4
        this.buffCardsOfType(playable, 'GAIN_ENERGY', boost, 'SELF')
    }

    private checkRemoveStatus(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const damagingTypes: CCGStatusEffectType[] = ['BLEED', 'SHOCK']
        const botConditions = game.state.statusConditions.filter((c) => c.ownerId === game.player2.id && c.remainingTurns > 1)
        if (botConditions.length === 0) return

        const hasDamagingStatus = botConditions.some((c) => damagingTypes.includes(c.type as CCGStatusEffectType))
        this.buffCardsOfType(playable, 'REMOVE_STATUS', hasDamagingStatus ? 10 : 5, 'SELF')
    }

    private checkSteal(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const lastCard = game.player1.usedCards[game.player1.usedCards.length - 1]
        if (lastCard && lastCard.id === 'kms2') {
            this.buffCardsOfType(playable, 'STEAL_CARD', 5, 'OPPONENT')
        }
    }

    private buffCardsOfType(
        playable: { card: CCGCard; score: number }[],
        type: CCGEffectType | CCGEffectType[],
        buffAmount: number,
        target: CCGTarget,
        immediate: boolean = false
    ) {
        const types = Array.isArray(type) ? type : [type]
        for (const card of playable) {
            if (card.card.effects?.some((effect) => types.includes(effect.type) && effect.target === target && (!immediate || (effect.turns ?? 0) === 0))) {
                card.score += buffAmount
            }
        }
    }

    /**
     * Hard mode: reads the player's actual hand to make precise counter-play decisions.
     * Check 1 — Pre-emptive block: if player can deal significant damage, boost NEUTRALIZE_ATTACK / REFLECT.
     * Check 2 — Don't play into neutralise: if player holds NEUTRALIZE_ATTACK they can afford, downgrade bot's top attack.
     * Check 3 — Race vs tank: if player's max affordable damage >= bot HP, shift to full survival.
     * Check 4 — Identifier counter-play: boost bot cards whose OPPONENT-target condition matches player's held identifiers.
     */
    private checkOpponentHand(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const player = game.player1
        const bot = game.player2
        const playerHand = player.hand.filter((c) => !!c)
        const playerAffordableDamage = this.getPlayerAffordableDamage(game)

        // Check 1: pre-emptive block — player is sitting on a big hit
        if (playerAffordableDamage >= 6) {
            this.buffCardsOfType(playable, 'NEUTRALIZE_ATTACK', 8, 'OPPONENT')
            this.buffCardsOfType(playable, 'REFLECT', 6, 'SELF')
        } else if (playerAffordableDamage >= 3) {
            this.buffCardsOfType(playable, 'NEUTRALIZE_ATTACK', 4, 'OPPONENT')
        }

        // Check 2: don't swing into a neutralise — player holds one and can afford it
        const playerHasNeutralise = playerHand.some((c) => c.effects?.some((e) => e.type === 'NEUTRALIZE_ATTACK') && c.cost <= player.energy)
        if (playerHasNeutralise) {
            // Downgrade the bot's highest-damage affordable card to discourage the obvious big swing
            const bigAttack = playable
                .filter((p) => this.getCardDamageEstimate(p.card) >= 4 && this.getCardCost(game, p.card) <= bot.energy)
                .sort((a, b) => this.getCardDamageEstimate(b.card) - this.getCardDamageEstimate(a.card))[0]
            if (bigAttack) bigAttack.score -= 5
        }

        // Check 3: race vs tank — if player can kill bot this turn, shift to full survival
        if (playerAffordableDamage >= bot.hp) {
            this.buffCardsOfType(playable, 'HEAL', 6, 'SELF')
            this.buffCardsOfType(playable, 'SHIELD', 6, 'SELF')
            this.buffCardsOfType(playable, 'NEUTRALIZE_ATTACK', 4, 'OPPONENT') // stacks with check 1
        }

        // Check 4: identifier counter-play — boost bot cards whose bonus damage condition
        // triggers on identifiers the player is actually holding this turn
        const playerIdentifiers = new Set(playerHand.flatMap((c) => c.identifier ?? []))
        for (const item of playable) {
            for (const effect of item.card.effects ?? []) {
                if (effect.condition?.type !== 'PLAYED_CARD_IDENTIFIER') continue
                if (effect.condition.target !== 'OPPONENT') continue
                if (effect.condition.invert) continue // skip fallback branches
                if (effect.condition.identifier && playerIdentifiers.has(effect.condition.identifier)) {
                    item.score += 4 // bonus damage condition is likely to fire
                }
            }
        }
    }

    /** Returns the total damage the player can afford to deal this turn from their hand. */
    private getPlayerAffordableDamage(game: CCGGame): number {
        return game.player1.hand.filter((c) => !!c && c.cost <= game.player1.energy).reduce((sum, c) => sum + this.getCardDamageEstimate(c), 0)
    }

    private getDifficultyLevel(game: CCGGame): 0 | 1 | 2 {
        switch (game.botDifficulty) {
            case Difficulty.Easy:
                return 0
            case Difficulty.Hard:
                return 2
            default:
                return 1 // Medium or unset
        }
    }

    private getCardCost(game: CCGGame, card: CCGCard) {
        const costReductionEffects = game.state.statusEffects.filter((effect) => effect.ownerId === game.player2.id && effect.type === 'REDUCE_COST')
        const botCostReduction = costReductionEffects
            .filter((e) => !e.identifier || card.identifier?.includes(e.identifier))
            .reduce((sum, effect) => (sum += effect.value), 0)
        return Math.max(0, card.cost - botCostReduction)
    }

    /**
     * Evaluates a condition against the current game state.
     * Returns null for conditions that depend on which cards are played this turn
     * (PLAYED_CARD_ID, PLAYED_CARD_IDENTIFIER, NUM_CARDS_PLAYED, PLAYED_EFFECT_TYPE)
     * since card selection hasn't been committed yet.
     */
    private evaluateConditionNow(game: CCGGame, condition: CCGCondition): boolean | null {
        const subject = condition.target === 'OPPONENT' ? game.player1 : game.player2
        let result: boolean
        switch (
            condition.type // Julia was here
        ) {
            case 'ALWAYS':
                result = true
                break
            case 'HP_BELOW':
                result = subject.hp < (condition.value ?? 0)
                break
            case 'HP_ABOVE':
                result = subject.hp > (condition.value ?? 0)
                break
            case 'ENERGY_BELOW':
                result = subject.energy < (condition.value ?? 0)
                break
            case 'ENERGY_ABOVE':
                result = subject.energy > (condition.value ?? 0)
                break
            case 'HAS_STATUS':
                result = game.state.statusConditions.some((s) => s.ownerId === subject.id && s.type === condition.status)
                break
            case 'NOT_HAS_STATUS':
                result = !game.state.statusConditions.some((s) => s.ownerId === subject.id && s.type === condition.status)
                break
            case 'BUILD_DEATHSTAR':
                result = game.state.statusConditions.some((s) => s.ownerId === subject.id && s.type === 'BUILD_DEATHSTAR')
                break
            case 'RANDOM':
            case 'PLAYED_CARD_ID':
            case 'PLAYED_CARD_IDENTIFIER':
            case 'PLAYED_EFFECT_TYPE':
            case 'NUM_CARDS_PLAYED':
            default:
                return null // unknowable at card selection time
        }
        return condition.invert ? !result : result
    }

    /**
     * Sets score to 0 for cards where every effect has a condition and all evaluatable
     * conditions are definitively false — i.e. the card will do nothing this turn.
     * Cards with any unconditional effect, any true condition, or any play-order-dependent
     * condition (which can't be known yet) are left unchanged.
     */
    private applyConditionAwareness(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        for (const item of playable) {
            const effects = item.card.effects ?? []
            if (effects.length === 0) continue
            // At least one unconditional effect — card always does something
            if (effects.some((e) => !e.condition)) continue

            let anyDefinitelyFires = false
            let anyUnknowable = false
            for (const effect of effects) {
                const result = this.evaluateConditionNow(game, effect.condition!)
                if (result === null) {
                    anyUnknowable = true
                } else if (result === true) {
                    anyDefinitelyFires = true
                }
            }

            // Only suppress if we're certain nothing fires and nothing is unknowable
            if (!anyDefinitelyFires && !anyUnknowable) {
                item.score = 0
            }
        }
    }

    /**
     * Boosts cards whose play-order conditional bonuses (PLAYED_CARD_IDENTIFIER / PLAYED_CARD_ID)
     * can actually be satisfied by the bot's current affordable hand.
     * Only considers SELF-target conditions — opponent-based synergies are uncontrollable.
     * Also nudges the enabler cards that make the synergy possible.
     */
    private checkPlayOrderSynergies(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const botEnergy = game.player2.energy

        for (const item of playable) {
            for (const effect of item.card.effects ?? []) {
                const condition = effect.condition
                if (!condition || condition.invert) continue // skip no-condition or fallback (inverted) branches
                if (condition.target !== 'SELF') continue // opponent-based synergies are uncontrollable

                if (condition.type === 'PLAYED_CARD_IDENTIFIER' && condition.identifier) {
                    const required = condition.value ?? 1
                    // Cards in hand that carry the required identifier, cheapest first
                    const candidates = playable
                        .filter((p) => p.card.identifier?.includes(condition.identifier!))
                        .sort((a, b) => this.getCardCost(game, a.card) - this.getCardCost(game, b.card))
                    if (!this.synergySatisfied(candidates.length, condition.comparator, required)) continue
                    // Check we can afford the cheapest `required` of them together
                    const totalCost = candidates.slice(0, required).reduce((sum, p) => sum + this.getCardCost(game, p.card), 0)
                    if (totalCost > botEnergy) continue

                    item.score += 3
                    // Nudge the enabling cards — they're what unlocks this bonus
                    for (const enabler of candidates.slice(0, required)) {
                        if (enabler !== item) enabler.score += 2
                    }
                }

                if (condition.type === 'PLAYED_CARD_ID' && condition.cardId) {
                    const required = condition.value ?? 2
                    // Copies of the required card in hand, cheapest first
                    const copies = playable
                        .filter((p) => p.card.id === condition.cardId)
                        .sort((a, b) => this.getCardCost(game, a.card) - this.getCardCost(game, b.card))
                    if (!this.synergySatisfied(copies.length, condition.comparator, required)) continue
                    const totalCost = copies.slice(0, required).reduce((sum, p) => sum + this.getCardCost(game, p.card), 0)
                    if (totalCost > botEnergy) continue

                    item.score += 3
                    for (const copy of copies.slice(0, required)) {
                        if (copy !== item) copy.score += 2
                    }
                }
            }
        }
    }

    private synergySatisfied(count: number, comparator: CCGCondition['comparator'], value: number): boolean {
        switch (comparator) {
            case '<':
                return count < value
            case '<=':
                return count <= value
            case '==':
                return count === value
            case '!=':
                return count !== value
            case '>=':
                return count >= value
            case '>':
                return count > value
            default:
                return count >= value
        }
    }
}
