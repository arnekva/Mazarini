import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Message } from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../../client/MazariniClient'
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
    diceroll: number
    id: number
    color: LudoColor
    pieces: LudoPiece[]
}
interface LudoMessage {
    messageId: string
    contentHash: string
}
export class Ludo extends AbstractCommands {
    private players: LudoPlayer[]
    private turnCounter: number
    private currentPlayer: LudoPlayer
    private boardState: any

    //Holds game state message
    private msg0: LudoMessage
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
        this.players = []
        this.msg1 = {
            contentHash: 'invalid',
            messageId: 'none',
        }
        this.msg0 = {
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
    }

    createGame() {
        const p1: LudoPlayer = {
            color: 'red',
            id: 1,
            diceroll: 0,
            pieces: this.getDefaultPiecesByColor('red', 1),
        }
        const p2: LudoPlayer = {
            color: 'blue',
            id: 2,
            diceroll: 0,
            pieces: this.getDefaultPiecesByColor('blue', 2),
        }
        this.players.push(p1, p2)
    }

    /*
    TODO:
    Safe positions must be added
   
    Needs some form of Async YeetOldBoards logic, such that it can be called to delete all old instances of ludo boards in the channel except current ones.
    Needs to be async so that the game can continue as normal while it deletes it in the background. Otherwise it will lag the server too much. Board should also be deleted on game completion

    */

    async updateBoard(interaction: ButtonInteraction | ChatInputCommandInteraction, diceRoll?: string) {
        const board = LudoBoard.board(this.allPieces)
        const msgContent0 = 'Spiller trillet ' + (diceRoll ? diceRoll : 'ingenting')
        const msgContent1 = board.board1
        const msgContent2 = board.board2
        const msgContent3 = board.board3
        const msgContent4 = this.buttonRow

        const msg0FromCache = interaction.channel.messages.cache.get(this.msg0.messageId) //.find((m) => m.id === this.msg1Id)
        const msg1FromCache = interaction.channel.messages.cache.get(this.msg1.messageId) //.find((m) => m.id === this.msg1Id)
        const msg2FromCache = interaction.channel.messages.cache.get(this.msg2.messageId)
        const msg3FromCache = interaction.channel.messages.cache.get(this.msg3.messageId)
        const msg4FromCache = interaction.channel.messages.cache.get(this.msg4.messageId)

        const msg0ShouldUpdate = this.msg0.contentHash !== msgContent0
        const msg1ShouldUpdate = this.msg1.contentHash !== msgContent1
        const msg2ShouldUpdate = this.msg2.contentHash !== msgContent2
        const msg3ShouldUpdate = this.msg3.contentHash !== msgContent3
        const msg4ShouldUpdate = this.msg4.contentHash !== JSON.stringify(msgContent4.toJSON())
        const updateRowMsg = (msg: Message, r: ActionRowBuilder<ButtonBuilder>) => {
            msg.edit({ components: [r] })
        }
        if (!msg0FromCache || !msg1FromCache || !msg2FromCache || !msg3FromCache || !msg4FromCache) {
            const msg0 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent0 })
            const msg1 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent1 })
            const msg2 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent2 })
            const msg3 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent3 })

            const gameButtons = this.buttonRow
            const msg4 = await this.messageHelper.sendMessage(interaction.channelId, { components: [gameButtons] })

            this.msg0.messageId = msg0.id
            this.msg1.messageId = msg1.id
            this.msg2.messageId = msg2.id
            this.msg3.messageId = msg3.id
            this.msg4.messageId = msg4.id
        } else {
            if (msg0ShouldUpdate) await msg0FromCache.edit({ content: msgContent0 })
            if (msg1ShouldUpdate) await msg1FromCache.edit({ content: msgContent1 })
            if (msg2ShouldUpdate) await msg2FromCache.edit({ content: msgContent2 })
            if (msg3ShouldUpdate) await msg3FromCache.edit({ content: msgContent3 })
            if (msg4ShouldUpdate) await msg4FromCache.edit({ components: [msgContent4] })
        }
        this.msg0.contentHash = msgContent0
        this.msg1.contentHash = msgContent1
        this.msg2.contentHash = msgContent2
        this.msg3.contentHash = msgContent3
        this.msg4.contentHash = JSON.stringify(msgContent4.toJSON())
    }

    /** Returns a flat map of all player pieces */
    get allPieces(): LudoPiece[] {
        return this.players.flatMap((p) => p.pieces)
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

    get buttonRow() {
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
                disabled: false,
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_2',
                style: ButtonStyle.Primary,
                label: `Brikke 2`,
                disabled: false,
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_3',
                style: ButtonStyle.Primary,
                label: `Brikke 3`,
                disabled: false,
                type: 2,
            }),

            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_4',
                style: ButtonStyle.Primary,
                label: `Brikke 4`,
                disabled: false,
                type: 2,
            }),
        ])
    }
    getCurrPlayer(interaction) {
        return interaction.user.id === '245607554254766081' ? this.players[0] : this.players[1]
    }

    /** Moves the piece (by index supplied by the button command). Handles moving out, checking goal state, looping board and moving into goal path */
    private movePiece(interaction: ButtonInteraction<CacheType>, idx: number) {
        const player = this.getCurrPlayer(interaction)
        const piece = player.pieces[idx - 1]

        if (this.isPieceInStart(piece)) {
            if (player.diceroll === 6) {
                this.moveOutPiece(piece)
                this.updateBoard(interaction)
                interaction.deferUpdate()
            } else {
                this.messageHelper.replyToInteraction(interaction, `Du kan bare flytte ut den brikken hvis du ruller 6`)
            }
        } else if (this.isPieceInGoal(piece)) {
            this.messageHelper.replyToInteraction(interaction, `Du kan ikke flytte på en brikke som er i mål`)
        } else {
            const diceRoll = this.getCurrPlayer(interaction).diceroll
            piece.positionIndex += diceRoll
            console.log('Moving,', this.players[0].pieces[idx - 1].positionIndex)

            const looping = this.handleBoardEnd(piece)
            this.checkPieceEndgameState(piece, piece.positionIndex - diceRoll, looping)
            this.updateBoard(interaction, diceRoll.toString())
            interaction.deferUpdate()
        }
    }

    /** Check if the given piece is in a start position */
    private isPieceInStart(p: LudoPiece) {
        const home = LudoBoard.homeIndexes(p.color)
        return home.includes(p.positionIndex)
    }
    /** Check if the given piece is in the goal index for its color */
    private isPieceInGoal(p: LudoPiece) {
        const goal = LudoBoard.goalForColor(p.color)
        return p.positionIndex === goal
    }

    /** Handles a piece hitting "board edge", i.e. position reaching end of map. Will move it to index 0 (plus remaining) */
    private handleBoardEnd(piece: LudoPiece) {
        if (piece.positionIndex > 52 && piece.positionIndex < 100) {
            console.log('a piece hit the end at 52', piece.positionIndex, 'moved to ' + (piece.positionIndex - 52))

            piece.positionIndex = piece.positionIndex - 52
            return true
        }
        return false
    }

    private rollDice(interaction: ButtonInteraction<CacheType>) {
        const diceRoll = RandomUtils.getRandomInteger(1, 6)
        this.getCurrPlayer(interaction).diceroll = diceRoll
        interaction.deferUpdate()
        const msg0FromCache = interaction.channel.messages.cache.get(this.msg0.messageId)
        if (msg0FromCache) {
            msg0FromCache.edit(`Spiller ${this.getCurrPlayer(interaction).id} trillet ${diceRoll}`)
        }
    }

    /** Checks if a given piece has reached or surpassed it's goal entrance. Will move it into goal path instead of continuing on the board */
    private checkPieceEndgameState(p: LudoPiece, oldPosition: number, didLoop: boolean) {
        console.log(p.positionIndex, LudoBoard.endStates(p.color), LudoBoard.endPathStart(p.color))

        //Piece is moving towards end game
        if (p.positionIndex >= LudoBoard.endPathStart(p.color) && p.positionIndex < 100 && oldPosition < LudoBoard.pieceStartPosition(p.color)) {
            p.positionIndex = LudoBoard.normalPathToEndPath(p.color) + (p.positionIndex - LudoBoard.endPathStart(p.color)) - 1

            console.log('Moving to endstate', p.positionIndex)
        }
        this.movePieceBackFromGoal(p)
    }

    /** If the given piece has a index greater than it's goal index it will be moved back from the goal, as a player must roll the exact number to enter the goal */
    private movePieceBackFromGoal(p: LudoPiece) {
        const goalForColor = LudoBoard.goalForColor(p.color)
        if (p.positionIndex > goalForColor) {
            console.log('has moved past goal', p.positionIndex, goalForColor)

            p.positionIndex = goalForColor - (p.positionIndex - goalForColor)
        } else if (p.positionIndex === goalForColor) {
            console.log('player is in goal')
        }
    }

    /** Moves a piece from its home to the correct start position on the board */
    private moveOutPiece(piece: LudoPiece) {
        piece.positionIndex = LudoBoard.pieceStartPosition(piece.color)
    }

    getAllInteractions() {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'ludo',
                        command: (rawInteraction) => {
                            this.createGame()
                            this.updateBoard(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
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
