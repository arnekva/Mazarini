import { randomUUID } from 'crypto'
import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { DeathRollStats } from '../../helpers/databaseHelper'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { LootboxQuality, MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../../interfaces/interactionInterface'
import { ArrayUtils } from '../../utils/arrayUtils'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils, ThreadIds } from '../../utils/mentionUtils'
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
    loserID?: string
}

export class Deathroll extends AbstractCommands {
    private drGames: DRGame[]

    private latestRoll: Date
    private previousSuggestions: Map<string, number>

    constructor(client: MazariniClient) {
        super(client)
        this.previousSuggestions = new Map<string, number>()

        // this.reRollWinningNumbers()
    }
    get rewardPot() {
        return this.client.cache.deathrollPot
    }
    set rewardPot(value: number) {
        this.client.cache.deathrollPot = value
    }
    async onReady() {
        const oldGames = await this.fetchSavedGames()

        if (oldGames) this.drGames = oldGames
        else this.drGames = new Array<DRGame>()

        this.reRollWinningNumbers()

        this.client.database.getDeathrollPot().then((value) => (this.client.cache.deathrollPot = value ?? 0))
    }

    private reRollWinningNumbers(printOldNumbers = false) {
        if (printOldNumbers) this.printOldNumbers()
        this.client.cache.deathrollWinningNumbers = Deathroll.getRollWinningNumbers()
    }

    //TODO: Should probably be refactored to somewhere else
    static getRollWinningNumbers() {
        const winningNumbers = new Array<number>()
        GameValues.deathroll.winningNumberRanges.forEach(([min, max]) => {
            winningNumbers.push(RandomUtils.getRandomInteger(min, max))
        })
        return winningNumbers
    }

    public printOldNumbers() {
        this.messageHelper.sendLogMessage(`De forrige skjulte tallene var:` + this.client.cache.deathrollWinningNumbers?.join(', '))
    }

    public saveActiveGamesToDatabase() {
        this.client.database.saveDeathrollGames(this.drGames)
    }

    private async fetchSavedGames() {
        return await this.client.database.getDeathrollGames()
    }

    private async rollDice(interaction: ChatInputCommandInteraction<CacheType>) {
        const diceTarget = interaction.options.get('sider')?.value as number
        if (diceTarget > 999999999) {
            this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille en terning med mer enn 9 sifre`, { ephemeral: true })
        } else if (diceTarget <= 0)
            this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille en terning med mindre enn 1 side`, { ephemeral: true })
        else {
            const user = interaction.user
            const game = this.getGame(user.id, diceTarget)
            const roll = RandomUtils.getRandomInteger(1, diceTarget)

            let additionalMessage = ''
            if (game) {
                this.latestRoll = new Date()
                this.updateGame(game, user.id, roll)
                this.checkForPotSkip(roll, diceTarget, user.id)
                const rewards = await this.checkForReward(roll, diceTarget, interaction)
                additionalMessage += rewards.text
                additionalMessage += this.checkForJokes(roll, diceTarget, game.nextToRoll)
                additionalMessage += await this.checkIfPotWon(game, roll, diceTarget, user.id)

                if (roll >= 100 && roll !== diceTarget) {
                    //Check if roll is a shuffled variant of the target number
                    additionalMessage = await this.checkForShuffle(roll, diceTarget, additionalMessage)
                }
                if (roll == 1) {
                    this.checkForLossOnFirstRoll(game, diceTarget)
                    const stat = await this.endGame(game)
                    additionalMessage += this.addToPotOnGameEnd(stat, diceTarget)
                    const kek = (await EmojiHelper.getEmoji('kekw', interaction)).id
                    const username = UserUtils.findUserById(stat.userId, interaction)?.username ?? 'Ukjent'

                    if (diceTarget > 80 || (diceTarget > 30 && RandomUtils.getRndBetween0and100() > 60)) {
                        additionalMessage += ` ${kek}`
                    }
                    if (stat.didGetNewBiggestLoss) additionalMessage += `\n*(${username} fikk et nytt tall inn på topplisten av største tap)*`
                    if (stat.isOnATHLossStreak) additionalMessage += `\n*(${username} har ny ATH loss streak på ${stat.isOnATHLossStreak})*`
                    else if (stat.currentLossStreak > 4) additionalMessage += `\n*(${username} er på en ${stat.currentLossStreak} loss streak)*`
                }
            }
            const bold = (game?.players?.length ?? 0) == 1 ? '**' : ''
            // Økende sannsynlighet for å bli tomasa jo større tapet er | generelt 0.1% sannsynlig å bli tomasa
            const shouldThrowTomas = Math.random() < 0.001 || (roll == 1 && Math.random() < diceTarget / 1000)
            const sendRoll = () => {
                this.messageHelper.replyToInteraction(interaction, `${bold}${roll} *(1 - ${diceTarget})*${bold}  ${additionalMessage}`, {
                    sendAsSilent: (game?.players?.length ?? 2) > 1,
                })
            }

            if (shouldThrowTomas)
                setTimeout(() => {
                    sendRoll()
                }, 5000)
            else sendRoll()
        }
    }

    private checkForPotSkip(roll: number, diceTarget: number, userId: string) {
        if (diceTarget > GameValues.deathroll.potSkip.diceTarget && roll < GameValues.deathroll.potSkip.roll) this.database.incrementPotSkip(userId)
    }

    private async checkForShuffle(roll: number, target: number, additionalMessage: string): Promise<string> {
        let msg = additionalMessage
        const rollAsString: string = roll.toString()
        const targetAsString = target.toString()
        const shuffled = rollAsString.replace(/0/g, '').split('').sort().join('') === targetAsString.replace(/0/g, '').split('').sort().join('')
        if (shuffled) {
            //Shuffle the reward pot digits into a new number in random order
            const potArray = this.rewardPot.toString()
            const storage = await this.database.getStorage()
            const shuffleIgnoresDigitLength = !!storage?.effects?.positive?.shuffleIgnoresDigits
            const dontShuffle = potArray.substring(0, potArray.length - targetAsString.length)
            const shuffle = potArray.substring(shuffleIgnoresDigitLength ? 0 : dontShuffle.length, potArray.length)

            let shuffledPot = shuffle

            //Make sure we dont go infinitely if the Pot contains only one unique digit
            const regEx = new RegExp(/^([0-9])\1*$/gi)

            while (shuffledPot === shuffle && !regEx.test(shuffledPot)) {
                shuffledPot = ArrayUtils.shuffleArray(shuffle.split('')).join('')
            }

            const oldPot = this.rewardPot
            this.rewardPot = parseInt(dontShuffle + shuffledPot)
            msg += `${additionalMessage.length > 0 ? '\nShuffle! ' : 'Shuffle!\n'}Potten ble shufflet fra ${oldPot} til ${this.rewardPot} chips! ${
                shuffleIgnoresDigitLength ? '*(full shuffle!)*' : ''
            }`
        }
        return msg
    }

    private addToPotOnGameEnd(stat: DeathRollStats, diceTarget: number) {
        const playerHasATHStreak = stat.isOnATHLossStreak && stat.isOnATHLossStreak > 0
        const playerHasStreak = stat.currentLossStreak > 4
        const playerHasBiggestLoss = stat.didGetNewBiggestLoss && stat.didGetNewBiggestLoss > 0

        let reward = playerHasATHStreak ? stat.currentLossStreak * GameValues.deathroll.addToPot.athStreakMultiplier : 0
        if (playerHasStreak && !playerHasATHStreak) reward += (stat.currentLossStreak - 4) * GameValues.deathroll.addToPot.streakMultiplier
        if (playerHasBiggestLoss) reward += stat.didGetNewBiggestLoss * GameValues.deathroll.addToPot.biggestLossMultiplier
        else if (diceTarget >= 100) reward += diceTarget * GameValues.deathroll.addToPot.largeNumberLossMultiplier
        this.rewardPot += Math.ceil(reward)
        if (reward > 0) this.saveRewardPot()
        return reward >= GameValues.deathroll.addToPot.minReward ? `(pott + ${reward} = ${this.rewardPot} chips)` : ''
    }

    private checkForJokes(roll: number, diceTarget: number, nextToRoll: string) {
        if (diceTarget == 11 || roll == 911) {
            if ((roll == 9 || roll == 911) && Math.random() < GameValues.deathroll.jokes.nineElevenChance) {
                const removed = this.rewardPot >= GameValues.deathroll.jokes.nineElevenRemove ? GameValues.deathroll.jokes.nineElevenRemove : this.rewardPot
                this.rewardPot -= removed
                if (removed > 0) this.saveRewardPot()
                return removed > 0 ? `(pott - ${removed} = ${this.rewardPot} chips)\nNever forget :coffin:` : ''
            } else if (roll == 7) {
                return '\n' + RandomUtils.getRandomItemFromList(['hæ, pølse?', ''])
            }
        }
        // else if (roll == 11 && nextToRoll === MentionUtils.User_IDs.THOMAS) {
        //     const mas2 = MentionUtils.mentionUser(nextToRoll)
        //     return (
        //         '\n' +
        //         RandomUtils.getRandomItemFromList([
        //             `denne er garantert safe ${mas2}`,
        //             `${mas2} sykt nice at terning er rig-proof, eller ka? <:pointerbrothers2:1215405291382767706>`,
        //             `${mas2} nå som eg har begynt å påpeke an er an ikke så farlig vel?`,
        //             `rart hvordan ingen andre har problemer med denne`,
        //             '<:pointerbrothers1:1177653110852825158>',
        //             '',
        //             '',
        //             '',
        //             '',
        //             '',
        //         ])
        //     )
        // }
        return ''
    }

    private async checkForReward(roll: number, diceTarget: number, int: ChatInputCommandInteraction<CacheType>): Promise<{ val: number; text: string }> {
        let totalAdded = this.getRollReward(roll)
        const multipliers: number[] = [1]
        const lowRoll = roll < GameValues.deathroll.checkForReward.minRollForMultiplier

        const addToPot = (amount: number, multiplierIncrease: number) => {
            totalAdded += amount
            if (!lowRoll) multipliers.push(multiplierIncrease)
        }
        if (roll === diceTarget) addToPot(roll, GameValues.deathroll.checkForReward.diceTargetMultiplier)

        if (roll === 2) addToPot(GameValues.deathroll.checkForReward.roll2Reward, 1)
        //Checks if all digits are the same (e.g. 111, 2222, 5555)
        const sameDigits = new RegExp(/^([0-9])\1*$/gi).test(roll.toString())
        if (sameDigits) addToPot(roll, GameValues.deathroll.checkForReward.sameDigitsMultiplier)
        //Check if ONLY the first digits is a non-zero (e.g. 40, 500, 6000, 20000)
        const allDigitsExceptFirstAreZero = new RegExp(/^[1-9]0+$/gi).test(roll.toString())
        if (allDigitsExceptFirstAreZero) addToPot(roll, GameValues.deathroll.checkForReward.allDigitsExceptFirstAreZeroMultiplier)
        let user: MazariniUser = undefined
        if (totalAdded > 0 && roll >= GameValues.deathroll.checkForReward.minRollForMultiplier) {
            user = await this.client.database.getUser(int.user.id)
            if ((user.effects?.positive?.doublePotDeposit ?? 0) > 0) {
                multipliers.push(GameValues.deathroll.checkForReward.doublePotDepositMultiplier)
                user.effects.positive.doublePotDeposit--
                this.client.database.updateUser(user)
            }
        }
        multipliers.forEach((m) => {
            totalAdded *= m
        })
        if (
            totalAdded > 0 &&
            roll >= GameValues.deathroll.checkForReward.minRollForMultiplier &&
            this.rewardPot < GameValues.deathroll.checkForReward.minPotForDouble &&
            totalAdded < GameValues.deathroll.checkForReward.maxDoubleReward
        )
            totalAdded *= 2
        const finalAmount = totalAdded
        const buff = user?.effects?.positive?.deahtrollLootboxChanceMultiplier ?? 1
        if (
            finalAmount >= GameValues.deathroll.addToPot.minReward &&
            roll >= GameValues.deathroll.checkForReward.minRollForMultiplier &&
            RandomUtils.getRandomPercentage(GameValues.deathroll.checkForReward.lootboxChance * buff)
        ) {
            let remainingChips = 0
            let cost = GameValues.deathroll.checkForReward.lootbox.basic.cost
            let quality = LootboxQuality.Basic
            if (finalAmount >= GameValues.deathroll.checkForReward.lootbox.elite.min) {
                quality = LootboxQuality.Elite
                cost = GameValues.deathroll.checkForReward.lootbox.elite.cost
            } else if (finalAmount >= GameValues.deathroll.checkForReward.lootbox.premium.min) {
                quality = LootboxQuality.Premium
                cost = GameValues.deathroll.checkForReward.lootbox.premium.cost
            }
            remainingChips = Math.ceil(totalAdded - cost)
            this.rewardPot += Math.max(remainingChips, 0)
            const totalText = `Lootbox reward! *(pott + ${Math.max(0, remainingChips)} = ${this.rewardPot} chips)*`
            this.client.bank.rewardLootbox(
                int.channelId,
                int.user.id,
                quality,
                `${MentionUtils.mentionUser(int.user.id)} du får ein ${quality} lootbox for ${roll}. Gz! `
            )
            return { val: Math.max(0, remainingChips), text: totalText }
        } else {
            this.rewardPot += Math.ceil(finalAmount)
        }
        if (totalAdded > 0) this.saveRewardPot()

        return {
            val: totalAdded,
            text:
                roll >= GameValues.deathroll.checkForReward.minRollForMultiplier && totalAdded > GameValues.deathroll.addToPot.minReward
                    ? `(pott + ${finalAmount} = ${this.rewardPot} chips)`
                    : '',
        }
    }

    private getRollReward(r: number) {
        if (GameValues.deathroll.getRollReward.specialNumbers.includes(r)) return r * GameValues.deathroll.getRollReward.multiplier
        else return 0
    }

    private async checkIfPotWon(game: DRGame, roll: number, diceTarget: number, userid: string) {
        const wonOnRandomNumber = this.client.cache.deathrollWinningNumbers.includes(roll)
        const wonOnStandard = roll === GameValues.deathroll.potWin.winOn
        const hasWon = wonOnRandomNumber || wonOnStandard
        if (hasWon && game.initialTarget >= GameValues.deathroll.potWin.minTarget) {
            if (wonOnRandomNumber) this.reRollWinningNumbers(true)
            const addToPot = this.rewardPot > 0 ? diceTarget - roll : 0
            return await this.rewardPotToUser(userid, addToPot)
        }
        return ''
    }

    private async rewardPotToUser(userId: string, addToPot: number) {
        const dbUser = await this.client.database.getUser(userId)
        const initialPot = this.rewardPot
        let potMultiplier = 1
        if ((dbUser.effects?.positive?.doublePotWins ?? 0) > 0) {
            potMultiplier = 2
            dbUser.effects.positive.doublePotWins--
        }
        const potentialReward = (this.rewardPot + addToPot) * potMultiplier
        const rewarded = this.client.bank.giveMoney(dbUser, potentialReward)
        this.rewardPot = Math.max(this.rewardPot + addToPot - rewarded, 0)
        if (rewarded > 0) this.saveRewardPot()
        if (rewarded < GameValues.deathroll.potWin.noThanksThreshold) this.sendNoThanksButton(userId, rewarded)
        else if (rewarded >= GameValues.deathroll.potWin.noThanksThreshold) this.sendBlackjackButton(userId, rewarded)
        const jailed = this.rewardPot > 0
        return (
            ` Nice\nDu vinner potten på ${initialPot + addToPot} ${addToPot > 0 ? `(${initialPot} + ${addToPot}) ` : ''}chips!` +
            `${potMultiplier > 1 ? `\n(men du har jo en x${potMultiplier} multiplier, så da får du ${potentialReward} chips!)` : ''}` +
            `${jailed ? `\n(men du får bare ${rewarded} siden du er i fengsel)\nPotten er fortsatt på ${this.rewardPot} chips` : ''}`
        )
    }

    private saveRewardPot(saveToDb: boolean = false) {
        if (saveToDb) this.client.database.saveDeathrollPot(this.rewardPot)
    }

    private sendNoThanksButton(userId: string, rewarded: number) {
        const button = noThanksButton(userId, rewarded)
        setTimeout(() => {
            this.messageHelper.sendMessage(ThreadIds.GENERAL_TERNING, { components: [button] })
        }, 500)
    }

    private sendBlackjackButton(userId: string, rewarded: number) {
        const button = blackjackButton(userId, rewarded)
        setTimeout(() => {
            this.messageHelper.sendMessage(ThreadIds.GENERAL_TERNING, { components: [button] })
        }, 500)
    }

    private async handleNoThanks(interaction: ButtonInteraction<CacheType>) {
        const params = interaction.customId.split(';')
        const userId = params[1]
        if (interaction.user.id !== userId) return interaction.deferUpdate()
        await interaction.deferReply()
        const amount = Number(params[2])
        const user = await this.client.database.getUser(userId)
        const hasTheMoney = this.client.bank.takeMoney(user, amount)
        if (hasTheMoney) {
            this.rewardPot = this.rewardPot + amount + GameValues.deathroll.potWin.noThanksBonus
            this.saveRewardPot()
            this.messageHelper.replyToInteraction(interaction, `Du ville ikke ha ${amount} chips altså? \nJaja, potten er på ${this.rewardPot} chips nå da`, {
                hasBeenDefered: true,
            })
        } else {
            const huh = await EmojiHelper.getEmoji('kekhuh', interaction)
            this.messageHelper.replyToInteraction(interaction, 'Du kan ikke "takke nei" til chipsene hvis du allerede har mistet dem ' + huh.id, {
                hasBeenDefered: true,
            })
        }
        interaction.message.delete()
    }

    private getGame(userID: string, diceTarget: number) {
        let game = this.findActiveGame(userID, diceTarget)
        if (!game) game = this.joinGame(this.checkForAvailableGame(userID, diceTarget), userID)
        return game ?? (diceTarget >= 10000 ? this.registerNewGame(userID, diceTarget) : undefined)
    }

    private findActiveGame(userID: string, diceTarget: number) {
        return this.drGames.find((game) => game.nextToRoll === userID && game.lastRoll === diceTarget && game.players.length > 1)
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
        if (newRoll === 1) {
            game.loserID = userID
        } else {
            const currentPlayerIndex = game.players.findIndex((player) => player.userID == userID)
            const currentPlayer = game.players[currentPlayerIndex]
            if (game.joinable && currentPlayer.rolls?.length > 0) game.joinable = false
            currentPlayer.rolls.push(newRoll)
            game.lastRoll = newRoll
            const nextPlayerIndex = Math.abs(currentPlayerIndex + 1) % game.players.length
            game.nextToRoll = game.players[nextPlayerIndex].userID
        }
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
        const previousRoll = this.previousSuggestions.get(userID)
        const game = this.drGames?.find((game) => game.nextToRoll === userID && game.players.length > 1 && game.lastRoll !== previousRoll)
        return game ?? this.drGames?.find((game) => game.nextToRoll === userID && game.players.length > 1)
    }

    private autoCompleteDice(interaction: AutocompleteInteraction<CacheType>) {
        let game = this.getActiveGameForUser(interaction.user.id)
        if (!game) game = this.checkForAvailableGame(interaction.user.id)

        if (game) {
            const diceTarget = Math.min(...game.players.map((p) => p.rolls).flat())
            this.previousSuggestions.set(interaction.user.id, diceTarget)
            return interaction.respond([{ name: `${diceTarget}`, value: diceTarget }])
        }
        return interaction.respond([{ name: GameValues.deathroll.autoCompleteDiceDefault.toString(), value: GameValues.deathroll.autoCompleteDiceDefault }])
    }

    private printCurrentState(interaction: ChatInputCommandInteraction<CacheType>) {
        const embed = EmbedUtils.createSimpleEmbed('Deathroll state', `${this.rewardPot} chips i potten`)

        const uniquePlayers: { [key: string]: { activeTurns: number; totalGames: number } } = {}

        this.drGames.forEach((game) => {
            game.players.forEach((player) => {
                const playerName = UserUtils.findMemberByUserID(player.userID, interaction).user.username
                if (!uniquePlayers[playerName]) {
                    uniquePlayers[playerName] = { activeTurns: 0, totalGames: 0 }
                }
                uniquePlayers[playerName].totalGames++
                if (game.nextToRoll === player.userID && game.players.length > 1) {
                    uniquePlayers[playerName].activeTurns++
                }
            })
        })

        const fields = Object.entries(uniquePlayers).map(([player, counts]) => ({
            name: player,
            value: `Kan trille ${counts.activeTurns} av ${counts.totalGames} spill`,
        }))

        const shortenedFieldList = fields.slice(0, GameValues.deathroll.printCurrentStateMaxFields)
        embed.addFields(shortenedFieldList)
        if (fields.length > GameValues.deathroll.printCurrentStateMaxFields)
            embed.setFooter({ text: `+ ${fields.length - GameValues.deathroll.printCurrentStateMaxFields} games` })
        this.messageHelper.replyToInteraction(interaction, embed)
    }

    override async onSave() {
        if (this.latestRoll && DateUtils.dateIsWithinLastMinute(this.latestRoll)) {
            this.client.cache.restartImpediments.push('Noen har trilt terning innen det siste minuttet')
        }
        this.printOldNumbers()
        this.saveRewardPot(true)
        await this.saveActiveGamesToDatabase()
        return true
    }

    // eslint-disable-next-line require-await
    async onTimedEvent(): Promise<IOnTimedEvent> {
        return {
            daily: [],
            weekly: [
                () => {
                    this.drGames = []
                    this.saveActiveGamesToDatabase()
                    return true
                },
            ],
            hourly: [
                () => {
                    this.saveActiveGamesToDatabase()
                    this.saveRewardPot()
                    return true
                },
            ],
        }
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
                buttonInteractionComands: [
                    {
                        commandName: 'DEATHROLL_NO_THANKS',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.handleNoThanks(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

const noThanksButton = (userId: string, rewarded: number) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `DEATHROLL_NO_THANKS;${userId};${rewarded}`,
            style: ButtonStyle.Primary,
            label: `Nei takk (+${GameValues.deathroll.potWin.noThanksBonus} chips)`,
            disabled: false,
            type: 2,
        })
    )
}
export const blackjackButton = (userId: string, rewarded: number) => {
    const emoji = rewarded >= 20000 ? { name: 'arne', id: '860282686605230130' } : { name: 'pointerbrothers1', id: '1177653110852825158' }
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `BLACKJACK_DEATHROLL;${userId};${rewarded}`,
            style: ButtonStyle.Success,
            disabled: false,
            emoji: emoji,
            type: 2,
        })
    )
}
