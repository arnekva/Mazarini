import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js'

import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import {  rapidApiKey } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { RocketLeagueTournament } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { DailyJobs } from '../../Jobs/dailyJobs'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'

interface rocketLeagueStats {
    modeName?: string
    rank?: string
    division?: string
    iconURL?: string
    mmr?: string
}
interface rocketLeagueLifetime {
    wins?: string
    goals?: string
    mvp?: string
    saves?: string
    assists?: string
    shots?: string
    goalShotRatio?: string
}
interface rocketLeagueMMR {
    mmr1v1?: string
    mmr2v2?: string
    mmr3v3?: string
    tournament: string
}
export interface rocketLeagueDbData {
    stats: rocketLeagueLifetime
    mmr: rocketLeagueMMR
}
const emptyStats: rocketLeagueDbData = {
    stats: { wins: '0', goals: '0', mvp: '0', saves: '0', assists: '0', shots: '0', goalShotRatio: '0' },
    mmr: { mmr1v1: '0', mmr2v2: '0', mmr3v3: '0', tournament: '0' },
}

export class RocketLeagueCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private getPuppeteer() {
        return require('puppeteer')
    }

    private stripTags(content: string) {
        const stripTags = require('striptags')
        return stripTags(content)
    }

    private async rocketLeagueRanks(interaction: ChatInteraction) {
        const dbUser = await this.client.database.getUser(interaction.user.id)
        const userValue = dbUser.rocketLeagueUserString
        let user
        if (userValue) user = userValue.split(';')

        // return
        if (!user) {
            return this.messageHelper.replyToInteraction(
                interaction,
                "Du må linke Rocket League kontoen din. Bruk '/link rocket <psn|xbl|steam|epic> <brukernavn>'"
            )
        }
     await interaction.deferReply()
const platform = user[0]
const name = user[1]
const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/${platform}/${name}`

let data: any //TODO: type this
try {
    const { execFile } = require('child_process') as typeof import('child_process')
    const body: string = await new Promise((resolve, reject) => {
        execFile(
            'curl_chrome116',
            [
                '-s',
                '-H', 'Accept: application/json, text/plain, */*',
                '-H', 'Accept-Language: en-US,en;q=0.9',
                '-H', 'Referer: https://rocketleague.tracker.network/',
                '-H', 'Origin: https://rocketleague.tracker.network',
                url,
            ],
            { timeout: 15000 },
            (err, stdout) => (err ? reject(err) : resolve(stdout))
        )
    })
    data = JSON.parse(body)
} catch {
    await interaction.editReply('Klarte ikke lese Rocket League-data frå Tracker.gg akkurat no.')
    this.messageHelper.sendLogMessage(`Rocket League-data kunne ikke parses for ${interaction.user.username}.`)
    return false
}

if (!data?.data) {
    await interaction.editReply('Fant ikke data')
    return false
}
        const segments = data.data.segments

        const threeVthree: rocketLeagueStats = {}
        const twoVtwo: rocketLeagueStats = {}
        const oneVone: rocketLeagueStats = {}
        const tournament: rocketLeagueStats = {}
        const lifetimeStats: rocketLeagueLifetime = {}
        if (!segments) {
            await interaction.editReply('Fetch til Rocket League API feilet')
            return false
        }
        for (const segment of segments) {
            if (!segment) {
                await interaction.editReply('Fetch til Rocket League API feilet')
                return false
            }
            if (segment.metadata.name === 'Lifetime') {
                //Lifetime stats
                lifetimeStats.goals = segment.stats.goals.value
                lifetimeStats.mvp = segment.stats.mVPs.value
                lifetimeStats.assists = segment.stats.assists.value
                lifetimeStats.saves = segment.stats.saves.value
                lifetimeStats.wins = segment.stats.wins.value
                lifetimeStats.shots = segment.stats.shots.value
                lifetimeStats.goalShotRatio = Number(segment.stats.goalShotRatio.value).toFixed(2)
            } else if (segment.type === 'playlist' && segment.metadata.name === 'Ranked Duel 1v1') {
                oneVone.rank = segment?.stats?.tier?.metadata?.name
                oneVone.division = segment?.stats?.division?.metadata?.name
                oneVone.modeName = segment?.metadata?.name
                oneVone.iconURL = segment.stats?.tier?.metadata?.iconUrl
                oneVone.mmr = segment?.stats?.rating?.value
            } else if (segment.type === 'playlist' && segment.metadata.name === 'Ranked Doubles 2v2') {
                twoVtwo.rank = segment?.stats?.tier?.metadata?.name
                twoVtwo.division = segment?.stats?.division?.metadata?.name
                twoVtwo.modeName = segment?.metadata?.name
                twoVtwo.iconURL = segment.stats?.tier?.metadata?.iconUrl
                twoVtwo.mmr = segment?.stats?.rating?.value
            } else if (segment.type === 'playlist' && segment.metadata.name === 'Ranked Standard 3v3') {
                threeVthree.rank = segment?.stats?.tier?.metadata?.name
                threeVthree.division = segment?.stats?.division?.metadata?.name
                threeVthree.modeName = segment?.metadata?.name
                threeVthree.iconURL = segment.stats?.tier?.metadata?.iconUrl
                threeVthree.mmr = segment?.stats?.rating?.value
            } else if (segment.type === 'playlist' && segment.metadata.name === 'Tournament Matches') {
                tournament.rank = segment?.stats?.tier?.metadata?.name
                tournament.division = segment?.stats?.division?.metadata?.name
                tournament.modeName = segment?.metadata?.name
                tournament.iconURL = segment.stats?.tier?.metadata?.iconUrl
                tournament.mmr = segment?.stats?.rating?.value
            }
        }
        const userData = await this.getUserStats(interaction)
        let mmrDiff = ''
        const msgContent = new EmbedBuilder().setTitle(`Rocket League - ${name}`)
        const statsType = interaction.options.get('modus')?.value as string
        if (statsType && statsType.toLowerCase() === 'lifetime') {
            const goalDiff = this.compareOldNewStats(lifetimeStats.goals, userData.stats?.goals, false)
            const winDiff = this.compareOldNewStats(lifetimeStats.wins, userData.stats?.wins, false)
            const shotsDiff = this.compareOldNewStats(lifetimeStats.shots, userData.stats?.shots, false)
            const savesDiff = this.compareOldNewStats(lifetimeStats.saves, userData.stats?.saves, false)
            const assistsDiff = this.compareOldNewStats(lifetimeStats.assists, userData.stats?.assists, false)
            const goalShotRatioDiff = this.compareOldNewStats(lifetimeStats.goalShotRatio, userData.stats?.goalShotRatio, false)
            msgContent.setDescription('Lifetime stats')
            msgContent.addFields([
                { name: 'Wins', value: lifetimeStats.wins + ' ' + winDiff, inline: true },
                { name: 'Goals', value: lifetimeStats.goals + ' ' + goalDiff, inline: true },
                { name: 'Assists', value: lifetimeStats.assists + ' ' + assistsDiff, inline: true },
                { name: 'Shots', value: lifetimeStats.shots + ' ' + shotsDiff, inline: true },
                { name: 'Saves', value: lifetimeStats.saves + ' ' + savesDiff, inline: true },
                { name: 'Goal/Shot Ratio', value: lifetimeStats.goalShotRatio + '% ' + goalShotRatioDiff, inline: true },
            ])
            userData.stats = lifetimeStats
        }
        if (!statsType || statsType === '1v1') {
            if (oneVone.mmr !== undefined) {
                mmrDiff = this.compareOldNewStats(oneVone.mmr, userData.mmr?.mmr1v1, false)
                msgContent.addFields([{ name: `${oneVone.modeName}`, value: `${oneVone.rank} ${oneVone.division}\n${oneVone.mmr} MMR ${mmrDiff}` }])
                if (oneVone.iconURL) msgContent.setThumbnail(oneVone.iconURL)
                userData.mmr.mmr1v1 = oneVone.mmr
            } else {
                msgContent.addFields([{ name: 'Ranked Duel 1v1', value: `${userData.mmr?.mmr1v1 ?? '?'} MMR (outdated)` }])
            }
        }
        if (!statsType || statsType === '2v2') {
            if (twoVtwo.mmr !== undefined) {
                mmrDiff = this.compareOldNewStats(twoVtwo.mmr, userData.mmr?.mmr2v2, false)
                msgContent.addFields([{ name: `${twoVtwo.modeName}`, value: `${twoVtwo.rank} ${twoVtwo.division}\n${twoVtwo.mmr} MMR ${mmrDiff}` }])
                if (twoVtwo.iconURL) msgContent.setThumbnail(twoVtwo.iconURL)
                userData.mmr.mmr2v2 = twoVtwo.mmr
            } else {
                msgContent.addFields([{ name: 'Ranked Doubles 2v2', value: `${userData.mmr?.mmr2v2 ?? '?'} MMR (outdated)` }])
            }
        }
        if (!statsType || statsType === '3v3') {
            if (threeVthree.mmr !== undefined) {
                mmrDiff = this.compareOldNewStats(threeVthree.mmr, userData.mmr?.mmr3v3, false)
                msgContent.addFields([{ name: `${threeVthree.modeName}`, value: `${threeVthree.rank} ${threeVthree.division}\n${threeVthree.mmr} MMR ${mmrDiff}` }])
                if (threeVthree.iconURL) msgContent.setThumbnail(threeVthree.iconURL)
                userData.mmr.mmr3v3 = threeVthree.mmr
            } else {
                msgContent.addFields([{ name: 'Ranked Standard 3v3', value: `${userData.mmr?.mmr3v3 ?? '?'} MMR (outdated)` }])
            }
        }
        if (!statsType || statsType.toLowerCase() === 'tournament') {
            if (tournament.mmr !== undefined) {
                mmrDiff = this.compareOldNewStats(tournament.mmr, userData.mmr?.tournament, false)
                msgContent.addFields([{ name: `${tournament.modeName}`, value: `${tournament.rank} ${tournament.division}\n${tournament.mmr} MMR ${mmrDiff}` }])
                if (tournament.iconURL) msgContent.setThumbnail(tournament.iconURL)
                userData.mmr.tournament = tournament.mmr
            } else {
                msgContent.addFields([{ name: 'Tournament Matches', value: `${userData.mmr?.tournament ?? '?'} MMR (outdated)` }])
            }
        }
        if (!statsType) msgContent.setThumbnail('https://www.pngkey.com/png/full/15-158249_rocket-league-logo.png')
        await this.saveUserStats(interaction, userData)
        interaction.editReply({ embeds: [msgContent] })
        return true
    }

    private compareOldNewStats(current?: string | number | undefined, storedData?: string | number | undefined, ignoreCompare?: boolean) {
        if (!current || !storedData) return ''
        if (ignoreCompare) return ''
        const currentStats = Number(current)
        const oldStorageStats = Number(storedData)
        const value = currentStats - oldStorageStats
        if (currentStats > oldStorageStats) return ` (+${parseFloat(Number(value).toFixed(2))})`
        if (currentStats < oldStorageStats) return ` (${parseFloat(Number(value).toFixed(2))})`
        return ``
    }

    private async saveUserStats(interaction: ChatInteraction, stats: rocketLeagueDbData) {
        const user = await this.client.database.getUser(interaction.user.id)
        user.rocketLeagueStats = stats
        await this.client.database.updateUser(user)
    }

    private async getUserStats(interaction: ChatInteraction) {
        const user = await this.client.database.getUser(interaction.user.id)
        if (user.rocketLeagueStats === undefined) return emptyStats
        return user.rocketLeagueStats
    }

    private async rocketLeagueTournaments(interaction: ChatInteraction) {
        const data = await this.getRocketLeagueTournaments()
        if (data) {
            this.messageHelper.replyToInteraction(interaction, data.embed)
            this.messageHelper.sendMessage(interaction.channelId, { components: [data.buttons] })
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Trigger DayJobs...', { ephemeral: true })
        }
    }

    private async getRocketLeagueTournaments(): Promise<{ embed: EmbedBuilder; buttons: ActionRowBuilder<ButtonBuilder> }> {
        const storage = await this.client.database.getStorage()
        const currentTournaments = storage?.rocketLeagueTournaments?.tournaments
        if (currentTournaments && DateUtils.isToday(new Date(currentTournaments[0].starts))) {
            return {
                buttons: RocketLeagueCommands.getButtonRow(currentTournaments),
                embed: RocketLeagueCommands.getEmbed(),
            }
        } else {
            this.messageHelper.sendLogMessage('Fant ikke RL Tournaments i storage. Forsøker å hente dem fra API.')
            const dayJobs = new DailyJobs(this.messageHelper, this.client)
            dayJobs.updateRLTournaments(rapidApiKey)
        }
        return undefined
    }

    static getEmbed() {
        const embed = EmbedUtils.createSimpleEmbed(
            `Rocket League Turneringer`,
            `For ${DateUtils.formatDate(new Date())}. Trykk på en av knappene for å bli varslet 1 time før turneringen starter`
        )
        return embed
    }

    static getButtonRow(rt: RocketLeagueTournament[]) {
        const activeGameButtonRow = new ActionRowBuilder<ButtonBuilder>()
        rt.forEach((t) => {
            if (t.mode.toLowerCase() == 'soccer') {
                activeGameButtonRow.addComponents(
                    new ButtonBuilder({
                        custom_id: `RL_TOURNAMENT;${t.id}`,
                        style: ButtonStyle.Primary,
                        label: `${t.players}v${t.players} ${t.mode} ${DateUtils.getTimeFormatted(new Date(t.starts))}${t.shouldNotify ? ' (*)' : ''}`,
                        disabled: false,
                        type: 2,
                    })
                )
            }
        })
        return activeGameButtonRow
    }

    private async getAllRLTournamentsAsEmbed() {
        const storage = await this.client.database.getStorage()
        const currentTournaments = storage?.rocketLeagueTournaments.tournaments
        if (currentTournaments) {
            const embed = EmbedUtils.createSimpleEmbed(
                `Rocket League Tournaments`,
                `For ${DateUtils.formatDate(new Date())}. Trykk på en av knappene for å bli varslet 1 time før turneringen starter`,
                currentTournaments.map((tournament) => {
                    const date = new Date(tournament.starts)
                    return {
                        name: `${tournament.players}v${tournament.players} - ${tournament.mode}`,
                        value: `${DateUtils.getTimeFormatted(date)}`,
                    }
                })
            )
            return embed
        }
    }

    private async createTournamentReminder(interaction: BtnInteraction) {
        const storage = await this.client.database.getStorage()
        const tournaments = storage?.rocketLeagueTournaments?.tournaments
        const ids = interaction.customId.split(';')
        const idToUpdate = Number(ids[1])
        const tournamentToUpdate = tournaments.find((t) => {
            return t.id === idToUpdate
        })

        if (tournamentToUpdate) {
            if (tournamentToUpdate.shouldNotify) {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Det er allerede opprettet en påminnelse for denne turneringen. Det blir varslet 1 time før start`,
                    { ephemeral: true }
                )
            } else {
                this.messageHelper.replyToInteraction(interaction, `Det vil bli sendt en påminnelse om denne turneringen 1 time før start`, { ephemeral: true })

                tournamentToUpdate.shouldNotify = true

                this.client.database.updateStorage({
                    rocketLeagueTournaments: {
                        mainMessageId: storage.rocketLeagueTournaments.mainMessageId ?? 'Unknown',
                        tournaments: tournaments,
                    },
                })
            }
        }
    }

    public getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'rocket',
                        command: (interaction: ChatInteraction) => {
                            this.rocketLeagueRanks(interaction)
                        },
                    },
                    {
                        commandName: 'tournament',
                        command: (interaction: ChatInteraction) => {
                            this.rocketLeagueTournaments(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'RL_TOURNAMENT',
                        command: (rawInteraction: BtnInteraction) => {
                            this.createTournamentReminder(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
