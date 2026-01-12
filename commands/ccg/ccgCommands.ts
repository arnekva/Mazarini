import { randomUUID } from 'crypto'
import { ActionRowBuilder, APIButtonComponent, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import { ImageGenerationHelper } from '../../helpers/imageGenerationHelper'
import { ICCGDeck } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { CCGContainer } from '../../templates/containerTemplates'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { BotResolver } from './BotResolver'
import { CardActionResolver } from './cardActionResolver'
import { CCGHelp } from './ccgHelp'
import { CCGCard, CCGEffect, CCGGame, CCGGameState, CCGLogEntry, CCGPlayer, Difficulty, StatusEffect } from './ccgInterface'
import { mockHand } from './mockCards'

export class CCGCommands extends AbstractCommands {
    private games: Map<string, CCGGame>
    private resolver: CardActionResolver
    private botResolver: BotResolver
    private igh: ImageGenerationHelper
    private helper: CCGHelp

    constructor(client: MazariniClient) {
        super(client)
        this.igh = new ImageGenerationHelper(this.client)
        this.helper = new CCGHelp(this.client)
        this.games = new Map<string, CCGGame>()
        this.resolver = new CardActionResolver()
        this.botResolver = new BotResolver()
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
            console.log('reshuffled deck')
        }
        player.hand.push(card)
    }

    public async sendPlayerHand(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        const msg = await this.messageHelper.replyToInteraction(interaction, 'Henter hånden din...', { ephemeral: !game.vsBot })
        player.handMessage = msg
        this.updatePlayerHand(game, player)
    }

    private async getPlayerHandImage(player: CCGPlayer) {
        const cards = player.hand.filter((card) => !player.submitted || !card.selected)
        const buffers = await Promise.all(
            cards.map(async (card) => {
                const res = await fetch(card.imageUrl)
                if (!res.ok) throw new Error(`Failed to fetch ${card.id}`)
                return Buffer.from(await res.arrayBuffer())
            })
        )
        return await this.igh.stitchImages(buffers, 'horizontal')
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

    private async submitCards(interaction: BtnInteraction, game: CCGGame, player: CCGPlayer) {
        const submitted = player.hand.filter((card) => card.selected)
        if (submitted.length > game.state.settings.maxCardsPlayed) {
            return this.messageHelper.replyToInteraction(interaction, `Du kan ikke spille mer enn ${game.state.settings.maxCardsPlayed} kort om gangen`, {
                ephemeral: true,
            })
        }
        const submittedCost = submitted.reduce((sum, card) => (sum += card.cost), 0)
        if (submittedCost > player.energy) {
            return this.messageHelper.replyToInteraction(interaction, 'Du har ikke nok energi!', { ephemeral: true })
        }
        interaction.deferUpdate()
        player.energy -= submittedCost
        player.submitted = true
        this.addEffectsToStack(game, player)
        await this.updatePlayerHand(game, player)
        if (game.player1.submitted && game.player2.submitted) {
            if (game.vsBot) {
                const botSubmitted = game.player2.hand.filter((card) => card.selected)
                const botCost = botSubmitted.reduce((sum, card) => (sum += card.cost), 0)
                game.player2.energy -= botCost
            }
            this.updatePlayerStates(game)
            this.resolveRound(game)
        } else {
            game.container.updateTextComponent('game-text', `Velg opptil 2 kort\nSpillere klar: ( 1 / 2 )`)
            this.updateGameMessage(game)
        }
    }

    private async resolveRound(game: CCGGame) {
        game.state.locked = true
        game.state.phase = 'RESOLVE'

        this.revealCards(game)
        await this.resolveEffects(game)

        if (game.state.winnerId) {
            this.endGame(game)
        } else {
            game.container.replaceComponent('main-button', nextRoundBtn(game.id))
            this.updateGameMessage(game)
        }
    }

    private startNextRound(interaction: BtnInteraction, game: CCGGame) {
        interaction.deferUpdate()
        game.state.phase = 'PLAY'
        game.state.turn = game.state.turn + 1
        game.state.locked = false
        game.container.removeComponent('effect-summary')
        game.container.removeComponent('separator3')
        game.container.updateTextComponent('game-text', `Velg opptil 2 kort\n${game.vsBot ? '' : 'Spillere klar: ( 0 / 2 )'}`)
        game.container.replaceComponent('main-button', readyBtn(game.id))
        this.preparePlayerForNewRound(game, game.player1)
        this.preparePlayerForNewRound(game, game.player2, game.vsBot)
        this.updatePlayerStates(game)
        this.updateGameMessage(game)
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
        await this.delay(3000)
        game.container.removeComponent('effect-summary')
        game.container.removeComponent('separator3')
        const winner = game.player1.id === game.state.winnerId ? game.player1 : game.player2
        game.container.updateTextComponent('game-text', `### ${winner.name} stikker av med seieren! :first_place:`)
        game.container.removeComponent('main-button')
        this.updateGameMessage(game)
        this.registerStats(game)
    }

    private async registerStats(game: CCGGame) {
        // TODO!
    }

    private async resolveEffects(game: CCGGame) {
        this.resolver.sortStack(game)
        while (game.state.stack.length > 0) {
            const effect = game.state.stack.shift()
            await this.delay(3000)
            this.resolver.resolveSingleEffect(game, effect)
            this.checkForWinner(game)
            this.updatePlayerStates(game)
            this.postEffectSummary(game)
            if (game.state.winnerId) return this.endGame(game)
        }
        for (const status of game.state.statusEffects) {
            await this.delay(3000)
            this.resolver.tickStatusEffects(game, status)
            this.checkForWinner(game)
            this.updatePlayerStates(game)
            this.postEffectSummary(game)
            if (game.state.winnerId) return this.endGame(game)
        }
    }

    private checkForWinner(game: CCGGame) {
        if (game.player1.hp <= 0) game.state.winnerId = game.player2.id
        if (game.player2.hp <= 0) game.state.winnerId = game.player1.id
        if (game.player1.hp <= 0 && game.player2.hp <= 0) game.state.winnerId = undefined
    }

    private revealCards(game: CCGGame) {
        const playedCards =
            `${game.player1.name} spiller:\n${this.getPlayedCardsString(game.player1)}\n\n` +
            `${game.player2.name} spiller:\n${this.getPlayedCardsString(game.player2)}`
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
        if (game.container.getComponentIndex('effect-summary') >= 0) {
            game.container.updateTextComponent('effect-summary', summary)
        } else {
            game.container.addComponentAfterReference('effect-summary', ComponentsHelper.createTextComponent().setContent(summary), 'separator2')
            game.container.addComponentAfterReference('separator3', ComponentsHelper.createSeparatorComponent(), 'effect-summary')
        }
        this.updateGameMessage(game)
    }

    private addEffectsToStack(game: CCGGame, player: CCGPlayer) {
        const submitted = player.hand.filter((card) => card.selected)
        for (const card of submitted) {
            game.state.stack.push(
                ...card.effects.map((effect) => {
                    return {
                        emoji: card.emoji,
                        targetPlayerId: effect.target === 'OPPONENT' ? player.opponentId : player.id,
                        sourceCardName: card.name,
                        sourcePlayerId: player.id,
                        speed: card.speed,
                        accuracy: card.accuracy,
                        type: effect.type,
                        value: effect.value,
                        turns: effect.turns,
                    }
                })
            )
        }
    }

    private async updatePlayerHand(game: CCGGame, player: CCGPlayer) {
        const handImage = await this.getPlayerHandImage(player)
        const attachment = new AttachmentBuilder(handImage, { name: 'hand.png' })
        const embed = EmbedUtils.createSimpleEmbed(' ', ' ').setImage('attachment://hand.png')
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
        interaction.deferUpdate()
        const game = this.getGame(interaction)
        if (game && !game.player2 && game.player1.id !== interaction.user.id) {
            game.player2 = await this.newPlayer(interaction)
            game.player2.opponentId = game.player1.id
            game.player1.opponentId = game.player2.id
            game.container.updateTextComponent('sub-header', `### ${game.player1.name} vs ${game.player2.name}`)
            game.container.addComponentAfterReference('game-text', ComponentsHelper.createTextComponent().setContent(`Er dere klare?\n( 0 / 2 )`), 'separator1')
            game.container.addComponentAfterReference('separator2', ComponentsHelper.createSeparatorComponent(), 'game-text')
            game.container.replaceComponent('main-button', readyUpBtn(game.id))
            this.updateGameMessage(game)
        }
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
            game.container.updateTextComponent('game-text', `Er dere klare?\n( 1 / 2 )`)
        }
        this.updateGameMessage(game)
    }

    private chooseBotCards(game: CCGGame) {
        this.botResolver.chooseBotCards(game)
        console.log('result of card resolution', game.player2.hand)

        this.addEffectsToStack(game, game.player2)
    }

    private updatePlayerStates(game: CCGGame) {
        game.container.updateTextComponent('player1', this.getPlayerStateString(game.player1))
        game.container.updateTextComponent('player2', this.getPlayerStateString(game.player2))
    }

    private startGame(game: CCGGame) {
        game.state.phase = 'PLAY'
        game.container.removeComponent('sub-header')
        game.container.addComponentAfterReference(
            'player1',
            ComponentsHelper.createTextComponent().setContent(this.getPlayerStateString(game.player1)),
            'header'
        )
        game.container.updateTextComponent('game-text', `Velg opptil 2 kort\n${game.vsBot ? '' : 'Spillere klar: ( 0 / 2 )'}`)
        game.container.addComponentAfterReference(
            'player2',
            ComponentsHelper.createTextComponent().setContent(this.getPlayerStateString(game.player2)),
            'separator2'
        )
        game.container.replaceComponent('main-button', readyBtn(game.id))
    }

    private getPlayerStateString(player: CCGPlayer) {
        return `### ${player.name}\n:heart: ${player.hp}    :zap: ${player.energy}`
    }

    private async setupGame(interaction: ChatInteraction, vsBot: boolean) {
        const difficulty = vsBot ? (interaction.options.get('difficulty')?.value as string as Difficulty) : undefined
        const gameId = randomUUID()
        const game: CCGGame = {
            id: gameId,
            player1: await this.newPlayer(interaction, vsBot),
            player2: vsBot ? await this.setupBotOpponent(difficulty, interaction.user.id) : undefined,
            container: CCGContainer(gameId, interaction.authorName, vsBot),
            state: this.getInitialGameState(),
            vsBot: vsBot,
            botDifficulty: difficulty,
        }
        const button = vsBot ? readyUpBtn(game.id) : joinButton(game.id)
        game.container.replaceComponent('main-button', button)
        if (vsBot) {
            game.container.updateTextComponent('sub-header', `### ${game.player1.name} vs ${game.player2.name}`)
            game.container.addComponentAfterReference('game-text', ComponentsHelper.createTextComponent().setContent(`Er du klar?`), 'separator1')
            game.container.addComponentAfterReference('separator2', ComponentsHelper.createSeparatorComponent(), 'game-text')
        }
        const msg = await this.messageHelper.replyToInteraction(interaction, '', {}, [game.container.container])
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
        }
    }

    private getInitialGameState(): CCGGameState {
        return {
            phase: 'DRAW',
            turn: 1,
            stack: new Array<CCGEffect>(),
            statusEffects: new Array<StatusEffect>(),
            log: new Array<CCGLogEntry>(),
            settings: GameValues.ccg.gameSettings,
            locked: false,
        }
    }

    private async newPlayer(interaction: ChatInteraction | BtnInteraction, vsBot = false): Promise<CCGPlayer> {
        const cards = await this.getPlayerCards(interaction.user.id)
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
        }
    }

    private async getPlayerCards(userId: string): Promise<CCGCard[]> {
        return mockHand // TOREMOVE
        const user = await this.database.getUser(userId)
        const deck = user.decks?.find((deck) => deck.active) ?? GameValues.ccg.defaultDeck
        return await this.getFullCards(deck)
    }

    private async getBotCards(difficulty: Difficulty): Promise<CCGCard[]> {
        return mockHand // TOREMOVE
        const deck = GameValues.ccg.botDeck[difficulty]
        return await this.getFullCards(deck)
    }

    private async getFullCards(deck: ICCGDeck) {
        const cards = (await this.database.getStorage()).ccg
        const userCards = new Array<CCGCard>()
        for (const item of deck.cards) {
            const series = cards[item.series] as CCGCard[]
            userCards.push({ ...series.find((card) => card.id === item.id), selected: false })
        }
        return userCards
    }

    private updateGameMessage(game: CCGGame) {
        game.message.edit({ components: [game.container.container] })
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    private executeSubCommand(interaction: ChatInteraction) {
        const cmd = interaction.options.getSubcommand()
        const cmdGroup = interaction.options.getSubcommandGroup()
        if (cmdGroup && cmdGroup === 'play') {
            this.setupGame(interaction, cmd === 'bot')
        } else if (cmd === 'help') this.helper.newCCGHelper(interaction)
    }

    private verifyUserAndCallMethod(interaction: BtnInteraction, callback: (game?: CCGGame, player?: CCGPlayer) => void) {
        const game = this.getGame(interaction)
        const player = this.getPlayer(interaction, game)
        if (player) {
            callback(game, player)
        } else this.messageHelper.replyToInteraction(interaction, 'du er ikke med i dette spillet', { ephemeral: true })
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
        })
    )
}

const readyUpBtn = (gameId: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `CCG_READY_UP;${gameId}`,
            style: ButtonStyle.Success,
            disabled: false,
            label: 'Klar',
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
            label: 'Spill valgte kort',
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
            label: 'Neste runde',
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
