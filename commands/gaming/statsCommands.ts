import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, TextDisplayBuilder, User } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { MazariniClient } from '../../client/MazariniClient'

import { EmojiHelper } from '../../helpers/emojiHelper'
import { ChipsStats, DeathrollStats, DonDStats, EmojiStats, MazariniUser, RulettStats } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { UserUtils } from '../../utils/userUtils'
import { DonDQuality } from '../games/dealOrNoDeal'

export class StatsCommands extends AbstractCommands {
    private emojiStats: EmojiStats[]
    private lastFetched: Date

    constructor(client: MazariniClient) {
        super(client)
    }

    private async findUserStats(interaction: ChatInputCommandInteraction<CacheType>) {
        const userParam = interaction.options.get('bruker')?.user
        const category = interaction.options.get('kategori')?.value as string
        const user = await this.client.database.getUser(userParam && userParam instanceof User ? userParam.id : interaction.user.id)
        const userStats = user.userStats?.chipsStats
        const rulettStats = user.userStats?.rulettStats
        const deathrollStats = user.userStats?.deathrollStats
        const dondStats = user.userStats?.dondStats
        let embed = EmbedUtils.createSimpleEmbed(`Du har ingen statistikk`, ` `)

        if (deathrollStats && category === 'deathroll') {
            embed = this.getDeathrollEmbed(deathrollStats, user)
        }
        if (userStats && category === 'gambling') {
            embed = this.getGamblingEmbed(userStats, user)
        }
        if (rulettStats && category === 'rulett') {
            embed = this.getRouletteEmbed(rulettStats, user)
        }
        if (dondStats && category === 'dond') {
            const container = this.getDonDContainer(dondStats, user)
            const reply = await this.messageHelper.replyToInteraction(interaction, '', {}, [container.container])
        } else {
            this.messageHelper.replyToInteraction(interaction, embed)
        }
    }

    private getDonDContainer(dondStats: DonDStats, user: MazariniUser, interaction?: ChatInputCommandInteraction<CacheType>) {
        const container = new SimpleContainer()

        const transformToDondProps = (n: keyof DonDStats) => {
            if (n === 'tenKStats') return { label: '10K stats', quality: DonDQuality.Basic }
            if (n === 'twentyKStats') return { label: '20K stats', quality: DonDQuality.Premium }
            if (n === 'fiftyKStats') return { label: '50K stats', quality: DonDQuality.Elite }
        }
        const text1 = new TextDisplayBuilder().setContent('# Deal or no Deal')
        const sortedStats: DonDStats = {
            tenKStats: dondStats.tenKStats,
            twentyKStats: dondStats.twentyKStats,
            fiftyKStats: dondStats.fiftyKStats,
        }
        container.addComponent(text1, 'header')
        Object.entries(sortedStats).forEach(([key, value]) => {
            const props = transformToDondProps(key as keyof DonDStats)
            const header = props.label
            const stats = dondStats[key as keyof DonDStats]
            if (stats.totalGames > 0) {
                const userAverageWin = Math.round((stats.winningsFromAcceptDeal + stats.winningsFromKeepOrSwitch) / stats.totalGames)
                const expectedReturn = this.getExpectedReturn(props.quality)

                const text = new TextDisplayBuilder().setContent(
                    [
                        `## ${header}`,
                        `* Antall spill: ${stats.totalGames}`,
                        `* Total gevinst: ${stats.winningsFromAcceptDeal + stats.winningsFromKeepOrSwitch}`,
                        `* Gjennomsnittsgevinst er ${userAverageWin}`,
                        `* Balanse behold/bytt: ${stats.keepSwitchBalance}`,
                        `-# Antall 1ere: ${stats.winsOfOne}`,
                    ].join('\n')
                )
                container.addSeparator()
                container.addComponent(text, key)
            }
        })

        return container
    }

    private getExpectedReturn(q: DonDQuality) {
        switch (q) {
            case DonDQuality.Premium:
                return 5757
            case DonDQuality.Elite:
                return 13087
            case DonDQuality.Basic:
            default:
                return 2760
        }
    }

    private getDeathrollEmbed(stats: DeathrollStats, user: MazariniUser) {
        return EmbedUtils.createSimpleEmbed(`**:game_die: Deathroll :game_die:**`, `Statistikk for ${UserUtils.findUserById(user.id, this.client).username}`)
            .addFields([
                {
                    name: 'Weekly',
                    value: `${stats.weeklyGames} / ${stats.weeklyLosses} | **${(
                        (stats.weeklyLosses / (stats.weeklyGames ? stats.weeklyGames : 1)) *
                        100
                    ).toFixed(1)}%**`,
                    inline: true,
                },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Avg loss', value: `${((stats.weeklyLossSum ?? 0) / (stats.weeklyLosses ? stats.weeklyLosses : 1)).toFixed(1)}`, inline: true },
                {
                    name: 'All-time',
                    value: `${stats.totalGames} / ${stats.totalLosses} | **${((stats.totalLosses / (stats.totalGames ? stats.totalGames : 1)) * 100).toFixed(
                        1
                    )}%**`,
                    inline: true,
                },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Streak | ATH', value: `${stats.currentLossStreak ?? 0} | ${stats.longestLossStreak ?? 0}`, inline: true },
            ])
            .setFooter({ text: `Største tap:\n${stats.biggestLoss?.sort((a, b) => b - a).join(', ') ?? ''}\nSkips: ${stats.potSkips ?? 0}` })
    }

    private getGamblingEmbed(stats: ChipsStats, user: MazariniUser) {
        return EmbedUtils.createSimpleEmbed(
            `**:moneybag: Gambling :moneybag:**`,
            `Statistikk for ${UserUtils.findUserById(user.id, this.client).username}`
        ).addFields([
            ...this.getWinLossRatioFieldRow('Gambling ', stats.gambleWins, stats.gambleLosses),
            ...this.getWinLossRatioFieldRow('Rulett ', stats.roulettWins, stats.rouletteLosses),
            ...this.getWinLossRatioFieldRow('Roll ', stats.slotWins, stats.slotLosses),
            ...this.getWinLossRatioFieldRow('Krig ', stats.krigWins, stats.krigLosses),
            ...this.getWinLossRatioFieldRow('Blackjack ', stats.blackjackWins, stats.blackjackLosses),
        ])
    }

    private getRouletteEmbed(stats: RulettStats, user: MazariniUser) {
        return EmbedUtils.createSimpleEmbed(`**:o: Rulett :o:**`, `Statistikk for ${UserUtils.findUserById(user.id, this.client).username}`).addFields([
            { name: 'Svart', value: `${stats.black ?? 0}`, inline: true },
            { name: 'Rød', value: `${stats.red ?? 0}`, inline: true },
            { name: 'Grønn', value: `${stats.green ?? 0}`, inline: true },
            { name: 'Partall', value: `${stats.even ?? 0}`, inline: true },
            { name: 'Oddetall', value: `${stats.odd ?? 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
        ])
    }

    private getWinLossRatioFieldRow(stat: string, won = 0, lost = 0, focusOnLoss: boolean = false) {
        return [
            { name: `${stat}`, value: `${(won ?? 0) + (lost ?? 0)}`, inline: true },
            { name: `${focusOnLoss ? 'Tapt' : 'Vunnet'}`, value: `${focusOnLoss ? lost ?? 0 : won ?? 0}`, inline: true },
            {
                name: `${focusOnLoss ? 'Loss' : 'Win'}%`,
                value: `${(((focusOnLoss ? lost : won) / (won + lost > 0 ? won + lost : 1)) * 100).toFixed(1)}`,
                inline: true,
            },
        ]
    }

    private async getEmojiStats(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const cmd = interaction.options.getSubcommand()
        if (cmd === 'søk') this.findSingleEmojiStats(interaction)
        else {
            this.getTopEmojiStats(interaction)
        }
    }

    private async findSingleEmojiStats(interaction: ChatInputCommandInteraction<CacheType>) {
        const input = interaction.options.get('emojinavn')?.value as string
        this.getEmojiAverages()
        const emojiStat = this.emojiStats.find((emoji) => emoji.name === input)
        if (!emojiStat) return this.messageHelper.replyToInteraction(interaction, 'Fant ikke emojien du søkte etter', { hasBeenDefered: true })
        const sortedByMessages = this.emojiStats.slice().sort((a, b) => b.timesUsedInMessages - a.timesUsedInMessages)
        const sortedByReactions = this.emojiStats.slice().sort((a, b) => b.timesUsedInReactions - a.timesUsedInReactions)
        const sortedByAverage = this.emojiStats.slice().sort((a, b) => b.weeklyAverage - a.weeklyAverage)
        const nMostUsedInMessages = sortedByMessages.findIndex((emoji) => emoji.timesUsedInMessages == emojiStat.timesUsedInMessages)
        const nMostUsedInReactions = sortedByReactions.findIndex((emoji) => emoji.timesUsedInReactions == emojiStat.timesUsedInReactions)
        const nMostUsedOnAverage = sortedByAverage.findIndex((emoji) => emoji.weeklyAverage == emojiStat.weeklyAverage)
        const emoji = await EmojiHelper.getEmoji(input, interaction)
        const embed = EmbedUtils.createSimpleEmbed(`Statistikk for ${emoji.id}`, input)
        embed.addFields(
            { name: 'Meldinger', value: `${emojiStat.timesUsedInMessages} ( #${nMostUsedInMessages + 1} mest brukt )`, inline: false },
            { name: 'Reaksjoner', value: `${emojiStat.timesUsedInReactions} ( #${nMostUsedInReactions + 1} mest brukt )`, inline: false },
            { name: 'Gj.snitt bruk / uke', value: `${emojiStat.weeklyAverage} ( #${nMostUsedOnAverage + 1} mest brukt )`, inline: false },
            { name: 'Lagt til', value: emojiStat.added[0].toString(), inline: false }
        )

        this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true })
    }

    private async getTopEmojiStats(interaction: ChatInputCommandInteraction<CacheType>) {
        await this.fetchEmojiStats()
        this.getEmojiAverages()
        const data = interaction.options.get('data')?.value as string
        let limit = interaction.options.get('antall')?.value as number
        const sorting = interaction.options.get('sortering')?.value as string
        const type = interaction.options.get('type')?.value as string
        limit = limit && limit < 25 && limit > 0 ? limit : 9
        const sortedStats = this.emojiStats
            .slice()
            .filter((x) => filterEmojiStats(x, type, data === 'top'))
            .sort((a, b) => (data === 'top' ? sortEmojiStats(b, a, sorting) : sortEmojiStats(a, b, sorting)))
            .slice(0, limit)
        const embed = EmbedUtils.createSimpleEmbed(
            `Statistikk for de ${sortedStats.length < limit ? sortedStats.length : limit} ${data === 'top' ? 'mest' : 'minst'}` +
                ` brukte ${type === 'standard' ? 'ikke-animerte ' : type === 'animert' ? 'animerte ' : ''}emojiene`,
            `Sortert etter ${sorting ?? 'total'}`
        )
        const fields = await this.getFields(sortedStats, sorting, interaction)
        embed.addFields(fields)
        this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true })
    }

    private async getFields(stats: EmojiStats[], sorting: string, interaction: ChatInputCommandInteraction<CacheType>) {
        const fields = stats.map(async (stat, i) => {
            const emoji = await EmojiHelper.getEmoji(stat.name, interaction)
            const emojiName = emoji.id === '<Fant ikke emojien>' ? stat.name : emoji.id
            const inMessages = `${this.boldStat('meldinger', sorting)}${stat.timesUsedInMessages ?? 0} meldinger${this.boldStat('meldinger', sorting)}`
            const inReactions = `${this.boldStat('reaksjoner', sorting)}${stat.timesUsedInReactions ?? 0} reaksjoner${this.boldStat('reaksjoner', sorting)}`
            const total = `${this.boldStat('total', sorting)}${(stat.timesUsedInReactions ?? 0) + (stat.timesUsedInMessages ?? 0)} totalt${this.boldStat(
                'total',
                sorting
            )}`
            const average = `${this.boldStat('gjennomsnitt', sorting)}Gj.snitt/uke: ${stat.weeklyAverage}${this.boldStat('gjennomsnitt', sorting)}`
            const info = `${inMessages}\n${inReactions}\n${total}\n\n${average}\n‎ `
            return { name: `${i + 1}. ${emojiName}`, value: info, inline: true }
        })
        const retVal = await Promise.all(fields)
        return retVal
    }

    private boldStat(stat: string, sorting: string) {
        return stat === sorting || (stat === 'total' && sorting == undefined) ? '**' : ''
    }

    private executeStatsSubCommand(interaction: ChatInputCommandInteraction<CacheType>) {
        const cmdGroup = interaction.options.getSubcommandGroup()
        const cmd = interaction.options.getSubcommand()
        if (cmdGroup && cmdGroup === 'emoji') this.getEmojiStats(interaction)
        else if (!cmdGroup && cmd === 'bruker') this.findUserStats(interaction)
    }

    private async filterEmojis(interaction: AutocompleteInteraction<CacheType>) {
        await this.fetchEmojiStats()
        const optionList: any = interaction.options
        const input = optionList.getFocused().toLowerCase()
        const options = this.emojiStats
            .filter((stat: EmojiStats) => stat.name?.toLowerCase()?.includes(input))
            .slice(0, 24)
            .map((stat) => ({ name: `${stat.name}`, value: stat.name }))
        interaction.respond(options)
    }

    private async fetchEmojiStats() {
        const now = new Date()
        if (!this.emojiStats || now.getTime() - this.lastFetched.getTime() > 60000) {
            //hent stats på nytt hvis det er har gått mer enn 1min (= utdaterte stats)
            const emojis = await this.client.database.getEmojiStats()
            const emojiStatsArray: EmojiStats[] = Object.values(emojis).map(
                ({ added, name, timesUsedInMessages, timesUsedInReactions, removed, animated }) => ({
                    added,
                    name,
                    timesUsedInMessages,
                    timesUsedInReactions,
                    removed,
                    animated,
                })
            )
            this.emojiStats = emojiStatsArray.filter((stat) => stat.name !== undefined)
            this.lastFetched = now
            return
        } else {
            return
        }
    }

    private getEmojiAverages() {
        this.emojiStats.forEach((stat) => {
            stat.weeklyAverage = this.calculateAverage(stat)
        })
    }

    private calculateAverage(stat: EmojiStats) {
        const now = new Date()
        let totalDaysInUse = 0
        for (let i = 0; i < stat.added.length; i++) {
            const startTime = stat.removed && stat.removed.length > i ? new Date(stat.removed[i]) : now
            const endTime = new Date(stat.added[i])
            const days = (startTime.getTime() - endTime.getTime()) / (1000 * 60 * 60 * 24)
            totalDaysInUse += Math.round(days)
        }
        const average = (stat.timesUsedInMessages + stat.timesUsedInReactions) / Math.ceil((totalDaysInUse > 0 ? totalDaysInUse : 1) / 7)
        return Math.round((average + Number.EPSILON) * 10) / 10
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'stats',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.executeStatsSubCommand(rawInteraction)
                        },
                        autoCompleteCallback: (rawInteraction: AutocompleteInteraction<CacheType>) => {
                            this.filterEmojis(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [],
                selectMenuInteractionCommands: [],
            },
        }
    }
}

const sortByMessages: (a: EmojiStats, b: EmojiStats) => number = (a, b) => a.timesUsedInMessages - b.timesUsedInMessages
const sortByReactions: (a: EmojiStats, b: EmojiStats) => number = (a, b) => a.timesUsedInReactions - b.timesUsedInReactions
const sortByAverage: (a: EmojiStats, b: EmojiStats) => number = (a, b) => a.weeklyAverage - b.weeklyAverage
const sortByTotal: (a: EmojiStats, b: EmojiStats) => number = (a, b) =>
    (a.timesUsedInReactions ?? 0) + (a.timesUsedInMessages ?? 0) - ((b.timesUsedInReactions ?? 0) + (b.timesUsedInMessages ?? 0))

const sortEmojiStats: (a: EmojiStats, b: EmojiStats, sorting: string) => number = (a, b, sort) => {
    switch (sort) {
        case 'meldinger':
            return sortByMessages(a, b)
        case 'reaksjoner':
            return sortByReactions(a, b)
        case 'gjennomsnitt':
            return sortByAverage(a, b)
        case 'total':
            return sortByTotal(a, b)
        default:
            return sortByTotal(a, b)
    }
}

const filterOnNotAnimated: (x: EmojiStats) => boolean = (x) => !x.animated
const filterOnAnimated: (x: EmojiStats) => boolean = (x) => x.animated
const filterEmojiStats: (x: EmojiStats, filter: string, top: boolean) => boolean = (x, filter, top) => {
    switch (filter) {
        case 'standard':
            return filterOnNotAnimated(x) && (top || !isRemoved(x))
        case 'animert':
            return filterOnAnimated(x) && (top || !isRemoved(x))
        case 'alle':
            return true && (top || !isRemoved(x))
        default:
            return true && (top || !isRemoved(x))
    }
}

const isRemoved: (x: EmojiStats) => boolean = (x) => x.removed && new Date(x.removed[x.removed.length - 1]) > new Date(x.added[x.added.length - 1])
