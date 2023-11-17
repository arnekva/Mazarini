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

    constructor(client: MazariniClient) {
        super(client)
        this.players = []
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

    async updateBoard(channelId: string) {
        const board = LudoBoard.board(this.allPieces)
        const msgContent1 = board.board1
        const msgContent2 = board.board2
        const msgContent3 = board.board3

        const msg1 = await this.messageHelper.sendMessage(channelId, { text: msgContent1 })
        const msg2 = await this.messageHelper.sendMessage(channelId, { text: msgContent2 })
        const msg3 = await this.messageHelper.sendMessage(channelId, { text: msgContent3 })
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
                    positionIndex: 1,
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

    private increment() {
        this.players[0].pieces[0].positionIndex += 0

        this.updateBoard()
    }

    getAllInteractions(): IInteractionElement {
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
                        commandName: 'LUDO_BTN',
                        command(rawInteraction) {
                            this.increment()
                        },
                    },
                ],
            },
        }
    }
}
