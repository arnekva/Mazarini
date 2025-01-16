import { randomUUID } from 'crypto'
import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { DeathRollStats } from '../../helpers/databaseHelper'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { LootboxQuality, MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { ArrayUtils } from '../../utils/arrayUtils'
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

    private reRollWinningNumbers(printOldNumbers = false) {
        setTimeout(() => {
            if (printOldNumbers) this.printOldNumbers()
            this.client.cache.deathrollWinningNumbers = Deathroll.getRollWinningNumbers()
        }, 5000)
    }

    //TODO: Should probably be refactored to somewhere else
    static getRollWinningNumbers() {
        const winningNumbers = new Array<number>()
        winningNumbers.push(RandomUtils.getRandomInteger(75, 100))
        winningNumbers.push(RandomUtils.getRandomInteger(101, 125))
        winningNumbers.push(RandomUtils.getRandomInteger(126, 150))
        winningNumbers.push(RandomUtils.getRandomInteger(151, 200))
        winningNumbers.push(RandomUtils.getRandomInteger(201, 10000))
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

    private retrieveDeathrollPot() {
        setTimeout(() => {
            this.client.database.getDeathrollPot().then((value) => (this.rewardPot = value ?? 0))
        }, 5000)
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
                this.updateGame(game, user.id, roll)
                const rewards = await this.checkForReward(roll, diceTarget, interaction)
                additionalMessage += rewards.text
                additionalMessage += this.checkForJokes(roll, diceTarget, game.nextToRoll)
                additionalMessage += await this.checkIfPotWon(game, roll, diceTarget, user.id)

                if (roll >= 100 && roll !== diceTarget) {
                    //Check if roll is a shuffled variant of the target number
                    additionalMessage = this.checkForShuffle(roll, diceTarget, additionalMessage)
                }
                if (roll == 1) {
                    this.checkForLossOnFirstRoll(game, diceTarget)
                    const stat = await this.endGame(game)
                    additionalMessage += this.addToPotOnGameEnd(stat, diceTarget)
                    const kek = (await EmojiHelper.getEmoji('kekw', interaction)).id
                    const username = UserUtils.findUserById(stat.userId, interaction)?.username ?? 'Ukjent'
                    if (diceTarget > 30 && RandomUtils.getRndBetween0and100() > 40) {
                        additionalMessage += ` ${kek}`
                    }
                    if (stat.didGetNewBiggestLoss) additionalMessage += `\n*(${username} fikk et nytt tall inn på topplisten av største tap)*`
                    if (stat.isOnATHLossStreak) additionalMessage += `\n*(${username} har ny ATH loss streak på ${stat.isOnATHLossStreak})*`
                    else if (stat.currentLossStreak > 4) additionalMessage += `\n*(${username} er på en ${stat.currentLossStreak} loss streak)*`
                }
            }
            const bold = (game?.players?.length ?? 0) == 1 ? '**' : ''
            const waitTme = Math.random() < 0.001 || (roll == 1 && Math.random() < diceTarget / 1000) ? 5000 : 0 // Økende sannsynlighet for å bli tomasa jo større tapet er | generelt 0.1% sannsynlig å bli tomasa
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
            const dontShuffle = potArray.substring(0, potArray.length - targetAsString.length)
            const shuffle = potArray.substring(dontShuffle.length, potArray.length)

            let shuffledPot = shuffle

            //Make sure we dont go infinitely if the Pot contains only one unique digit
            const regEx = new RegExp(/^([0-9])\1*$/gi)

            while (shuffledPot === shuffle && !regEx.test(shuffledPot)) {
                shuffledPot = ArrayUtils.shuffleArray(shuffle.split('')).join('')
            }

            const oldPot = this.rewardPot
            this.rewardPot = parseInt(dontShuffle + shuffledPot)
            msg += `${additionalMessage.length > 0 ? '\nShuffle! ' : 'Shuffle!\n'}Potten ble shufflet fra ${oldPot} til ${this.rewardPot} chips!`
        }
        return msg
    }

    private addToPotOnGameEnd(stat: DeathRollStats, diceTarget: number) {
        const playerHasATHStreak = stat.isOnATHLossStreak && stat.isOnATHLossStreak > 0
        const playerHasStreak = stat.currentLossStreak > 4
        const playerHasBiggestLoss = stat.didGetNewBiggestLoss && stat.didGetNewBiggestLoss > 0

        let reward = playerHasATHStreak ? stat.currentLossStreak * 2500 : 0
        if (playerHasStreak && !playerHasATHStreak) reward += (stat.currentLossStreak - 4) * 1100
        if (playerHasBiggestLoss) reward += stat.didGetNewBiggestLoss * 50
        else if (diceTarget >= 100) reward += diceTarget * 10
        this.rewardPot += reward
        if (reward > 0) this.saveRewardPot()
        return reward >= 100 ? `(pott + ${reward} = ${this.rewardPot} chips)` : ''
    }

    private checkForJokes(roll: number, diceTarget: number, nextToRoll: string) {
        if (diceTarget == 11) {
            if (roll == 9 && Math.random() < 0.25) {
                const removed = this.rewardPot >= 2977 ? 2977 : this.rewardPot
                this.rewardPot -= removed
                if (removed > 0) this.saveRewardPot()
                return removed > 0 ? `(pott - ${removed} = ${this.rewardPot} chips)\nNever forget :coffin:` : ''
            } else if (roll == 7) {
                return (
                    '\n' +
                    RandomUtils.getRandomItemFromList([
                        'hæ, pølse?',
                        'alle pølser kr 29 (unntatt baconpølse)',
                        'alle pølser kr 29',
                        'hadde tilbud på pølser forrige uke',
                        'har bedre pølser enn Narvesen',
                        'hæ?',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                    ])
                )
            }
        } else if (roll == 11 && nextToRoll === MentionUtils.User_IDs.THOMAS) {
            const mas2 = MentionUtils.mentionUser(nextToRoll)
            return (
                '\n' +
                RandomUtils.getRandomItemFromList([
                    `denne er garantert safe ${mas2}`,
                    `${mas2} sykt nice at terning er rig-proof, eller ka? <:pointerbrothers2:1215405291382767706>`,
                    `${mas2} nå som eg har begynt å påpeke an er an ikke så farlig vel?`,
                    `rart hvordan ingen andre har problemer med denne`,
                    '<:pointerbrothers1:1177653110852825158>',
                    '',
                    '',
                    '',
                    '',
                    '',
                ])
            )
        }
        return ''
    }

    private async checkForReward(roll: number, diceTarget: number, int: ChatInputCommandInteraction<CacheType>): Promise<{ val: number; text: string }> {
        let totalAdded = this.getRollReward(roll)
        const multipliers: number[] = [1]
        const lowRoll = roll < 100

        const addToPot = (amount: number, multiplierIncrease: number) => {
            totalAdded += amount
            if (!lowRoll) multipliers.push(multiplierIncrease)
        }
        if (roll === diceTarget) addToPot(roll, 10)

        if (roll === 2) addToPot(20, 1)
        //Checks if all digits are the same (e.g. 111, 2222, 5555)
        const sameDigits = new RegExp(/^([0-9])\1*$/gi).test(roll.toString())
        if (sameDigits) addToPot(roll, 4)
        //Check if ONLY the first digits is a non-zero (e.g. 40, 500, 6000, 20000)
        const allDigitsExceptFirstAreZero = new RegExp(/^[1-9]0+$/gi).test(roll.toString())
        if (allDigitsExceptFirstAreZero) addToPot(roll, 4)
        let user: MazariniUser = undefined
        if (totalAdded > 0 && roll >= 100) {
            user = await this.client.database.getUser(int.user.id)
            if ((user.effects?.positive?.doublePotDeposit ?? 0) > 0) {
                multipliers.push(2)
                user.effects.positive.doublePotDeposit--
                this.client.database.updateUser(user)
            }
            if (this.rewardPot < 1000) multipliers.push(2)
        }
        multipliers.forEach((m) => {
            totalAdded *= m
        })
        const finalAmount = totalAdded
        const buff = user?.effects?.positive?.deahtrollLootboxChanceMultiplier ?? 1
        if (finalAmount >= 100 && roll >= 100 && RandomUtils.getRandomPercentage(7.5 * buff)) {
            let remainingChips = 0
            let cost = 0
            let quality = LootboxQuality.Basic
            if (finalAmount >= 25000) {
                quality = LootboxQuality.Elite
                cost = 25000
            } else if (finalAmount >= 10000) {
                quality = LootboxQuality.Premium
                cost = 10000
            } else {
                cost = 5000
            }
            remainingChips = totalAdded - cost
            this.rewardPot += Math.max(remainingChips, 0)
            const totalText = `Lootbox reward! *(pott + (${totalAdded} - ${Math.max(0, cost)}) = ${this.rewardPot} chips)*`
            this.client.bank.rewardLootbox(int.channelId, int.user.id, quality, `${MentionUtils.mentionUser(int.user.id)} du får ein lootbox for ${roll}. Gz! `)
            return { val: Math.max(0, remainingChips), text: totalText }
        } else {
            this.rewardPot += finalAmount
        }
        if (totalAdded > 0) this.saveRewardPot()

        return { val: totalAdded, text: roll >= 100 && totalAdded > 100 ? `(pott + ${finalAmount} = ${this.rewardPot} chips)` : '' }
    }

    private getRollReward(r: number) {
        if ([1996, 1997, 1881, 1337, 1030, 1349, 1814, 1905, 690, 8008, 6969, 420, 123, 1234, 12345, 1984, 2024, 2025].includes(r)) return r * 3
        else return 0
    }

    private async checkIfPotWon(game: DRGame, roll: number, diceTarget: number, userid: string) {
        const wonOnRandomNumber = this.client.cache.deathrollWinningNumbers.includes(roll)
        const wonOnStandard = roll === 69
        const hasWon = wonOnRandomNumber || wonOnStandard
        if (hasWon && game.initialTarget >= 10000) {
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
        if (rewarded < 10000) this.sendNoThanksButton(userId, rewarded)
        const jailed = this.rewardPot > 0
        return (
            ` Nice\nDu vinner potten på ${initialPot + addToPot} ${addToPot > 0 ? `(${initialPot} + ${addToPot}) ` : ''}chips!` +
            `${potMultiplier > 1 ? `\n(men du har jo en x${potMultiplier} multiplier, så da får du ${potentialReward} chips!)` : ''}` +
            `${jailed ? `\n(men du får bare ${rewarded} siden du er i fengsel)\nPotten er fortsatt på ${this.rewardPot} chips` : ''}`
        )
    }

    private saveRewardPot() {
        this.client.database.saveDeathrollPot(this.rewardPot)
    }

    private sendNoThanksButton(userId: string, rewarded: number) {
        const button = noThanksButton(userId, rewarded)
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
            this.rewardPot = this.rewardPot + amount + 2000
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
        return game ?? (diceTarget > 100 ? this.registerNewGame(userID, diceTarget) : undefined)
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
        return this.drGames?.find((game) => game.nextToRoll === userID && game.players.length > 1)
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

        const shortenedFieldList = fields.slice(0, 25)
        embed.addFields(shortenedFieldList)
        if (fields.length > 25) embed.setFooter({ text: `+ ${fields.length - 25} games` })
        this.messageHelper.replyToInteraction(interaction, embed)
    }

    override async onSave() {
        this.printOldNumbers()
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
            label: `Nei takk (+2k chips)`,
            disabled: false,
            type: 2,
        })
    )
}
