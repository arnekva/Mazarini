import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { EmojiHelper } from '../../helpers/emojiHelper'
import { ChipsStats, EmojiStats, RulettStats } from '../../interfaces/database/databaseInterface'
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
        let reply = ''
        if (userStats) {
            reply += '**Gambling**\n'
            reply += Object.entries(userStats)
                .map((stat) => {
                    return `${this.findPrettyNameForChipsKey(stat[0] as keyof ChipsStats)}: ${stat[1]}`
                })
                .sort()
                .join('\n')
        }
        if (rulettStats) {
            reply += '\n\n**Rulett**\n'
            reply += Object.entries(rulettStats)
                .map((stat) => {
                    return `${this.findPrettyNameForRulettKey(stat[0] as keyof RulettStats)}: ${stat[1]}`
                })
                .sort()
                .join('\n')
        }
        if (reply == '') {
            reply = 'Du har ingen statistikk å visa'
        }
        this.messageHelper.replyToInteraction(interaction, reply)
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
        const emojiStat = this.emojiStats.find((emoji) => emoji.name === input)
        if (!emojiStat) return this.messageHelper.replyToInteraction(interaction, 'Fant ikke emojien du søkte etter', { hasBeenDefered: true })
        const sortedByMessages = this.emojiStats.slice().sort((a, b) => b.timesUsedInMessages - a.timesUsedInMessages)
        const sortedByReactions = this.emojiStats.slice().sort((a, b) => b.timesUsedInReactions - a.timesUsedInReactions)
        const nMostUsedInMessages = sortedByMessages.findIndex((emoji) => emoji.timesUsedInMessages == emojiStat.timesUsedInMessages)
        const nMostUsedInReactions = sortedByReactions.findIndex((emoji) => emoji.timesUsedInReactions == emojiStat.timesUsedInReactions)
        const emoji = await EmojiHelper.getEmoji(input, interaction)
        const embed = EmbedUtils.createSimpleEmbed(`Statistikk for ${emoji.id}`, input)
        embed.addFields(
            { name: 'Meldinger', value: `${emojiStat.timesUsedInMessages} ( #${nMostUsedInMessages + 1} mest brukt )`, inline: false },
            { name: 'Reaksjoner', value: `${emojiStat.timesUsedInReactions} ( #${nMostUsedInReactions + 1} mest brukt )`, inline: false },
            { name: 'Lagt til', value: emojiStat.added.toString(), inline: false }
        )

        this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true })
    }

    private async getTopEmojiStats(interaction: ChatInputCommandInteraction<CacheType>) {
        await this.fetchEmojiStats()
        const data = interaction.options.get('data')?.value as string
        let limit = interaction.options.get('antall')?.value as number
        const ignore = interaction.options.get('ignorer')?.value as string
        const animated = interaction.options.get('animert')?.value as string
        limit = limit && limit < 25 && limit > 0 ? limit : 9
        const sortEmojis: (a: EmojiStats, b: EmojiStats) => number = ignore
            ? ignore === 'ignoreMessages'
                ? (a, b) => a.timesUsedInReactions - b.timesUsedInReactions
                : (a, b) => a.timesUsedInMessages - b.timesUsedInMessages
            : (a, b) => (a.timesUsedInReactions ?? 0) + (a.timesUsedInMessages ?? 0) - ((b.timesUsedInReactions ?? 0) + (b.timesUsedInMessages ?? 0))
        const filterEmojis: (x: EmojiStats) => boolean = animated 
            ? animated === 'ignoreAnimated' ? (x) => !x.animated : (x) => x.animated
            : () => true
        const sortedStats = this.emojiStats
            .slice()
            .filter(filterEmojis)
            .sort((a, b) => (data === 'top' ? sortEmojis(b, a) : sortEmojis(a, b)))
            .slice(0, limit)
        const embed = EmbedUtils.createSimpleEmbed(
            `Statistikk for de ${sortedStats.length < limit ? sortedStats.length : limit} ${data === 'top' ? 'mest' : 'minst'}`
            + ` brukte ${animated ? animated === 'ignoreAnimated' ? 'ikke-animerte ' : 'animerte ' : ''}emojiene`,
            ignore ? `Teller ikke med ${ignore === 'ignoreMessages' ? 'meldinger' : 'reaksjoner'}` : ' '
        )
        const fields = await this.getFields(sortedStats, ignore, interaction)
        embed.addFields(fields)
        this.messageHelper.replyToInteraction(interaction, embed, { hasBeenDefered: true })
    }

    private async getFields(stats: EmojiStats[], ignore: string, interaction: ChatInputCommandInteraction<CacheType>) {
        const fields = stats.map(async (stat, i) => {
            const emoji = await EmojiHelper.getEmoji(stat.name, interaction)
            const emojiName = emoji.id === '<Fant ikke emojien>' ? stat.name : emoji.id
            const inMessages = `${stat.timesUsedInMessages ?? 0} meldinger`
            const inReactions = `${stat.timesUsedInReactions ?? 0} reaksjoner`
            const total = `${(stat.timesUsedInReactions ?? 0) + (stat.timesUsedInMessages ?? 0)} totalt`
            const info = ignore ? (ignore === 'ignoreMessages' ? inReactions : inMessages) : `${inMessages}\n${inReactions}\n${total}`
            return { name: `${i + 1}. ${emojiName}`, value: info, inline: true }
        })
        const retVal = await Promise.all(fields)
        return retVal
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
            const emojiStatsArray: EmojiStats[] = Object.values(emojis).map(({ added, name, timesUsedInMessages, timesUsedInReactions, removed, animated }) => ({
                added,
                name,
                timesUsedInMessages,
                timesUsedInReactions,
                removed,
                animated
            }))
            this.emojiStats = emojiStatsArray.filter((stat) => stat.name !== undefined)
            this.lastFetched = now
        }
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
