import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Message } from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../../client/MazariniClient'
import { IInteractionElement } from '../../../general/commands'
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
            color: 'yellow',
            id: 0,
            diceroll: 0,
            pieces: this.getDefaultPiecesByColor('yellow'),
        }
        const p2: LudoPlayer = {
            color: 'green',
            id: 0,
            diceroll: 0,
            pieces: this.getDefaultPiecesByColor('green'),
        }
        this.players.push(p1, p2)
    }

    /*
    TODO:
    Winning positions must be added
    Safe positions must be added
    Default pieces should be placed in house

    Needs some form of Async YeetOldBoards logic, such that it can be called to delete all old instances of ludo boards in the channel except current ones.
    Needs to be async so that the game can continue as normal while it deletes it in the background. Otherwise it will lag the server too much. Board should also be deleted on game completion

    */

    async updateBoard(interaction: ButtonInteraction | ChatInputCommandInteraction, diceRoll?: string) {
        const board = LudoBoard.board(this.allPieces)
        const msgContent0 = 'Player rolled ' + diceRoll
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

    private getDefaultPiecesByColor(c: LudoColor): LudoPiece[] {
        if (c === 'yellow') {
            return [
                {
                    id: 0,
                    color: 'yellow',
                    positionIndex: 30,
                },
                {
                    id: 1,
                    color: 'yellow',
                    positionIndex: 101,
                },
                {
                    id: 2,
                    color: 'yellow',
                    positionIndex: 102,
                },
                {
                    id: 3,
                    color: 'yellow',
                    positionIndex: 103,
                },
            ]
        }
        if (c === 'green') {
            return [
                {
                    id: 4,
                    color: 'green',
                    positionIndex: 200,
                },
                {
                    id: 5,
                    color: 'green',
                    positionIndex: 201,
                },
                {
                    id: 6,
                    color: 'green',
                    positionIndex: 202,
                },
                {
                    id: 7,
                    color: 'green',
                    positionIndex: 203,
                },
            ]
        }
    }

    get buttonRow() {
        return new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_ROLL',
                style: ButtonStyle.Success,
                label: `Rull`,
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
                custom_id: 'LUDO_BTN_TAKE_OUT',
                style: ButtonStyle.Danger,
                label: `Flutt ut`,
                disabled: false,
                type: 2,
            }),
        ])
    }

    private movePiece(interaction: ButtonInteraction<CacheType>, idx: number) {
        const diceRoll = this.players[0].diceroll
        this.players[0].pieces[idx - 1].positionIndex += diceRoll
        console.log('Moving,', this.players[0].pieces[idx - 1].positionIndex)

        this.checkPieceEndgameState(this.players[0].pieces[idx - 1], this.players[0].pieces[idx - 1].positionIndex - diceRoll)
        if (interaction.user.id === '245607554254766081') {
            this.updateBoard(interaction, diceRoll.toString())
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'pls no', { ephemeral: true })
        }
    }

    private rollDice(interaction: ButtonInteraction<CacheType>) {
        const diceRoll = RandomUtils.getRandomInteger(1, 6)
        this.players[0].diceroll = diceRoll

        const msg0FromCache = interaction.channel.messages.cache.get(this.msg0.messageId)
        if (msg0FromCache) {
            msg0FromCache.edit(`Spiller 1 trillet ${diceRoll}`)
        }
    }

    private checkPieceEndgameState(p: LudoPiece, oldPosition: number) {
        console.log(p.positionIndex, LudoBoard.endStates(p.color), LudoBoard.endPathStart(p.color))

        //Piece is moving towards end game
        if (p.positionIndex >= LudoBoard.endPathStart(p.color) && p.positionIndex < 100 && oldPosition < LudoBoard.pieceStartPosition(p.color)) {
            p.positionIndex = LudoBoard.normalPathToEndPath(p.color) + (p.positionIndex - LudoBoard.endPathStart(p.color))
            console.log('Moving to endstate', p.positionIndex)
        }
        this.movePieceBackFromGoal(p)
    }

    private movePieceBackFromGoal(p: LudoPiece) {
        const goalForColor = LudoBoard.goalForColor(p.color)
        if (p.positionIndex > goalForColor) {
            console.log('is in goal?', p.positionIndex, goalForColor)

            p.positionIndex = p.positionIndex - (p.positionIndex - goalForColor)
        } else if (p.positionIndex === goalForColor) {
            console.log('player is in goal')
        }
    }

    private moveOutPiece(interaction: ButtonInteraction<CacheType>) {
        const currPlayer = this.players[0]
        if (currPlayer.diceroll === 6) {
            const pieceToMove = currPlayer.pieces.find((p) => LudoBoard.homeIndexes(p.color).includes(p.positionIndex))
            if (pieceToMove) {
                pieceToMove.positionIndex = LudoBoard.pieceStartPosition(pieceToMove.color)
            }
        }
    }

    getAllInteractions(): IInteractionElement {
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
                        commandName: 'LUDO_BTN_TAKE_OUT',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.moveOutPiece(rawInteraction)
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
