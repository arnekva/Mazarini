import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { EmojiHelper } from '../../helpers/emojiHelper'
import { ChipsStats, DeathrollStats, EmojiStats, RulettStats } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'

export class StatsCommands extends AbstractCommands {
    private emojiStats: EmojiStats[]
    private lastFetched: Date

    constructor(client: MazariniClient) {
        super(client)
    }

    private async findUserStats(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const userStats = user.userStats?.chipsStats
        const rulettStats = user.userStats?.rulettStats
        const deathrollStats = user.userStats?.deathrollStats
        let reply = ''

        const getStats = (prettyName: (a: string) => string, props: ChipsStats | DeathrollStats | RulettStats) => {
            return Object.entries(props)
                .map((stat) => {
                    return `${prettyName(stat[0])}: ${Array.isArray(stat) ? stat.join(', ') : stat[1]}`
                })
                .sort()
                .join('\n')
        }
        if (deathrollStats) {
            reply += 'Stats:\n**Deathroll**\n'
            reply += getStats((a: keyof DeathrollStats) => this.findPrettyNameForDeathrollKey(a), deathrollStats)
            // Object.entries(deathrollStats)
            //     .map((stat) => {
            //         return `${this.findPrettyNameForDeathrollKey(stat[0] as keyof DeathrollStats)}: ${stat[1]}`
            //     })
            //     .sort()
            //     .join('\n')
        }
        if (userStats) {
            reply += '\n\n**Gambling**\n'
            reply += getStats((a: keyof ChipsStats) => this.findPrettyNameForChipsKey(a), userStats)
        }
        if (rulettStats) {
            reply += '\n\n**Rulett**\n'
            reply += getStats((a: keyof RulettStats) => this.findPrettyNameForRulettKey(a), rulettStats)
        }
        if (reply == '') {
            reply = 'Du har ingen statistikk å visa'
        }
        this.messageHelper.replyToInteraction(interaction, reply)
    }

    private findPrettyNameForDeathrollKey(prop: keyof DeathrollStats) {
        switch (prop) {
            case 'totalGames':
                return 'Deathroll spill'
            case 'totalLosses':
                return 'Deathroll tap'
            case 'weeklyGames':
                return 'Ukentlige spill'
            case 'weeklyLosses':
                return 'Ukentlige tap'
            case 'biggestLoss':
                return 'Største tap'
            default:
                return 'Ukjent'
        }
    }

    private findPrettyNameForChipsKey(prop: keyof ChipsStats) {
        switch (prop) {
            case 'gambleLosses':
                return 'Gambling tap'
            case 'gambleWins':
                return 'Gambling gevinst'
            case 'krigLosses':
                return 'Krig tap'
            case 'krigWins':
                return 'Krig seier'
            case 'roulettWins':
                return 'Rulett gevinst'
            case 'rouletteLosses':
                return 'Rulett tap'
            case 'slotLosses':
                return 'Roll tap'
            case 'slotWins':
                return 'Roll gevinst'
            default:
                return 'Ukjent'
        }
    }
    private findPrettyNameForRulettKey(prop: keyof RulettStats) {
        switch (prop) {
            case 'black':
                return 'Svart'
            case 'green':
                return 'Grønn'
            case 'red':
                return 'Rød'
            case 'even':
                return 'Partall'
            case 'odd':
                return 'Oddetall'
            default:
                return 'Ukjent'
        }
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
            .filter((x) => filterEmojiStats(x, type))
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
const filterEmojiStats: (x: EmojiStats, filter: string) => boolean = (x, filter) => {
    switch (filter) {
        case 'standard':
            return filterOnNotAnimated(x)
        case 'animert':
            return filterOnAnimated(x)
        case 'alle':
            return true
        default:
            return true
    }
}
