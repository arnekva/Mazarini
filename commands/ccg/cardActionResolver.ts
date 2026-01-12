import { CCGEffect, CCGGame, CCGPlayer, StatusEffect } from './ccgInterface'

export class CardActionResolver {
    constructor() {}

    public sortStack(game: CCGGame) {
        console.log('sorterer', game.state.stack)

        game.state.stack.sort((a, b) => b.speed - a.speed)
    }

    public resolveSingleEffect(game: CCGGame, effect: CCGEffect) {
        const source = this.getPlayer(game, effect.sourcePlayerId)
        const target = this.getPlayer(game, effect.targetPlayerId)

        if (Math.random() > effect.accuracy / 100) {
            return this.log(game, `${effect.emoji}: ${source.name}'s ${effect.sourceCardName} failed`)
        }

        switch (effect.type) {
            case 'DAMAGE':
                this.applyDamage(game, effect, source, target, effect.value ?? 0)
                break

            case 'HEAL': {
                const healed = Math.min(target.hp + effect.value, 20) - target.hp
                target.hp += healed
                this.log(game, `${effect.emoji}: ${target.name} **heals ${healed}**`)
                break
            }
            case 'GAIN_ENERGY':
                if (effect.turns) {
                    this.applyStatus(game, effect, target, 'GAIN_ENERGY')
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

            case 'STUN':
                this.applyStatus(game, effect, target, 'STUN')
                this.log(game, `${target.name} is **stunned** for **${effect.turns} turns**`)
                break

            case 'SHIELD':
                this.applyStatus(game, effect, target, 'SHIELD')
                this.log(game, `${target.name} gains **${effect.value} shield**`)
                break

            case 'REFLECT':
                this.applyStatus(game, effect, target, 'REFLECT')
                this.log(game, `${target.name} **reflects** all damage this round`)
                break
        }
    }

    private applyDamage(game: CCGGame, effect: CCGEffect, source: CCGPlayer, target: CCGPlayer, amount: number) {
        let damage = amount

        // Reflect damage
        const reflect = this.getStatus(game, target, 'REFLECT')
        if (reflect && damage > 0 && !(effect.reflected ?? false)) {
            // cannot reflect already reflected damage
            this.log(game, `${effect.emoji}: ${target.name} reflects ${damage} damage`)
            game.state.stack.unshift({
                emoji: effect.emoji,
                sourceCardName: effect.sourceCardName,
                type: 'DAMAGE',
                sourcePlayerId: target.id,
                targetPlayerId: target.opponentId,
                speed: effect.speed,
                accuracy: effect.accuracy,
                value: damage,
                reflected: true,
            })
            return
        }

        // Shield
        const shield = this.getStatus(game, target, 'SHIELD')
        if (shield) {
            const absorbed = Math.min(shield.value, damage)
            shield.value -= absorbed
            damage -= absorbed

            this.log(game, `${effect.emoji}: ${target.name}'s Shield absorbs ${absorbed}`)
            if (shield.value <= 0) this.removeStatus(game, shield)
        }

        if (damage > 0) {
            target.hp -= damage
            this.log(game, `${effect.emoji}: ${source.name} deals **${damage} damage** to ${target.name}`)
        }
    }

    private applyStatus(game: CCGGame, effect: CCGEffect, target: CCGPlayer, type: StatusEffect['type']) {
        game.state.statusEffects.push({
            id: crypto.randomUUID(),
            ownerId: target.id,
            type,
            value: effect.value,
            remainingTurns: effect.turns ?? 100,
        })
    }

    public tickStatusEffects(game: CCGGame, status: StatusEffect) {
        const player = this.getPlayer(game, status.ownerId)

        if (status.type === 'BURN') {
            player.hp -= status.value
            this.log(game, `${player.name} takes ${status.value} burn damage`)
        } else if (status.type === 'GAIN_ENERGY') {
            player.energy += status.value
            this.log(game, `${player.name} gains ${status.value} energy`)
        }

        status.remainingTurns--

        game.state.statusEffects = game.state.statusEffects.filter((s) => s.remainingTurns > 0)
    }

    private getPlayer(game: CCGGame, id: string): CCGPlayer {
        return game.player1.id === id ? game.player1 : game.player2
    }

    private getStatus(game: CCGGame, player: CCGPlayer, type: StatusEffect['type']) {
        return game.state.statusEffects.find((s) => s.ownerId === player.id && s.type === type)
    }

    private removeStatus(game: CCGGame, status: StatusEffect) {
        game.state.statusEffects = game.state.statusEffects.filter((s) => s.id !== status.id)
    }

    private log(game: CCGGame, message: string) {
        game.state.log.push({
            turn: game.state.turn,
            message,
        })
    }
}
