import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { IInteractionElement } from '../../interfaces/interactionInterface'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { randomUUID } from 'crypto'


export interface DRPlayer {
    username: string
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
            const game = this.getGame(user.username, diceTarget)
            const roll = RandomUtils.getRandomInteger(1, diceTarget)
            this.updateGame(game, user.username, roll)
            if (roll == 1) this.endGame(game, user.id, diceTarget) 
            this.messageHelper.replyToInteraction(interaction, `${roll} *(1 - ${diceTarget})*`, {sendAsSilent: true})
        }
    }

    private getGame(username: string, diceTarget: number) {
        let game = this.findActiveGame(username, diceTarget)        
        if (!game) game = this.joinGame(this.checkForAvailableGame(username, diceTarget), username)
        return game ?? this.registerNewGame(username)
    }

    private findActiveGame(username: string, diceTarget: number) {
        return this.drGames.find((game) => game.players.some(player => player.username == username && this.isPlayersTurn(game, player)) && game.players.some(player => player.username != username && player.roll == diceTarget))
    }

    private joinGame(game: DRGame, username: string) {
        if (game && game.joinable) {
            game.players.push({username: username, roll: undefined})
            return game
        }
        return undefined
    }

    private checkForAvailableGame(username: string, diceTarget?: number) {
        return this.drGames.find((game) => game.joinable && !game.players.some(player => player.username == username) && (!diceTarget || game.players.some(player => player.roll == diceTarget)))
    }

    private registerNewGame(username: string) {
        const p1: DRPlayer = {username: username, roll: undefined}
        const game: DRGame = {id: randomUUID(), players: [p1], joinable: true, lastToRoll: undefined}
        this.drGames.push(game)
        return game
    }

    private updateGame(game: DRGame, username: string, newRoll: number) {
        const currentPlayer = game.players.find(player => player.username == username)
        if (game.joinable && currentPlayer.roll) game.joinable = false
        currentPlayer.roll = newRoll
        game.lastToRoll = username
    }

    private endGame(finishedGame: DRGame, userID: string, diceTarget: number) {
        this.drGames = this.drGames.filter(game => game.id != finishedGame.id)
        this.client.database.registerDeathrollStats(finishedGame)
    }

    private getActiveGameForUser(username: string) {
        return this.drGames.find((game) => game.players.some(player => player.username == username && this.isPlayersTurn(game, player)))
    }

    private isPlayersTurn(game: DRGame, currentPlayer: DRPlayer) {
        const playerIndex = game.players.findIndex(player => player.username == currentPlayer.username)
        const previousPlayer = game.players[Math.abs(playerIndex + game.players.length - 1) % game.players.length]
        return (!game.players.some(player => player.roll < previousPlayer.roll && player.username != previousPlayer.username)) && game.lastToRoll != currentPlayer.username
    }

    private autoCompleteDice(interaction: AutocompleteInteraction<CacheType>) {
        let game = this.getActiveGameForUser(interaction.user.username)
        if (!game) game = this.checkForAvailableGame(interaction.user.username)
        if (game) {
            const diceTarget = Math.min(...game.players.map(p => p.roll))
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
