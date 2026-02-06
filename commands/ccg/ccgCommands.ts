import { randomUUID } from 'crypto'
import { ActionRowBuilder, APIButtonComponent, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { ImageGenerationHelper } from '../../helpers/imageGenerationHelper'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { ICCGDeck, MazariniUser } from '../../interfaces/database/databaseInterface'
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

export class CCGCommands extends AbstractCommands {
    private games: Map<string, CCGGame>
    private resolver: CardActionResolver
    private botResolver: BotResolver
    private igh: ImageGenerationHelper
    private progressHandler: ProgressionHandler
    private helper: CCGHelp
    private statViewer: CCGStatView

    constructor(client: MazariniClient) {
        super(client)
        this.igh = new ImageGenerationHelper(this.client)
        this.helper = new CCGHelp(this.client)
        this.games = new Map<string, CCGGame>()
        this.resolver = new CardActionResolver()
        this.botResolver = new BotResolver()
        this.progressHandler = new ProgressionHandler(this.client)
        this.statViewer = new CCGStatView(this.client)
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

    private async getPlayerHandImage(player: CCGPlayer, includeAll = false) {
        const cards = player.hand.filter((card) => includeAll || !player.submitted || !card.selected)
        if (!cards || cards.length === 0) return undefined
        const buffers = await Promise.all(
            cards.map(async (card) => {
                return Buffer.from(await this.getCardImage(card))
            })
        )
        return await this.igh.stitchImages(buffers, 'horizontal')
    }

    private async getCardImage(card: CCGCard) {
        const path = `loot/${card.series}/${card.id}_small.png`
        return await this.database.getFromStorage(path)
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
        const submitted = player.hand.filter((card) => card.selected)
        if (submitted.length > game.state.settings.maxCardsPlayed) {
            return this.messageHelper.replyToInteraction(interaction, `Du kan ikke spille mer enn ${game.state.settings.maxCardsPlayed} kort om gangen`, {
                ephemeral: true,
            })
        }
        const costReduction = this.getEffectsForPlayer(game, player, 'REDUCE_COST').reduce((sum, effect) => (sum += effect.value), 0)
        const submittedCost = submitted.reduce((sum, card) => (sum += Math.max(card.cost - costReduction, 0)), 0)
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
        interaction.deferUpdate()
        player.hand = player.hand.filter((card) => !card.selected)
        player.submitted = true
        this.handlePlayerSubmit(game, player)
    }

    private async handlePlayerSubmit(game: CCGGame, player: CCGPlayer) {
        await this.updatePlayerHand(game, player)
        if (game.player1.submitted && game.player2.submitted) {
            if (game.vsBot) {
                const botSubmitted = game.player2.hand.filter((card) => card.selected)
                const botCostReduction = this.getEffectsForPlayer(game, game.player2, 'REDUCE_COST').reduce((sum, effect) => (sum += effect.value), 0)
                const botCost = botSubmitted.reduce((sum, card) => (sum += Math.max(card.cost - botCostReduction, 0)), 0)
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
        game.state.locked = true
        game.state.phase = 'RESOLVE'

        this.checkForSpecialCards(game, game.player1)
        this.checkForSpecialCards(game, game.player2)
        this.revealCards(game)
        await this.resolveEffects(game)

        if (game.state.winnerId) {
            this.endGame(game)
        } else {
            game.container.replaceComponent('main-button', nextRoundBtn(game.id))
            game.state.locked = false
            this.updateGameMessage(game)
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
        game.container.replaceComponent('main-button', readyBtn(game.id, !game.vsBot))
        this.preparePlayerForNewRound(game, game.player1)
        this.preparePlayerForNewRound(game, game.player2, game.vsBot)
        this.updatePlayerStates(game)
        this.updateGameMessage(game)
        if (!game.vsBot) {
            setTimeout(() => {
                game.container.replaceComponent('main-button', readyBtn(game.id))
                this.updateGameMessage(game)
            }, 3000)
        }
    }

    private preparePlayerForNewRound(game: CCGGame, player: CCGPlayer, isBot = false) {
        player.usedCards.push(...player.hand.filter((card) => card.selected))
        player.hand = player.hand.filter((card) => !card.selected)
        player.submitted = false
        player.energy += game.state.settings.energyRecoveryPerRound
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
        game.container.replaceComponent('main-button', readyBtn(game.id, game.state.locked))
        this.updateGameMessage(game)
    }

    private getPlayedCardsString(player: CCGPlayer) {
        const submitted = player.hand.filter((card) => card.selected)
        return submitted
            .map((card) => {
                return `${card.emoji} ${card.name}`
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

    private addEffectsToStack(game: CCGGame, player: CCGPlayer) {
        const submitted = player.hand.filter((card) => card.selected)
        for (const card of submitted) {
            const cardId = randomUUID().substring(0, 10)
            const succesful = this.isCardSuccessful(game, player, card)
            const speed = this.getSpeed(game, player, card)
            if (succesful) player.stats.hits += 1
            else player.stats.misses += 1
            if (card.effects?.length ?? 0 > 0) {
                game.state.stack.push(
                    ...card.effects.map((effect) => {
                        return {
                            cardId: cardId,
                            emoji: card.emoji,
                            targetPlayerId: this.getTarget(game, player, effect),
                            sourceCardName: card.name,
                            sourcePlayerId: player.id,
                            speed: speed,
                            accuracy: effect.accuracy ?? 100,
                            cardSuccessful: succesful,
                            type: effect.type,
                            value: effect.value,
                            turns: effect.turns,
                        }
                    })
                )
            }
        }
    }

    private checkForSpecialCards(game: CCGGame, player: CCGPlayer) {
        const submitted = player.hand.filter((card) => card.selected)
        for (const card of submitted) {
            if (card.id === 'same') {
                const cardId = randomUUID().substring(0, 10)
                const succesful = this.isCardSuccessful(game, player, card)
                const opponent = this.getOpponent(game, player.id)
                const opponentCards = opponent.hand.filter((card) => card.selected)?.sort((a, b) => b.cost - a.cost)
                const cardCopied = opponentCards?.length ?? 0 > 0 ? opponentCards[0] : undefined
                if (cardCopied) {
                    const speed = this.getSpeed(game, player, cardCopied)
                    game.state.stack.push(
                        ...cardCopied.effects.map((effect) => {
                            return {
                                cardId: cardId,
                                emoji: cardCopied.emoji,
                                targetPlayerId: this.getTarget(game, player, effect),
                                sourceCardName: cardCopied.name,
                                sourcePlayerId: player.id,
                                speed: speed,
                                accuracy: effect.accuracy ?? 100,
                                cardSuccessful: succesful,
                                type: effect.type,
                                value: effect.value,
                                turns: effect.turns,
                            }
                        })
                    )
                }
            }
        }
    }

    private getTarget(game: CCGGame, player: CCGPlayer, effect: CCGCardEffect) {
        const isRetarded = this.playerHasCondition(game, player, 'RETARDED')
        if (isRetarded) return RandomUtils.getRandomItemFromList([player.id, player.opponentId])
        else return effect.target === 'OPPONENT' ? player.opponentId : player.id
    }

    private isCardSuccessful(game: CCGGame, player: CCGPlayer, card: CCGCard) {
        const isChokester = this.playerHasCondition(game, player, 'CHOKESTER')
        const hasChokeShield = this.playerHasStatus(game, player, 'CHOKE_SHIELD')
        let accuracy = isChokester ? 50 : card.accuracy
        accuracy += hasChokeShield ? 20 : 0
        return Math.random() <= accuracy / 100
    }

    private getSpeed(game: CCGGame, player: CCGPlayer, card: CCGCard) {
        const isSlow = this.playerHasCondition(game, player, 'SLOW')
        const speedDivisor = isSlow ? GameValues.ccg.status.slow_speedDivideBy : 1
        return Math.floor(card.speed / speedDivisor) + Math.random()
    }

    private async updatePlayerHand(game: CCGGame, player: CCGPlayer) {
        const embed = EmbedUtils.createSimpleEmbed(' ', ' ')
        const handImage = await this.getPlayerHandImage(player)
        if (!handImage) return player.handMessage.edit({ content: '', embeds: [embed.setTitle('Waiting for cards...')], components: [], files: [] })
        embed.setImage('attachment://hand.png')
        const attachment = new AttachmentBuilder(handImage, { name: 'hand.png' })
        const buttons = this.getPlayerHandButtons(game, player)
        player.handMessage.edit({ content: '', embeds: [embed], components: [buttons], files: [attachment] })
    }

    private async selectCard(interaction: BtnInteraction, player: CCGPlayer) {
        interaction.deferUpdate()
        const cardIndex = Number(interaction.customId.split(';')[2])
        player.hand[cardIndex].selected = !player.hand[cardIndex].selected
        const row = interaction.message.components[0] as any
        ;(row.components as any) = row.components.map((button) =>
            button.customId === interaction.customId
                ? ButtonBuilder.from(button as APIButtonComponent).setStyle(
                      (button as APIButtonComponent).style === ButtonStyle.Secondary ? ButtonStyle.Primary : ButtonStyle.Secondary
                  )
                : button
        )
        await player.handMessage.edit({ components: [row] })
    }

    private async joinGame(interaction: BtnInteraction) {
        const user = await this.database.getUser(interaction.user.id)
        const game = this.getGame(interaction)
        if (game && !game.player2 && game.player1.id !== interaction.user.id) {
            if (!this.userCanJoin(game, user)) return this.messageHelper.replyToInteraction(interaction, 'Du har ikke råd til å være med på denne')
            interaction.deferUpdate()
            game.player2 = await this.newPlayer(interaction)
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
        this.drawCards(game, player)
        if (game.vsBot) {
            this.drawCards(game, game.player2)
            this.chooseBotCards(game)
        }
        await this.sendPlayerHand(interaction, game, player)
        if (game.player1.handMessage && (game.vsBot || game.player2.handMessage)) {
            this.startGame(game)
        } else {
            game.container.updateTextComponent('game-text', `Ready?\n( 1 / 2 )`)
        }
        this.updateGameMessage(game)
    }

    private chooseBotCards(game: CCGGame) {
        this.botResolver.chooseBotCards(game)
        this.addEffectsToStack(game, game.player2)
    }

    private updatePlayerStates(game: CCGGame) {
        game.container.updateTextComponent(game.player1.id, this.getPlayerStateString(game, game.player1))
        game.container.updateTextComponent(game.player2.id, this.getPlayerStateString(game, game.player2))
        this.checkForSpecialEffects(game)
    }

    private startGame(game: CCGGame) {
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
        game.container.replaceComponent('main-button', readyBtn(game.id))
        game.container.replaceComponent('resendButtons', resendButtons(game.id, true))
    }

    private getPlayerStateString(game: CCGGame, player: CCGPlayer) {
        const statusString = this.getPlayerStatusesString(game, player)
        return `### ${player.name}\n:heart: ${player.hp}    :zap: ${player.energy}    ${player.cardbackEmoji} ${player.deck.length}` + statusString
    }

    private getPlayerStatusesString(game: CCGGame, player: CCGPlayer) {
        const statuses = this.getConditionsForPlayer(game, player).filter((effect) => effect.emoji)
        if (statuses?.length ?? 0 > 0) {
            return `\n${statuses.map((effect) => effect.emoji).join('    ')}`
        }
        return ''
    }

    private async setupGame(interaction: ChatInteraction, vsBot: boolean) {
        await this.messageHelper.deferReply(interaction)
        const difficulty = vsBot ? (interaction.options.get('difficulty')?.value as string as Difficulty) : undefined
        const mode = vsBot ? (interaction.options.get('mode')?.value as string as Mode) : undefined
        const wager = !vsBot ? SlashCommandHelper.getCleanNumberValue(interaction.options.get('innsats')?.value) : undefined
        const gameId = randomUUID()
        const game: CCGGame = {
            id: gameId,
            player1: await this.newPlayer(interaction, vsBot),
            player2: vsBot ? await this.setupBotOpponent(difficulty, interaction.user.id) : undefined,
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

    private async getCardbackEmoji(user?: MazariniUser) {
        const cardback = user?.ccg?.cardback ?? GameValues.ccg.defaultCardback
        const emoji = await EmojiHelper.getApplicationEmoji(`cardback_${cardback}`, this.client)
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

    private async getPlayerCards(user: MazariniUser): Promise<CCGCard[]> {
        const deck = user.ccg?.decks?.find((deck) => deck.active && deck.valid) ?? GameValues.ccg.defaultDeck
        return await this.getFullCards(deck)
    }

    private async getBotCards(difficulty: Difficulty): Promise<CCGCard[]> {
        const deck = GameValues.ccg.botDeck[difficulty]
        return await this.getFullCards(deck)
    }

    private async getFullCards(deck: ICCGDeck) {
        const cards = (await this.database.getStorage()).ccg
        const userCards = new Array<CCGCard>()
        for (const item of deck.cards) {
            const series = cards[item.series] as CCGCard[]
            const card = series.find((card) => card.id === item.id)
            const emoji = await EmojiHelper.getApplicationEmoji(`${card.series}_${card.id}`, this.client)
            const fullCard = { ...card, selected: false, emoji: emoji.id }
            for (let i = 0; i < item.amount; i++) userCards.push(structuredClone(fullCard))
        }
        return userCards
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

    private updateGameMessage(game: CCGGame) {
        if (game.message) game.message.edit({ components: [game.container.container] })
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    private async executeSubCommand(interaction: ChatInteraction) {
        const cmd = interaction.options.getSubcommand()
        const cmdGroup = interaction.options.getSubcommandGroup()
        if (cmdGroup && cmdGroup === 'play') {
            const vsBot = cmd === 'bot'
            const canAfford = await this.userCanAfford(interaction, vsBot)
            if (!canAfford) return this.messageHelper.replyToInteraction(interaction, 'Du har ikke råd til dette')
            this.setupGame(interaction, vsBot)
        } else if (cmd === 'help') this.helper.newCCGHelper(interaction)
        else if (cmd === 'stats') this.statViewer.newCCGStatView(interaction)
    }

    private async userCanAfford(interaction: ChatInteraction, vsBot: boolean) {
        const user = await this.database.getUser(interaction.user.id)
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
        const summary = game.state.log
            .filter((entry) => entry.turn === game.summary.round)
            .map((entry) => {
                return entry.message
            })
            .join('\n\n')
        return `Round ${game.summary.round} of ${game.state.turn}\n\n${summary}`
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
        for (const game of finishedGames) this.games.delete(game.id)
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

const readyBtn = (gameId: string, disabled = false) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_READY;${gameId}`,
            style: ButtonStyle.Success,
            disabled: disabled,
            label: 'Play',
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `CCG_DISCARD;${gameId}`,
            style: ButtonStyle.Secondary,
            disabled: disabled,
            label: 'Discard',
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
        label: `${card.id}`,
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
