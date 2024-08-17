import { randomUUID } from 'crypto'
import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { DeathRollStats } from '../../helpers/databaseHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { UserUtils } from '../../utils/userUtils'

export interface DRPlayer {
    userID: string
    rolls: number[]
}

export interface DRGame {
    id: string
    players: DRPlayer[]
    joinable: boolean
    lastToRoll: string
    initialTarget: number
}

export class Deathroll extends AbstractCommands {
    private drGames: DRGame[]
    private rewardPot: number

    constructor(client: MazariniClient) {
        super(client)
        this.drGames = new Array<DRGame>()
        this.retrieveDeathrollPot()
    }

    private retrieveDeathrollPot() {
        setTimeout(() => {
            this.client.database.getDeathrollPot().then((value) => (this.rewardPot = value ?? 0))
        }, 5000)
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
                additionalMessage += this.checkForReward(roll, diceTarget)
                additionalMessage += await this.checkIfPotWon(game, roll, user.id)
                if (roll == 1) {
                    this.checkForLossOnFirstRoll(game, diceTarget)
                    const stats = await this.endGame(game)
                    additionalMessage += this.rewardPlayersOnGameEnd(stats, diceTarget)
                    stats.forEach((stat) => {
                        const username = UserUtils.findUserById(stat.userId, interaction)?.username ?? 'Ukjent'
                        if (stat.didGetNewBiggestLoss) additionalMessage += `\n*(${username} fikk et nytt tall inn på topplisten av største tap)*`
                        if (stat.isOnATHLossStreak) additionalMessage += `\n*(${username} har ny ATH loss streak)*`
                    })
                }
            }
            const bold = (game?.players?.length ?? 0) == 1 ? '**' : ''
            this.messageHelper.replyToInteraction(interaction, `${bold}${roll} *(1 - ${diceTarget})*${bold}  ${additionalMessage}`, {
                sendAsSilent: (game?.players?.length ?? 2) > 1,
            })
        }
    }
    //TODO: Make this pretty
    private rewardPlayersOnGameEnd(s: DeathRollStats[], diceTarget: number) {
        const playerHsATHStreak = s.find((p) => p.isOnATHLossStreak && p.isOnATHLossStreak > 0)
        const playerHasBiggestLoss = s.find((p) => p.didGetNewBiggestLoss && p.didGetNewBiggestLoss > 0)

        let reward = playerHsATHStreak ? playerHsATHStreak.isOnATHLossStreak * 250 : 0
        if (playerHasBiggestLoss) reward += playerHasBiggestLoss.didGetNewBiggestLoss * 50
        else if (diceTarget >= 100) reward += diceTarget * 25
        this.rewardPot += reward
        if (reward > 0) this.saveRewardPot()
        return reward >= 100 ? `(pott + ${reward} = ${this.rewardPot} chips)` : ''
    }

    private async rewardPotToUser(userId: string) {
        const dbUser = await this.client.database.getUser(userId)
        const rewarded = this.client.bank.giveMoney(dbUser, this.rewardPot)
        this.rewardPot -= rewarded
        if (rewarded > 0) this.saveRewardPot()
        const jailed = this.rewardPot > 0
        return `Nice\nDu vinner potten på ${this.rewardPot + rewarded} chips! ${
            jailed ? `(men du får bare ${rewarded} siden du er i fengsel)\nPotten er fortsatt på ${this.rewardPot} chips` : ''
        }`
    }

    private checkForReward(roll: number, diceTarget: number) {
        let totalAdded = this.getRollReward(roll)
        let multiplier = 1
        const lowRoll = roll < 100

        const addToPot = (amount: number, multiplierIncrease: number) => {
            totalAdded += amount
            if (!lowRoll) multiplier += multiplierIncrease
        }
        if (roll === diceTarget) addToPot(roll, 10)

        //Checks if all digits are the same (e.g. 111, 2222, 5555)
        const sameDigits = new RegExp(/^([0-9])\1*$/gi).test(roll.toString())
        if (sameDigits) addToPot(roll, 10)
        //Check if ONLY the first digits is a non-zero (e.g. 40, 500, 6000, 20000)
        const allDigitsExceptFirstAreZero = new RegExp(/^[1-9]0+$/gi).test(roll.toString())
        if (allDigitsExceptFirstAreZero) addToPot(roll, 3)

        const finalAmount = totalAdded * multiplier
        this.rewardPot += finalAmount
        if (totalAdded > 0) this.saveRewardPot()
        return totalAdded >= 100 ? `(pott + ${finalAmount} = ${this.rewardPot} chips)` : ''
    }

    private getRollReward(r: number) {
        switch (r) {
            case 6969:
                return 6969
            case 420:
                return 4200
            case 6868:
                return 101
            case 6669:
                return 6690
            case 669:
                return 669
            case 1337:
                return 13370
            case 1996:
                return 9999
            case 1997:
                return 101
            case 8008:
                return 80085
            case 1881:
                return 1881
            case 123:
                return 123
            case 1234:
                return 12340
            case 12345:
                return 123450
            default:
                return 0
        }
    }

    private async checkIfPotWon(game: DRGame, roll: number, userid: string) {
        if (roll == 69 && game.initialTarget >= 10000) {
            return await this.rewardPotToUser(userid)
        }
        return ''
    }

    private saveRewardPot() {
        this.client.database.saveDeathrollPot(this.rewardPot)
    }

    private getGame(userID: string, diceTarget: number) {
        let game = this.findActiveGame(userID, diceTarget)
        if (!game) game = this.joinGame(this.checkForAvailableGame(userID, diceTarget), userID)
        return game ?? (diceTarget > 100 ? this.registerNewGame(userID, diceTarget) : undefined)
    }

    private findActiveGame(userID: string, diceTarget: number) {
        return this.drGames.find(
            (game) =>
                game.players.some((player) => player.userID == userID && this.isPlayersTurn(game, player)) &&
                game.players.some((player) => player.userID != userID && Math.min(...player.rolls) == diceTarget)
        )
    }

    private joinGame(game: DRGame, userID: string) {
        if (game && game.joinable) {
            game.players.push({ userID: userID, rolls: [] })
            return game
        }
        return undefined
    }

    private checkForAvailableGame(userID: string, diceTarget?: number) {
        return this.drGames.find(
            (game) =>
                game.joinable && //game is joinable
                !game.players.some((player) => player.userID == userID) && //player hasn't already joined
                (!diceTarget || Math.min(...game.players.map((x) => x.rolls).flat()) == diceTarget)
        )
    }

    private registerNewGame(userID: string, diceTarget: number) {
        const p1: DRPlayer = { userID: userID, rolls: [] }
        const game: DRGame = { id: randomUUID(), players: [p1], joinable: true, lastToRoll: undefined, initialTarget: diceTarget }
        this.drGames.push(game)
        return game
    }

    private updateGame(game: DRGame, userID: string, newRoll: number) {
        const currentPlayer = game.players.find((player) => player.userID == userID)
        if (game.joinable && currentPlayer.rolls?.length > 0) game.joinable = false
        currentPlayer.rolls.push(newRoll)
        game.lastToRoll = userID
    }

    private checkForLossOnFirstRoll(game: DRGame, diceTarget: number) {
        if (game.players.length === 1) {
            game.players.push({ userID: MentionUtils.User_IDs.BOT_HOIE, rolls: [diceTarget] })
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
            !game.players.some((player) => player.userID != previousPlayer.userID && Math.min(...player.rolls) < Math.min(...previousPlayer.rolls)) &&
            game.lastToRoll != currentPlayer.userID
        )
    }

    private autoCompleteDice(interaction: AutocompleteInteraction<CacheType>) {
        let game = this.getActiveGameForUser(interaction.user.id)
        if (!game) game = this.checkForAvailableGame(interaction.user.id)
        if (game) {
            const diceTarget = Math.min(...game.players.map((p) => p.rolls).flat())
            return interaction.respond([{ name: `${diceTarget}`, value: diceTarget }])
        }
        return interaction.respond([{ name: '10000', value: 10000 }])
    }

    private printCurrentState(interaction: ChatInputCommandInteraction<CacheType>) {
        const embed = EmbedUtils.createSimpleEmbed('Deathroll state', `${this.rewardPot} chips i potten`)
        const fields = this.drGames.map((game, i) => {
            const lastToRollIndex = game.players.findIndex((player) => player.userID === game.lastToRoll)
            const nextPlayer = game.players[Math.abs(lastToRollIndex + 1) % game.players.length]
            const previousRoll = Math.min(...game.players.map((x) => x.rolls).flat())
            // const getName = (p1: DRPlayer) => `${p1.userID === nextPlayer.userID ? '**' : ''}${UserUtils.findMemberByUserID(p1.userID, interaction).user.username}${p1.userID === nextPlayer.userID ? '**' : ''}`
            let stateString = game.players.reduce((acc, player) => (acc += `${UserUtils.findMemberByUserID(player.userID, interaction).user.username}, `), '')
            stateString =
                stateString.substring(0, stateString.length - 2) +
                `\n:hourglass: **${UserUtils.findMemberByUserID(nextPlayer.userID, interaction).user.username}** :hourglass: (${previousRoll}) `
            const joinable = game.joinable ? ':unlock:' : ':lock:'
            return { name: `Game ${i + 1} ${joinable}`, value: stateString }
        })
        embed.addFields(fields)
        this.messageHelper.replyToInteraction(interaction, embed)
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
                    {
                        commandName: 'deathroll',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.printCurrentState(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
