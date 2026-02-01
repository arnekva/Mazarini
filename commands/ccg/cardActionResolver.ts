import { GameValues } from '../../general/values'
import { CCGEffect, CCGGame, CCGPlayer, CCGStatusEffectType, StatusEffect } from './ccgInterface'

const statusesWithEmoji: CCGStatusEffectType[] = ['CHOKESTER', 'RETARDED', 'SLOW']
export class CardActionResolver {
    constructor() {}

    public sortStack(game: CCGGame) {
        game.state.stack.sort((a, b) => b.speed - a.speed)
    }

    public async resolveSingleEffect(game: CCGGame, effect: CCGEffect) {
        const source = this.getPlayer(game, effect.sourcePlayerId)
        const target = this.getPlayer(game, effect.targetPlayerId)
        const opponent = this.getPlayer(game, source.opponentId)
        if (!effect.cardSuccessful) {
            await this.delay(3000)
            game.state.stack = game.state.stack.filter((stackedEffect) => stackedEffect.cardId !== effect.cardId)
            return this.log(game, `${effect.emoji}: ${source.name}'s ${effect.sourceCardName} failed`)
        }
        if (Math.random() > effect.accuracy / 100) {
            return
        }
        await this.delay(3000)

        switch (effect.type) {
            case 'DAMAGE':
                this.applyDamage(game, effect, source, target, effect.value ?? 0)
                break

            case 'HEAL': {
                const healed = Math.min(target.hp + effect.value, GameValues.ccg.gameSettings.startingHP) - target.hp
                target.hp += healed
                this.log(game, `${effect.emoji}: ${target.name} **heals ${healed}**`)
                break
            }
            case 'GAIN_ENERGY':
                if (effect.turns) {
                    this.applyStatusEffect(game, effect, target, 'GAIN_ENERGY')
                    this.log(game, `${effect.emoji}: ${source.name} gains **${effect.value} energy** extra for ${effect.turns} turns`)
                } else {
                    source.energy = source.energy + (effect.value ?? 1)
                    this.log(game, `${effect.emoji}: ${source.name} gains **${effect.value} energy**`)
                }
                break

            case 'LOSE_ENERGY':
                target.energy = Math.max(target.energy - (effect.value ?? 1), 0)
                this.log(game, `${effect.emoji}: ${target.name} loses **${effect.value} energy**`)
                break

            case 'SHIELD':
                this.applyStatusEffect(game, effect, target, 'SHIELD')
                this.log(game, `${effect.emoji}: ${target.name} gains **${effect.value} shield**`)
                break

            case 'REFLECT':
                this.applyStatusEffect(game, effect, target, 'REFLECT')
                this.log(game, `${effect.emoji}: ${target.name} **reflects** all damage for the remainder of the round`)
                break

            case 'REMOVE_STATUS':
                this.removeAllStatusForPlayer(game, target)
                this.log(game, `${effect.emoji}: ${target.name} has all status conditions removed`)
                break

            case 'REDUCE_COST':
                this.applyStatusEffect(game, effect, target, 'REDUCE_COST')
                this.log(
                    game,
                    `${effect.emoji}: ${target.name} **reduces the cost** of all their cards by **${effect.value}**  ${
                        effect.turns ? `for ${effect.turns} turns` : ''
                    }`
                )
                break

            case 'VIEW_HAND':
                this.applyStatusEffect(game, effect, target, 'VIEW_HAND')
                this.log(game, `${effect.emoji}: ${target.name} gains a single-use button to view ${opponent.name}'s hand`)
                break

            case 'STEAL_CARD':
                this.stealCard(game, effect, source, target)
                break

            case 'BLEED':
                this.applyStatusCondition(game, effect, target, 'BLEED')
                this.log(game, `${effect.emoji}: ${target.name} **bleeds** for **${effect.turns} turns**`)
                break

            case 'RETARDED':
                this.applyStatusCondition(game, effect, target, 'RETARDED')
                this.log(game, `${effect.emoji}: ${target.name} is **retarded** for the next **${effect.turns - 1} turns**`)
                break

            case 'SLOW':
                this.applyStatusCondition(game, effect, target, 'SLOW')
                this.log(game, `${effect.emoji}: ${target.name} is **slow** for the next **${effect.turns - 1} turns**`)
                break

            case 'CHOKESTER':
                this.applyStatusCondition(game, effect, target, 'CHOKESTER')
                this.log(game, `${effect.emoji}: ${target.name} is a **chokester** for the next **${effect.turns - 1} turns**`)
                break

            case 'CHOKE_SHIELD':
                this.applyStatusEffect(game, effect, target, 'CHOKE_SHIELD')
                this.log(game, `${effect.emoji}: ${target.name} increases the accuracy of all their cards by 20%`)
                break
        }
    }

    private applyDamage(game: CCGGame, effect: CCGEffect, source: CCGPlayer, target: CCGPlayer, amount: number) {
        let damage = amount

        // Reflect damage
        const reflect = this.getStatusEffect(game, target, 'REFLECT')
        if (reflect && damage > 0 && !(effect.reflected ?? false)) {
            // cannot reflect already reflected damage
            this.log(game, `${effect.emoji}: ${target.name} reflects ${damage} damage`)
            game.state.stack.unshift({
                cardId: effect.cardId,
                emoji: effect.emoji,
                sourceCardName: effect.sourceCardName,
                type: 'DAMAGE',
                sourcePlayerId: target.id,
                targetPlayerId: target.opponentId,
                speed: effect.speed,
                accuracy: effect.accuracy,
                cardSuccessful: true,
                value: damage,
                reflected: true,
            })
            return
        }

        // Shield
        const shield = this.getStatusEffect(game, target, 'SHIELD')
        if (shield) {
            const absorbed = Math.min(shield.value, damage)
            shield.value -= absorbed
            damage -= absorbed

            this.log(game, `${effect.emoji}: ${target.name}'s Shield absorbs ${absorbed}`)
            if (shield.value <= 0) this.removeStatus(game, shield)
        }

        if (damage > 0) {
            damage = Math.min(target.hp, damage)
            target.hp = target.hp - damage
            source.stats.damageDealt += damage
            target.stats.damageTaken += damage
            this.log(game, `${effect.emoji}: ${source.name} deals **${damage} damage** to ${target.name}`)
        }
    }

    private applyStatusEffect(game: CCGGame, effect: CCGEffect, target: CCGPlayer, type: StatusEffect['type']) {
        game.state.statusEffects.push({
            id: crypto.randomUUID().substring(0, 10),
            ownerId: target.id,
            sourcePlayerId: effect.sourcePlayerId,
            type,
            value: effect.value,
            remainingTurns: effect.turns ?? 100,
            emoji: statusesWithEmoji.includes(type) ? effect.emoji : undefined,
        })
    }

    private applyStatusCondition(game: CCGGame, effect: CCGEffect, target: CCGPlayer, type: StatusEffect['type']) {
        this.registerStatusStats(target, type)
        game.state.statusConditions.push({
            id: crypto.randomUUID().substring(0, 10),
            ownerId: target.id,
            sourcePlayerId: effect.sourcePlayerId,
            type,
            value: effect.value,
            remainingTurns: effect.turns ?? 100,
            emoji: statusesWithEmoji.includes(type) ? effect.emoji : undefined,
        })
    }

    private registerStatusStats(player: CCGPlayer, type: CCGStatusEffectType) {
        const index = player.stats.statused.findIndex((status) => status.statusName === type)
        if (index >= 0) player.stats.statused[index].amount += 1
        else player.stats.statused.push({ statusName: type, amount: 1 })
    }

    private stealCard(game: CCGGame, effect: CCGEffect, source: CCGPlayer, target: CCGPlayer) {
        const cardStolen = target.usedCards.pop()
        if (cardStolen) {
            source.deck.push(cardStolen)
            this.log(game, `${effect.emoji}: ${source.name} **steals ${cardStolen.name}** from ${target.name}'s used cards, and adds it to their deck`)
        } else {
            this.log(game, `${effect.emoji}: ${source.name}'s ${effect.sourceCardName} failed`)
        }
    }

    private removeAllStatusForPlayer(game: CCGGame, target: CCGPlayer) {
        game.state.statusConditions = game.state.statusConditions.filter((s) => s.ownerId !== target.id)
    }

    public async tickStatusEffects(game: CCGGame, status: StatusEffect) {
        const player = this.getPlayer(game, status.ownerId)

        if (status.type === 'BLEED') {
            const source = this.getPlayer(game, status.sourcePlayerId)
            player.hp -= status.value
            source.stats.damageDealt += status.value
            player.stats.damageTaken += status.value
            this.log(game, `${player.name} takes ${status.value} bleed damage`)
            await this.delay(3000)
        } else if (status.type === 'GAIN_ENERGY') {
            player.energy += status.value
            this.log(game, `${player.name} gains ${status.value} energy`)
            await this.delay(3000)
        }

        status.remainingTurns--

        game.state.statusEffects = game.state.statusEffects.filter((s) => s.remainingTurns > 0)
        game.state.statusConditions = game.state.statusConditions.filter((s) => s.remainingTurns > 0)
    }

    private getPlayer(game: CCGGame, id: string): CCGPlayer {
        return game.player1.id === id ? game.player1 : game.player2
    }

    private getStatusEffect(game: CCGGame, player: CCGPlayer, type: StatusEffect['type']) {
        return game.state.statusEffects.find((s) => s.ownerId === player.id && s.type === type)
    }

    private removeStatus(game: CCGGame, status: StatusEffect) {
        game.state.statusEffects = game.state.statusEffects.filter((s) => s.id !== status.id)
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    private log(game: CCGGame, message: string) {
        game.state.log.push({
            turn: game.state.turn,
            message,
        })
    }
}
