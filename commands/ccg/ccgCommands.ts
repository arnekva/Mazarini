import { randomUUID } from 'crypto'
import type { ApplicationEmoji, Collection } from 'discord.js'
import { ActionRowBuilder, APIButtonComponent, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { environment } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import type { CardModification } from '../../helpers/ccgCardGenerator'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import type { ImageGenerationHelper } from '../../helpers/imageGenerationHelper'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { ICCGDeck, ICCGSystem, MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../../interfaces/interactionInterface'
import { CCGContainer } from '../../templates/containerTemplates'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { BotResolver } from './BotResolver'
import { CardActionResolver } from './cardActionResolver'
import { CCGHelp } from './ccgHelp'
import {
    CCGCard,
    CCGCardEffect,
    CCGCardStats,
    CCGEffect,
    CCGEffectType,
    CCGGame,
    CCGGameState,
    CCGLogEntry,
    CCGPlayer,
    CCGStatusStats,
    Difficulty,
    Mode,
    StatusEffect,
} from './ccgInterface'
import { CCGStatView } from './ccgStats'
import { ProgressionHandler } from './progressionHandler'
import { CCGValidator } from './validator'

/** CCG series whose emoji names match the card ID exactly (no series_ prefix) */
const SERIES_EMOJI_IS_ID = new Set(['swCCG'])

export class CCGCommands extends AbstractCommands {
    private ccgStoragePromise: Promise<ICCGSystem>
    private games: Map<string, CCGGame>
    private gameMessageUpdateQueue: Map<string, Promise<void>>
    private gameMessageUpdateRequested: Set<string>
    private resolver: CardActionResolver
    private botResolver: BotResolver
    private igh: ImageGenerationHelper
    private progressHandler: ProgressionHandler
    private helper: CCGHelp
    private statViewer: CCGStatView

    constructor(client: MazariniClient) {
        super(client)
        this.helper = new CCGHelp(this.client)
        this.games = new Map<string, CCGGame>()
        this.gameMessageUpdateQueue = new Map<string, Promise<void>>()
        this.gameMessageUpdateRequested = new Set<string>()
        this.resolver = new CardActionResolver(this.client)
        this.botResolver = new BotResolver()
        this.progressHandler = new ProgressionHandler(this.client)
        this.statViewer = new CCGStatView(this.client)
    }

    private getImageHelper() {
        if (!this.igh) {
            const { ImageGenerationHelper } = require('../../helpers/imageGenerationHelper') as typeof import('../../helpers/imageGenerationHelper')
            this.igh = new ImageGenerationHelper(this.client)
        }
        return this.igh
    }

    private getCardGenerator() {
        return require('../../helpers/ccgCardGenerator').CCGCardGenerator as typeof import('../../helpers/ccgCardGenerator').CCGCardGenerator
    }

    private getCcgStorage() {
        if (!this.ccgStoragePromise) {
            this.ccgStoragePromise = this.database.getStorage().then((storage) => storage.ccg)
        }
        return this.ccgStoragePromise
    }

    private drawCards(game: CCGGame, player: CCGPlayer) {
        if (player.stunned) return
        for (let i = player.hand.length; i < game.state.settings.defaultHandSize; i++) {
            this.drawCard(game, player)
        }
    }

    private drawCard(game: CCGGame, player: CCGPlayer) {
        if (player.hand.length === game.state.settings.maxHandSize) return
        let card = player.deck.pop()
        if (!card) {
            player.deck = RandomUtils.shuffleList(player.usedCards.map((card) => ({ ...card, selected: false })))
            player.usedCards = []
            card = player.deck.pop()
        }
        player.hand.push(card)
    }

    private async sendPlayerHand(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        const msg = await this.messageHelper.replyToInteraction(interaction, 'Fetching hand...', { ephemeral: !game.vsBot })
        player.handMessage = msg
        this.updatePlayerHand(game, player)
    }

    private async getPlayerHandImage(player: CCGPlayer, includeAll = false, mods: CardModification[] = []) {
        const cards = player.hand.filter((card) => includeAll || !player.submitted || !card.selected)
        if (!cards || cards.length === 0) return undefined
        const buffers = await Promise.all(
            cards.map(async (card) => {
                return Buffer.from(await this.getCardImage(card, mods))
            })
        )
        return await this.getImageHelper().stitchImages(buffers, 'horizontal')
    }

    private async getCardImage(card: CCGCard, mods: CardModification[] = []) {
        const CCGCardGenerator = this.getCardGenerator()
        if (mods.length > 0) return await CCGCardGenerator.getModifiedCardBuffer(card, mods)
        return await CCGCardGenerator.getCardBuffer(card)
    }

    private getPlayerHandButtons(game: CCGGame, player: CCGPlayer) {
        const cards = player.hand.filter((card) => !player.submitted || !card.selected)
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            cards.map((card, index) => {
                return cardBtn(game.id, index, card)
                    .setStyle(card.selected ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(game.state.locked || player.submitted)
            })
        )
    }

    private submitCards(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        if (player.submitted)
            return this.messageHelper.replyToInteraction(interaction, `Du har allerede spilt denne runden`, {
                ephemeral: true,
            })
        const submitted = player.hand.filter((card) => card.selected)
        const extraCardsEffects = this.getEffectsForPlayer(game, player, 'EXTRA_CARDS')
        const maxCards = extraCardsEffects.length > 0 ? extraCardsEffects[0].value : game.state.settings.maxCardsPlayed
        if (submitted.length > maxCards) {
            return this.messageHelper.replyToInteraction(interaction, `Du kan ikke spille mer enn ${maxCards} kort om gangen`, {
                ephemeral: true,
            })
        }
        const costReductionEffects = this.getEffectsForPlayer(game, player, 'REDUCE_COST')
        const submittedCost = submitted.reduce((sum, card) => {
            const cardReduction = costReductionEffects.filter((e) => !e.identifier || card.identifier?.includes(e.identifier)).reduce((s, e) => s + e.value, 0)
            return sum + Math.max(card.cost - cardReduction, 0)
        }, 0)
        if (submittedCost > player.energy) {
            return this.messageHelper.replyToInteraction(interaction, 'Du har ikke nok energi!', { ephemeral: true })
        }
        interaction.deferUpdate()
        player.energy -= submittedCost
        player.submitted = true
        this.registerCardsPlayed(player, submitted)
        this.addEffectsToStack(game, player)
        this.handlePlayerSubmit(game, player)
    }

    private discardCards(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        if (player.submitted)
            return this.messageHelper.replyToInteraction(interaction, `Du har allerede spilt denne runden`, {
                ephemeral: true,
            })
        interaction.deferUpdate()
        const discarded = player.hand.filter((card) => card.selected)
        if (discarded.length > 0) {
            game.state.log.push({
                turn: game.state.turn,
                message: `*${player.name} discards ${discarded.length} card${discarded.length > 1 ? 's' : ''}*`,
            })
        }
        player.usedCards.push(...discarded)
        player.hand = player.hand.filter((card) => !card.selected)
        player.submitted = true
        this.handlePlayerSubmit(game, player)
    }

    private async concedeGame(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        const penalty = Math.max(0, GameValues.ccg.concedeShardPenalty - game.state.turn)
        const btn = confirmConcede(game.id, player.id)
        await this.messageHelper.replyToInteraction(interaction, `Er du sikker på at du vil gi deg? Dette vil koste deg ${penalty} shards!`, undefined, [btn])
    }

    private async confirmConcedeGame(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        if (interaction.user.id !== interaction.customId.split(';')[2]) return interaction.deferUpdate()
        await interaction.message.delete()
        interaction.deferUpdate()
        // Deduct shard penalty from conceder
        const user = await this.client.database.getUser(player.id)
        const penalty = Math.max(0, GameValues.ccg.concedeShardPenalty - game.state.turn)
        if (user.ccg) {
            user.ccg.shards = Math.max(0, (user.ccg.shards ?? 0) - penalty)
        } else {
            user.ccg = { shards: 0, weeklyShardsEarned: 0, dailyShardBonusClaimed: false }
        }
        await this.client.database.updateUser(user)
        // Set opponent as winner
        game.state.winnerId = player.opponentId
        // Log concede
        game.state.log.push({
            turn: game.state.turn,
            message: `*${player.name} concedes the game*`,
        })
        // End game
        await this.endGame(game)
    }

    private async handlePlayerSubmit(game: CCGGame, player: CCGPlayer) {
        await this.updatePlayerHand(game, player)
        if (game.player1.submitted && game.player2.submitted) {
            if (game.vsBot) {
                const botSubmitted = game.player2.hand.filter((card) => card.selected)
                const botCostReductionEffects = this.getEffectsForPlayer(game, game.player2, 'REDUCE_COST')
                const botCost = botSubmitted.reduce((sum, card) => {
                    const cardReduction = botCostReductionEffects
                        .filter((e) => !e.identifier || card.identifier?.includes(e.identifier))
                        .reduce((s, e) => s + e.value, 0)
                    return sum + Math.max(card.cost - cardReduction, 0)
                }, 0)
                game.player2.energy -= botCost
                this.registerCardsPlayed(game.player2, botSubmitted)
            }
            this.updatePlayerStates(game)
            this.resolveRound(game)
        } else {
            game.container.updateTextComponent('game-text', `Choose up to 2 cards\nPlayers submitted: ( 1 / 2 )`)
            this.updateGameMessage(game)
        }
    }

    private registerCardsPlayed(player: CCGPlayer, cards: CCGCard[]) {
        for (const card of cards) {
            const index = player.stats.cardsPlayed.findIndex((playedCard) => playedCard.cardId === card.id)
            if (index >= 0) player.stats.cardsPlayed[index].timesPlayed += 1
            else player.stats.cardsPlayed.push({ cardId: card.id, timesPlayed: 1 })
        }
    }

    private getEffectsForPlayer(game: CCGGame, player: CCGPlayer, type?: CCGEffectType) {
        return game.state.statusEffects.filter((effect) => effect.ownerId === player.id && (!type || effect.type === type))
    }

    private getConditionsForPlayer(game: CCGGame, player: CCGPlayer, type?: CCGEffectType) {
        return game.state.statusConditions.filter((effect) => effect.ownerId === player.id && (!type || effect.type === type))
    }

    private async resolveRound(game: CCGGame) {
        if (game.state.phase === 'RESOLVE') return // prevent double resolve
        game.state.phase = 'RESOLVE'
        game.state.locked = true

        this.checkForSpecialCards(game, game.player1)
        this.checkForSpecialCards(game, game.player2)
        this.revealCards(game)
        await this.resolveEffects(game)

        if (game.state.winnerId) {
            this.endGame(game)
        } else {
            game.container.replaceComponent('main-button', nextRoundBtn(game.id))
            game.state.locked = false
            await this.updateGameMessage(game)
        }
    }

    private startNextRound(interaction: BtnInteraction, game: CCGGame) {
        interaction.deferUpdate()
        if (game.state.phase === 'PLAY') return
        game.state.phase = 'PLAY'
        game.state.turn = game.state.turn + 1
        game.container.removeComponent('effect-summary')
        game.container.removeComponent('separator3')
        game.container.updateTextComponent('game-text', `Choose up to 2 cards\n${game.vsBot ? '' : 'Players submitted: ( 0 / 2 )'}`)
        game.container.replaceComponent('main-button', getPlayButtons(game, !game.vsBot))
        this.preparePlayerForNewRound(game, game.player1)
        this.preparePlayerForNewRound(game, game.player2, game.vsBot)
        this.updatePlayerStates(game)
        this.updateGameMessage(game)
        if (!game.vsBot) {
            setTimeout(() => {
                game.container.replaceComponent('main-button', getPlayButtons(game))
                this.updateGameMessage(game)
            }, 3000)
        }
    }

    private preparePlayerForNewRound(game: CCGGame, player: CCGPlayer, isBot = false) {
        player.usedCards.push(...player.hand.filter((card) => card.selected && !card.summoned))
        player.hand = player.hand.filter((card) => !card.selected)
        player.submitted = false
        const isMygling = this.playerHasStatus(game, player, 'MYGLING')
        player.energy += isMygling ? 0 : game.state.settings.energyRecoveryPerRound
        this.drawCards(game, player)
        if (isBot) this.chooseBotCards(game)
        else this.updatePlayerHand(game, player)
    }

    private async endGame(game: CCGGame) {
        game.state.phase = 'FINISHED'
        await this.delay(3000)
        await this.progressHandler.registerStats(game)
        game.container = await this.progressHandler.getMatchSummary(game)
        game.container.addComponent(ComponentsHelper.createSeparatorComponent(), 'summary_btn_separator')
        game.container.addComponent(summaryBtn(game.id, game.summary.visible), 'summary_btn')
        this.updateGameMessage(game)
    }

    private async resolveEffects(game: CCGGame) {
        this.resolver.sortStack(game)
        let effectSummaryPosted = false
        if (game.state.stack.length === 0) {
            game.state.log.push({
                turn: game.state.turn,
                message: '*No cards played this round*',
            })
        }
        while (game.state.stack.length > 0) {
            effectSummaryPosted = true
            const effect = game.state.stack.shift()
            await this.resolver.resolveSingleEffect(game, effect)
            this.checkForWinner(game)
            this.updatePlayerStates(game)
            this.postEffectSummary(game)
            if (game.state.winnerId) return
        }
        for (const status of [...game.state.statusEffects, ...game.state.statusConditions]) {
            effectSummaryPosted = true
            await this.resolver.tickStatusEffects(game, status)
            this.checkForWinner(game)
            this.updatePlayerStates(game)
            this.postEffectSummary(game)
            if (game.state.winnerId) return
        }
        if (!effectSummaryPosted) this.postEffectSummary(game)
    }

    private checkForWinner(game: CCGGame) {
        if (game.player1.hp <= 0) game.state.winnerId = game.player2.id
        if (game.player2.hp <= 0) game.state.winnerId = game.player1.id
        if (game.player1.hp <= 0 && game.player2.hp <= 0) game.state.winnerId = undefined
    }

    private revealCards(game: CCGGame) {
        const playedCards =
            `${game.player2.name} plays:\n${this.getPlayedCardsString(game.player2)}\n\n` +
            `${game.player1.name} plays:\n${this.getPlayedCardsString(game.player1)}`
        game.container.updateTextComponent('game-text', playedCards)
        game.container.replaceComponent('main-button', getPlayButtons(game, game.state.locked))
        this.updateGameMessage(game)
    }

    private getPlayedCardsString(player: CCGPlayer) {
        const submitted = player.hand.filter((card) => card.selected)
        return submitted
            .map((card) => {
                return card.emoji ? `${card.emoji} ${card.name}` : card.name
            })
            .join('\n')
    }

    private postEffectSummary(game: CCGGame) {
        const summary = game.state.log
            .filter((entry) => entry.turn === game.state.turn)
            .map((entry) => {
                return entry.message
            })
            .join('\n\n')

        if (!summary || summary.length === 0) return
        if (game.container.getComponentIndex('effect-summary') >= 0) {
            game.container.updateTextComponent('effect-summary', summary)
        } else {
            game.container.addComponentAfterReference('effect-summary', ComponentsHelper.createTextComponent().setContent(summary ?? ' '), 'separator2')
            game.container.addComponentAfterReference('separator3', ComponentsHelper.createSeparatorComponent(), 'effect-summary')
        }
        this.updateGameMessage(game)
    }

    private playerHasCondition(game: CCGGame, player: CCGPlayer, status: CCGEffectType) {
        return game.state.statusConditions.some((effect) => effect.ownerId === player.id && effect.type === status)
    }

    private playerHasStatus(game: CCGGame, player: CCGPlayer, status: CCGEffectType) {
        return game.state.statusEffects.some((effect) => effect.ownerId === player.id && effect.type === status)
    }

    private getPlayerCondition(game: CCGGame, player: CCGPlayer, status: CCGEffectType) {
        return game.state.statusConditions.find((effect) => effect.ownerId === player.id && effect.type === status)
    }

    private addEffectsToStack(game: CCGGame, player: CCGPlayer) {
        const submitted = player.hand.filter((card) => card.selected)

        // Track played cards for condition checking and match summary
        let playerEntry = game.state.playedCardsAllGame.find((entry) => entry.playerId === player.id && entry.round === game.state.turn)
        if (!playerEntry) {
            playerEntry = { playerId: player.id, round: game.state.turn, cards: [] }
            game.state.playedCardsAllGame.push(playerEntry)
        }
        playerEntry.cards.push(...submitted)

        for (const card of submitted) {
            const cardId = randomUUID().substring(0, 10)
            const succesful = this.isCardSuccessful(game, player, card)
            const speed = this.getSpeed(game, player, card)
            if (succesful) player.stats.hits += 1
            else player.stats.misses += 1
            if (card.effects?.length ?? 0 > 0) {
                // Group effects by gambleGroup and pick exactly one per group
                const gambleWinners = new Set<CCGCardEffect>()
                const groups = new Map<string, CCGCardEffect[]>()
                for (const effect of card.effects) {
                    if (effect.gambleGroup) {
                        const g = groups.get(effect.gambleGroup) ?? []
                        g.push(effect)
                        groups.set(effect.gambleGroup, g)
                    }
                }
                // Each gamble group contributes exactly one randomly-picked winner to the stack
                for (const group of groups.values()) {
                    gambleWinners.add(group[Math.floor(Math.random() * group.length)])
                }

                const effectsToQueue = card.effects.filter((e) => !e.gambleGroup || gambleWinners.has(e))
                game.state.stack.push(
                    ...effectsToQueue.map((effect) => {
                        return {
                            cardId: cardId,
                            emoji: card.emoji,
                            targetPlayerId: this.getTarget(game, player, effect, card),
                            cardTarget: effect.target,
                            sourceCardName: card.name,
                            sourceCardId: card.id,
                            sourcePlayerId: player.id,
                            speed: speed,
                            accuracy: effect.accuracy ?? 100,
                            cardSuccessful: succesful,
                            type: effect.type,
                            value: effect.value,
                            turns: effect.turns,
                            amount: effect.amount,
                            condition: effect.condition,
                            statusAccuracy: effect.statusAccuracy ?? 100,
                            includeCurrentTurn: effect.includeCurrentTurn,
                            transformCardId: effect.transformCardId,
                            identifier: effect.identifier,
                            summonCardId: effect.summonCardId,
                            delayedTrigger: effect.delayedTrigger,
                            countTarget: effect.countTarget,
                            base: effect.base,
                        }
                    })
                )
            }
        }
    }

    private checkForSpecialCards(game: CCGGame, player: CCGPlayer) {
        const copyCardIds = ['same']
        const submitted = player.hand.filter((card) => card.selected)
        for (const card of submitted) {
            if (card.id === 'same') {
                const cardId = randomUUID().substring(0, 10)
                const succesful = this.isCardSuccessful(game, player, card)
                const opponent = this.getOpponent(game, player.id)
                const opponentCards = opponent.hand.filter((card) => card.selected && !copyCardIds.includes(card.id))?.sort((a, b) => b.cost - a.cost)
                const cardCopied = opponentCards?.length ?? 0 > 0 ? opponentCards[0] : undefined
                if (cardCopied) {
                    this.queueCopiedEffects(game, player, cardId, cardCopied, succesful)
                }
            }
        }
    }

    private queueCopiedEffects(
        game: CCGGame,
        player: CCGPlayer,
        cardId: string,
        copiedCard: CCGCard,
        cardSuccessful: boolean,
        options?: {
            sourceCardName?: string
            statusText?: string
            randomTarget?: boolean
        }
    ) {
        const speed = this.getSpeed(game, player, copiedCard)
        const opponent = this.getOpponent(game, player.id)
        const sourceCardName = options?.sourceCardName ?? copiedCard.name
        const statusText = options?.statusText ?? `${player.name}'s copy`

        game.state.stack.push(
            ...copiedCard.effects.map((effect) => {
                let targetPlayerId = this.getTarget(game, player, effect, copiedCard)
                if (options?.randomTarget) {
                    targetPlayerId = Math.random() > 0.5 ? player.id : opponent.id
                }

                return {
                    cardId,
                    emoji: copiedCard.emoji,
                    statusText,
                    targetPlayerId,
                    sourceCardName,
                    sourceCardId: copiedCard.id,
                    sourcePlayerId: player.id,
                    speed,
                    accuracy: effect.accuracy ?? 100,
                    cardSuccessful,
                    type: effect.type,
                    value: effect.value,
                    turns: effect.turns,
                    condition: effect.condition,
                    includeCurrentTurn: effect.includeCurrentTurn,
                    transformCardId: effect.transformCardId,
                }
            })
        )
    }

    private getTarget(game: CCGGame, player: CCGPlayer, effect: CCGCardEffect, card: CCGCard) {
        const retarded = this.getPlayerCondition(game, player, 'RETARDED')
        const roll = Math.random()
        const flip = retarded && !card.effectImmunities?.includes('RETARDED') && roll < retarded.accuracy / 100
        if (flip) {
            return effect.target === 'OPPONENT' ? player.id : player.opponentId
        } else {
            return effect.target === 'OPPONENT' ? player.opponentId : player.id
        }
    }

    private isCardSuccessful(game: CCGGame, player: CCGPlayer, card: CCGCard) {
        if (card.cannotMiss) return true
        const isChokester = this.playerHasCondition(game, player, 'CHOKESTER')
        const hasChokeShield = this.playerHasStatus(game, player, 'CHOKE_SHIELD')
        let accuracy = isChokester ? 50 : card.accuracy
        accuracy += hasChokeShield ? 20 : 0
        return Math.random() <= accuracy / 100
    }

    private getSpeed(game: CCGGame, player: CCGPlayer, card: CCGCard) {
        const isSlow = !card.effectImmunities?.includes('SLOW') && this.playerHasCondition(game, player, 'SLOW')
        const hasSpeedBuff = this.playerHasStatus(game, player, 'SPEED_BUFF')
        const speedDivisor = isSlow ? GameValues.ccg.status.slow_speedDivideBy : 1
        const speedMultiplier = hasSpeedBuff ? GameValues.ccg.status.speedBuff_multiplier : 1
        return Math.floor((card.speed * speedMultiplier) / speedDivisor) + Math.random()
    }

    private async updatePlayerHand(game: CCGGame, player: CCGPlayer) {
        const mods = CCGCommands.resolveHandModifications(game, player)
        const embed = EmbedUtils.createSimpleEmbed(' ', ' ')
        const handImage = await this.getPlayerHandImage(player, false, mods)
        if (!handImage) return player.handMessage.edit({ content: '', embeds: [embed.setTitle('Waiting for cards...')], components: [], files: [] })
        embed.setImage('attachment://hand.png')
        const attachment = new AttachmentBuilder(handImage, { name: 'hand.png' })
        const buttons = this.getPlayerHandButtons(game, player)
        player.handMessage.edit({ content: '', embeds: [embed], components: [buttons], files: [attachment] })
    }

    /** Derive active CardModifications for a player from the current status effects */
    private static resolveHandModifications(game: CCGGame, player: CCGPlayer): CardModification[] {
        const mods: CardModification[] = []
        for (const effect of game.state.statusEffects) {
            if (effect.ownerId !== player.id) continue
            if (effect.type === 'REDUCE_COST') mods.push({ type: 'COST_DELTA', value: -effect.value, identifier: effect.identifier })
            if (effect.type === 'CHOKE_SHIELD') mods.push({ type: 'ACCURACY_DELTA', value: 20 })
            if (effect.type === 'SPEED_BUFF') mods.push({ type: 'SPEED_MULTIPLIER', value: GameValues.ccg.status.speedBuff_multiplier })
            if (effect.type === 'DAMAGE_BOOST') mods.push({ type: 'DAMAGE_DELTA', value: effect.value })
        }
        for (const condition of game.state.statusConditions) {
            if (condition.ownerId !== player.id) continue
            if (condition.type === 'SLOW') mods.push({ type: 'SPEED_MULTIPLIER', value: 1 / GameValues.ccg.status.slow_speedDivideBy })
            if (condition.type === 'CHOKESTER') mods.push({ type: 'ACCURACY_OVERRIDE', value: 50 })
        }
        return mods
    }

    private async selectCard(interaction: BtnInteraction, player: CCGPlayer) {
        interaction.deferUpdate()
        const cardIndex = Number(interaction.customId.split(';')[2])
        player.hand[cardIndex].selected = !player.hand[cardIndex].selected
        const row = interaction.message.components[0] as any
        ;(row.components as any) = row.components.map((button, index) =>
            ButtonBuilder.from(button as APIButtonComponent).setStyle(player.hand[index].selected ? ButtonStyle.Primary : ButtonStyle.Secondary)
        )
        await player.handMessage.edit({ components: [row] })
    }

    private async joinGame(interaction: BtnInteraction) {
        const user = await this.database.getUser(interaction.user.id)
        const game = this.getGame(interaction)
        if (game && !game.player2 && game.player1.id !== interaction.user.id) {
            const ccgStorage = await this.getCcgStorage()
            const validDeck = await this.userHasValidDeck(interaction, user, ccgStorage)
            if (!validDeck) return this.handleUserHasInvalidDeck(interaction)
            if (!this.userCanJoin(game, user)) return this.messageHelper.replyToInteraction(interaction, 'Du har ikke råd til å være med på denne')
            interaction.deferUpdate()
            game.player2 = this.buildPendingPlayer(interaction)
            game.player2.opponentId = game.player1.id
            game.player1.opponentId = game.player2.id
            game.container.updateTextComponent('sub-header', `### ${game.player1.name} vs ${game.player2.name}`)
            game.container.addComponentAfterReference('game-text', ComponentsHelper.createTextComponent().setContent(`Ready?\n( 0 / 2 )`), 'separator1')
            game.container.addComponentAfterReference('separator2', ComponentsHelper.createSeparatorComponent(), 'game-text')
            game.container.replaceComponent('main-button', readyUpBtn(game.id))
            this.updateGameMessage(game)
        }
    }

    private async cancelGame(interaction: BtnInteraction, game: CCGGame) {
        await game.message.delete()
        const wager = game.wager
        this.games.delete(game.id)
        this.clearGameMessageUpdateState(game.id)
        const user = await this.database.getUser(interaction.user.id)
        if (wager && wager > 0) this.client.bank.giveUnrestrictedMoney(user, wager)
    }

    private userCanJoin(game: CCGGame, user: MazariniUser) {
        if (game.wager && game.wager > 0) {
            return this.client.bank.takeMoney(user, game.wager)
        }
        return true
    }

    private getGame(interaction: BtnInteraction) {
        return this.games.get(interaction.customId.split(';')[1])
    }

    private getPlayer(interaction: BtnInteraction, game: CCGGame) {
        if (game.player1.id === interaction.user.id) return game.player1
        else if (game.player2.id === interaction.user.id) return game.player2
        else return undefined
    }

    private async readyUp(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        if (!player.handMessage) {
            await this.sendPlayerHand(interaction, game, player)
        }
        const ccgStorage = await this.getCcgStorage()
        const appEmojis = await this.client.getEmojis()
        const user = game.vsBot ? undefined : await this.database.getUser(player.id)
        await this.ensurePlayerLoaded(game, player, ccgStorage, appEmojis, user)
        this.drawCards(game, player)
        if (game.vsBot) {
            await this.ensurePlayerLoaded(game, game.player2, ccgStorage, appEmojis)
            this.drawCards(game, game.player2)
            this.chooseBotCards(game)
        }
        await this.updatePlayerHand(game, player)
        if (game.player1.handMessage && (game.vsBot || game.player2.handMessage)) {
            this.startGame(game)
        } else {
            game.container.updateTextComponent('game-text', `Ready?\n( 1 / 2 )`)
        }
        this.updateGameMessage(game)
    }

    private chooseBotCards(game: CCGGame) {
        const wantsToDiscard = this.botResolver.chooseBotCards(game)
        // Only add effects to stack if bot is playing cards, not discarding
        if (!wantsToDiscard) {
            this.addEffectsToStack(game, game.player2)
        } else {
            // Add log entry for bot discarding and remove cards from hand immediately
            // so handlePlayerSubmit doesn't incorrectly deduct energy for discarded cards
            const discardedCards = game.player2.hand.filter((card) => card.selected)
            if (discardedCards.length > 0) {
                game.state.log.push({
                    turn: game.state.turn,
                    message: `*${game.player2.name} discarded ${discardedCards.length} card${discardedCards.length > 1 ? 's' : ''} to mulligan*`,
                })
                game.player2.usedCards.push(...discardedCards)
                game.player2.hand = game.player2.hand.filter((card) => !card.selected)
            }
        }
    }

    private updatePlayerStates(game: CCGGame) {
        game.container.updateTextComponent(game.player1.id, this.getPlayerStateString(game, game.player1))
        game.container.updateTextComponent(game.player2.id, this.getPlayerStateString(game, game.player2))
        this.checkForSpecialEffects(game)
    }

    private startGame(game: CCGGame) {
        if (game.state.phase === 'PLAY') return
        game.state.phase = 'PLAY'
        game.container.removeComponent('sub-header')
        game.container.removeComponent('wager')
        game.container.addComponentAfterReference(
            game.player2.id,
            ComponentsHelper.createTextComponent().setContent(this.getPlayerStateString(game, game.player2)),
            'header'
        )
        game.container.updateTextComponent('game-text', `Choose up to 2 cards\n${game.vsBot ? '' : 'Players submitted: ( 0 / 2 )'}`)
        game.container.addComponentAfterReference(
            game.player1.id,
            ComponentsHelper.createTextComponent().setContent(this.getPlayerStateString(game, game.player1)),
            'separator2'
        )
        game.container.replaceComponent('main-button', getPlayButtons(game))
        game.container.replaceComponent('resendButtons', resendButtons(game.id, true))
    }

    private getPlayerStateString(game: CCGGame, player: CCGPlayer) {
        const statusString = this.getPlayerStatusesString(game, player)
        return `### ${player.name}\n:heart: ${player.hp}    :zap: ${player.energy}    ${player.cardbackEmoji} ${player.deck.length}` + statusString
    }

    private getPlayerStatusesString(game: CCGGame, player: CCGPlayer) {
        let statusString = '\n'
        const conditions = this.getConditionsForPlayer(game, player).filter((effect) => effect.emoji)
        const hasConditions = conditions?.length ?? 0 > 0
        const statuses = this.getEffectsForPlayer(game, player).filter((effect) => effect.emoji)
        const hasStatus = statuses?.length ?? 0 > 0
        if (hasConditions) {
            statusString += `${conditions.map((effect) => effect.emoji).join('  ')}`
        }
        if (hasConditions && hasStatus) {
            statusString = statusString + ' | '
        }
        if (hasStatus) {
            statusString += `${statuses.map((effect) => effect.emoji).join('  ')}`
        }
        return statusString
    }

    private async setupGame(interaction: ChatInteraction, vsBot: boolean) {
        await this.messageHelper.deferReply(interaction)
        const difficulty = vsBot ? (interaction.options.get('difficulty')?.value as string as Difficulty) : undefined
        const mode = vsBot ? (interaction.options.get('mode')?.value as string as Mode) : undefined
        const wager = !vsBot ? SlashCommandHelper.getCleanNumberValue(interaction.options.get('innsats')?.value) : undefined
        const gameId = randomUUID()
        const game: CCGGame = {
            id: gameId,
            channelId: interaction.channelId,
            player1: this.buildPendingPlayer(interaction, vsBot ? MentionUtils.User_IDs.BOT_HOIE : undefined),
            player2: vsBot ? this.buildPendingBotOpponent(difficulty, interaction.user.id) : undefined,
            container: CCGContainer(gameId, interaction.authorName, vsBot),
            state: this.getInitialGameState(),
            vsBot: vsBot,
            summary: { visible: false, round: 1 },
            botDifficulty: difficulty ?? null,
            mode: mode,
            wager: Math.max(wager ?? 0, 0),
        }
        const button = vsBot ? readyUpBtn(game.id) : joinButton(game.id)
        game.container.replaceComponent('main-button', button)
        const resendButtonRow = resendButtons(game.id, false)
        game.container.replaceComponent('resendButtons', resendButtonRow)
        if (game.wager > 0)
            game.container.addComponentAfterReference('wager', ComponentsHelper.createTextComponent().setContent(`Innsats: ${game.wager}`), 'sub-header')
        if (vsBot) {
            game.container.addComponentAfterReference('game-text', ComponentsHelper.createTextComponent().setContent(`Ready?`), 'separator1')
            game.container.addComponentAfterReference('separator2', ComponentsHelper.createSeparatorComponent(), 'game-text')
        }
        const msg = await this.messageHelper.replyToInteraction(interaction, '', { hasBeenDefered: true }, [game.container.container])
        game.message = msg
        this.games.set(gameId, game)
    }

    private buildPendingBotOpponent(difficulty: Difficulty, playerId: string): CCGPlayer {
        return {
            id: MentionUtils.User_IDs.BOT_HOIE,
            name: 'Høie',
            deck: [],
            hand: [],
            usedCards: [],
            energy: GameValues.ccg.gameSettings.startingEnergy,
            hp: GameValues.ccg.gameSettings.startingHP,
            handMessage: undefined,
            submitted: false,
            opponentId: playerId,
            stunned: false,
            stats: this.freshCCGStats(),
            cardbackEmoji: '',
        }
    }

    private buildPendingPlayer(interaction: ChatInteraction | BtnInteraction, opponentId?: string): CCGPlayer {
        return {
            id: interaction.user.id,
            name: interaction.authorName,
            deck: [],
            hand: [],
            usedCards: [],
            energy: GameValues.ccg.gameSettings.startingEnergy,
            hp: GameValues.ccg.gameSettings.startingHP,
            handMessage: undefined,
            submitted: false,
            opponentId: opponentId,
            stunned: false,
            stats: this.freshCCGStats(),
            cardbackEmoji: '',
        }
    }

    private async ensurePlayerLoaded(
        game: CCGGame,
        player: CCGPlayer,
        cards: ICCGSystem,
        appEmojis: Collection<string, ApplicationEmoji>,
        user?: MazariniUser
    ) {
        if (player.deck.length > 0 && player.cardbackEmoji) return
        if (player.id === MentionUtils.User_IDs.BOT_HOIE) {
            const botCards = await this.getBotCards(game.botDifficulty, cards, appEmojis)
            player.deck = RandomUtils.shuffleList(structuredClone(botCards))
            player.cardbackEmoji = await this.getCardbackEmoji(undefined, appEmojis)
            return
        }

        const resolvedUser = user ?? (await this.database.getUser(player.id))
        const playerCards = await this.getPlayerCards(resolvedUser, cards, appEmojis)
        player.deck = RandomUtils.shuffleList(structuredClone(playerCards))
        player.cardbackEmoji = await this.getCardbackEmoji(resolvedUser, appEmojis)
    }

    private async setupBotOpponent(difficulty: Difficulty, playerId: string) {
        const cards = await this.getBotCards(difficulty)
        return {
            id: MentionUtils.User_IDs.BOT_HOIE,
            name: 'Høie',
            deck: RandomUtils.shuffleList(structuredClone(cards)),
            hand: [],
            usedCards: [],
            energy: GameValues.ccg.gameSettings.startingEnergy,
            hp: GameValues.ccg.gameSettings.startingHP,
            handMessage: undefined,
            submitted: false,
            opponentId: playerId,
            stunned: false,
            stats: this.freshCCGStats(),
            cardbackEmoji: await this.getCardbackEmoji(),
        }
    }

    private getInitialGameState(): CCGGameState {
        return {
            phase: 'DRAW',
            turn: 1,
            stack: new Array<CCGEffect>(),
            statusEffects: new Array<StatusEffect>(),
            statusConditions: new Array<StatusEffect>(),
            log: new Array<CCGLogEntry>(),
            settings: GameValues.ccg.gameSettings,
            locked: false,
            playedCardsAllGame: [],
        }
    }

    private async newPlayer(interaction: ChatInteraction | BtnInteraction, vsBot = false): Promise<CCGPlayer> {
        const user = await this.database.getUser(interaction.user.id)
        const cards = await this.getPlayerCards(user)
        return {
            id: interaction.user.id,
            name: interaction.authorName,
            deck: RandomUtils.shuffleList(structuredClone(cards)),
            hand: [],
            usedCards: [],
            energy: GameValues.ccg.gameSettings.startingEnergy,
            hp: GameValues.ccg.gameSettings.startingHP,
            handMessage: undefined,
            submitted: false,
            opponentId: vsBot ? MentionUtils.User_IDs.BOT_HOIE : undefined,
            stunned: false,
            stats: this.freshCCGStats(),
            cardbackEmoji: await this.getCardbackEmoji(user),
        }
    }

    private async getCardbackEmoji(user?: MazariniUser, appEmojis?: Collection<string, ApplicationEmoji>) {
        const cardback = user?.ccg?.cardback ?? GameValues.ccg.defaultCardback
        const emoji = appEmojis ? this.client.getEmojiFromCollection(`cardback_${cardback}`, appEmojis) : await this.client.getEmoji(`cardback_${cardback}`)
        return emoji.id
    }

    private freshCCGStats() {
        return {
            won: 0,
            lost: 0,
            chipsWon: 0,
            gamesPlayed: 1,
            cardsPlayed: new Array<CCGCardStats>(),
            damageDealt: 0,
            damageTaken: 0,
            statused: new Array<CCGStatusStats>(),
            hits: 0,
            misses: 0,
        }
    }

    private async getPlayerCards(user: MazariniUser, cards?: ICCGSystem, appEmojis?: Collection<string, ApplicationEmoji>): Promise<CCGCard[]> {
        const resolvedCards = cards ?? (await this.getCcgStorage())
        const resolvedEmojis = appEmojis ?? (await this.client.getEmojis())
        const deck = user.ccg?.decks?.find((deck) => deck.active) ?? GameValues.ccg.defaultDeck
        return await this.getFullCards(deck, resolvedCards, resolvedEmojis)
    }

    private async getBotCards(difficulty: Difficulty, cards?: ICCGSystem, appEmojis?: Collection<string, ApplicationEmoji>): Promise<CCGCard[]> {
        const resolvedCards = cards ?? (await this.getCcgStorage())
        const resolvedEmojis = appEmojis ?? (await this.client.getEmojis())
        const deck = RandomUtils.getRandomItemFromList(GameValues.ccg.botDeck[difficulty])
        return await this.getFullCards(deck, resolvedCards, resolvedEmojis)
    }

    private async getFullCards(deck: ICCGDeck, cards?: ICCGSystem, appEmojis?: Collection<string, ApplicationEmoji>) {
        const resolvedCards = cards ?? (await this.getCcgStorage())
        const resolvedEmojis = appEmojis ?? (await this.client.getEmojis())
        const userCards = new Array<CCGCard>()
        for (const item of deck.cards) {
            const series = resolvedCards[item.series] as CCGCard[]
            const card = series?.find((card) => card.id === item.id)
            if (!card) {
                this.messageHelper.sendLogMessage(`CCG: card not found in deck – series=${item.series}, id=${item.id}`)
                continue
            }
            const emojiName = SERIES_EMOJI_IS_ID.has(card.series) ? card.id : `${card.series}_${card.id}`
            const emoji = this.client.getEmojiFromCollection(emojiName, resolvedEmojis)
            const fullCard = { ...card, selected: false, emoji: emoji.id }
            for (let i = 0; i < item.amount; i++) userCards.push(structuredClone(fullCard))
        }
        return userCards
    }

    private async userHasValidDeck(interaction: ChatInteraction | BtnInteraction, user?: MazariniUser, cards?: ICCGSystem) {
        if (environment === 'dev') return true // skip deck validation in development for faster testing
        const resolvedUser = user ?? (await this.database.getUser(interaction.user.id))
        const resolvedCards = cards ?? (await this.getCcgStorage())
        const deck = resolvedUser.ccg?.decks?.find((deck) => deck.active) ?? GameValues.ccg.defaultDeck
        deck.valid = true
        CCGValidator.validateDeckWithCards(resolvedUser, deck, new Array<string>(), resolvedCards)
        return deck.valid
    }

    private handleUserHasInvalidDeck(interaction: ChatInteraction | BtnInteraction) {
        return this.messageHelper.replyToInteraction(interaction, 'Ditt aktive deck er ugyldig og må oppdateres før du kan spille.')
    }

    private getOpponent(game: CCGGame, playerId: string) {
        return game.player1.id === playerId ? game.player2 : game.player1
    }

    private checkForSpecialEffects(game: CCGGame) {
        for (const effect of game.state.statusEffects) {
            if (game.container.getComponentIndex(effect.id) < 0) {
                //check if game-container already has this effect
                if (effect.type === 'VIEW_HAND') {
                    const opponent = this.getOpponent(game, effect.ownerId)
                    const btn = viewHandBtn(game.id, effect.ownerId, opponent.name, effect.id)
                    game.container.addComponentAfterReference(effect.id, btn, effect.ownerId)
                }
            }
        }
    }

    private async viewOpponentHand(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        const customId = interaction.customId.split(';')
        if (player.id !== customId[2]) return interaction.deferUpdate()
        else {
            const opponent = this.getOpponent(game, player.id)
            const msg = await this.messageHelper.replyToInteraction(interaction, `Fetching ${opponent.name}'s hand...`, { ephemeral: !game.vsBot })

            const effectId = customId[3]
            const index = game.state.statusEffects.findIndex((effect) => effect.id === effectId)
            game.state.statusEffects.splice(index, 1)
            game.container.removeComponent(effectId)
            this.updateGameMessage(game)

            const handImage = await this.getPlayerHandImage(opponent, true)
            const attachment = new AttachmentBuilder(handImage, { name: 'hand.png' })
            const embed = EmbedUtils.createSimpleEmbed(' ', ' ').setImage('attachment://hand.png')
            msg.edit({ content: '', embeds: [embed], files: [attachment] })
        }
    }

    private clearGameMessageUpdateState(gameId: string) {
        this.gameMessageUpdateRequested.delete(gameId)
        this.gameMessageUpdateQueue.delete(gameId)
    }

    private updateGameMessage(game: CCGGame) {
        if (!game.message) return Promise.resolve()

        const queuedUpdate = this.gameMessageUpdateQueue.get(game.id) ?? Promise.resolve()
        this.gameMessageUpdateRequested.add(game.id)

        const nextUpdate = queuedUpdate
            .catch(() => undefined)
            .then(async () => {
                while (this.gameMessageUpdateRequested.has(game.id) && game.message) {
                    this.gameMessageUpdateRequested.delete(game.id)
                    await game.message.edit({ components: [game.container.container] })
                }
            })

        const trackedUpdate = nextUpdate.finally(() => {
            if (this.gameMessageUpdateQueue.get(game.id) === trackedUpdate) {
                this.gameMessageUpdateQueue.delete(game.id)
            }
        })

        this.gameMessageUpdateQueue.set(game.id, trackedUpdate)
        return trackedUpdate
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    private async executeSubCommand(interaction: ChatInteraction) {
        const cmd = interaction.options.getSubcommand()
        const cmdGroup = interaction.options.getSubcommandGroup()
        if (cmdGroup && cmdGroup === 'play') {
            if (!this.getCardGenerator().isReady)
                return this.messageHelper.replyToInteraction(interaction, 'Kortbilder genereres fortsatt, prøv igjen om litt.')
            const vsBot = cmd === 'bot'
            const user = await this.database.getUser(interaction.user.id)
            const ccgStorage = await this.getCcgStorage()
            const validDeck = await this.userHasValidDeck(interaction, user, ccgStorage)
            if (!validDeck) return this.handleUserHasInvalidDeck(interaction)
            const canAfford = this.userCanAfford(user, interaction, vsBot)
            if (!canAfford) return this.messageHelper.replyToInteraction(interaction, 'Du har ikke råd til dette')
            await this.setupGame(interaction, vsBot)
        } else if (cmd === 'help') this.helper.newCCGHelper(interaction)
        else if (cmd === 'stats') this.statViewer.newCCGStatView(interaction)
    }

    private userCanAfford(user: MazariniUser, interaction: ChatInteraction, vsBot: boolean) {
        if (vsBot) {
            // if ((user.ccg?.weeklyShardsEarned ?? 0) >= GameValues.ccg.rewards.weeklyLimit) return true
            const mode = interaction.options.get('mode')?.value as string as Mode
            return mode === Mode.Practice || this.client.bank.takeMoney(user, GameValues.ccg.rewards.entryFee)
        } else {
            const wager = SlashCommandHelper.getCleanNumberValue(interaction.options.get('innsats')?.value)
            return !wager || wager <= 0 || this.client.bank.takeMoney(user, wager)
        }
    }

    private toggleSummary(interaction: BtnInteraction) {
        const game = this.getGame(interaction)
        if (!game) return this.messageHelper.replyToInteraction(interaction, 'Dette gamet er for gammelt')
        interaction.deferUpdate()
        game.summary.visible = !game.summary.visible
        game.container.replaceComponent('summary_btn', summaryBtn(game.id, game.summary.visible))
        if (game.summary.visible) {
            const summary = this.getSummary(game)
            game.container.addComponent(ComponentsHelper.createSeparatorComponent(), 'summary_separator')
            game.container.addComponent(summaryPageBtn(game.id), 'summary_page_btn')
            game.container.addComponent(ComponentsHelper.createTextComponent().setContent(summary), 'summary_text')
        } else {
            game.container.removeComponent('summary_separator')
            game.container.removeComponent('summary_page_btn')
            game.container.removeComponent('summary_text')
        }
        this.updateGameMessage(game)
    }

    private changeSummaryRound(interaction: BtnInteraction) {
        const game = this.getGame(interaction)
        if (!game) return this.messageHelper.replyToInteraction(interaction, 'Dette gamet er for gammelt')
        interaction.deferUpdate()
        const pageChange = interaction.customId.split(';')[2] === 'next' ? 1 : -1
        game.summary.round = this.mod(game.summary.round + pageChange - 1, game.state.turn) + 1
        game.container.updateTextComponent('summary_text', this.getSummary(game))
        this.updateGameMessage(game)
    }

    private mod(n: number, m: number): number {
        return ((n % m) + m) % m
    }

    private getSummary(game: CCGGame) {
        const roundLog = game.state.log
            .filter((entry) => entry.turn === game.summary.round)
            .map((entry) => entry.message)
            .join('\n\n')

        const cardsPlayedThisRound = game.state.playedCardsAllGame
            .filter((entry) => entry.round === game.summary.round)
            .map((entry) => {
                const player = game.player1.id === entry.playerId ? game.player1 : game.player2
                const cardNames = entry.cards.map((c) => c.name).join(', ')
                return `${player.name}: ${cardNames}`
            })
            .join('\n')

        const cardsSection = cardsPlayedThisRound ? `**Cards Played:**\n${cardsPlayedThisRound}\n\n` : ''
        return `Round ${game.summary.round} of ${game.state.turn}\n\n${cardsSection}${roundLog}`
    }

    private async resendMessages(interaction: BtnInteraction, game: CCGGame) {
        if (game.state.locked) return this.messageHelper.replyToInteraction(interaction, 'Vent til runden er ferdig')
        await interaction.deferUpdate()
        await game.message.delete()
        game.message = await this.messageHelper.sendMessage(interaction.channelId, { components: [game.container.container] }, { isComponentOnly: true })
    }

    private verifyUserAndCallMethod(interaction: BtnInteraction, callback: (game?: CCGGame, player?: CCGPlayer) => void) {
        const game = this.getGame(interaction)
        if (!game) return this.messageHelper.replyToInteraction(interaction, 'Dette spillet er ikke lenger tilgjengelig', { ephemeral: true })
        const player = this.getPlayer(interaction, game)
        if (player) {
            callback(game, player)
        } else this.messageHelper.replyToInteraction(interaction, 'du er ikke med i dette spillet', { ephemeral: true })
    }

    private async resetRewards(weekly: boolean) {
        const users = await this.database.getAllUsers()
        const usersWithStats = users.filter((user) => user.ccg?.weeklyShardsEarned ?? 0 > 0)
        for (const user of usersWithStats) {
            user.ccg.dailyShardBonusClaimed = false
            user.ccg.weeklyShardsEarned = weekly ? 0 : user.ccg.weeklyShardsEarned
            await this.database.updateUser(user)
        }
        return true
    }

    private deleteFinishedGames() {
        const finishedGames = Array.from(this.games.values()).filter((game) => game.state.phase === 'FINISHED')
        for (const game of finishedGames) {
            this.games.delete(game.id)
            this.clearGameMessageUpdateState(game.id)
        }
        return true
    }

    override onSave(): Promise<boolean> {
        for (const game of this.games.values()) {
            if (!(game.state.phase === 'FINISHED')) {
                this.client.cache.restartImpediments.push(`${game.player1.name} har et aktivt CCG game mot ${game.player2?.name ?? '...'}`)
            }
        }
        return Promise.resolve(true)
    }

    // eslint-disable-next-line require-await
    async onTimedEvent(): Promise<IOnTimedEvent> {
        return { daily: [() => this.resetRewards(false), () => this.deleteFinishedGames()], weekly: [() => this.resetRewards(true)], hourly: [] }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'ccg',
                        command: (interaction: ChatInteraction) => {
                            this.executeSubCommand(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'CCG_JOIN',
                        command: (interaction: ButtonInteraction) => {
                            this.joinGame(interaction)
                        },
                    },
                    {
                        commandName: 'CCG_CANCEL',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game) => this.cancelGame(interaction, game))
                        },
                    },
                    {
                        commandName: 'CCG_READY_UP',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.readyUp(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'CCG_CARD',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.selectCard(interaction, player))
                        },
                    },
                    {
                        commandName: 'CCG_READY',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.submitCards(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'CCG_DISCARD',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.discardCards(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'CCG_CONTINUE',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game) => this.startNextRound(interaction, game))
                        },
                    },
                    {
                        commandName: 'CCG_CONCEDE',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.concedeGame(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'CCG_CONFIRM_CONCEDE',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.confirmConcedeGame(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'CCG_HELPER',
                        command: (interaction: ButtonInteraction) => {
                            this.helper.setCategory(interaction)
                        },
                    },
                    {
                        commandName: 'CCG_HELPER_SUB',
                        command: (interaction: ButtonInteraction) => {
                            this.helper.setSubCategory(interaction)
                        },
                    },
                    {
                        commandName: 'CCG_VIEW_HAND',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.viewOpponentHand(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'CCG_MOVE_DOWN',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game) => this.resendMessages(interaction, game))
                        },
                    },
                    {
                        commandName: 'CCG_SEND_HAND',
                        command: (interaction: ButtonInteraction) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.sendPlayerHand(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'CCG_SUMMARY',
                        command: (interaction: ButtonInteraction) => {
                            this.toggleSummary(interaction)
                        },
                    },
                    {
                        commandName: 'CCG_SUMMARY_PAGE',
                        command: (interaction: ButtonInteraction) => {
                            this.changeSummaryRound(interaction)
                        },
                    },
                    {
                        commandName: 'CCG_STATS',
                        command: (interaction: ButtonInteraction) => {
                            this.statViewer.setUser(interaction)
                        },
                    },
                    {
                        commandName: 'CCG_STATS_DIFFICULTY',
                        command: (interaction: ButtonInteraction) => {
                            this.statViewer.setDifficulty(interaction)
                        },
                    },
                ],
            },
        }
    }
}

const joinButton = (gameId: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_JOIN;${gameId}`,
            style: ButtonStyle.Primary,
            disabled: false,
            label: 'Join',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `CCG_CANCEL;${gameId}`,
            style: ButtonStyle.Secondary,
            disabled: false,
            label: 'Cancel',
            type: 2,
        })
    )
}

const readyUpBtn = (gameId: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_READY_UP;${gameId}`,
            style: ButtonStyle.Success,
            disabled: false,
            label: 'Ready',
            type: 2,
        })
    )
}

const getPlayButtons = (game: CCGGame, disabled = false) => {
    const components = [
        new ButtonBuilder({
            custom_id: `CCG_READY;${game.id}`,
            style: ButtonStyle.Success,
            disabled: disabled,
            label: 'Play',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `CCG_DISCARD;${game.id}`,
            style: ButtonStyle.Secondary,
            disabled: disabled,
            label: 'Discard',
            type: 2,
        }),
    ]
    // Add concede button if PvP
    if (!game.vsBot) {
        components.push(
            new ButtonBuilder({
                custom_id: `CCG_CONCEDE;${game.id}`,
                style: ButtonStyle.Secondary,
                disabled: disabled,
                label: `Concede`,
                type: 2,
            })
        )
    }
    return new ActionRowBuilder<ButtonBuilder>().addComponents(...components)
}

const confirmConcede = (gameId: string, userId: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_CONFIRM_CONCEDE;${gameId};${userId}`,
            style: ButtonStyle.Danger,
            disabled: false,
            label: 'Confirm Concede',
            type: 2,
        })
    )
}

const nextRoundBtn = (gameId: string, disabled = false) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_CONTINUE;${gameId}`,
            style: ButtonStyle.Success,
            disabled: disabled,
            label: 'Next round',
            type: 2,
        })
    )
}

const cardBtn = (gameId: string, cardId: number, card: CCGCard) => {
    // const emoji = rewarded >= 20000 ? { name: 'arne', id: '860282686605230130' } : { name: 'pointerbrothers1', id: '1177653110852825158' }
    return new ButtonBuilder({
        custom_id: `CCG_CARD;${gameId};${cardId}`,
        style: ButtonStyle.Secondary,
        disabled: false,
        label: `${card.name}`,
        type: 2,
    })
}

const viewHandBtn = (gameId: string, ownerId: string, opponentName: string, effectId: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_VIEW_HAND;${gameId};${ownerId};${effectId}`,
            style: ButtonStyle.Primary,
            disabled: false,
            label: `See ${opponentName}'s hand`,
            type: 2,
        })
    )
}

const resendButtons = (gameId: string, includeHandBtn: boolean) => {
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_MOVE_DOWN;${gameId}`,
            style: ButtonStyle.Secondary,
            disabled: false,
            label: 'Move down',
            type: 2,
        })
    )
    if (includeHandBtn)
        buttonRow.addComponents(
            new ButtonBuilder({
                custom_id: `CCG_SEND_HAND;${gameId}`,
                style: ButtonStyle.Secondary,
                disabled: false,
                label: 'Re-send hand',
                type: 2,
            })
        )
    return buttonRow
}

const summaryBtn = (gameId: string, visible: boolean) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_SUMMARY;${gameId}`,
            style: ButtonStyle.Secondary,
            disabled: false,
            label: visible ? 'Hide summary' : 'Get summary',
            type: 2,
        })
    )
}

const summaryPageBtn = (gameId: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_SUMMARY_PAGE;${gameId};previous`,
            style: ButtonStyle.Secondary,
            disabled: false,
            label: 'Previous round',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `CCG_SUMMARY_PAGE;${gameId};next`,
            style: ButtonStyle.Secondary,
            disabled: false,
            label: 'Next round',
            type: 2,
        })
    )
}
