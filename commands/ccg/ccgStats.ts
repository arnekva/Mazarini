import { randomUUID } from 'crypto'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { MazariniClient } from '../../client/MazariniClient'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { MentionUtils } from '../../utils/mentionUtils'
import { TextUtils } from '../../utils/textUtils'
import { UserUtils } from '../../utils/userUtils'
import { CCGPlayerStats, CCGStats, Difficulty } from './ccgInterface'

export class CCGStatView extends AbstractCommands {
    private stats: Map<string, CCGStats>

    constructor(client: MazariniClient) {
        super(client)
        this.stats = new Map<string, CCGStats>()
    }

    public async newCCGStatView(interaction: ChatInteraction) {
        const statsId = randomUUID()
        const stats: CCGStats = {
            id: statsId,
            guildId: interaction.guildId,
            stats: await this.getAllCCGStats(),
            stat1Id: undefined,
            stat2Id: undefined,
            info: {
                container: undefined,
                message: undefined,
            },
        }
        await this.newInfoContainer(stats)
        const infoMsg = await this.messageHelper.replyToInteraction(interaction, '', undefined, [stats.info.container.container])
        stats.info.message = infoMsg
        this.stats.set(statsId, stats)
    }

    private async getAllCCGStats() {
        const users = await this.database.getAllUsers()
        const usersWithStats = users.filter((user) => (user.userStats?.ccgStats?.length ?? 0) > 0)
        const statMap = new Map<string, CCGPlayerStats[]>()
        for (const user of usersWithStats) {
            statMap.set(user.id, user.userStats.ccgStats)
        }
        return statMap
    }

    private async newInfoContainer(stats: CCGStats) {
        const container = new SimpleContainer()
        container.addComponent(ComponentsHelper.createTextComponent().setContent('## CCG stats'), 'header')
        container.addComponent(ComponentsHelper.createSeparatorComponent(), 'header_separator')
        stats.info.container = container
        await this.addPlayer1StatsButtons(stats)
        if (stats.stat1Id) {
            container.addComponent(ComponentsHelper.createSeparatorComponent(), 'player1_buttons_separator')
            container.addComponent(ComponentsHelper.createTextComponent().setContent('### Hvilke stats vil du se?'), 'stat_selection')
            await this.addPlayer2StatsButtons(stats)
            if (stats.stat2Id) {
                container.addComponent(ComponentsHelper.createSeparatorComponent(), 'player2_buttons_separator')
                const hoieSelected = [stats.stat1Id, stats.stat2Id].includes(MentionUtils.User_IDs.BOT_HOIE)
                if (hoieSelected) {
                    this.addDifficultyButtons(stats)
                    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'difficulty_buttons_separator')
                }
                if (!hoieSelected || stats.difficulty) {
                    await this.addSelectedStats(stats)
                }
            }
        }
    }

    public setUser(interaction: BtnInteraction) {
        const customId = interaction.customId.split(';')
        const stats = this.stats.get(customId[1])
        if (!stats) return this.messageHelper.replyToInteraction(interaction, 'Denne er utdatert, åpne nye stats med /ccg stats', { ephemeral: true })
        interaction.deferUpdate()
        if (customId[2] === '1') {
            stats.stat1Id = customId[3]
            stats.stat2Id = undefined
            stats.difficulty = undefined
        } else {
            stats.stat2Id = customId[3]
            stats.difficulty = undefined
        }
        this.updateStatsView(stats)
    }

    public setDifficulty(interaction: BtnInteraction) {
        const customId = interaction.customId.split(';')
        const stats = this.stats.get(customId[1])
        if (!stats) return this.messageHelper.replyToInteraction(interaction, 'Denne er utdatert, åpne nye stats med /ccg stats', { ephemeral: true })
        interaction.deferUpdate()
        stats.difficulty = customId[2] as Difficulty
        this.updateStatsView(stats)
    }

    private async addSelectedStats(stats: CCGStats) {
        const player1Stats = stats.stats
            .get(stats.stat1Id)
            .find((stat) => stat.opponentId === stats.stat2Id && (!stats.difficulty || stats.difficulty === stat.difficulty))
        const player2Stats = stats.stats
            .get(stats.stat2Id)
            .find((stat) => stat.opponentId === stats.stat1Id && (!stats.difficulty || stats.difficulty === stat.difficulty))
        const stat1Name = await this.getName(stats, stats.stat1Id)
        const stat2Name = await this.getName(stats, stats.stat2Id)
        let table = `${stat1Name} VS ${stat2Name}\n`
        const length = table.length
        table += `${'───────────────'.padEnd(length, '─')}\n`
        for (const key of statsMap.keys()) {
            table += `${String(player1Stats[key]).padStart(4).padEnd(6)}   ${statsMap.get(key).padEnd(12)}   ${String(player2Stats[key])
                .padStart(1)
                .padEnd(4)}\n`
        }
        if (!stats.difficulty && player1Stats.chipsWon !== 0) {
            const chipsWinner = player1Stats.chipsWon > 0 ? stat1Name : stat2Name
            table += `\n${chipsWinner} er ${Math.abs(player1Stats.chipsWon)} chips \ni pluss\n`
        }
        stats.info.container.addComponent(ComponentsHelper.createTextComponent().setContent('```' + table + '```'), 'selectedStats')
    }

    private async addPlayer1StatsButtons(stats: CCGStats) {
        const userIds = Array.from(stats.stats.keys())
        const components: Array<ButtonBuilder> = new Array<ButtonBuilder>()
        for (const userId of userIds) {
            const name = await this.getName(stats, userId)
            components.push(player1StatsButton(stats.id, userId, name, userId === stats.stat1Id))
        }
        const numOfBtnRows = Math.ceil(components.length / 5)
        for (let i = 0; i < numOfBtnRows; i++) {
            const startIndex = i * 5
            const endIndex = Math.min((i + 1) * 5, components.length)
            const componentCutout = components.slice(startIndex, endIndex)
            const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(componentCutout)
            stats.info.container.addComponent(btnRow, `player1_buttons_${i + 1}`)
        }
    }

    private async addPlayer2StatsButtons(stats: CCGStats) {
        const selectedUserStats = stats.stats.get(stats.stat1Id).map((stat) => stat.opponentId)
        const components: Array<ButtonBuilder> = new Array<ButtonBuilder>()
        for (const userId of [...new Set(selectedUserStats)]) {
            const name = await this.getName(stats, userId)
            components.push(player2StatsButton(stats.id, userId, `vs ${name}`, userId === stats.stat2Id))
        }
        const numOfBtnRows = Math.ceil(components.length / 5)
        for (let i = 0; i < numOfBtnRows; i++) {
            const startIndex = i * 5
            const endIndex = Math.min((i + 1) * 5, components.length)
            const componentCutout = components.slice(startIndex, endIndex)
            const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(componentCutout)
            stats.info.container.addComponent(btnRow, `player2_buttons_${i + 1}`)
        }
    }

    private addDifficultyButtons(stats: CCGStats) {
        const selectedUserStats = stats.stats.get(stats.stat1Id).filter((stat) => stat.opponentId === stats.stat2Id)
        const difficulties = selectedUserStats.map((stat) => stat.difficulty)
        const components: Array<ButtonBuilder> = new Array<ButtonBuilder>()
        for (const difficulty of difficulties) {
            components.push(difficultyStatsButton(stats.id, difficulty, difficulty === stats.difficulty))
        }
        const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(components)
        stats.info.container.addComponent(btnRow, 'difficulty_buttons')
    }

    private async getName(stats: CCGStats, userId: string) {
        const guild = this.client.guilds.cache.find((guild) => guild.id === stats.guildId)
        const member = await guild.members.fetch(userId)
        return UserUtils.getPrettyName(member)
    }

    private async updateStatsView(stats: CCGStats) {
        await this.newInfoContainer(stats)
        stats.info.message.edit({ components: [stats.info.container.container] })
    }

    getAllInteractions(): IInteractionElement {
        throw new Error('Method not implemented.')
    }
}

const statsMap: Map<string, string> = new Map([
    ['won', 'Vunnet'],
    ['damageDealt', 'Skade gjort'],
    ['damageTaken', 'Skade tatt'],
    ['hits', 'Kort truffet'],
    ['misses', 'Kort bommet'],
])

const player1StatsButton = (statsId: string, playerId: string, name: string, isSelected = false) => {
    return new ButtonBuilder({
        custom_id: `CCG_STATS;${statsId};1;${playerId}`,
        style: isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: false,
        label: name,
        type: 2,
    })
}

const player2StatsButton = (statsId: string, playerId: string, name: string, isSelected = false) => {
    return new ButtonBuilder({
        custom_id: `CCG_STATS;${statsId};2;${playerId}`,
        style: isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: false,
        label: name,
        type: 2,
    })
}

const difficultyStatsButton = (statsId: string, difficulty: Difficulty, isSelected = false) => {
    return new ButtonBuilder({
        custom_id: `CCG_STATS_DIFFICULTY;${statsId};${difficulty}`,
        style: isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: false,
        label: TextUtils.capitalizeFirstLetter(difficulty),
        type: 2,
    })
}
