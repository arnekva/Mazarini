import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { RandomUtils } from '../../utils/randomUtils'
import { hpCCG } from './cards/hpCCG'
import { mazariniCCG } from './cards/mazariniCCG'
import { swCCG } from './cards/swCCG'
import {
    CardIdentifier,
    CCGCard,
    CCGCondition,
    CCGEffect,
    CCGEffectType,
    CCGGame,
    CCGPlayer,
    CCGStatusEffectType,
    ReflectType,
    StatusEffect,
} from './ccgInterface'

const SERIES_EMOJI_IS_ID = new Set(['swCCG', 'hpCCG'])
const ALL_CARDS = [...mazariniCCG, ...swCCG, ...hpCCG]

export class CardActionResolver {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    public sortStack(game: CCGGame) {
        game.state.stack.sort((a, b) => b.speed - a.speed)
    }

    public async resolveSingleEffect(game: CCGGame, effect: CCGEffect) {
        const source = this.getPlayer(game, effect.sourcePlayerId)
        // Re-evaluate target now in case RETARDED was cleared by an earlier effect this round.
        // Skip RETARDED conditions created this turn (they should only take effect next turn).
        if (effect.cardTarget) {
            const retarded = game.state.statusConditions.find(
                (s) => s.ownerId === source.id && s.type === 'RETARDED' && (s.createdOnTurn !== game.state.turn || s.includeCurrentTurn)
            )
            const flip = retarded && Math.random() < retarded.accuracy / 100
            const wantsOpponent = effect.cardTarget === 'OPPONENT'
            effect.targetPlayerId = wantsOpponent !== !!flip ? source.opponentId : source.id
            if (flip) {
                effect.statusText = effect.statusText ? `${effect.statusText}, random target` : 'random target'
            }
        }
        const target = this.getPlayer(game, effect.targetPlayerId)
        const opponent = this.getPlayer(game, source.opponentId)
        const sourceCannotMiss = (game.state.statusEffects.filter((s) => s.ownerId === source.id && s.type === 'CANNOT_MISS')?.length ?? 0) > 0

        if (effect.condition && !this.areConditionsMet(game, source, target, effect.condition)) {
            return
        }

        if (!effect.cardSuccessful && !sourceCannotMiss) {
            await this.delay(2500)
            game.state.stack = game.state.stack.filter((stackedEffect) => stackedEffect.cardId !== effect.cardId)
            return this.log(game, `${this.getEffectLogPrefix(effect)}${source.name}'s ${effect.sourceCardName} failed`)
        }
        // Elusive: each individual effect targeting an elusive opponent has a 25% chance to be dodged
        if (target.id !== source.id && !sourceCannotMiss) {
            const targetIsElusive = game.state.statusEffects.filter((s) => s.ownerId === target.id && s.type === 'ELUSIVE')
            if ((targetIsElusive?.length ?? 0) > 0 && Math.random() < 0.25 * targetIsElusive.length) {
                return this.log(game, `${this.getEffectLogPrefix(effect)}${effect.sourceCardName} missed ${target.name} (**Elusive**)`)
            }
        }
        if (effect.type === 'SHOOT') {
            await this.delay(2500)
            const shots = effect.amount ?? 1
            let hits = 0
            for (let i = 0; i < shots; i++) {
                if (Math.random() <= effect.accuracy / 100) {
                    hits++
                }
            }
            this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} fires ${shots} shots at ${target.name} — ${hits} hit`)
            if (hits > 0) {
                this.applyDamage(game, effect, source, target, hits * (effect.value ?? 1))
            }
            return
        }
        if (Math.random() > effect.accuracy / 100) {
            return
        }
        await this.delay(2500)

        // REFLECT: redirect the first incoming effect from an opponent back at them
        if (target.id !== source.id && !effect.reflected) {
            const reflect = this.getStatusCondition(game, target, 'REFLECT')
            if (reflect && this.isReflectedByType(reflect.reflectType, effect.type)) {
                const sourceReflect = this.getStatusCondition(game, source, 'REFLECT')
                if (sourceReflect && this.isReflectedByType(sourceReflect.reflectType, effect.type)) {
                    this.consumeReflect(game, reflect)
                    this.consumeReflect(game, sourceReflect)
                    return this.log(game, `${this.getEffectLogPrefix(effect)}Both players have reflect — **${effect.sourceCardName}** is negated`)
                }
                this.consumeReflect(game, reflect)
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} **reflects** ${effect.sourceCardName}!`)
                // Re-queue with source/target swapped; strip conditions so they aren't re-evaluated in the new context
                game.state.stack.unshift({ ...effect, sourcePlayerId: target.id, targetPlayerId: source.id, reflected: true, condition: undefined })
                return
            }
        }

        switch (effect.type) {
            case 'DAMAGE':
                this.applyDamage(game, effect, source, target, effect.value ?? 0)
                break

            case 'DAMAGE_PER_IDENTIFIER': {
                let players: CCGPlayer[]
                if (effect.countTarget === 'BOTH') players = [source, target]
                else if (effect.countTarget === 'OPPONENT') players = [target]
                else players = [source]
                let count = 0
                for (const p of players) {
                    const entry = game.state.playedCardsAllGame.find((e) => e.playerId === p.id && e.round === game.state.turn)
                    count += entry ? entry.cards.filter((c) => c.identifier?.includes(effect.identifier))?.length ?? 0 : 0
                }
                const total = (effect.base ?? 0) + count * (effect.value ?? 1)
                this.applyDamage(game, effect, source, target, total)
                break
            }

            case 'DAMAGE_PER_CARD_PLAYED': {
                let players: CCGPlayer[]
                if (effect.countTarget === 'BOTH') players = [source, target]
                else if (effect.countTarget === 'OPPONENT') players = [target]
                else players = [source]
                let count = 0
                for (const p of players) {
                    const entry = game.state.playedCardsAllGame.find((e) => e.playerId === p.id && e.round === game.state.turn)
                    count += entry ? entry.cards.length : 0
                }
                const total = (effect.base ?? 0) + count * (effect.value ?? 1)
                this.applyDamage(game, effect, source, target, total)
                break
            }

            case 'HEAL': {
                if (effect.turns) {
                    this.applyStatusEffect(game, effect, target, 'RECOVER')
                    this.log(
                        game,
                        `${this.getEffectLogPrefix(effect)}${target.name} will **recover ${effect.value} HP**${
                            effect.delayedTrigger ? ` in ${effect.turns} turns` : ` per turn for ${effect.turns} turns`
                        }`
                    )
                } else {
                    const healBoost = this.getStatusEffect(game, target, 'HEAL_BOOST')
                    const bonus = healBoost && healBoost.createdOnTurn !== game.state.turn ? healBoost.value : 0
                    const maxHp = target.maxHp ?? GameValues.ccg.gameSettings.startingHP
                    const healed = Math.min(target.hp + (effect.value ?? 0) + bonus, maxHp) - target.hp
                    target.hp += healed
                    this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} **heals ${healed}**`)
                }
                break
            }
            case 'GAIN_ENERGY':
                if (effect.turns) {
                    this.applyStatusEffect(game, effect, target, 'GAIN_ENERGY')
                    this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} gains **${effect.value} energy** extra for ${effect.turns} turns`)
                } else {
                    target.energy = target.energy + (effect.value ?? 1)
                    this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} gains **${effect.value} energy**`)
                }
                break

            case 'LOSE_ENERGY':
                target.energy = Math.max(target.energy - (effect.value ?? 1), 0)
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} loses **${effect.value} energy**`)
                break

            case 'SHIELD':
                this.applyStatusEffect(game, effect, target, 'SHIELD')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} gains **${effect.value} shield**`)
                break

            case 'SLEEP':
                this.applyStatusEffect(game, effect, target, 'SLEEP')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} **sleeps** for ${effect.turns} turn${effect.turns > 1 ? 's' : ''}`)
                break

            case 'REFLECT':
                this.applyStatusCondition(game, effect, target, 'REFLECT')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} gains **reflect** for the remainder of the round`)
                break

            case 'REMOVE_STATUS':
                this.removeAllStatusForPlayer(game, target)
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} has all status conditions removed`)
                break

            case 'REDUCE_COST': {
                this.applyStatusEffect(game, effect, target, 'REDUCE_COST')
                const costDesc =
                    (effect.value ?? 0) >= 99
                        ? `reduced to **0**`
                        : (effect.value ?? 0) < 0
                        ? `increased by **${Math.abs(effect.value)}**`
                        : `reduced by **${effect.value}**`
                this.log(
                    game,
                    `${this.getEffectLogPrefix(effect)}**${effect.sourceCardName}** – ${target.name}'s ${
                        effect.identifier ? `**${effect.identifier}** ` : ''
                    }card costs ${costDesc} ${effect.turns ? `for ${effect.turns} turns` : ''}`
                )
                break
            }

            case 'VIEW_HAND':
                this.applyStatusEffect(game, effect, target, 'VIEW_HAND')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} gains a single-use button to view ${opponent.name}'s hand`)
                break

            case 'STEAL_CARD':
                this.stealCard(game, effect, source, target)
                break

            case 'BLEED':
                this.applyStatusCondition(game, effect, target, 'BLEED')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} **bleeds** for **${effect.turns} turns**`)
                break

            case 'SHOCK':
                this.applyStatusCondition(game, effect, target, 'SHOCK')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} takes **shock damage** for **${effect.turns} turns**`)
                break

            case 'RETARDED':
                this.applyStatusCondition(game, effect, target, 'RETARDED')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} is **retarded** for the next **${effect.turns} turns**`)
                break

            case 'SLOW':
                this.applyStatusCondition(game, effect, target, 'SLOW')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} is **slow** for the next **${effect.turns} turns**`)
                break

            case 'CHOKESTER':
                this.applyStatusCondition(game, effect, target, 'CHOKESTER')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} is a **chokester** for the next **${effect.turns} turns**`)
                break

            case 'CHOKE_SHIELD':
                this.applyStatusEffect(game, effect, target, 'CHOKE_SHIELD')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} increases the accuracy of all their cards by 20%`)
                break

            case 'WAITING': {
                const turns = RandomUtils.getRandomInteger(1, effect.turns)
                effect.value = turns * 3
                effect.turns = turns + 1
                this.applyStatusCondition(game, effect, target, 'WAITING')
                this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} is waiting to attack ${target.name}`)
                break
            }
            case 'MYGLING':
                this.applyStatusEffect(game, effect, target, 'MYGLING')
                this.log(game, `${this.getEffectLogPrefix(effect)}${effect.sourceCardName} applies **Mygling** to ${target.name} for ${effect.turns} turns`)
                break

            case 'EIVINDPRIDE':
                this.applyStatusEffect(game, effect, target, 'EIVINDPRIDE')
                this.log(game, `${this.getEffectLogPrefix(effect)}Eivind might show up to attack ${target.name} in the next **${effect.turns} turns**`)
                break

            case 'RECOVER':
                this.applyStatusEffect(game, effect, target, 'RECOVER')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} will **recover ${effect.value} HP** per turn for **${effect.turns} turns**`)
                break

            case 'SPEED_BUFF':
                this.applyStatusEffect(game, effect, target, 'SPEED_BUFF')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} gains **+50% speed** for **${effect.turns} turns**`)
                break

            case 'DAMAGE_BOOST':
                this.applyStatusEffect(game, effect, target, 'DAMAGE_BOOST')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name}'s damage will be **increased by ${effect.value}** next turn`)
                break

            case 'EXTRA_CARDS':
                this.applyStatusEffect(game, effect, target, 'EXTRA_CARDS')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} can play **${effect.value} cards** next turn`)
                break

            case 'BUILD_DEATHSTAR':
                this.applyStatusCondition(game, effect, target, 'BUILD_DEATHSTAR')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} builds the Death Star for ${effect.turns ?? 3} turns`)
                break

            case 'DESTROY_DEATHSTAR':
                this.removeStatusTypeForPlayer(game, target, 'BUILD_DEATHSTAR')
                this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} destroys ${target.name}'s Death Star`)
                break

            case 'TRANSFORM':
                // Transform card immediately (specific instance that triggered this effect).
                if (effect.transformCardId) {
                    const transformCard = await this.getCardById(effect.transformCardId)
                    if (transformCard && Math.random() < effect.accuracy / 100) {
                        const playedIndex = effect.sourceCardId
                            ? target.hand.findIndex((card) => card.id === effect.sourceCardId && card.selected)
                            : target.hand.findIndex((card) => card.name === effect.sourceCardName && card.selected)

                        if (playedIndex !== -1) {
                            target.hand[playedIndex] = { ...transformCard, selected: true }
                            this.log(
                                game,
                                `${this.getEffectLogPrefix(effect)}${target.name} transforms! ${effect.sourceCardName} becomes ${transformCard.name}`
                            )
                        } else {
                            this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} immitation card cannot transform further`)
                        }
                    }
                } else if (effect.transformSeries) {
                    await this.playAsRandomCardFromSeries(game, effect, source)
                }
                break

            case 'STEAL_ENERGY': {
                const stolen = Math.min(target.energy, effect.value ?? 1)
                target.energy -= stolen
                source.energy += stolen
                this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} steals **${stolen} energy** from ${target.name}`)
                break
            }

            case 'DISCARD_CARD': {
                const amount = effect.amount ?? 1
                // Only non-submitted cards can be discarded; submitted ones are mid-resolution
                const discardPool = target.hand.filter((c) => !c.selected)
                if (discardPool.length === 0) {
                    this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} has no discardable cards`)
                    break
                }
                const discarded: string[] = []
                for (let i = 0; i < Math.min(amount, discardPool.length); i++) {
                    const idx = Math.floor(Math.random() * discardPool.length)
                    const card = discardPool.splice(idx, 1)[0]
                    discarded.push(card.name)
                    target.usedCards.push(card)
                    target.hand.splice(target.hand.indexOf(card), 1)
                }
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} discards a random card`)
                break
            }

            case 'ELUSIVE':
                this.applyStatusEffect(game, effect, target, 'ELUSIVE')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} becomes **elusive** for ${effect.turns} turns`)
                break

            case 'ARMOR': {
                this.applyStatusEffect(game, effect, target, 'ARMOR')
                const duration =
                    effect.turns && effect.turns === 1 && effect.includeCurrentTurn
                        ? ` for the remainder of the turn`
                        : ` for ${effect.turns} turn${effect.turns > 1 ? 's' : ''}`
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} gains **armor** (reduces incoming damage by ${effect.value})${duration}`)
                break
            }
            case 'BOUNTY':
                this.applyStatusCondition(game, effect, target, 'BOUNTY')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} has a **BOUNTY** placed on them`)
                break

            case 'CLAIM_BOUNTY': {
                const bountyIndex = game.state.statusConditions.findIndex((s) => s.ownerId === target.id && s.type === 'BOUNTY')
                if (bountyIndex !== -1) {
                    game.state.statusConditions.splice(bountyIndex, 1)
                    this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} **claims the bounty** on ${target.name}!`)
                    this.applyDamage(game, effect, source, target, effect.value ?? 3)
                } else {
                    this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} found no bounty to claim on ${target.name}`)
                }
                break
            }

            case 'NEUTRALIZE_ATTACK': {
                const attackIndex = game.state.stack.findIndex((e) => {
                    if (!['DAMAGE', 'DAMAGE_PER_IDENTIFIER', 'DAMAGE_PER_CARD_PLAYED', 'SHOOT', 'DAMAGE_PER_OPPONENT_COST'].includes(e.type)) return false
                    if (e.sourcePlayerId === effect.sourcePlayerId) return false
                    if (e.targetPlayerId !== effect.sourcePlayerId) return false
                    if (
                        e.condition &&
                        !this.areConditionsMet(game, this.getPlayer(game, e.sourcePlayerId), this.getPlayer(game, e.targetPlayerId), e.condition)
                    )
                        return false
                    return true
                })
                if (attackIndex !== -1) {
                    const neutralized = game.state.stack.splice(attackIndex, 1)[0]
                    this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} **neutralizes** ${neutralized.sourceCardName}'s attack`)
                } else {
                    this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} found no incoming attack to neutralize`)
                }
                break
            }

            case 'PERSISTENT_APPEARANCE':
                this.applyStatusEffect(game, effect, target, 'PERSISTENT_APPEARANCE')
                this.log(game, `${this.getEffectLogPrefix(effect)}${effect.sourceCardName} will pester ${target.name} for ${effect.turns} turns`)
                break

            case 'SUMMON_CARD': {
                const maxHandSize = GameValues.ccg.gameSettings.maxHandSize
                // Submitted cards are still in hand during resolution; count only non-selected ones as remaining
                const cardsRemainingAfterPlay = source.hand.filter((c) => !c.selected).length
                if (cardsRemainingAfterPlay >= maxHandSize) {
                    this.log(game, `${this.getEffectLogPrefix(effect)}${source.name}'s hand is full — could not summon a card`)
                    break
                }
                let summoned: CCGCard | undefined
                if (effect.summonCardId) {
                    summoned = await this.getCardById(effect.summonCardId)
                } else if (effect.identifier) {
                    summoned = await this.getRandomCardByIdentifier(effect.identifier)
                }
                if (summoned) {
                    source.hand.push({ ...summoned, summoned: true })
                    const summonedDesc = effect.identifier ? `a ${effect.identifier} card` : summoned.name
                    this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} summons **${summonedDesc}** to their hand`)
                } else {
                    this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} could not summon a card — no matching card found`)
                }
                break
            }

            case 'PRANK': {
                const prankCards = ['hp_prank_damage_n', 'hp_prank_shield_n', 'hp_prank_both_n', 'hp_prank_energy_n']
                const prankId = prankCards[Math.floor(Math.random() * prankCards.length)]
                const prankCard = ALL_CARDS.find((c) => c.id === prankId)
                if (!prankCard) break
                const fredEmoji = source.hand.find((c) => c.id === 'hp_fred_n' || c.id === 'hp_george_n')?.emoji ?? effect.emoji
                for (const prankEffect of prankCard.effects ?? []) {
                    const prankTarget = prankEffect.target === 'OPPONENT' ? target : source
                    const stackEffect: CCGEffect = {
                        cardId: prankCard.id,
                        emoji: fredEmoji,
                        sourceCardName: prankCard.name,
                        sourceCardId: prankCard.id,
                        sourcePlayerId: source.id,
                        targetPlayerId: prankTarget.id,
                        cardTarget: prankEffect.target,
                        type: prankEffect.type,
                        speed: prankCard.speed,
                        accuracy: 100,
                        cardSuccessful: true,
                        value: prankEffect.value,
                        turns: prankEffect.turns,
                    } as CCGEffect
                    game.state.stack.push(stackEffect)
                }
                this.sortStack(game)
                this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} sets off **${prankCard.name}**!`)
                break
            }

            case 'COPY_CARD':
                this.copyCard(game, effect, source, target)
                break

            case 'HEAL_PER_OPPONENT_COST': {
                const opponentEntry = game.state.playedCardsAllGame.find((e) => e.playerId === opponent.id && e.round === game.state.turn)
                const totalCost = opponentEntry ? opponentEntry.cards.reduce((sum, c) => sum + c.cost, 0) : 0
                const maxHp = source.maxHp ?? GameValues.ccg.gameSettings.startingHP
                const healed = Math.min(source.hp + totalCost, maxHp) - source.hp
                source.hp += healed
                this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} **heals ${healed} HP** (opponent spent ${totalCost} energy)`)
                break
            }

            case 'DAMAGE_PER_OPPONENT_COST': {
                const opponentEntry = game.state.playedCardsAllGame.find((e) => e.playerId === target.id && e.round === game.state.turn)
                const totalCost = opponentEntry ? opponentEntry.cards.reduce((sum, c) => sum + c.cost, 0) : 0
                this.applyDamage(game, effect, source, target, totalCost)
                break
            }

            case 'INCREASE_MAX_HP': {
                const hpGain = effect.value ?? 0
                source.maxHp = (source.maxHp ?? GameValues.ccg.gameSettings.startingHP) + hpGain
                source.hp = Math.min(source.hp + hpGain, source.maxHp)
                this.log(game, `${this.getEffectLogPrefix(effect)}${source.name}'s max HP raised to **${source.maxHp}**`)
                break
            }

            case 'HEAL_BOOST':
                this.applyStatusEffect(game, effect, target, 'HEAL_BOOST')
                this.log(
                    game,
                    `${this.getEffectLogPrefix(effect)}${target.name}'s heals are **boosted by ${effect.value}** for ${effect.turns} turn${
                        effect.turns > 1 ? 's' : ''
                    }`
                )
                break

            case 'RESTRICT_CARDS':
                this.applyStatusCondition(game, effect, target, 'RESTRICT_CARDS')
                this.log(game, `${this.getEffectLogPrefix(effect)}${target.name} is **restricted** to playing ${effect.value ?? 1} card(s) next turn`)
                break

            case 'CANNOT_MISS':
                this.applyStatusEffect(game, effect, target, 'CANNOT_MISS')
                this.log(
                    game,
                    `${this.getEffectLogPrefix(effect)}${target.name}'s cards are **100% accurate** for ${effect.turns} turn${effect.turns > 1 ? 's' : ''}`
                )
                break
        }
    }

    private async getCardById(cardId: string): Promise<CCGCard | undefined> {
        const card = ALL_CARDS.find((card) => card.id === cardId)
        if (!card) return undefined
        return await this.getCardWithEmoji(card)
    }

    private async getRandomCardByIdentifier(identifier: CardIdentifier): Promise<CCGCard | undefined> {
        const eligible = ALL_CARDS.filter((c) => c.identifier?.includes(identifier))
        if (eligible.length === 0) return undefined
        const card = eligible[Math.floor(Math.random() * eligible.length)]
        return await this.getCardWithEmoji(card)
    }

    private async playAsRandomCardFromSeries(game: CCGGame, effect: CCGEffect, source: CCGPlayer): Promise<void> {
        const eligible = ALL_CARDS.filter(
            (c) => c.series === effect.transformSeries && !c.summoned && c.collectible !== false && !c.consumable && c.id !== effect.sourceCardId
        )
        if (eligible.length === 0) return
        const card = eligible[Math.floor(Math.random() * eligible.length)]
        const fullCard = await this.getCardWithEmoji(card)
        this.log(game, `${this.getEffectLogPrefix(effect)}${source.name}'s ${effect.sourceCardName} becomes **${card.name}**!`)

        // Update the visual card in hand temporarily for display — match selected only so duplicate card IDs don't steal the wrong slot
        const playedIndex = source.hand.findIndex((c) => c.id === effect.sourceCardId && c.selected)
        if (playedIndex !== -1) source.hand[playedIndex] = { ...fullCard, selected: true }

        // Push the random card's effects onto the stack so they resolve this round
        const opponent = this.getPlayer(game, source.opponentId)
        for (const cardEffect of card.effects) {
            const targetPlayerId = cardEffect.target === 'SELF' ? source.id : opponent.id
            game.state.stack.push({
                cardId: effect.cardId,
                emoji: fullCard.emoji,
                statusText: `via ${effect.sourceCardName}`,
                sourceCardName: card.name,
                sourceCardId: card.id,
                sourcePlayerId: source.id,
                targetPlayerId,
                cardTarget: cardEffect.target,
                speed: card.speed,
                accuracy: cardEffect.accuracy ?? card.accuracy,
                cardSuccessful: true,
                type: cardEffect.type,
                value: cardEffect.value,
                turns: cardEffect.turns,
                amount: cardEffect.amount,
                condition: cardEffect.condition,
                statusAccuracy: cardEffect.statusAccuracy ?? 100,
                includeCurrentTurn: cardEffect.includeCurrentTurn,
                transformCardId: cardEffect.transformCardId,
                identifier: cardEffect.identifier,
                summonCardId: cardEffect.summonCardId,
                delayedTrigger: cardEffect.delayedTrigger,
                countTarget: cardEffect.countTarget,
                base: cardEffect.base,
                reflectType: cardEffect.reflectType,
            })
        }

        // Restore the original card in hand so it shuffles back as itself (transform is visual/effect only for this round)
        if (playedIndex !== -1 && effect.sourceCardId) {
            const originalCard = await this.getCardById(effect.sourceCardId)
            if (originalCard) source.hand[playedIndex] = { ...originalCard, selected: true }
        }
    }

    private async getCardWithEmoji(card: CCGCard): Promise<CCGCard> {
        const emojiName = SERIES_EMOJI_IS_ID.has(card.series) ? card.id : `${card.series}_${card.id}`
        const emoji = await this.client.getEmoji(emojiName)
        const fullCard = { ...card, selected: false, emoji: emoji.id }
        return fullCard
    }

    private applyDamage(game: CCGGame, effect: CCGEffect, source: CCGPlayer, target: CCGPlayer, amount: number) {
        let damage = amount

        // Damage boost from DAMAGE_BOOST status (skip if created this turn)
        const damageBoost = this.getStatusEffect(game, source, 'DAMAGE_BOOST')
        if (damageBoost && damage > 0 && damageBoost.createdOnTurn !== game.state.turn) damage += damageBoost.value

        // Shield
        const shield = this.getStatusEffect(game, target, 'SHIELD')
        if (shield) {
            const absorbed = Math.min(shield.value, damage)
            shield.value -= absorbed
            damage -= absorbed

            this.log(game, `${this.getEffectLogPrefix(effect)}${target.name}'s Shield absorbs ${absorbed}`)
            if (shield.value <= 0) this.removeStatus(game, shield)
        }

        // Armor (identifier-filtered armor only applies against cards with that identifier)
        const armor = game.state.statusEffects.filter((s) => {
            if (s.ownerId !== target.id || s.type !== 'ARMOR') return false
            if (!s.identifier) return true
            const sourceCard = ALL_CARDS.find((c) => c.id === effect.sourceCardId)
            return sourceCard?.identifier?.includes(s.identifier) ?? false
        })
        if ((armor?.length ?? 0) > 0 && damage > 0) {
            const totalArmor = armor.reduce((sum, a) => sum + a.value, 0)
            const reduced = Math.min(totalArmor, damage)
            damage -= reduced
            this.log(game, `${this.getEffectLogPrefix(effect)}${target.name}'s Armor reduces damage by ${reduced}`)
        }

        if (damage > 0) {
            damage = Math.min(target.hp, damage)
            target.hp = target.hp - damage
            source.stats.damageDealt += damage
            target.stats.damageTaken += damage
            this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} deals **${damage} damage** to ${target.name}`)
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
            accuracy: effect.statusAccuracy ?? 100,
            emoji: effect.emoji,
            includeCurrentTurn: effect.includeCurrentTurn,
            createdOnTurn: game.state.turn,
            identifier: effect.identifier,
            delayedTrigger: effect.delayedTrigger,
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
            accuracy: effect.statusAccuracy ?? 100,
            emoji: effect.emoji,
            includeCurrentTurn: effect.includeCurrentTurn,
            createdOnTurn: game.state.turn,
            reflectType: type === 'REFLECT' ? effect.reflectType : undefined,
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
            source.deck.push({ ...cardStolen, selected: false })
            this.log(
                game,
                `${this.getEffectLogPrefix(effect)}${source.name} **steals ${cardStolen.name}** from ${target.name}'s used cards, and adds it to their deck`
            )
        } else {
            this.log(game, `${this.getEffectLogPrefix(effect)}${source.name}'s ${effect.sourceCardName} failed`)
        }
    }

    private copyCard(game: CCGGame, effect: CCGEffect, source: CCGPlayer, target: CCGPlayer) {
        const cardToCopy = target.usedCards[target.usedCards.length - 1]
        if (cardToCopy) {
            source.deck.push({ ...cardToCopy, selected: false })
            this.log(game, `${this.getEffectLogPrefix(effect)}${source.name} **copies ${cardToCopy.name}** from ${target.name}'s used cards into their deck`)
        } else {
            this.log(game, `${this.getEffectLogPrefix(effect)}${source.name}'s ${effect.sourceCardName} found no card to copy`)
        }
    }

    private getEffectLogPrefix(effect: CCGEffect) {
        return `${effect.emoji}: ${effect.statusText ? `*(${effect.statusText})* ` : ''}`
    }

    private removeAllStatusForPlayer(game: CCGGame, target: CCGPlayer) {
        game.state.statusConditions = game.state.statusConditions.filter((s) => s.ownerId !== target.id || s.type === 'REFLECT')
    }

    private removeStatusTypeForPlayer(game: CCGGame, target: CCGPlayer, type: StatusEffect['type']) {
        game.state.statusConditions = game.state.statusConditions.filter((s) => s.ownerId !== target.id || s.type !== type)
    }

    public async tickStatusEffects(game: CCGGame, status: StatusEffect) {
        const player = this.getPlayer(game, status.ownerId)

        if (status.type === 'BLEED' || status.type === 'SHOCK') {
            const source = this.getPlayer(game, status.sourcePlayerId)
            player.hp -= status.value
            source.stats.damageDealt += status.value
            player.stats.damageTaken += status.value
            this.log(game, `${player.name} takes ${status.value} ${status.type === 'SHOCK' ? 'shock' : 'bleed'} damage`)
            await this.delay(2000)
        } else if (status.type === 'GAIN_ENERGY') {
            if (!status.delayedTrigger || status.remainingTurns === 1) {
                player.energy += status.value
                this.log(game, `${player.name} gains ${status.value} energy`)
                await this.delay(2000)
            }
        } else if (status.type === 'RECOVER') {
            if (!status.delayedTrigger || status.remainingTurns === 1) {
                const healBoost = this.getStatusEffect(game, player, 'HEAL_BOOST')
                const bonus = healBoost ? healBoost.value : 0
                const maxHp = player.maxHp ?? GameValues.ccg.gameSettings.startingHP
                const healed = Math.min(player.hp + status.value + bonus, maxHp) - player.hp
                player.hp += healed
                this.log(game, `${player.name} **recovers ${healed} HP**`)
                await this.delay(2000)
            }
        } else if (status.type === 'PERSISTENT_APPEARANCE' && Math.random() < (status.accuracy ?? 100) / 100) {
            const source = this.getPlayer(game, status.sourcePlayerId)
            const damage = Math.min(player.hp, status.value)
            player.hp -= damage
            source.stats.damageDealt += damage
            player.stats.damageTaken += damage
            this.log(game, `${status.emoji}: ${source.name}'s card pesters ${player.name} for ${damage} damage`)
            await this.delay(2000)
        } else if (status.type === 'EIVINDPRIDE' && Math.random() < status.accuracy / 100) {
            const source = this.getPlayer(game, status.sourcePlayerId)
            const damage = Math.min(player.hp, status.value)
            player.hp -= damage
            source.stats.damageDealt += damage
            player.stats.damageTaken += damage
            this.log(game, `${status.emoji}: Eivind appears and attacks ${player.name} for ${damage} damage`)
            await this.delay(2000)
        } else if (status.type === 'WAITING' && status.remainingTurns === 1) {
            const source = this.getPlayer(game, status.sourcePlayerId)
            const damage = Math.min(player.hp, status.value)
            player.hp -= damage
            source.stats.damageDealt += damage
            player.stats.damageTaken += damage
            this.log(game, `${status.emoji}: ${player.name} takes ${damage} damage`)
            await this.delay(2000)
        }

        // Skip tick on the turn the status was created, unless it includes current turn
        const skipTick = status.createdOnTurn === game.state.turn && !status.includeCurrentTurn
        if (!skipTick) {
            status.remainingTurns--
        }

        game.state.statusEffects = game.state.statusEffects.filter((s) => s.remainingTurns > 0)
        game.state.statusConditions = game.state.statusConditions.filter((s) => s.remainingTurns > 0)
    }

    private areConditionsMet(game: CCGGame, source: CCGPlayer, target: CCGPlayer, condition: CCGCondition | CCGCondition[]): boolean {
        const conditions = Array.isArray(condition) ? condition : [condition]
        return conditions.every((c) => this.isConditionMet(game, source, target, c))
    }

    private isConditionMet(game: CCGGame, source: CCGPlayer, target: CCGPlayer, condition: CCGCondition): boolean {
        const subject = condition.target === 'OPPONENT' ? target : source
        let result: boolean
        switch (condition.type) {
            case 'ALWAYS':
                result = true
                break
            case 'RANDOM':
                result = Math.random() <= (condition.chance ?? 50) / 100
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
            case 'PLAYED_CARD_ID': {
                const playedEntries = game.state.playedCardsAllGame.find((entry) => entry.playerId === subject.id && entry.round === game.state.turn)
                const cardsWithId = playedEntries ? playedEntries.cards.filter((card) => card.id === condition.cardId) : []
                const comparator = condition.comparator ?? '>'
                result = this.comparatorCheck(cardsWithId.length, comparator, condition.value ?? 0)
                break
            }
            case 'PLAYED_CARD_IDENTIFIER': {
                const playedEntries = game.state.playedCardsAllGame.find((entry) => entry.playerId === subject.id && entry.round === game.state.turn)
                const count = playedEntries ? playedEntries.cards.filter((card) => card.identifier?.includes(condition.identifier)).length : 0
                const comparator = condition.comparator ?? '>'
                result = this.comparatorCheck(count, comparator, condition.value ?? 0)
                break
            }
            case 'BUILD_DEATHSTAR':
                result = game.state.statusConditions.some((s) => s.ownerId === subject.id && s.type === 'BUILD_DEATHSTAR')
                break
            case 'NUM_CARDS_PLAYED': {
                const playedEntries = game.state.playedCardsAllGame.find((entry) => entry.playerId === subject.id && entry.round === game.state.turn)
                const count = playedEntries ? playedEntries.cards.length : 0
                const comparator = condition.comparator ?? '>'
                result = this.comparatorCheck(count, comparator, condition.value ?? 0)
                break
            }
            default:
                result = true
        }
        return condition.invert ? !result : result
    }

    private comparatorCheck(count: number, comparator: CCGCondition['comparator'], value: number) {
        switch (comparator) {
            case '<':
                return count < (value ?? 0)
            case '<=':
                return count <= (value ?? 0)
            case '==':
                return count === (value ?? 0)
            case '!=':
                return count !== (value ?? 0)
            case '>=':
                return count >= (value ?? 0)
            case '>':
            default:
                return count > (value ?? 0)
        }
    }

    private getPlayer(game: CCGGame, id: string): CCGPlayer {
        return game.player1.id === id ? game.player1 : game.player2
    }

    private getStatusEffect(game: CCGGame, player: CCGPlayer, type: StatusEffect['type']) {
        return game.state.statusEffects.find((s) => s.ownerId === player.id && s.type === type)
    }

    private getStatusCondition(game: CCGGame, player: CCGPlayer, type: StatusEffect['type']) {
        return game.state.statusConditions.find((s) => s.ownerId === player.id && s.type === type)
    }

    private consumeReflect(game: CCGGame, reflect: StatusEffect) {
        game.state.statusConditions = game.state.statusConditions.filter((s) => s.id !== reflect.id)
    }

    private isReflectedByType(reflectType: ReflectType | undefined, effectType: CCGEffectType): boolean {
        const DAMAGE_TYPES: CCGEffectType[] = ['DAMAGE', 'DAMAGE_PER_IDENTIFIER', 'DAMAGE_PER_CARD_PLAYED', 'DAMAGE_PER_OPPONENT_COST']
        const type = reflectType ?? 'damage'
        if (type === 'all') return true
        if (type === 'damage') return DAMAGE_TYPES.includes(effectType)
        if (type === 'allEffects') return !DAMAGE_TYPES.includes(effectType)
        return (type as CCGEffectType[]).includes(effectType)
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
