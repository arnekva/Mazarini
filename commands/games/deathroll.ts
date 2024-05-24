import { randomUUID } from 'crypto'
import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { RandomUtils } from '../../utils/randomUtils'

export interface DRPlayer {
    userID: string
    roll: number
}

export interface DRGame {
    id: string
    players: DRPlayer[]
    joinable: boolean
    lastToRoll: string
}

export class Deathroll extends AbstractCommands {
    private drGames: DRGame[]

    constructor(client: MazariniClient) {
        super(client)
        this.drGames = new Array<DRGame>()
    }

    private rollDice(interaction: ChatInputCommandInteraction<CacheType>) {
        const diceTarget = interaction.options.get('sider')?.value as number
        if (diceTarget <= 0) this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille en terning med mindre enn 1 side`, { ephemeral: true })
        else {
            const user = interaction.user
            const game = this.getGame(user.id, diceTarget)
            const roll = RandomUtils.getRandomInteger(1, diceTarget)
            this.updateGame(game, user.id, roll)
            if (roll == 1) this.endGame(game)
            this.messageHelper.replyToInteraction(interaction, `${roll} *(1 - ${diceTarget})*`, { sendAsSilent: true })
        }
    }

    private getGame(userID: string, diceTarget: number) {
        let game = this.findActiveGame(userID, diceTarget)
        if (!game) game = this.joinGame(this.checkForAvailableGame(userID, diceTarget), userID)
        return game ?? this.registerNewGame(userID)
    }

    private findActiveGame(userID: string, diceTarget: number) {
        return this.drGames.find(
            (game) =>
                game.players.some((player) => player.userID == userID && this.isPlayersTurn(game, player)) &&
                game.players.some((player) => player.userID != userID && player.roll == diceTarget)
        )
    }

    private joinGame(game: DRGame, userID: string) {
        if (game && game.joinable) {
            game.players.push({ userID: userID, roll: undefined })
            return game
        }
        return undefined
    }

    private checkForAvailableGame(userID: string, diceTarget?: number) {
        return this.drGames.find(
            (game) =>
                game.joinable &&
                !game.players.some((player) => player.userID == userID) &&
                (!diceTarget || game.players.some((player) => player.roll == diceTarget))
        )
    }

    private registerNewGame(userID: string) {
        const p1: DRPlayer = { userID: userID, roll: undefined }
        const game: DRGame = { id: randomUUID(), players: [p1], joinable: true, lastToRoll: undefined }
        this.drGames.push(game)
        return game
    }

    private updateGame(game: DRGame, userID: string, newRoll: number) {
        const currentPlayer = game.players.find((player) => player.userID == userID)
        if (game.joinable && currentPlayer.roll) game.joinable = false
        currentPlayer.roll = newRoll
        game.lastToRoll = userID
    }

    private endGame(finishedGame: DRGame) {
        this.drGames = this.drGames.filter((game) => game.id != finishedGame.id)
        this.client.database.registerDeathrollStats(finishedGame)
    }

    private getActiveGameForUser(userID: string) {
        return this.drGames.find((game) => game.players.some((player) => player.userID == userID && this.isPlayersTurn(game, player)))
    }

    private isPlayersTurn(game: DRGame, currentPlayer: DRPlayer) {
        const playerIndex = game.players.findIndex((player) => player.userID == currentPlayer.userID)
        const previousPlayer = game.players[Math.abs(playerIndex + game.players.length - 1) % game.players.length]
        return (
            !game.players.some((player) => player.roll < previousPlayer.roll && player.userID != previousPlayer.userID) &&
            game.lastToRoll != currentPlayer.userID
        )
    }

    private autoCompleteDice(interaction: AutocompleteInteraction<CacheType>) {
        let game = this.getActiveGameForUser(interaction.user.id)
        if (!game) game = this.checkForAvailableGame(interaction.user.id)
        if (game) {
            const diceTarget = Math.min(...game.players.map((p) => p.roll))
            return interaction.respond([{ name: `${diceTarget}`, value: diceTarget }])
        }
        return interaction.respond([{ name: '10000', value: 10000 }])
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'terning',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.rollDice(rawInteraction)
                        },
                        autoCompleteCallback: (rawInteraction: AutocompleteInteraction<CacheType>) => {
                            this.autoCompleteDice(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
