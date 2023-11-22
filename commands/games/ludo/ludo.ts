import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Message } from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../../client/MazariniClient'
import { IInteractionElement } from '../../../general/commands'
import { RandomUtils } from '../../../utils/randomUtils'
import { LudoBoard } from './boards'

export type LudoColor = 'yellow' | 'green' | 'blue' | 'red'
export interface LudoPiece {
    id: number
    positionIndex: number
    color: LudoColor
    isSafe?: boolean
}
interface LudoPlayer {
    id: number
    color: LudoColor
    pieces: LudoPiece[]
}

export class Ludo extends AbstractCommands {
    private players: LudoPlayer[]
    private turnCounter: number
    private currentPlayer: LudoPlayer
    private boardState: any

    //Holds game state message
    private msg0Id: string
    //Holds first part of board
    private msg1Id: string
    //Holds second part of board
    private msg2Id: string
    //Holds third part of board
    private msg3Id: string
    //Holds buttonRow
    private msg4Id: string

    constructor(client: MazariniClient) {
        super(client)
        this.players = []
        this.msg1Id = this.msg2Id = this.msg3Id = this.msg4Id = 'none'
    }

    createGame() {
        const p1: LudoPlayer = {
            color: 'yellow',
            id: 0,
            pieces: this.getDefaultPiecesByColor('yellow'),
        }
        const p2: LudoPlayer = {
            color: 'green',
            id: 0,
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
        const msg4Content = this.buttonRow

        const msg0FromCache = interaction.channel.messages.cache.get(this.msg0Id) //.find((m) => m.id === this.msg1Id)
        const msg1FromCache = interaction.channel.messages.cache.get(this.msg1Id) //.find((m) => m.id === this.msg1Id)
        const msg2FromCache = interaction.channel.messages.cache.get(this.msg2Id)
        const msg3FromCache = interaction.channel.messages.cache.get(this.msg3Id)
        const msg4FromCache = interaction.channel.messages.cache.get(this.msg4Id)

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

            this.msg0Id = msg0.id
            this.msg1Id = msg1.id
            this.msg2Id = msg2.id
            this.msg3Id = msg3.id
            this.msg4Id = msg4.id
        } else {
            msg0FromCache.edit({ content: msgContent0 })
            msg1FromCache.edit({ content: msgContent1 })
            msg2FromCache.edit({ content: msgContent2 })
            msg3FromCache.edit({ content: msgContent3 })
            msg4FromCache.edit({ components: [msg4Content] })
        }
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
                custom_id: 'LUDO_BTN_MOVE_1',
                style: ButtonStyle.Primary,
                label: `Brikke 1`,
                disabled: false,
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: 'LUDO_BTN_MOVE_2',
                style: ButtonStyle.Danger,
                label: `Brikke 2`,
                disabled: false,
                type: 2,
            }),
        ])
    }

    private movePiece(interaction: ButtonInteraction<CacheType>) {
        const diceRoll = RandomUtils.getRandomInteger(1, 6)
        this.players[0].pieces[0].positionIndex += diceRoll
        if (interaction.user.id === '245607554254766081') {
            this.updateBoard(interaction, diceRoll)
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'pls no', { ephemeral: true })
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
                            this.movePiece(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
