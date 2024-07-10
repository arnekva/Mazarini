import { randomUUID } from 'crypto'
import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import moment from 'moment'
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

    static lastRollTimeStamp = moment()

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
                if (roll === diceTarget) {
                    const targetRollReward = this.getTargetRollReward(diceTarget)
                    if (targetRollReward.reward) {
                        this.updateUserChips(user.id, targetRollReward.reward)
                        if (!targetRollReward.silent) additionalMessage += `*(+${targetRollReward.reward} chips)*`
                    }
                }
                if (rollReward) {
                    this.updateUserChips(user.id, rollReward)
                    additionalMessage += `*(+${rollReward} chips)*`
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
            const isLongSinceLastRoll = moment().diff(Deathroll.lastRollTimeStamp, 'seconds') > 15
            Deathroll.lastRollTimeStamp = moment()
            this.messageHelper.replyToInteraction(interaction, `${roll} *(1 - ${diceTarget})*  ${additionalMessage}`, {
                sendAsSilent: isLongSinceLastRoll ? false : (game?.players?.length ?? 2) > 1,
            })
        }
    }
    //TODO: Make this pretty
    private rewardPlayersOnGameEnd(s: DeathRollStats[]) {
        const playerHsATHStreak = s.find((p) => p.isOnATHLossStreak && p.isOnATHLossStreak > 0)
        const playerHasBiggestLoss = s.find((p) => p.didGetNewBiggestLoss && p.didGetNewBiggestLoss > 0)
        const remainingPlayers = s.filter((p) => !p.didGetNewBiggestLoss && !p.isOnATHLossStreak)

        if (remainingPlayers.length !== s.length) {
            let reward = playerHsATHStreak ? playerHsATHStreak.isOnATHLossStreak * 250 : 0
            if (playerHasBiggestLoss) reward += playerHasBiggestLoss.didGetNewBiggestLoss * 50
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

    getTargetRollReward(r: number): {
        reward: number
        silent: boolean
    } {
        let reward = 0
        let silent = false
        if (r < 100) {
            reward = r
            silent = true
        } else reward = r * 10

        return {
            reward: reward,
            silent: silent,
        }
    }

    private getRollReward(r: number) {
        switch (r) {
            case 69:
                return 690
            case 123:
                return 1230
            case 1234:
                return 12340
            case 12345:
                return 123450
            case 6969:
                return 6969
            case 420:
                return 4200
            case 666:
                return 6666
            case 777:
                return 7777
            case 1337:
                return 13370
            case 8008:
                return 80085
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
