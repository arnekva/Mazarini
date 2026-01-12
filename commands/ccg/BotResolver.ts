import { GameValues } from '../../general/values'
import { RandomUtils } from '../../utils/randomUtils'
import { CCGCard, CCGEffectType, CCGGame, CCGPlayer, CCGTarget } from './ccgInterface'

export class BotResolver {
    constructor() {}

    public chooseBotCards(game: CCGGame) {
        const bot = game.player2
        const playable = bot.hand.map((card) => ({ card: card, score: 1 }))
        console.log('initial state:', playable)

        this.checkLethal(game, playable)
        console.log('after lethal', playable)

        this.checkSurvival(game, playable)
        console.log('after survival', playable)

        this.sortPlayable(playable)
        console.log('after sorting', playable)

        if (this.shouldSaveEnergy(game, playable)) {
            bot.submitted = true
            return
        } else this.selectCards(bot, playable)
    }

    private selectCards(bot: CCGPlayer, playable: { card: CCGCard; score: number }[]) {
        let energy = bot.energy
        let selected = 0
        for (const { card } of playable) {
            if (selected < GameValues.ccg.gameSettings.maxCardsPlayed && card.cost <= energy) {
                selected += 1
                card.selected = true
                energy -= card.cost
            }
        }
        // bot.energy = energy
        bot.submitted = true
    }

    private shouldSaveEnergy(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        return playable[0].card.cost > game.player2.energy
    }

    private sortPlayable(playable: { card: CCGCard; score: number }[]) {
        playable.sort((a, b) => b.card.cost + b.score - (a.card.cost + a.score))
    }

    private checkLethal(game: CCGGame, playable: { card: CCGCard; score: number }[]) {
        playable.sort((a, b) => (this.getAttackEffect(b.card)?.value ?? 0) - (this.getAttackEffect(a.card)?.value ?? 0))
        for (let i = 0; i < playable.length; i++) {
            const card = playable[i].card
            const attack = this.getAttackEffect(card)
            if (attack) {
                if (attack.value >= game.player1.hp && card.cost <= game.player2.energy) {
                    playable[i].score += 10
                    return
                } else {
                    for (let y = i; y < playable.length; y++) {
                        const card2 = playable[y].card
                        const attack2 = this.getAttackEffect(card2)
                        if (attack2 && attack2.value + attack.value >= game.player1.hp && card.cost + card2.cost <= game.player2.energy) {
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
        if (game.player2.hp <= RandomUtils.getRandomInteger(2, 5)) {
            this.buffCardsOfType(playable, 'HEAL', 5, 'SELF')
        }
    }

    private buffCardsOfType(playable: { card: CCGCard; score: number }[], type: CCGEffectType, buffAmount: number, target: CCGTarget) {
        for (const card of playable) {
            if (card.card.effects.some((effect) => effect.type === type && effect.target === target)) {
                card.score += buffAmount
            }
        }
    }
}
