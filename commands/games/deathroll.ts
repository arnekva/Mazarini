import { randomUUID } from 'crypto'
import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { DeathRollStats } from '../../helpers/databaseHelper'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { ArrayUtils } from '../../utils/arrayUtils'
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
    lastRoll: number
    nextToRoll: string
    initialTarget: number
}

export class Deathroll extends AbstractCommands {
    private drGames: DRGame[]
    private rewardPot: number

    constructor(client: MazariniClient) {
        super(client)

        this.setGamesFromDB()
        this.retrieveDeathrollPot()
        this.reRollWinningNumbers()
    }

    private setGamesFromDB() {
        setTimeout(async () => {
            const oldGames = await this.fetchSavedGames()

            if (oldGames) this.drGames = oldGames
            else this.drGames = new Array<DRGame>()
        }, 5000)
    }

    private reRollWinningNumbers() {
        setTimeout(() => {
            const winningNumbers = new Array<number>()
            winningNumbers.push(RandomUtils.getRandomInteger(70, 200))
            winningNumbers.push(RandomUtils.getRandomInteger(70, 200))
            winningNumbers.push(RandomUtils.getRandomInteger(70, 200))
            this.client.cache.deathrollWinningNumbers = winningNumbers
        }, 5000)
    }

    public saveActiveGamesToDatabase() {
        this.client.database.saveDeathrollGames(this.drGames)
    }

    private async fetchSavedGames() {
        return await this.client.database.getDeathrollGames()
    }

    private retrieveDeathrollPot() {
        setTimeout(() => {
            this.client.database.getDeathrollPot().then((value) => (this.rewardPot = value ?? 0))
        }, 5000)
    }

    private async rollDice(interaction: ChatInputCommandInteraction<CacheType>) {
        const diceTarget = interaction.options.get('sider')?.value as number
        if (diceTarget > 9999999999) {
            this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille en terning med mer enn 10 sifre`, { ephemeral: true })
        } else if (diceTarget <= 0)
            this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille en terning med mindre enn 1 side`, { ephemeral: true })
        else {
            const user = interaction.user
            const game = this.getGame(user.id, diceTarget)
            const roll = RandomUtils.getRandomInteger(1, diceTarget)

            let additionalMessage = ''
            if (game) {
                if (roll > 1) this.updateGame(game, user.id, roll) // Don't update if loss (easier to register stats)
                additionalMessage += this.checkForReward(roll, diceTarget)
                additionalMessage += await this.checkIfPotWon(game, roll, diceTarget, user.id)

                if (roll >= 100 && roll !== diceTarget) {
                    //Check if roll is a shuffled variant of the target number
                    additionalMessage = this.checkForShuffle(roll, diceTarget, additionalMessage)
                }
                if (roll == 1) {
                    this.checkForLossOnFirstRoll(game, diceTarget)
                    const stats = await this.endGame(game)
                    additionalMessage += this.rewardPlayersOnGameEnd(stats, diceTarget)
                    const kek = (await EmojiHelper.getEmoji('kekw', interaction)).id
                    stats.forEach((stat) => {
                        const username = UserUtils.findUserById(stat.userId, interaction)?.username ?? 'Ukjent'
                        if (diceTarget > 30 && RandomUtils.getRndBetween0and100() > 40) {
                            additionalMessage += ` ${kek}`
                        }
                        if (stat.didGetNewBiggestLoss) additionalMessage += `\n*(${username} fikk et nytt tall inn på topplisten av største tap)*`
                        if (stat.isOnATHLossStreak) additionalMessage += `\n*(${username} har ny ATH loss streak på ${stat.isOnATHLossStreak})*`
                        else if (stat.currentLossStreak > 4) additionalMessage += `\n*(${username} er på en ${stat.currentLossStreak} loss streak)*`
                    })
                }
            }
            const bold = (game?.players?.length ?? 0) == 1 ? '**' : ''
            const waitTme = roll == 1 && Math.random() < diceTarget / 1000 ? 5000 : 0 // Økende sannsynlighet for å bli tomasa jo større tapet er
            setTimeout(() => {
                this.messageHelper.replyToInteraction(interaction, `${bold}${roll} *(1 - ${diceTarget})*${bold}  ${additionalMessage}`, {
                    sendAsSilent: (game?.players?.length ?? 2) > 1,
                })
            }, waitTme)
        }
    }

    private checkForShuffle(roll: number, target: number, additionalMessage: string): string {
        let msg = additionalMessage
        const rollAsString: string = roll.toString()
        const targetAsString = target.toString()
        const shuffled = rollAsString.replace(/0/g, '').split('').sort().join('') === targetAsString.replace(/0/g, '').split('').sort().join('')
        if (shuffled) {
            //Shuffle the reward pot digits into a new number in random order
            const potArray = this.rewardPot.toString()
            const dontShuffle = potArray.substring(0,potArray.length-targetAsString.length)
            const shuffle = potArray.substring(dontShuffle.length,potArray.length)

            let shuffledPot = shuffle

            //Make sure we dont go infinitely if the Pot contains only one unique digit
            const regEx = new RegExp(/^([0-9])\1*$/gi)

            while (shuffledPot === shuffle && !regEx.test(shuffledPot)) {
                shuffledPot = ArrayUtils.shuffleArray(shuffle.split('')).join('')
            }

            const oldPot = this.rewardPot
            this.rewardPot = parseInt(dontShuffle + shuffledPot)
            msg +=`${
                additionalMessage.length > 0 ? '\nShuffle! ' : 'Shuffle!\n'
            }Potten ble shufflet fra ${oldPot} til ${this.rewardPot} chips!`
        }
        return msg
    }
    //TODO: Make this pretty
    private rewardPlayersOnGameEnd(s: DeathRollStats[], diceTarget: number) {
        const playerHasATHStreak = s.find((p) => p.isOnATHLossStreak && p.isOnATHLossStreak > 0)
        const playerHasStreak = s.find((p) => p.currentLossStreak > 4)
        const playerHasBiggestLoss = s.find((p) => p.didGetNewBiggestLoss && p.didGetNewBiggestLoss > 0)

        let reward = playerHasATHStreak ? playerHasATHStreak.currentLossStreak * 2000 : 0
        if (playerHasStreak && !playerHasATHStreak) reward += (playerHasStreak.currentLossStreak-4) * 1000
        if (playerHasBiggestLoss) reward += playerHasBiggestLoss.didGetNewBiggestLoss * 50
        else if (diceTarget >= 100) reward += diceTarget * 10
        this.rewardPot += reward
        if (reward > 0) this.saveRewardPot()
        return reward >= 100 ? `(pott + ${reward} = ${this.rewardPot} chips)` : ''
    }

    private async rewardPotToUser(userId: string, addToPot: number) {
        const dbUser = await this.client.database.getUser(userId)
        const initalPot = this.rewardPot
        const rewarded = this.client.bank.giveMoney(dbUser, (this.rewardPot + addToPot))
        this.rewardPot = (this.rewardPot + addToPot) - rewarded
        if (rewarded > 0) this.saveRewardPot()
        const jailed = this.rewardPot > 0
        return `Nice\nDu vinner potten på ${initalPot} ${addToPot > 0 ? '(+'+addToPot+') ' : ''}chips! ${
            jailed ? `(men du får bare ${rewarded} siden du er i fengsel)\nPotten er fortsatt på ${this.rewardPot} chips` : ''
        }`
    }

    private checkForReward(roll: number, diceTarget: number) {
        if (roll == 9 && diceTarget == 11 && Math.random() < 0.5) {
            // 50% sjanse for minus i potten ved 9-11
            const removed = this.rewardPot >= 2977 ? 2977 : this.rewardPot
            this.rewardPot -= removed
            if (removed > 0) this.saveRewardPot()
            return removed > 0 ? `(pott - ${removed} = ${this.rewardPot} chips)\nNever forget :coffin:` : ''
        }
        let totalAdded = this.getRollReward(roll)
        const multipliers: number[] = [1]
        const lowRoll = roll < 100

        const addToPot = (amount: number, multiplierIncrease: number) => {
            totalAdded += amount
            if (!lowRoll) multipliers.push(multiplierIncrease)
        }
        if (roll === diceTarget) addToPot(roll, 10)

        //Checks if all digits are the same (e.g. 111, 2222, 5555)
        const sameDigits = new RegExp(/^([0-9])\1*$/gi).test(roll.toString())
        if (sameDigits && roll > 10) addToPot(roll, 1)
        //Check if ONLY the first digits is a non-zero (e.g. 40, 500, 6000, 20000)
        const allDigitsExceptFirstAreZero = new RegExp(/^[1-9]0+$/gi).test(roll.toString())
        if (allDigitsExceptFirstAreZero) addToPot(roll, 1)

        multipliers.forEach((m) => {
            totalAdded *= m
        })
        const finalAmount = totalAdded
        this.rewardPot += finalAmount
        if (totalAdded > 0) this.saveRewardPot()
        return totalAdded >= 100 ? `(pott + ${finalAmount} = ${this.rewardPot} chips)` : ''
    }

    private getRollReward(r: number) {
        switch (r) {
            case 6969:
                return 69690
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
                return 19999
            case 1997:
                return 101
            case 8008:
                return 80085
            case 1881:
                return 1881
            case 123:
                return 1230
            case 1234:
                return 12340
            case 12345:
                return 123450
            default:
                return 0
        }
    }

    private async checkIfPotWon(game: DRGame, roll: number, diceTarget: number, userid: string) {
        if ([...this.client.cache.deathrollWinningNumbers, 69].includes(roll) && game.initialTarget >= 10000) {
            const addToPot = this.rewardPot > 0 ? (diceTarget-roll) : 0
            return await this.rewardPotToUser(userid, addToPot)
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
        return this.drGames.find(game => game.nextToRoll === userID && game.lastRoll === diceTarget)
    }

    private joinGame(game: DRGame, userID: string) {
        if (game && game.joinable) {
            game.players.push({ userID: userID, rolls: [] })
            return game
        }
        return undefined
    }

    private checkForAvailableGame(userID: string, diceTarget?: number) {
        return this.drGames?.find(
            (game) =>
                game.joinable && //game is joinable
                !game.players.some((player) => player.userID == userID) && //player hasn't already joined
                (!diceTarget || game.lastRoll === diceTarget)
        )
    }

    private registerNewGame(userID: string, diceTarget: number) {
        const p1: DRPlayer = { userID: userID, rolls: [] }
        const game: DRGame = { id: randomUUID(), players: [p1], joinable: true, lastRoll: diceTarget, nextToRoll: userID, initialTarget: diceTarget }
        this.drGames.push(game)
        return game
    }

    private updateGame(game: DRGame, userID: string, newRoll: number) {
        const currentPlayerIndex = game.players.findIndex((player) => player.userID == userID)
        const currentPlayer = game.players[currentPlayerIndex]
        if (game.joinable && currentPlayer.rolls?.length > 0) game.joinable = false
        currentPlayer.rolls.push(newRoll)
        game.lastRoll = newRoll
        const nextPlayerIndex = Math.abs(currentPlayerIndex + 1) % game.players.length
        game.nextToRoll = game.players[nextPlayerIndex].userID
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
        return this.drGames?.find(game => game.nextToRoll === userID && game.players.length > 1)
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
        const fields = this.drGames?.map((game, i) => {
            let stateString = game.players.reduce((acc, player) => (acc += `${UserUtils.findMemberByUserID(player.userID, interaction).user.username}, `), '')
            stateString =
                stateString.substring(0, stateString.length - 2) +
                `\n:hourglass: **${UserUtils.findMemberByUserID(game.nextToRoll, interaction).user.username}** :hourglass: (${game.lastRoll}) `
            const joinable = game.joinable ? ':unlock:' : ':lock:'
            return { name: `Game ${i + 1} ${joinable}`, value: stateString }
        })
        const shortenedFieldList = fields.slice(0, 25)
        embed.addFields(shortenedFieldList)
        if (fields.length > 25) embed.setFooter({text: `+ ${fields.length - 25} games`})
        this.messageHelper.replyToInteraction(interaction, embed)
    }

    override async onSave() {
        await this.saveActiveGamesToDatabase()
        return true
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
