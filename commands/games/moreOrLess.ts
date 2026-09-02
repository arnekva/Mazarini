import { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionResponse, Message, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'

import { randomUUID } from 'crypto'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { IMoreOrLess, IMoreOrLessVote, MazariniStorage } from '../../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../../interfaces/interactionInterface'
import { CustomMOLHandler } from '../../res/games/moreOrLess/CustomMOLHandler'
import { DateUtils } from '../../utils/dateUtils'
import { FetchUtils } from '../../utils/fetchUtils'
import { MentionUtils, ThreadIds } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'
import { UserUtils } from '../../utils/userUtils'

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
    /** Number of daily attempts already completed before this game, used to decide when to show the entry counter. */
    numAttempts: number
}

export class MoreOrLess extends AbstractCommands {
    /** Reference to the single MoreOrLess instance created by Commands, so scheduled jobs can reach it without a full registry. */
    static instance: MoreOrLess
    private game: IMoreOrLess
    private userGames: Map<string, IMoreOrLessUserGame>
    /** Historical blacklist, kept as a permanent seed alongside whatever the community votes into `storage.moreOrLess.blacklist` in firebase. */
    // :maggiscared:
    static readonly defaultBlacklistSeed: string[] = [
        'lol-champion-win-rates',
        'lol-champion-prices',
        'fortnite-youtubers',
        'league-of-legends-youtubers',
        'german-league-of-legends-youtubers',
        'lol-champion-skins',
        'german-youtubers',
        'league-of-legends-youtubers',
        'population-by-country',
        'mrbeast-youtube-video-views',
        'carryminati-youtube-video-views',
        'stoke-twins-youtube-video-views',
    ]

    constructor(client: MazariniClient) {
        super(client)
        this.userGames = new Map<string, IMoreOrLessUserGame>()
        MoreOrLess.instance = this
    }

    onReady(): void {
        this.database.getStorage().then((storage) => (this.game = storage.moreOrLess.current))
    }

    public static async fetchAllGames(): Promise<IMoreOrLess[]> {
        const url = 'https://api.moreorless.io/en/games.json'
        const listResponse = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        })

        const customGames = CustomMOLHandler.getAllCustomGames()
        if (!listResponse.ok) return customGames
        const games: IMoreOrLess[] = await listResponse.json()
        games.push(...customGames)
        return games
    }

    /** Validates a candidate game, fetching its dataset and strings. Returns undefined if the game turns out to be unplayable. */
    private static async validateGame(game: IMoreOrLess): Promise<IMoreOrLess | undefined> {
        if (game.tags?.includes(CustomMOLHandler.customGameTag)) return game
        const dataUrl = `https://api.moreorless.io/en/games/${game.slug}.json`
        const dataResponse = await fetch(dataUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        })
        if (!dataResponse.ok) return undefined
        const check: any = (await dataResponse.json()).game
        if (check.data[0].length > 4) return undefined
        return { ...game, strings: check.strings }
    }

    /** Picks up to `count` distinct, validated, non-blacklisted categories - preferring ones not in `previous` until that pool runs dry. */
    public static async pickValidGames(count: number, previous: string[], blacklist: string[]): Promise<IMoreOrLess[]> {
        const games = await MoreOrLess.fetchAllGames()
        const filteredGames = games.filter((game) => !blacklist.includes(game.slug))
        const excluded = [...previous]
        const picked: IMoreOrLess[] = []
        while (picked.length < count) {
            let candidates = filteredGames.filter((game) => !excluded.includes(game.slug))
            if (candidates.length === 0) {
                // Ran out of unplayed categories - reshuffle within the picks made so far this round
                candidates = filteredGames.filter((game) => !picked.some((p) => p.slug === game.slug))
            }
            if (candidates.length === 0) break // fully exhausted, nothing left to pick even after reshuffling

            const candidate = RandomUtils.getRandomItemFromList(candidates)
            excluded.push(candidate.slug)
            const validated = await MoreOrLess.validateGame(candidate)
            if (validated) picked.push(validated)
        }
        return picked
    }

    public static async getNewMoreOrLessGame(previous: string[], blacklist: string[] = []): Promise<IMoreOrLess> {
        const [game] = await MoreOrLess.pickValidGames(1, previous, blacklist)
        return game
    }

    /** Finds a game by slug (across API + custom games) and validates it, for admin overrides. Returns undefined if not found or unplayable. */
    public static async findAndValidateGame(slug: string): Promise<IMoreOrLess | undefined> {
        const games = await MoreOrLess.fetchAllGames()
        const match = games.find((g) => g.slug === slug)
        if (!match) return undefined
        return MoreOrLess.validateGame(match)
    }

    public static getEffectiveBlacklist(storage: MazariniStorage): string[] {
        return [...(storage.moreOrLess.blacklist ?? []), ...MoreOrLess.defaultBlacklistSeed]
    }

    private getBlacklist(storage: MazariniStorage): string[] {
        return MoreOrLess.getEffectiveBlacklist(storage)
    }

    private async fetchGameData() {
        const storage = await this.client.database.getStorage()
        const blacklist = this.getBlacklist(storage)
        this.game = storage.moreOrLess.current ?? (await MoreOrLess.getNewMoreOrLessGame(storage.moreOrLess.previous ?? [], blacklist))
        let game: any = {}
        if (this.game.tags?.includes(CustomMOLHandler.customGameTag)) {
            game = CustomMOLHandler.getJSONByName(this.game.slug as any).game
        } else {
            const url = `https://api.moreorless.io/en/games/${this.game.slug}.json`
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            })
            if (!response.ok) {
                const customGames = CustomMOLHandler.getAllCustomGames().filter((g) => !blacklist.includes(g.slug))
                const unplayed = customGames.filter((g) => !storage.moreOrLess.previous?.includes(g.slug))
                this.game = RandomUtils.getRandomItemFromList(unplayed.length > 0 ? unplayed : customGames)
                game = CustomMOLHandler.getJSONByName(this.game.slug).game
            } else {
                game = (await response.json()).game
            }
        }
        const data: IMoreOrLessData[] = game.data
            .filter((item) => item.length <= 4)
            .map((item) => {
                return { subject: item[0], answer: item[1], image: item[2] }
            })
        this.game.strings = game.strings
        this.game.totalEntries = data.length
        return data
    }

    /** Builds a text block with a small thumbnail alongside it (instead of a full-size image), falling back to plain text if no valid image is given. */
    private buildTextWithThumbnail(content: string, imageUrl?: string): SectionBuilder | TextDisplayBuilder {
        const text = new TextDisplayBuilder().setContent(content)
        if (!imageUrl) return text
        return new SectionBuilder().addTextDisplayComponents(text).setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl))
    }

    private async buildIntroContainer(): Promise<SimpleContainer> {
        const container = new SimpleContainer()
        const imageUrl = this.game.image ? `https://api.moreorless.io/img/${this.game.image}_512.jpg` : undefined
        const isImageReal = imageUrl && (await FetchUtils.checkImageUrl(imageUrl))
        container.addComponent(this.buildTextWithThumbnail(`# ${this.game.title}\n${this.game.description}`, isImageReal ? imageUrl : undefined), 'header')
        container.addSeparator()
        container.addComponent(startBtnRow, 'start-btn')
        return container
    }

    private async setupGame(interaction: ChatInteraction | BtnInteraction) {
        const data = await this.fetchGameData()
        const user = await this.database.getUser(interaction.user.id)
        const numAttempts = user.dailyGameStats?.moreOrLess?.numAttempts ?? 0
        if (interaction.isButton()) {
            //assumes origin is play again button
            interaction.deferUpdate()
            const previousGame = this.userGames.get(interaction.user.id)
            previousGame.data = data
            previousGame.correctAnswers = 0
            previousGame.id = randomUUID()
            previousGame.numAttempts = numAttempts
            previousGame.message.edit({
                components: [(await this.buildIntroContainer()).container],
            })
        } else {
            const activeGame = this.userGames.get(interaction.user.id)
            if (activeGame && activeGame.active) {
                const msg = await this.messageHelper.replyToInteraction(interaction, '', { ephemeral: true, dontSendDMOnError: true }, [
                    (await this.buildIntroContainer()).container,
                ])
                activeGame.message = msg
                this.updateGame(activeGame)
            } else {
                const msg = await this.messageHelper.replyToInteraction(interaction, '', { ephemeral: true, dontSendDMOnError: true }, [
                    (await this.buildIntroContainer()).container,
                ])
                const userGame: IMoreOrLessUserGame = {
                    id: randomUUID(),
                    data: data,
                    correctAnswers: 0,
                    message: msg,
                    active: false,
                    totalQuestions: data.length,
                    startTime: new Date(),
                    numAttempts: numAttempts,
                }
                this.userGames.set(interaction.user.id, userGame)
            }
        }
    }

    private startGame(interaction: BtnInteraction) {
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

    private guess(interaction: BtnInteraction) {
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
        const container = new SimpleContainer()
        container.addComponent(new TextDisplayBuilder().setContent(`# ${this.game.title}`), 'header')

        const currentText = `**${game.current.subject}** ${this.game.strings?.verb} **${TextUtils.formatLargeNumber(game.current.answer)}${
            this.game.strings?.valueSuffix ?? ''
        }** ${this.game.strings?.valueTitle}`
        const isCurrentImageReal = await FetchUtils.checkImageUrl(game.current.image)
        container.addComponent(this.buildTextWithThumbnail(currentText, isCurrentImageReal ? game.current.image : undefined), 'current')

        container.addComponent(new TextDisplayBuilder().setContent('VS'), 'vs')

        const isNextImageReal = await FetchUtils.checkImageUrl(game.next.image)
        container.addComponent(this.buildTextWithThumbnail(`**${game.next.subject}**`, isNextImageReal ? game.next.image : undefined), 'next')

        container.addSeparator()
        const footerText = game.numAttempts >= 2 ? `${game.correctAnswers + 1}/${game.totalQuestions}` : `${game.correctAnswers} riktige.`
        container.addComponent(new TextDisplayBuilder().setContent(footerText), 'footer')
        container.addComponent(guessBtnRow(game.id, this.game.strings?.buttonMore, this.game.strings?.buttonLess), 'guess-btns')

        game.message.edit({
            components: [container.container],
        })
    }

    private async endGame(game: IMoreOrLessUserGame, userId: string, wasCorrect = true) {
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
                    secondAttempt: null,
                },
            }
            if (game.correctAnswers === 0) this.database.updateUser(user)
        }

        const completedNow = game.data.length === 0 && wasCorrect
        const completedPreviously = user.dailyGameStats.moreOrLess.completed
        const numTries = (user.dailyGameStats.moreOrLess.numAttempts ?? 0) + 1
        user.dailyGameStats.moreOrLess.numAttempts = numTries
        if (user.dailyGameStats.moreOrLess.firstAttempt !== undefined && user.dailyGameStats.moreOrLess.secondAttempt == null && numTries > 1) {
            user.dailyGameStats.moreOrLess.secondAttempt = game.correctAnswers
        }

        if (game.correctAnswers > user.dailyGameStats.moreOrLess.bestAttempt) {
            const correctAnswers = game.correctAnswers - user.dailyGameStats.moreOrLess.bestAttempt
            let reward = 0
            if (correctAnswers > 0) {
                for (let i = user.dailyGameStats.moreOrLess.bestAttempt + 1; i <= game.correctAnswers; i++) {
                    if (i <= 10) reward += GameValues.moreOrLess.rewards.tier1
                    else if (i <= 20) reward += GameValues.moreOrLess.rewards.tier2
                    else if (i <= 30) reward += GameValues.moreOrLess.rewards.tier3
                    else if (i <= 40) reward += GameValues.moreOrLess.rewards.tier4
                    else if (i <= 50) reward += GameValues.moreOrLess.rewards.tier5
                    else reward += GameValues.moreOrLess.rewards.tier6
                }
            }
            if (completedNow && !completedPreviously) reward += GameValues.moreOrLess.rewards.completed
            user.dailyGameStats.moreOrLess.bestAttempt = game.correctAnswers
            if (game.data.length === 0) user.dailyGameStats.moreOrLess.completed = true
            const awarded = this.client.bank.giveMoney(user, reward)
            rewardMsg = ` og får ${awarded} chips`
        } else this.database.updateUser(user)
        const msg = completedNow ? 'Du har fullført dagens more or less!' : 'Du tok dessverre feil'
        const showEntryCounter = numTries >= 2 && !!this.game.totalEntries
        const description =
            `**${game.next.subject}** ${this.game.strings.verb} **${TextUtils.formatLargeNumber(game.next.answer)}${this.game.strings?.valueSuffix ?? ''}** ${
                this.game.strings.valueTitle
            }` +
            `\n\n${msg}\n\n` +
            `Du fikk ${game.correctAnswers}${showEntryCounter ? `/${this.game.totalEntries}` : ''} riktige${rewardMsg}!`

        const container = new SimpleContainer()
        container.addComponent(new TextDisplayBuilder().setContent(`# ${this.game.title}`), 'header')
        const isNextImageReal = await FetchUtils.checkImageUrl(game.next.image)
        container.addComponent(this.buildTextWithThumbnail(description, isNextImageReal ? game.next.image : undefined), 'description')
        container.addSeparator()
        container.addComponent(playAgainBtnRow, 'play-again-btn')

        game.message.edit({ components: [container.container] })
        if (completedNow && !completedPreviously) {
            // const buttons = new ActionRowBuilder<ButtonBuilder>()

            // let boxQuality = LootboxQuality.Basic
            // if (game.totalQuestions > 100) boxQuality = LootboxQuality.Elite
            // else if (game.totalQuestions > 50) boxQuality = LootboxQuality.Premium

            // const boxButton = LootboxCommands.getLootRewardButton(user.id, boxQuality).components
            // buttons.addComponents(boxButton)
            this.messageHelper.sendMessage(ThreadIds.MORE_OR_LESS, {
                text: `Gz med fullført more or less, ${MentionUtils.mentionUser(user.id)}!`,
                // components: [buttons],
            })
        }
    }

    private async buildResultsContainer(resolveUsername: (userId: string) => string, includeEntryCounter = true): Promise<SimpleContainer> {
        const container = new SimpleContainer()
        const imageUrl = this.game.image ? `https://api.moreorless.io/img/${this.game.image}_512.jpg` : undefined
        const isImageReal = imageUrl && (await FetchUtils.checkImageUrl(imageUrl))
        container.addComponent(
            this.buildTextWithThumbnail(`# Dagens more or less resultater\n${this.game.title}`, isImageReal ? imageUrl : undefined),
            'header'
        )
        container.addSeparator()

        const users = (await this.database.getAllUsers()).filter((user) => user.dailyGameStats?.moreOrLess?.attempted)

        const shouldReveal = DateUtils.isTimeOfDayAfter(18) || DateUtils.isTimeOfDayBefore(5)

        const sortedUsers = shouldReveal
            ? users.sort((a, b) => {
                  const aBest = Math.max(a.dailyGameStats.moreOrLess.firstAttempt ?? 0, a.dailyGameStats.moreOrLess.secondAttempt ?? 0)
                  const bBest = Math.max(b.dailyGameStats.moreOrLess.firstAttempt ?? 0, b.dailyGameStats.moreOrLess.secondAttempt ?? 0)
                  return bBest - aBest
              })
            : users
        for (const user of sortedUsers) {
            const name = resolveUsername(user.id)
            const numAttempts = user.dailyGameStats.moreOrLess.numAttempts ?? 0
            const showEntryCounter = includeEntryCounter && numAttempts >= 2 && !!this.game.totalEntries
            const bestAttemptValue = `${user.dailyGameStats.moreOrLess.bestAttempt}${showEntryCounter ? `/${this.game.totalEntries}` : ''} riktige`
            const firstAttemptValue = user.dailyGameStats.moreOrLess.firstAttempt ?? 0
            const secondAttemptValue = user.dailyGameStats.moreOrLess.secondAttempt ?? 0
            const shouldBoldFirst = firstAttemptValue > secondAttemptValue && firstAttemptValue >= 0
            const shouldBoldSecond = !shouldBoldFirst && secondAttemptValue >= 0
            const firstAttempt = `${shouldBoldFirst ? '**' : ''}${
                user.dailyGameStats.moreOrLess.firstAttempt !== undefined ? user.dailyGameStats.moreOrLess.firstAttempt + ' riktige' : 'Ikke spilt'
            }${shouldBoldFirst ? '**' : ''}`
            const secondAttempt = `${shouldBoldSecond ? '**' : ''}${
                user.dailyGameStats.moreOrLess.secondAttempt !== undefined ? user.dailyGameStats.moreOrLess.secondAttempt + ' riktige' : 'Ikke spilt'
            }${shouldBoldSecond ? '**' : ''}`
            const result =
                `**${name}**` +
                `\nFørste forsøk: ${shouldReveal ? firstAttempt : 'Skjult'} ` +
                `\nAndre forsøk: ${shouldReveal ? secondAttempt : 'Skjult'}` +
                `\nBeste forsøk: ${bestAttemptValue}` +
                `\nAntall forsøk: ${shouldReveal ? numAttempts : 'Skjult'}`
            container.addComponent(new TextDisplayBuilder().setContent(result), `user-${user.id}`)
        }
        return container
    }

    private async revealResults(interaction: ChatInteraction) {
        const container = await this.buildResultsContainer((userId) => UserUtils.findMemberByUserID(userId, interaction).user.username, false)
        this.messageHelper.replyToInteraction(interaction, '', {}, [container.container])
    }

    private buildVoteButtonRows(vote: IMoreOrLessVote): ActionRowBuilder<ButtonBuilder>[] {
        const counts: { [key: string]: number } = {}
        Object.values(vote.votes ?? {}).forEach((choice) => {
            counts[choice] = (counts[choice] ?? 0) + 1
        })
        const totalVoters = Object.keys(vote.votes ?? {}).length

        const blacklistCounts: { [key: string]: number } = {}
        Object.values(vote.blacklistVotes ?? {}).forEach((slugs) => {
            slugs.forEach((slug) => {
                blacklistCounts[slug] = (blacklistCounts[slug] ?? 0) + 1
            })
        })

        return vote.candidates.map((candidate) =>
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder({
                    custom_id: `MORE_OR_LESS_VOTE;${candidate.slug}`,
                    style: ButtonStyle.Primary,
                    label: `${candidate.title} (${counts[candidate.slug] ?? 0})`,
                    disabled: false,
                    type: 2,
                }),
                new ButtonBuilder({
                    custom_id: `MORE_OR_LESS_BLACKLIST;${candidate.slug}`,
                    style: ButtonStyle.Danger,
                    label: `Blacklist (${blacklistCounts[candidate.slug] ?? 0}/${totalVoters})`,
                    disabled: false,
                    type: 2,
                })
            )
        )
    }

    private addVoteComponents(container: SimpleContainer, vote: IMoreOrLessVote) {
        container.addSeparator()
        container.addComponent(new TextDisplayBuilder().setContent('**Morgendagens kategori:**'), 'vote-header')
        this.buildVoteButtonRows(vote).forEach((row, i) => container.addComponent(row, `vote-buttons-${i}`))
    }

    /** Automatically posts the daily More or Less results to the dedicated thread at 18:00, along with a vote for tomorrow's category. */
    public async sendScheduledResults(): Promise<void> {
        if (!this.game) return
        const container = await this.buildResultsContainer((userId) => UserUtils.findUserById(userId, this.client)?.username ?? 'Ukjent')

        const storage = await this.client.database.getStorage()
        const blacklist = this.getBlacklist(storage)
        const previous = storage.moreOrLess.previous ?? []
        const candidates = await MoreOrLess.pickValidGames(3, previous, blacklist)

        let vote: IMoreOrLessVote | undefined
        if (candidates.length > 0) {
            vote = { candidates, votes: {} }
            this.addVoteComponents(container, vote)
        }
        await this.client.database.updateStorage({ moreOrLess: { ...storage.moreOrLess, vote: vote ?? null } })

        this.messageHelper.sendMessage(ThreadIds.MORE_OR_LESS, { components: [container.container] }, { isComponentOnly: true })
    }

    private async castVote(interaction: BtnInteraction) {
        const storage = await this.client.database.getStorage()
        const vote = storage.moreOrLess.vote
        if (!vote) {
            return this.messageHelper.replyToInteraction(interaction, 'Avstemningen for morgendagens kategori er ikke lenger åpen.', { ephemeral: true })
        }
        const choice = interaction.customId.split(';')[1]
        vote.votes = vote.votes ?? {} // firebase drops empty objects, so a freshly created vote may come back without `votes`
        vote.votes[interaction.user.id] = choice
        await this.client.database.updateStorage({ moreOrLess: { ...storage.moreOrLess, vote } })

        const choiceName = vote.candidates.find((c) => c.slug === choice)?.title ?? choice
        this.messageHelper.sendLogMessage(`${interaction.user.username} stemte for ${choiceName}`)

        interaction.deferUpdate()
        const container = await this.buildResultsContainer((userId) => UserUtils.findUserById(userId, this.client)?.username ?? 'Ukjent')
        this.addVoteComponents(container, vote)
        await interaction.message.edit({ components: [container.container] })
    }

    /** Toggles the calling user's blacklist vote for a single candidate. Unlike the category vote, a user can blacklist any number of candidates. */
    private async castBlacklistVote(interaction: BtnInteraction) {
        const storage = await this.client.database.getStorage()
        const vote = storage.moreOrLess.vote
        if (!vote) {
            return this.messageHelper.replyToInteraction(interaction, 'Avstemningen for morgendagens kategori er ikke lenger åpen.', { ephemeral: true })
        }
        const choice = interaction.customId.split(';')[1]
        vote.blacklistVotes = vote.blacklistVotes ?? {} // firebase drops empty objects, so a freshly created vote may come back without `blacklistVotes`
        const userBlacklistVotes = vote.blacklistVotes[interaction.user.id] ?? []
        const alreadyVoted = userBlacklistVotes.includes(choice)
        vote.blacklistVotes[interaction.user.id] = alreadyVoted ? userBlacklistVotes.filter((slug) => slug !== choice) : [...userBlacklistVotes, choice]
        await this.client.database.updateStorage({ moreOrLess: { ...storage.moreOrLess, vote } })

        const choiceName = vote.candidates.find((c) => c.slug === choice)?.title ?? choice
        this.messageHelper.sendLogMessage(`${interaction.user.username} stemte ${alreadyVoted ? 'ikke lenger' : ''} for å blackliste ${choiceName}`)

        interaction.deferUpdate()
        const container = await this.buildResultsContainer((userId) => UserUtils.findUserById(userId, this.client)?.username ?? 'Ukjent')
        this.addVoteComponents(container, vote)
        await interaction.message.edit({ components: [container.container] })
    }

    override onSave(): Promise<boolean> {
        this.userGames.forEach((game, user) => {
            if (game.active) {
                this.client.cache.restartImpediments.push(`${UserUtils.findUserById(user, this.client).username} har et aktivt more or less game`)
            }
        })
        return Promise.resolve(true)
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
                        command: (rawInteraction: ChatInteraction) => {
                            const cmd = rawInteraction.options.getSubcommand()
                            if (cmd === 'spill') this.setupGame(rawInteraction)
                            else if (cmd === 'resultater') this.revealResults(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'MORE_OR_LESS_START',
                        command: (rawInteraction: BtnInteraction) => {
                            this.startGame(rawInteraction)
                        },
                    },
                    {
                        commandName: 'MORE_OR_LESS_GUESS',
                        command: (rawInteraction: BtnInteraction) => {
                            this.guess(rawInteraction)
                        },
                    },
                    {
                        commandName: 'MORE_OR_LESS_TRY_AGAIN',
                        command: (rawInteraction: BtnInteraction) => {
                            this.setupGame(rawInteraction)
                        },
                    },
                    {
                        commandName: 'MORE_OR_LESS_VOTE',
                        command: (rawInteraction: BtnInteraction) => {
                            this.castVote(rawInteraction)
                        },
                    },
                    {
                        commandName: 'MORE_OR_LESS_BLACKLIST',
                        command: (rawInteraction: BtnInteraction) => {
                            this.castBlacklistVote(rawInteraction)
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
