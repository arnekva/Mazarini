import { ButtonInteraction, CacheType, ChatInputCommandInteraction, InteractionResponse, Message } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import { MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../../interfaces/interactionInterface'
import { mastermindContainer } from '../../templates/containerTemplates'
import { EmbedUtils } from '../../utils/embedUtils'
import { ChannelIds } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { UserUtils } from '../../utils/userUtils'

export interface MMGame {
    id: string
    previousGuesses: string[][]
    currentGuess: string[]
    completed: boolean
    guessLimitReached: boolean
    container?: SimpleContainer
    message?: Message | InteractionResponse
}

interface MMHint {
    black: number
    white: number
}

const colors = ['red', 'blue', 'yellow', 'green', 'black', 'white']

export class Mastermind extends AbstractCommands {
    private solution: string[]
    private userGames: Map<string, MMGame>

    constructor(client: MazariniClient) {
        super(client)
        this.userGames = new Map<string, MMGame>()
    }

    async onReady(): Promise<void> {
        this.solution = await this.database.getMastermindSolution()
        if (!this.solution || this.solution.length === 0) this.setNewSolution()
    }

    private async setupMastermind(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.database.getUser(interaction.user.id)
        let game: MMGame = this.userGames.get(interaction.user.id)
        if ((!game || game.guessLimitReached) && user.dailyGameStats?.mastermind?.attempted)
            return this.messageHelper.replyToInteraction(interaction, 'Du har ikke flere forsøk i dag')
        if (!game)
            game = {
                id: interaction.user.id,
                previousGuesses: new Array<string[]>(),
                currentGuess: new Array<string>(),
                completed: false,
                guessLimitReached: false,
            }
        const container = game.container ?? mastermindContainer()
        game.container = container
        const msg = await this.messageHelper.replyToInteraction(interaction, '', { ephemeral: true }, [container.container])
        game.message = msg
        if (!this.userGames.has(interaction.user.id)) this.userGames.set(interaction.user.id, game)
    }

    private addColor(interaction: ButtonInteraction<CacheType>) {
        interaction.deferUpdate()
        const game = this.userGames.get(interaction.user.id)
        if (game.currentGuess && game.currentGuess.length === GameValues.mastermind.codeLength) return
        if (!game.currentGuess) game.currentGuess = new Array<string>()
        game.currentGuess.push(interaction.customId.split(';')[1])
        this.updateGameMessage(interaction)
    }

    private resetColors(interaction: ButtonInteraction<CacheType>) {
        interaction.deferUpdate()
        const game = this.userGames.get(interaction.user.id)
        if (!game.currentGuess || game.currentGuess.length === 0) return
        game.currentGuess = new Array<string>()
        this.updateGameMessage(interaction)
    }

    private updateGameMessage(interaction: ButtonInteraction<CacheType>) {
        const game = this.userGames.get(interaction.user.id)
        const currentRowString = game.currentGuess.map((color) => this.getColorEmoji(color)).join(' ')
        const currentRow = ComponentsHelper.createTextComponent().setContent(currentRowString + ' :arrow_left:')
        game.container.replaceComponent(`guess${game.previousGuesses?.length + 1}`, currentRow)
        game.message.edit({ components: [game.container.container] })
    }

    private async submitGuess(interaction: ButtonInteraction<CacheType>) {
        // Verify 4 colors
        interaction.deferUpdate()
        const game = this.userGames.get(interaction.user.id)
        if (!game.currentGuess || game.currentGuess.length !== GameValues.mastermind.codeLength) return
        // Check guess
        const correct = this.checkGuess(game)
        // Update current row with hint
        const currentRowString = game.currentGuess.map((color) => this.getColorEmoji(color)).join(' ')
        const currentRow = ComponentsHelper.createTextComponent().setContent(currentRowString + ' | ' + this.getHintString(correct))
        game.container.replaceComponent(`guess${game.previousGuesses?.length + 1}`, currentRow)
        game.previousGuesses.push(game.currentGuess)
        game.currentGuess = new Array<string>()
        // Add new row to container
        game.completed = correct.black === GameValues.mastermind.codeLength
        game.guessLimitReached = game.previousGuesses.length === GameValues.mastermind.totalAttempts
        if (game.completed || game.guessLimitReached) {
            game.container.removeComponent('buttons1')
            game.container.removeComponent('buttons2')
            game.container.removeComponent('buttons3')
        }
        this.addNewRow(game)
        await this.updateUserStats(game)
        game.message.edit({ components: [game.container.container] })
    }

    private addNewRow(game: MMGame) {
        let content = ''
        if (game.completed) content = 'Gratulerer! Du har fullført dagens mastermind!'
        else if (game.guessLimitReached) content = 'Beklager! Du er tom for forsøk i dag. \nRiktig løsning var:'
        else content = ':arrow_left:'
        const nextRow = ComponentsHelper.createTextComponent().setContent(content)
        const previousRowIndex = game.container.getComponentIndex(`guess${game.previousGuesses?.length}`)
        game.container.addComponent(nextRow, `guess${game.previousGuesses?.length + 1}`, previousRowIndex + 1)
        if (game.guessLimitReached && !game.completed) {
            const solution = this.solution.map((color) => this.getColorEmoji(color)).join(' ')
            const finalRow = ComponentsHelper.createTextComponent().setContent(solution)
            game.container.addComponent(finalRow, `guess${game.previousGuesses?.length + 1}`, previousRowIndex + 2)
        }
    }

    private async updateUserStats(game: MMGame) {
        const user = await this.database.getUser(game.id)
        user.dailyGameStats = { ...user.dailyGameStats, mastermind: { attempted: true, numAttempts: game.previousGuesses.length, completed: game.completed } }
        await this.database.updateUser(user)
    }

    private checkGuess(game: MMGame): MMHint {
        let black = 0
        let white = 0

        const answerCopy = [...this.solution]
        const guessCopy = [...game.currentGuess]

        // First pass: find exact matches (black pegs)
        for (let i = 0; i < game.currentGuess.length; i++) {
            if (game.currentGuess[i] === this.solution[i]) {
                black++
                // Mark as used so we don't double-count later
                answerCopy[i] = guessCopy[i] = null as any
            }
        }

        // Second pass: find color-only matches (white pegs)
        for (let i = 0; i < game.currentGuess.length; i++) {
            if (guessCopy[i] && answerCopy.includes(guessCopy[i])) {
                white++
                // Remove the matched color to avoid duplicates
                const index = answerCopy.indexOf(guessCopy[i])
                answerCopy[index] = null as any
            }
        }

        return { black: black, white: white }
    }

    private getHintString(hint: MMHint) {
        return ':black_small_square:'.repeat(hint.black) + ':white_small_square:'.repeat(hint.white)
    }

    private getColorEmoji(color: string) {
        const large = ['black', 'white'].includes(color) ? '_large' : ''
        return `:${color}${large}_square:`
    }

    private wipeGames() {
        this.userGames.clear()
        return true
    }

    private async revealWinner() {
        const users = await this.database.getAllUsers()
        const usersWithStats = users.filter((user) => user.dailyGameStats?.mastermind?.attempted)
        const attempted = (usersWithStats?.length ?? 0) > 0
        let description = `Ingen forsøk ble gjort på gårsdagens mastermind`
        if (attempted) {
            const sortedUsers = usersWithStats.sort((a, b) => {
                const aBest = a.dailyGameStats?.mastermind?.completed ? a.dailyGameStats?.mastermind?.numAttempts : GameValues.mastermind.totalAttempts + 1
                const bBest = b.dailyGameStats?.mastermind?.completed ? b.dailyGameStats?.mastermind?.numAttempts : GameValues.mastermind.totalAttempts + 1
                return aBest - bBest
            })

            const bestScore = sortedUsers[0].dailyGameStats.mastermind.numAttempts
            const winners = sortedUsers[0].dailyGameStats.mastermind.completed
                ? sortedUsers
                      .slice()
                      .filter((user) => user.dailyGameStats.mastermind.numAttempts === bestScore && user.dailyGameStats.mastermind.numAttempts > 0)
                : []

            const results = sortedUsers
                .map((user) => {
                    const isWinner = winners.some((winner) => winner.id === user.id)
                    const userResult = `${user.dailyGameStats.mastermind.completed ? user.dailyGameStats.mastermind.numAttempts + ' forsøk' : ':x:'}`
                    return `${UserUtils.findUserById(user.id, this.client).displayName}: ${userResult} ${isWinner ? ':first_place:' : ''}`
                })
                .join('\n')

            if (winners && winners.length > 0) {
                const winnerNames = []
                const winnerReward = Math.floor(GameValues.mastermind.winnerReward / winners.length)
                for (const winner of winners) {
                    this.client.bank.giveMoney(winner, winnerReward)
                    winnerNames.push(UserUtils.findUserById(winner.id, this.client))
                }
                description =
                    `Gratulerer til gårsdagens vinner${winners.length > 1 ? 'e' : ''} for raskeste løst mastermind, ${winnerNames.join(
                        ' og '
                    )}, som vinner ${winnerReward} chips!` + `\n\nResultater:\n${results}`
            } else {
                description = `Det ble ingen vinner av gårsdagens mastermind` + `\nResultater:\n${results}`
            }
        }

        const embed = EmbedUtils.createSimpleEmbed('Mastermind', description)
        this.messageHelper.sendMessage(ChannelIds.VLADIVOSTOK, { embed: embed })
        if (attempted) {
            this.resetUserStats(usersWithStats)
        }
        this.setNewSolution()
        return true
    }

    private resetUserStats(users: MazariniUser[]) {
        const updates = {}
        users.forEach((user) => {
            const updatePath = this.client.database.getUserPathToUpdate(user.id, 'dailyGameStats')
            updates[`${updatePath}/mastermind`] = { attempted: false, completed: false, numAttempts: 0 }
        })
        this.client.database.updateData(updates)
    }

    private setNewSolution() {
        const newSolution = new Array<string>()
        for (let i = 0; i < GameValues.mastermind.codeLength; i++) {
            newSolution.push(RandomUtils.getRandomItemFromList(colors))
        }
        this.solution = newSolution
        this.database.setMastermindSolution(newSolution)
    }

    override onSave(): Promise<boolean> {
        this.userGames.forEach((game, user) => {
            if (!game.completed && !game.guessLimitReached) {
                this.client.cache.restartImpediments.push(`${UserUtils.findUserById(user, this.client).username} har et aktivt mastermind game`)
            }
        })
        return Promise.resolve(true)
    }

    // eslint-disable-next-line require-await
    async onTimedEvent(): Promise<IOnTimedEvent> {
        return { daily: [() => this.wipeGames(), () => this.revealWinner()], weekly: [], hourly: [] }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'mastermind',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            const cmd = interaction.options.getSubcommand()
                            if (cmd === 'spill') this.setupMastermind(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'MASTERMIND_COLOR',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.addColor(interaction)
                        },
                    },
                    {
                        commandName: 'MASTERMIND_RESET',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.resetColors(interaction)
                        },
                    },
                    {
                        commandName: 'MASTERMIND_SUBMIT',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.submitGuess(interaction)
                        },
                    },
                ],
            },
        }
    }
}
