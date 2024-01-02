import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Message } from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../../client/MazariniClient'
import { GameStateHandler } from '../../../handlers/gameStateHandler'
import { EmbedUtils } from '../../../utils/embedUtils'
import { RandomUtils } from '../../../utils/randomUtils'
import { LudoBoard } from './boards'
const crypto = require('crypto')
export type LudoColor = 'yellow' | 'green' | 'blue' | 'red'
export interface LudoPiece {
    id: number
    positionIndex: number
    color: LudoColor
    isSafe?: boolean
}
interface LudoPlayer {
    id: string
    playerName: string
    color: LudoColor
    pieces: LudoPiece[]
    diceroll?: number
    remainingRolls: number
}
interface LudoMessage {
    messageId: string
    contentHash: string
}
export class Ludo extends AbstractCommands {
    private turnCounter: number
    private currentPlayer: LudoPlayer
    private boardState: any
    private gameStateHandler: GameStateHandler<LudoPlayer>
    private initiatedBy: string
    private startMessageId: string

    //Holds game state message
    private gameStateMessage: LudoMessage
    //Holds first part of board
    private msg1: LudoMessage
    //Holds second part of board
    private msg2: LudoMessage
    //Holds third part of board
    private msg3: LudoMessage
    //Holds buttonRow
    private msg4: LudoMessage

    constructor(client: MazariniClient) {
        super(client)

        this.msg1 = {
            contentHash: 'invalid',
            messageId: 'none',
        }
        this.gameStateMessage = {
            contentHash: 'invalid',
            messageId: 'none',
        }
        this.msg2 = {
            contentHash: 'invalid',
            messageId: 'none',
        }
        this.msg3 = {
            contentHash: 'invalid',
            messageId: 'none',
        }
        this.msg4 = {
            contentHash: 'invalid',
            messageId: 'none',
        }
        this.gameStateHandler = new GameStateHandler<LudoPlayer>()
    }

    async createGame(interaction: ButtonInteraction | ChatInputCommandInteraction) {
        this.initiatedBy = interaction.user.id
        const embd = EmbedUtils.createSimpleEmbed(`Ludo`, `Bli med på Ludo`)
        const controls = this.gameStateHandler.getStartComponents(`LUDO`)
        this.messageHelper.replyToInteraction(interaction, `Starter ludo`, { ephemeral: true })
        const startMsg = await this.messageHelper.sendMessage(interaction.channelId, { embed: embd, components: [controls] })
        this.startMessageId = startMsg.id
    }

    joinGame(interaction: ButtonInteraction) {
        const pIndex = this.gameStateHandler.allPlayers.length
        if (pIndex > 3) {
            this.messageHelper.replyToInteraction(interaction, `Spillet er fult`, { ephemeral: true })
        } else if (this.gameStateHandler.allPlayers.find((p) => p.id === interaction.user.id)) {
            this.messageHelper.replyToInteraction(interaction, `Du er allerede med`, { ephemeral: true })
        } else {
            const playerColor = LudoBoard.getColorByIndex(pIndex)
            const player: LudoPlayer = {
                color: playerColor,
                id: interaction.user.id,
                playerName: interaction.user.username,
                diceroll: undefined,
                pieces: this.getDefaultPiecesByColor(playerColor, pIndex),
                remainingRolls: 3,
            }
            this.gameStateHandler.addUniquePlayer(player)
            const startMsg = interaction.channel.messages.cache.get(this.startMessageId)
            const embd = EmbedUtils.createSimpleEmbed(`Ludo`, `${this.gameStateHandler.allPlayers.length} spillere`)
            if (startMsg) startMsg.edit({ embeds: [embd] })
            interaction.deferUpdate()
        }
    }

    startGame(interaction: ButtonInteraction | ChatInputCommandInteraction) {
        if (interaction.user.id === this.initiatedBy) {
            this.updateBoard(interaction)
        } else {
            this.messageHelper.replyToInteraction(interaction, `Bare den som initierte spillet kan starte det`)
        }
    }

    async updateBoard(interaction: ButtonInteraction | ChatInputCommandInteraction, diceRoll?: string) {
        const board = LudoBoard.board(this.allPieces)
        const gameStateMsgContent = `Spiller ${this.gameStateHandler.getCurrentPlayer().playerName} sin tur!`
        const msgContent1 = board.board1
        const msgContent2 = board.board2
        const msgContent3 = board.board3
        const msgContent4 = this.buttonRow

        const gameStateMessageFromCache = interaction.channel.messages.cache.get(this.gameStateMessage.messageId) //.find((m) => m.id === this.msg1Id)
        const msg1FromCache = interaction.channel.messages.cache.get(this.msg1.messageId) //.find((m) => m.id === this.msg1Id)
        const msg2FromCache = interaction.channel.messages.cache.get(this.msg2.messageId)
        const msg3FromCache = interaction.channel.messages.cache.get(this.msg3.messageId)
        const msg4FromCache = interaction.channel.messages.cache.get(this.msg4.messageId)

        const gameStateShouldUpdate = this.gameStateMessage.contentHash !== gameStateMsgContent
        const msg1ShouldUpdate = this.msg1.contentHash !== msgContent1
        const msg2ShouldUpdate = this.msg2.contentHash !== msgContent2
        const msg3ShouldUpdate = this.msg3.contentHash !== msgContent3
        const msg4ShouldUpdate = this.msg4.contentHash !== JSON.stringify(msgContent4.toJSON())
        const updateRowMsg = (msg: Message, r: ActionRowBuilder<ButtonBuilder>) => {
            msg.edit({ components: [r] })
        }
        if (!gameStateMessageFromCache || !msg1FromCache || !msg2FromCache || !msg3FromCache || !msg4FromCache) {
            const msg1 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent1 })
            const msg2 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent2 })
            const msg3 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent3 })
            const gameStateMessage = await this.messageHelper.sendMessage(interaction.channelId, { text: gameStateMsgContent })

            const gameButtons = this.buttonRow
            const msg4 = await this.messageHelper.sendMessage(interaction.channelId, { components: [gameButtons] })

            this.gameStateMessage.messageId = gameStateMessage.id
            this.msg1.messageId = msg1.id
            this.msg2.messageId = msg2.id
            this.msg3.messageId = msg3.id
            this.msg4.messageId = msg4.id
        } else {
            if (gameStateShouldUpdate) await gameStateMessageFromCache.edit({ content: gameStateMsgContent })
            if (msg1ShouldUpdate) await msg1FromCache.edit({ content: msgContent1 })
            if (msg2ShouldUpdate) await msg2FromCache.edit({ content: msgContent2 })
            if (msg3ShouldUpdate) await msg3FromCache.edit({ content: msgContent3 })
            if (msg4ShouldUpdate) await msg4FromCache.edit({ components: [msgContent4] })
        }
        this.gameStateMessage.contentHash = gameStateMsgContent
        this.msg1.contentHash = msgContent1
        this.msg2.contentHash = msgContent2
        this.msg3.contentHash = msgContent3
        this.msg4.contentHash = JSON.stringify(msgContent4.toJSON())
    }

    /** Returns a flat map of all player pieces */
    get allPieces(): LudoPiece[] {
        return this.gameStateHandler.allPlayers.flatMap((p) => p.pieces)
    }

    private updateBoardStateMessage(interaction: ButtonInteraction | ChatInputCommandInteraction, content: string) {
        const msg0FromCache = interaction.channel.messages.cache.get(this.gameStateMessage.messageId) //.find((m) => m.id === this.msg1Id)
        if (msg0FromCache) msg0FromCache.edit(content)
    }

    private getDefaultPiecesByColor(c: LudoColor, playerIdx): LudoPiece[] {
        const pIdxStart = playerIdx + 4
        const pieces: LudoPiece[] = LudoBoard.homeIndexes(c).map((hc, idx) => {
            const piece: LudoPiece = {
                id: pIdxStart + idx,
                color: c,
                positionIndex: hc,
            }
            return piece
        })
        return pieces
    }

    /** Moves the piece (by index supplied by the button command). Handles moving out, checking goal state, looping board and moving into goal path */
    private movePiece(interaction: ButtonInteraction<CacheType>, idx: number) {
        const player = this.gameStateHandler.getCurrentPlayer()
        const piece = player.pieces[idx - 1]
        if (interaction.user.id !== player.id) {
            this.messageHelper.replyToInteraction(interaction, `Det er ikke din tur`, { ephemeral: true })
        } else if (!player.diceroll) {
            this.messageHelper.replyToInteraction(interaction, `Du må trille terningen først`, { ephemeral: true })
        } else {
            if (this.isPieceInStart(piece)) {
                if (player.diceroll === 6) {
                    this.moveOutPiece(piece)
                    this.updateBoard(interaction)
                    player.diceroll = undefined
                    interaction.deferUpdate()
                } else {
                    this.messageHelper.replyToInteraction(interaction, `Du kan bare flytte ut den brikken hvis du ruller 6`)
                }
            } else if (this.isPieceInGoal(piece)) {
                this.messageHelper.replyToInteraction(interaction, `Du kan ikke flytte på en brikke som er i mål`)
            } else {
                const diceRoll = this.gameStateHandler.getCurrentPlayer().diceroll
                piece.positionIndex += diceRoll
                const looping = this.handleBoardEnd(piece)
                this.checkPieceEndgameState(piece, piece.positionIndex - diceRoll, looping)
                this.updateBoard(interaction, diceRoll.toString())
                interaction.deferUpdate()

                //Reset dice roll for next turn
                if (player.diceroll !== 6) {
                    this.goToNextTurn(interaction)
                } else {
                    this.updateBoardStateMessage(interaction, `${player.id} får trille på ny`)
                }
            }
        }
    }

    private goToNextTurn(interaction: ButtonInteraction<CacheType>) {
        this.gameStateHandler.getCurrentPlayer().diceroll = undefined
        this.gameStateHandler.nextPlayer()
        this.setCurrentPlayersDiceRollAmount()

        this.updateBoardStateMessage(interaction, `Det er spiller ${this.gameStateHandler.getCurrentPlayer().playerName} sin tur`)
    }

    /** set remaining dice rolls based on position of the pieces */
    private setCurrentPlayersDiceRollAmount() {
        const player = this.gameStateHandler.getCurrentPlayer()
        const areAllPiecesAtHome = this.areAllPlayerPiecesAtHome(player)

        if (areAllPiecesAtHome) {
            player.remainingRolls = 3
        } else {
            player.remainingRolls = 1
        }
    }

    private areAllPlayerPiecesAtHome(p: LudoPlayer) {
        return p.pieces.every((p, idx) => {
            return LudoBoard.homeIndexes(p.color).includes(p.positionIndex)
        })
    }

    /** Check if the given piece is in a start position */
    private isPieceInStart(p: LudoPiece) {
        const home = LudoBoard.homeIndexes(p.color)
        return home.includes(p.positionIndex)
    }
    /** Check if the given piece is in the goal index for its color */
    private isPieceInGoal(p: LudoPiece) {
        if (p?.color) {
            const goal = LudoBoard.goalForColor(p.color)
            return p.positionIndex === goal
        } else return false
    }

    /** Handles a piece hitting "board edge", i.e. position reaching end of map. Will move it to index 0 (plus remaining) */
    private handleBoardEnd(piece: LudoPiece) {
        if (piece.positionIndex > 52 && piece.positionIndex < 100) {
            piece.positionIndex = piece.positionIndex - 52
            return true
        }
        return false
    }

    private rollDice(interaction: ButtonInteraction<CacheType>) {
        const player = this.gameStateHandler.getCurrentPlayer()
        if (player.remainingRolls > 0) {
            const diceRoll = RandomUtils.getRandomInteger(1, 6)
            player.diceroll = diceRoll
            player.remainingRolls = diceRoll === 6 ? 1 : player.remainingRolls - 1
            interaction.deferUpdate()
            const msg0FromCache = interaction.channel.messages.cache.get(this.gameStateMessage.messageId)
            if (msg0FromCache) {
                msg0FromCache.edit(`${this.gameStateHandler.getCurrentPlayer().playerName} trillet ${diceRoll}`)
            }
            //If player has spent all rolls and are still stuck after 3 attempts, go to next turn
            if (player.remainingRolls === 0 && this.areAllPlayerPiecesAtHome(player) && player.diceroll !== 6) {
                this.goToNextTurn(interaction)
            }
        } else {
            if (this.areAllPlayerPiecesAtHome(player)) {
                this.goToNextTurn(interaction)
            }
            this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille flere ganger denne runden`, { ephemeral: true })
        }
    }

    /** Checks if a given piece has reached or surpassed it's goal entrance. Will move it into goal path instead of continuing on the board */
    private checkPieceEndgameState(p: LudoPiece, oldPosition: number, didLoop: boolean) {
        //Piece is moving towards end game
        if (p.positionIndex >= LudoBoard.endPathStart(p.color) && p.positionIndex < 100 && oldPosition < LudoBoard.pieceStartPosition(p.color)) {
            p.positionIndex = LudoBoard.normalPathToEndPath(p.color) + (p.positionIndex - LudoBoard.endPathStart(p.color)) - 1
        }
        this.movePieceBackFromGoal(p)
    }

    /** If the given piece has a index greater than it's goal index it will be moved back from the goal, as a player must roll the exact number to enter the goal */
    private movePieceBackFromGoal(p: LudoPiece) {
        const goalForColor = LudoBoard.goalForColor(p.color)
        if (p.positionIndex > goalForColor) {
            p.positionIndex = goalForColor - (p.positionIndex - goalForColor)
        } else if (p.positionIndex === goalForColor) {
            console.log('player is in goal')
        }
    }

    /** Moves a piece from its home to the correct start position on the board */
    private moveOutPiece(piece: LudoPiece) {
        piece.positionIndex = LudoBoard.pieceStartPosition(piece.color)
    }

    /** Check if any pieces are colliding with the supplied one. If colors dont match current one, it will be kicked back */
    private checkCollision(p: LudoPiece) {
        const allPieces = this.allPieces
        const collision = allPieces.filter((piece) => piece.positionIndex === p.positionIndex && p.color !== piece.color && piece !== p)
        if (collision) {
            console.log('A collision occured, attempting to kick back')

            collision.forEach((piece) => {
                const piecesInColor = this.getAllPiecesOfColor(piece.color)
                const homePositionsForColor = LudoBoard.homeIndexes(piece.color).filter((hi) => !piecesInColor.find((p) => p.positionIndex === hi))

                piece.positionIndex = homePositionsForColor[0]
            })
        }
    }

    private updateGameStateMessage() {
        //Det er X sin tur
        //Brikke Y og Z står på samme plass
        //Etc?
    }

    private getAllPiecesOfColor(c: LudoColor) {
        return this.allPieces.filter((p) => p.color === c)
    }

    get buttonRow() {
        const player = this.gameStateHandler.getCurrentPlayer()
        return new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_ROLL',
                style: ButtonStyle.Success,
                label: `Trill`,
                disabled: false,
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_1',
                style: ButtonStyle.Primary,
                label: `Brikke 1`,
                disabled: this.isPieceInGoal(player.pieces[0]),
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_2',
                style: ButtonStyle.Primary,
                label: `Brikke 2`,
                disabled: this.isPieceInGoal(player.pieces[2]),
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_3',
                style: ButtonStyle.Primary,
                label: `Brikke 3`,
                disabled: this.isPieceInGoal(player.pieces[3]),
                type: 2,
            }),

            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_4',
                style: ButtonStyle.Primary,
                label: `Brikke 4`,
                disabled: this.isPieceInGoal(player.pieces[4]),
                type: 2,
            }),
        ])
    }

    getAllInteractions() {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'ludo',
                        command: (rawInteraction) => {
                            this.createGame(rawInteraction)
                        },
                        disabled: true,
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'LUDO_START',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.startGame(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LUDO_JOIN',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.joinGame(rawInteraction)
                        },
                    },
                    {
                        commandName: 'LUDO_BTN_MOVE_1',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.movePiece(rawInteraction, 1)
                        },
                    },
                    {
                        commandName: 'LUDO_BTN_MOVE_2',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.movePiece(rawInteraction, 2)
                        },
                    },
                    {
                        commandName: 'LUDO_BTN_MOVE_3',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.movePiece(rawInteraction, 3)
                        },
                    },
                    {
                        commandName: 'LUDO_BTN_MOVE_4',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.movePiece(rawInteraction, 4)
                        },
                    },
                    {
                        commandName: 'LUDO_BTN_ROLL',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.rollDice(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
