import { randomUUID } from 'crypto'
import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { DeathRollStats } from '../../helpers/databaseHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { UserUtils } from '../../utils/userUtils'

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

    private async rollDice(interaction: ChatInputCommandInteraction<CacheType>) {
        const diceTarget = interaction.options.get('sider')?.value as number
        if (diceTarget <= 0) this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille en terning med mindre enn 1 side`, { ephemeral: true })
        else {
            const user = interaction.user
            const game = this.getGame(user.id, diceTarget)
            const roll = RandomUtils.getRandomInteger(1, diceTarget)

            let additionalMessage = ''
            if (game) {
                this.updateGame(game, user.id, roll)
                const rollReward = this.getRollReward(roll)
                if (rollReward) {
                    this.updateUserChips(user.id, rollReward)
                    additionalMessage = `*(+${rollReward} chips)*`
                }
                if (roll == 1) {
                    this.checkForLossOnFirstRoll(game, diceTarget)
                    const stats = await this.endGame(game)
                    this.rewardPlayersOnGameEnd(stats)
                    stats.forEach((stat) => {
                        const username = UserUtils.findUserById(stat.userId, interaction)?.username ?? 'Ukjent'
                        if (stat.didGetNewBiggestLoss) additionalMessage += `\n*(${username} fikk et nytt tall inn på topplisten av største tap)*`
                        if (stat.isOnATHLossStreak) additionalMessage += `\n*(${username} har ny ATH loss streak)*`
                    })
                }
            }
            this.messageHelper.replyToInteraction(interaction, `${roll} *(1 - ${diceTarget})*  ${additionalMessage}`, {
                sendAsSilent: (game?.players?.length ?? 2) > 1,
            })
        }
    }

    private rewardPlayersOnGameEnd(s: DeathRollStats[]) {
        //TODO: Make this pretty
        const playerHsATHStreak = s.find((p) => p.isOnATHLossStreak)
        const playerHasBiggestLoss = s.find((p) => p.didGetNewBiggestLoss)
        const remainingPlayers = s.filter((p) => !p.didGetNewBiggestLoss && !p.isOnATHLossStreak)

        if (remainingPlayers.length !== s.length) {
            let reward = playerHsATHStreak ? 1000 : 0
            if (playerHasBiggestLoss) reward += 1000
            remainingPlayers.forEach((p) => {
                this.updateUserChips(p.userId, reward)
            })
        }
    }

    private async updateUserChips(userId: string, chips: number) {
        const dbUser = await this.client.database.getUser(userId)
        dbUser.chips += chips
        this.client.database.updateUser(dbUser)
    }

    private getRollReward(r: number) {
        switch (r) {
            case 69:
                return 500
            case 1337:
                return 1000
            case 8008:
                return 1000
            default:
                return 0
        }
    }

    private getGame(userID: string, diceTarget: number) {
        let game = this.findActiveGame(userID, diceTarget)
        if (!game) game = this.joinGame(this.checkForAvailableGame(userID, diceTarget), userID)
        return game ?? (diceTarget > 100 ? this.registerNewGame(userID) : undefined)
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
                (!diceTarget || (game.players.some((player) => player.roll == diceTarget) && Math.min(...game.players.map((x) => x.roll)) == diceTarget))
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

    private checkForLossOnFirstRoll(game: DRGame, diceTarget: number) {
        if (game.players.length === 1) {
            game.players.push({ userID: MentionUtils.User_IDs.BOT_HOIE, roll: diceTarget })
        }
    }

    private endGame(finishedGame: DRGame) {
        this.drGames = this.drGames.filter((game) => game.id != finishedGame.id)
        return this.client.database.registerDeathrollStats(finishedGame)
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
