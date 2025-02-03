import {
    ActionRowBuilder,
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

import { IMoreOrLess } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'
import { UserUtils } from '../../utils/userUtils'

export interface IMoreOrLessData {
    subject: string
    answer: number
    image: string
}

interface IMoreOrLessUserGame {
    data: IMoreOrLessData[]
    current?: IMoreOrLessData
    next?: IMoreOrLessData
    correctAnswers: number
    message: Message | InteractionResponse
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
            this.database.getStorage().then((storage) => (this.game = storage.moreOrLess))
        }, 5000)
    }

    public static async getNewMoreOrLessGame(): Promise<IMoreOrLess> {
        const url = 'https://api.moreorless.io/en/games.json'
        const games: IMoreOrLess[] = await (
            await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            })
        ).json()
        const game: IMoreOrLess = RandomUtils.getRandomItemFromList(games)
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
            return MoreOrLess.getNewMoreOrLessGame()
        } else {
            return { ...game, strings: check.strings }
        }
    }

    private async fetchGameData() {
        const storage = await this.client.database.getStorage()
        this.game = storage.moreOrLess ?? (await MoreOrLess.getNewMoreOrLessGame())
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
        const data = RandomUtils.shuffleList(await this.fetchGameData())
        const embed = EmbedUtils.createSimpleEmbed(this.game.title, this.game.description).setThumbnail(
            `https://api.moreorless.io/img/${this.game.image}_512.jpg`
        )
        if (interaction.isButton()) {
            //assumes origin is play again button
            interaction.deferUpdate()
            const previousGame = this.userGames.get(interaction.user.id)
            previousGame.data = data
            previousGame.correctAnswers = 0
            previousGame.message.edit({ embeds: [embed], components: [startBtnRow] })
        } else {
            const game = this.userGames.get(interaction.user.id)
            if (game) {
                const oldMsg = await game.message.fetch()
                if (oldMsg && oldMsg.deletable) await oldMsg.delete()
            }
            const msg = await this.messageHelper.replyToInteraction(interaction, embed, { ephemeral: true }, [startBtnRow])
            const userGame: IMoreOrLessUserGame = { data: data, correctAnswers: 0, message: msg }
            this.userGames.set(interaction.user.id, userGame)
        }
    }

    private startGame(interaction: ButtonInteraction<CacheType>) {
        interaction.deferUpdate()
        const game = this.userGames.get(interaction.user.id)
        game.current = game.data.pop()
        game.next = game.data.pop()
        this.updateGame(game)
    }

    private guess(interaction: ButtonInteraction<CacheType>) {
        interaction.deferUpdate()
        const game = this.userGames.get(interaction.user.id)
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
            this.endGame(game, interaction.user.id)
        }
    }

    private updateGame(game: IMoreOrLessUserGame) {
        const description =
            `${game.current.subject} ${this.game.strings?.verb} **${TextUtils.formatLargeNumber(game.current.answer)}${
                this.game.strings?.valueSuffix ?? ''
            }** ${this.game.strings?.valueTitle}` +
            `\n\nVS\n\n` +
            `${game.next.subject}`
        const embed = EmbedUtils.createSimpleEmbed(this.game.title, description).setThumbnail(game.current.image)
        game.message.edit({ embeds: [embed], components: [guessBtnRow(this.game.strings?.buttonMore, this.game.strings?.buttonLess)] })
    }

    private async endGame(game: IMoreOrLessUserGame, userId: string) {
        const user = await this.database.getUser(userId)
        let rewardMsg = ''
        if (!user.dailyGameStats?.moreOrLess?.attempted) {
            user.dailyGameStats = { ...user.dailyGameStats, moreOrLess: { attempted: true, firstAttempt: game.correctAnswers, bestAttempt: 0 } }
            if (game.correctAnswers === 0) this.database.updateUser(user)
        }
        if (game.correctAnswers > user.dailyGameStats.moreOrLess.bestAttempt) {
            const reward = (game.correctAnswers - user.dailyGameStats.moreOrLess.bestAttempt) * 500
            user.dailyGameStats = { ...user.dailyGameStats, moreOrLess: { ...user.dailyGameStats.moreOrLess, bestAttempt: game.correctAnswers } }
            const awarded = this.client.bank.giveMoney(user, reward)
            rewardMsg = ` og får ${awarded} chips`
        }
        const msg = game.data.length > 0 ? 'Du tok dessverre feil' : 'Du har fullført dagens more or less!'
        const description =
            `${game.next.subject} ${this.game.strings.verb} **${TextUtils.formatLargeNumber(game.next.answer)}${this.game.strings?.valueSuffix ?? ''}** ${
                this.game.strings.valueTitle
            }` +
            `\n\n${msg}\n\n` +
            `Du fikk ${game.correctAnswers} riktige${rewardMsg}!`
        const embed = EmbedUtils.createSimpleEmbed(this.game.title, description).setThumbnail(game.next.image)
        game.message.edit({ embeds: [embed], components: [playAgainBtnRow] })
    }

    private async revealResults(interaction: ChatInputCommandInteraction<CacheType>) {
        const embed = EmbedUtils.createSimpleEmbed('Dagens more or less resultater', this.game.title).setThumbnail(
            `https://api.moreorless.io/img/${this.game.image}_512.jpg`
        )
        const users = (await this.database.getAllUsers()).filter((user) => user.dailyGameStats?.moreOrLess?.attempted)
        for (const user of users) {
            const name = UserUtils.findMemberByUserID(user.id, interaction).user.username
            const result =
                `Første forsøk: ${DateUtils.isTimeOfDayAfter(18) ? user.dailyGameStats.moreOrLess.firstAttempt + ' riktige' : 'Skjult'} ` +
                `\nBeste forsøk: ${user.dailyGameStats.moreOrLess.bestAttempt} riktige`
            embed.addFields({ name: name, value: result })
        }
        this.messageHelper.replyToInteraction(interaction, embed)
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

const guessBtnRow = (btnMore: string = 'More', btnLess: string = 'Less') =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `MORE_OR_LESS_GUESS;less`,
            style: ButtonStyle.Primary,
            label: btnLess,
            disabled: false,
            emoji: { name: 'arrow_d', id: '1331548470854684702' },
            type: 2,
        }),
        new ButtonBuilder({
            custom_id: `MORE_OR_LESS_GUESS;more`,
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
