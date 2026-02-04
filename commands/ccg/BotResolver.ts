import { GameValues } from '../../general/values'
import { RandomUtils } from '../../utils/randomUtils'
import { CCGCard, CCGEffectType, CCGGame, CCGPlayer, CCGTarget } from './ccgInterface'

export class BotResolver {
    constructor() {}

    public chooseBotCards(game: CCGGame) {
        const bot = game.player2
        const playable = bot.hand.map((card) => ({ card: card, score: 1 }))

        this.checkLethal(game, playable)
        this.checkSurvival(game, playable)
        this.sortPlayable(playable)
        this.checkRemoveStatus(game, playable)
        this.checkGainEnergy(game, playable)

        if (this.shouldSaveEnergy(game, playable)) {
            bot.submitted = true
            return
        } else this.selectCards(game, bot, playable)
    }

    private selectCards(game: CCGGame, bot: CCGPlayer, playable: { card: CCGCard; score: number }[]) {
        let energy = bot.energy
        let selected = 0
        for (const { card } of playable) {
            const cost = this.getCardCost(game, card)
            if (selected < GameValues.ccg.gameSettings.maxCardsPlayed && cost <= energy) {
                selected += 1
                card.selected = true
                energy -= cost
            }
        }
        bot.submitted = true
    }

    private shouldSaveEnergy(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const cost = this.getCardCost(game, playable[0].card)
        return cost > game.player2.energy
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
        return card.effects.find((effect) => effect.type === 'DAMAGE' && effect.target === 'OPPONENT')
    }

    private checkSurvival(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        if (game.player2.hp <= RandomUtils.getRandomInteger(4, 8)) {
            this.buffCardsOfType(playable, 'HEAL', 5, 'SELF')
        } else if (game.player2.hp >= GameValues.ccg.gameSettings.startingHP - 3) {
            this.buffCardsOfType(playable, 'HEAL', -10, 'SELF')
        }
    }

    private checkGainEnergy(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        if (this.shouldSaveEnergy(game, playable)) {
            this.buffCardsOfType(playable, 'GAIN_ENERGY', 5, 'SELF')
        }
    }

    private checkRemoveStatus(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        const hasStatusConditions = game.state.statusConditions.some((condition) => condition.ownerId === game.player2.id && condition.remainingTurns > 1)
        if (hasStatusConditions) {
            this.buffCardsOfType(playable, 'REMOVE_STATUS', 7, 'SELF')
        }
    }

    private buffCardsOfType(playable: { card: CCGCard; score: number }[], type: CCGEffectType, buffAmount: number, target: CCGTarget) {
        for (const card of playable) {
            if (card.card.effects.some((effect) => effect.type === type && effect.target === target)) {
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
