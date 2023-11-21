import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../../client/MazariniClient'
import { IInteractionElement } from '../../../general/commands'
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

    private msg1Id: string
    private msg2Id: string
    private msg3Id: string

    constructor(client: MazariniClient) {
        super(client)
        this.players = []
        this.msg1Id = this.msg2Id = this.msg3Id = ''
        this.createGame()
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



    */

    async updateBoard(interaction: ButtonInteraction | ChatInputCommandInteraction) {
        const board = LudoBoard.board(this.allPieces)
        const msgContent1 = board.board1
        const msgContent2 = board.board2
        const msgContent3 = board.board3

        const msg1FromCache = interaction.channel.messages.cache.find((m) => m.id === this.msg1Id)
        const msg2FromCache = interaction.channel.messages.cache.find((m) => m.id === this.msg2Id)
        const msg3FromCache = interaction.channel.messages.cache.find((m) => m.id === this.msg3Id)

        if (!msg1FromCache || !msg2FromCache || !msg3FromCache) {
            const msg1 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent1 })
            const msg2 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent2 })
            const msg3 = await this.messageHelper.sendMessage(interaction.channelId, { text: msgContent3 })
            this.msg1Id = msg1.id
            this.msg2Id = msg2.id
            this.msg3Id = msg3.id
            const gameButtons = new ActionRowBuilder<ButtonBuilder>()
            gameButtons.addComponents(
                new ButtonBuilder({
                    custom_id: 'LUDO_BTN_MOVE_1',
                    style: ButtonStyle.Primary,
                    label: `Brikke 1`,
                    disabled: false,
                    type: 2,
                }),
                new ButtonBuilder({
                    custom_id: 'LUDO_BTN_MOVE_2',
                    style: ButtonStyle.Success,
                    label: `Brikke 2`,
                    disabled: true,
                    type: 2,
                })
            )
            const msg4 = await this.messageHelper.sendMessage(interaction.channelId, { components: [gameButtons] })
        } else {
            msg1FromCache.edit({ content: msgContent1 })
            msg2FromCache.edit({ content: msgContent2 })
            msg3FromCache.edit({ content: msgContent3 })
        }
        console.log(this.msg1Id)
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
                    positionIndex: 0,
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

    private movePiece(interaction: ButtonInteraction<CacheType>) {
        this.players[0].pieces[0].positionIndex += 1

        this.updateBoard(interaction)
        interaction.deferUpdate()
    }

    getAllInteractions(): IInteractionElement {
        const _this = this
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'ludo',
                        command(rawInteraction) {
                            console.log('tried it')
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'LUDO_BTN_MOVE_1',
                        command(rawInteraction: ButtonInteraction<CacheType>) {
                            _this.movePiece(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}