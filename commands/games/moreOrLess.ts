import {
    ActionRowBuilder,
    APIEmbedField,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    InteractionResponse,
    Message,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { randomUUID } from 'crypto'
import { IMoreOrLess } from '../../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../../interfaces/interactionInterface'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'
import { FetchUtils } from '../../utils/fetchUtils'
import { MentionUtils, ThreadIds } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'
import { UserUtils } from '../../utils/userUtils'
import { DealOrNoDeal, DonDQuality } from './dealOrNoDeal'

export interface IMoreOrLessData {
    subject: string
    answer: number
    image: string
}

interface IMoreOrLessUserGame {
    id: string
    data: IMoreOrLessData[]
    current?: IMoreOrLessData
    next?: IMoreOrLessData
    correctAnswers: number
    message: Message | InteractionResponse
    active: boolean
    totalQuestions: number
    startTime?: Date
}

export class MoreOrLess extends AbstractCommands {
    private game: IMoreOrLess
    private userGames: Map<string, IMoreOrLessUserGame>

    constructor(client: MazariniClient) {
        super(client)
        this.userGames = new Map<string, IMoreOrLessUserGame>()
        this.getGameFromStorage()
    }

    private getGameFromStorage() {
        setTimeout(() => {
            this.database.getStorage().then((storage) => (this.game = storage.moreOrLess.current))
        }, 5000)
    }

    public static async getNewMoreOrLessGame(previous: string[]): Promise<IMoreOrLess> {
        const url = 'https://api.moreorless.io/en/games.json'
        const games: IMoreOrLess[] = await (
            await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            })
        ).json()
        const unplayed = games.filter((game) => !previous.includes(game.slug))
        const game: IMoreOrLess = unplayed && unplayed.length > 0 ? RandomUtils.getRandomItemFromList(unplayed) : RandomUtils.getRandomItemFromList(games)

        const dataUrl = `https://api.moreorless.io/en/games/${game.slug}.json`
        const check: any = (
            await (
                await fetch(dataUrl, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                })
            ).json()
        ).game
        if (check.data[0].length > 4) {
            return MoreOrLess.getNewMoreOrLessGame([...previous, game.slug])
        } else {
            return { ...game, strings: check.strings }
        }
    }

    private async fetchGameData() {
        const storage = await this.client.database.getStorage()
        this.game = storage.moreOrLess.current ?? (await MoreOrLess.getNewMoreOrLessGame(storage.moreOrLess.previous ?? []))
        const url = `https://api.moreorless.io/en/games/${this.game.slug}.json`
        const game: any = (
            await (
                await fetch(url, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                })
            ).json()
        ).game
        const data: IMoreOrLessData[] = game.data
            .filter((item) => item.length <= 4)
            .map((item) => {
                return { subject: item[0], answer: item[1], image: item[2] }
            })
        this.game.strings = game.strings
        return data
    }

    private async setupGame(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const data = await this.fetchGameData()
        const embed = EmbedUtils.createSimpleEmbed(this.game.title, this.game.description).setThumbnail(
            `https://api.moreorless.io/img/${this.game.image}_512.jpg`
        )
        if (interaction.isButton()) {
            //assumes origin is play again button
            interaction.deferUpdate()
            const previousGame = this.userGames.get(interaction.user.id)
            previousGame.data = data
            previousGame.correctAnswers = 0
            previousGame.id = randomUUID()
            previousGame.message.edit({ embeds: [embed], components: [startBtnRow] })
        } else {
            const activeGame = this.userGames.get(interaction.user.id)
            if (activeGame && activeGame.active) {
                const msg = await this.messageHelper.replyToInteraction(interaction, embed, { ephemeral: true })
                activeGame.message = msg
                this.updateGame(activeGame)
            } else {
                const msg = await this.messageHelper.replyToInteraction(interaction, embed, { ephemeral: true }, [startBtnRow])
                const userGame: IMoreOrLessUserGame = {
                    id: randomUUID(),
                    data: data,
                    correctAnswers: 0,
                    message: msg,
                    active: false,
                    totalQuestions: data.length,
                    startTime: new Date(),
                }
                this.userGames.set(interaction.user.id, userGame)
            }
        }
    }

    private startGame(interaction: ButtonInteraction<CacheType>) {
        interaction.deferUpdate()
        const game = this.userGames.get(interaction.user.id)
        const shuffledData = RandomUtils.shuffleList(game.data)
        game.active = true
        game.data = shuffledData
        game.correctAnswers = 0
        game.current = game.data.pop()
        game.next = game.data.pop()
        this.updateGame(game)
    }

    private guess(interaction: ButtonInteraction<CacheType>) {
        const game = this.userGames.get(interaction.user.id)
        if (!game.active) return interaction.deferUpdate()
        const gameId = interaction.customId.split(';')[2]
        if (gameId !== game.id)
            return this.messageHelper.replyToInteraction(
                interaction,
                'Du kan kun spille på det nyeste gamet ditt. Start et nytt game dersom du har fjernet dette.',
                { ephemeral: true }
            )
        interaction.deferUpdate()
        const more = interaction.customId.split(';')[1] === 'more'
        let correct = false
        if ((more && game.next.answer >= game.current.answer) || (!more && game.next.answer <= game.current.answer)) {
            game.correctAnswers++
            correct = true
        }
        if (correct && game.data.length > 0) {
            game.current = game.next
            game.next = game.data.pop()
            this.updateGame(game)
        } else {
            this.endGame(game, interaction.user.id, correct)
        }
    }

    private async updateGame(game: IMoreOrLessUserGame) {
        const description =
            `${game.current.subject} ${this.game.strings?.verb} **${TextUtils.formatLargeNumber(game.current.answer)}${
                this.game.strings?.valueSuffix ?? ''
            }** ${this.game.strings?.valueTitle}` +
            `\n\nVS\n\n` +
            `${game.next.subject}`
        const embed = EmbedUtils.createSimpleEmbed(this.game.title, description).setFooter({
            text: `${game.correctAnswers} riktige.`,
        })

        const isImageReal = await FetchUtils.checkImageUrl(game.current.image)
        if (isImageReal) embed.setThumbnail(game.current.image)
        game.message.edit({
            embeds: [embed],
            components: [guessBtnRow(game.id, this.game.strings?.buttonMore, this.game.strings?.buttonLess)],
        })
    }

    private async endGame(game: IMoreOrLessUserGame, userId: string, wasCorrent = true) {
        game.active = false
        const user = await this.database.getUser(userId)
        let rewardMsg = ''
        if (!user.dailyGameStats?.moreOrLess?.attempted) {
            user.dailyGameStats = {
                ...user.dailyGameStats,
                moreOrLess: {
                    attempted: true,
                    firstAttempt: game.correctAnswers,
                    bestAttempt: 0,
                    numAttempts: 0,
                    completed: false,
                },
            }
            if (game.correctAnswers === 0) this.database.updateUser(user)
        }
        const completedNow = game.data.length === 0 && wasCorrent
        const completedPreviously = user.dailyGameStats.moreOrLess.completed
        const numTries = user.dailyGameStats.moreOrLess.numAttempts + 1
        user.dailyGameStats.moreOrLess.numAttempts = numTries
        if (game.correctAnswers > user.dailyGameStats.moreOrLess.bestAttempt) {
            const correctAnswers = game.correctAnswers - user.dailyGameStats.moreOrLess.bestAttempt
            let reward = 0
            if (correctAnswers > 0) {
                for (let i = user.dailyGameStats.moreOrLess.bestAttempt + 1; i <= game.correctAnswers; i++) {
                    if (i <= 10) reward += 500
                    else if (i <= 20) reward += 400
                    else if (i <= 30) reward += 300
                    else if (i <= 40) reward += 200
                    else if (i <= 50) reward += 100
                    else reward += 50
                }
            }

            user.dailyGameStats.moreOrLess.bestAttempt = game.correctAnswers
            if (game.data.length === 0) user.dailyGameStats.moreOrLess.completed = true
            const awarded = this.client.bank.giveMoney(user, reward)
            rewardMsg = ` og får ${awarded} chips`
        } else this.database.updateUser(user)
        const msg = completedNow ? 'Du har fullført dagens more or less!' : 'Du tok dessverre feil'
        const description =
            `${game.next.subject} ${this.game.strings.verb} **${TextUtils.formatLargeNumber(game.next.answer)}${this.game.strings?.valueSuffix ?? ''}** ${
                this.game.strings.valueTitle
            }` +
            `\n\n${msg}\n\n` +
            `Du fikk ${game.correctAnswers} riktige${rewardMsg}!`
        const embed = EmbedUtils.createSimpleEmbed(this.game.title, description)
        if (await FetchUtils.checkImageUrl(game.next.image)) embed.setThumbnail(game.next.image)

        game.message.edit({ embeds: [embed], components: [playAgainBtnRow] })
        if (completedNow && !completedPreviously) {
            const buttons = new ActionRowBuilder<ButtonBuilder>()

            let dondQuality = DonDQuality.Basic
            if (game.totalQuestions > 100) dondQuality = DonDQuality.Elite
            else if (game.totalQuestions > 50) dondQuality = DonDQuality.Premium

            const dond = DealOrNoDeal.getDealOrNoDealButton(user.id, dondQuality)
            buttons.addComponents(dond)
            this.messageHelper.sendMessage(ThreadIds.MORE_OR_LESS, {
                text: `Gz med fullført more or less ${MentionUtils.mentionUser(user.id)}`,
                components: [buttons],
            })
        }
    }

    private async revealResults(interaction: ChatInputCommandInteraction<CacheType>) {
        const embed = EmbedUtils.createSimpleEmbed('Dagens more or less resultater', this.game.title).setThumbnail(
            `https://api.moreorless.io/img/${this.game.image}_512.jpg`
        )
        const users = (await this.database.getAllUsers()).filter((user) => user.dailyGameStats?.moreOrLess?.attempted)
        const sortedUsers = DateUtils.isTimeOfDayAfter(18)
            ? users.sort((a, b) => b.dailyGameStats.moreOrLess.firstAttempt - a.dailyGameStats.moreOrLess.firstAttempt)
            : users
        const fields: APIEmbedField[] = []
        for (const user of sortedUsers) {
            const name = UserUtils.findMemberByUserID(user.id, interaction).user.username
            const shouldShowBestResult = user.dailyGameStats.moreOrLess.numAttempts > 1 || DateUtils.isTimeOfDayAfter(18)
            const result =
                `Første forsøk: ${DateUtils.isTimeOfDayAfter(18) ? user.dailyGameStats.moreOrLess.firstAttempt + ' riktige' : 'Skjult'} ` +
                `\nBeste forsøk: ${shouldShowBestResult ? user.dailyGameStats.moreOrLess.bestAttempt + ' riktige' : 'Skjult'}` +
                `\nAntall forsøk: ${DateUtils.isTimeOfDayAfter(18) ? user.dailyGameStats.moreOrLess.numAttempts : 'Skjult'}`
            fields.push({ name: name, value: result })
        }

        embed.addFields(fields)
        this.messageHelper.replyToInteraction(interaction, embed)
    }

    override async onSave(): Promise<boolean> {
        this.userGames.forEach((game, user) => {
            if (game.active) {
                this.client.cache.restartImpediments.push(`${UserUtils.findUserById(user, this.client).username} har et aktivt more or less game`)
            }
        })
        return true
    }

    private wipeGames() {
        this.userGames.clear()
        return true
    }

    // eslint-disable-next-line require-await
    async onTimedEvent(): Promise<IOnTimedEvent> {
        return { daily: [() => this.wipeGames()], weekly: [], hourly: [] }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'moreorless',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            const cmd = rawInteraction.options.getSubcommand()
                            if (cmd === 'spill') this.setupGame(rawInteraction)
                            else if (cmd === 'resultater') this.revealResults(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'MORE_OR_LESS_START',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.startGame(rawInteraction)
                        },
                    },
                    {
                        commandName: 'MORE_OR_LESS_GUESS',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.guess(rawInteraction)
                        },
                    },
                    {
                        commandName: 'MORE_OR_LESS_TRY_AGAIN',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.setupGame(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

const startBtnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `MORE_OR_LESS_START`,
        style: ButtonStyle.Success,
        label: `Start`,
        disabled: false,
        type: 2,
    })
)

const guessBtnRow = (gameId: string, btnMore: string = 'More', btnLess: string = 'Less') =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `MORE_OR_LESS_GUESS;less;${gameId}`,
            style: ButtonStyle.Primary,
            label: btnLess,
            disabled: false,
            emoji: { name: 'arrow_d', id: '1331548470854684702' },
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `MORE_OR_LESS_GUESS;more;${gameId}`,
            style: ButtonStyle.Danger,
            label: btnMore,
            disabled: false,
            emoji: { name: 'arrow_u', id: '1331548537716080661' },
            type: 2,
        })
    )

const playAgainBtnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `MORE_OR_LESS_TRY_AGAIN`,
        style: ButtonStyle.Success,
        label: `Play again`,
        disabled: false,
        type: 2,
    })
)
