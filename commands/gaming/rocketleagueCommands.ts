import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { environment, rapidApiKey } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { RocketLeagueTournament } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'
import { MessageUtils } from '../../utils/messageUtils'
import { DailyJobs } from '../../Jobs/dailyJobs'

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
const fetch = require('node-fetch')
const striptags = require('striptags')
const puppeteer = require('puppeteer')

export class RocketLeagueCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async rocketLeagueRanks(interaction: ChatInputCommandInteraction<CacheType>) {
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

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36',
        }

        //Need to specify executable path on Raspberry Pi, as it for some reason doesn't like the Puppeteer-supplied chromium version. Should work on Windows/Mac.
        let browser
        if (environment === 'prod')
            browser = await puppeteer.launch({
                headless: true,
                executablePath: '/usr/bin/chromium-browser',
            })
        else
            browser = await puppeteer.launch({
                headless: true,
            })
        const page = await browser.newPage()
        page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36')
        await page.goto(url)
        const content = await page.content()

        await browser.close()
        const contentString = content as string
        if (contentString.includes('Access denied')) {
            interaction.editReply(`Access denied.`)
            this.messageHelper.sendLogMessage(
                `api.tracker.gg for Rocket League gir Access Denied. Melding stammer fra ${interaction.user.username} i ${
                    (interaction?.channel as TextChannel).name
                }`
            )
        }

        const response = JSON.parse(striptags(content))
        if (!response.data) {
            interaction.editReply('Fant ikke data')
        }
        const segments = response.data.segments

        let threeVthree: rocketLeagueStats = {}
        let twoVtwo: rocketLeagueStats = {}
        let oneVone: rocketLeagueStats = {}
        let tournament: rocketLeagueStats = {}
        let lifetimeStats: rocketLeagueLifetime = {}
        if (!segments) {
            interaction.editReply('Fetch til Rocket League API feilet')
        }
        for (const segment of segments) {
            if (!segment) {
                interaction.editReply('Fetch til Rocket League API feilet')
                break
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
            } else if (segment.type === "playlist" && segment.metadata.name === 'Ranked Duel 1v1') {
                oneVone.rank = segment?.stats?.tier?.metadata?.name
                oneVone.division = segment?.stats?.division?.metadata?.name
                oneVone.modeName = segment?.metadata?.name
                oneVone.iconURL = segment.stats?.tier?.metadata?.iconUrl
                oneVone.mmr = segment?.stats?.rating?.value
            } else if (segment.type === "playlist" && segment.metadata.name === 'Ranked Doubles 2v2') {                
                twoVtwo.rank = segment?.stats?.tier?.metadata?.name
                twoVtwo.division = segment?.stats?.division?.metadata?.name
                twoVtwo.modeName = segment?.metadata?.name
                twoVtwo.iconURL = segment.stats?.tier?.metadata?.iconUrl
                twoVtwo.mmr = segment?.stats?.rating?.value
            } else if (segment.type === "playlist" && segment.metadata.name === 'Ranked Standard 3v3') {
                threeVthree.rank = segment?.stats?.tier?.metadata?.name
                threeVthree.division = segment?.stats?.division?.metadata?.name
                threeVthree.modeName = segment?.metadata?.name
                threeVthree.iconURL = segment.stats?.tier?.metadata?.iconUrl
                threeVthree.mmr = segment?.stats?.rating?.value
            } else if (segment.type === "playlist" && segment.metadata.name === 'Tournament Matches') {
                tournament.rank = segment?.stats?.tier?.metadata?.name
                tournament.division = segment?.stats?.division?.metadata?.name
                tournament.modeName = segment?.metadata?.name
                tournament.iconURL = segment.stats?.tier?.metadata?.iconUrl
                tournament.mmr = segment?.stats?.rating?.value
            }
        }        
        let userData = await this.getUserStats(interaction)
        let mmrDiff = ''
        const msgContent = new EmbedBuilder().setTitle(`Rocket League - ${name}`)
        const statsType = interaction.options.get('modus')?.value as string
        if (statsType === '3v3') {
            mmrDiff = this.compareOldNewStats(threeVthree.mmr, userData.mmr?.mmr3v3, false)
            msgContent.addFields([{ name: `${threeVthree.modeName}`, value: `${threeVthree.rank} ${threeVthree.division}\n${threeVthree.mmr} MMR ${mmrDiff}` }])
            if (threeVthree.iconURL) msgContent.setThumbnail(threeVthree.iconURL)
            userData.mmr.mmr3v3 = threeVthree.mmr
        } else if (statsType === '2v2') {
            mmrDiff = this.compareOldNewStats(twoVtwo.mmr, userData.mmr?.mmr2v2, false)
            msgContent.addFields([{ name: `${twoVtwo.modeName}`, value: `${twoVtwo.rank} ${twoVtwo.division}\n${twoVtwo.mmr} MMR ${mmrDiff}` }])
            if (twoVtwo.iconURL) msgContent.setThumbnail(twoVtwo.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
            userData.mmr.mmr2v2 = twoVtwo.mmr
        } else if (statsType === '1v1') {
            mmrDiff = this.compareOldNewStats(oneVone.mmr, userData.mmr?.mmr1v1, false)
            msgContent.addFields([{ name: `${oneVone.modeName}`, value: `${oneVone.rank} ${oneVone.division}\n${oneVone.mmr} MMR ${mmrDiff}` }])
            if (oneVone.iconURL) msgContent.setThumbnail(oneVone.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
            userData.mmr.mmr1v1 = oneVone.mmr
        } else if (statsType.toLowerCase() === 'tournament') {
            mmrDiff = this.compareOldNewStats(tournament.mmr, userData.mmr?.tournament, false)
            msgContent.addFields([{ name: `${tournament.modeName}`, value: `${tournament.rank} ${tournament.division}\n${tournament.mmr} MMR ${mmrDiff}` }])
            if (tournament.iconURL) msgContent.setThumbnail(tournament.iconURL) //{ url: twoVtwo.iconURL, height: 25, width: 25 }
            userData.mmr.tournament = tournament.mmr
        } else {
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
        this.saveUserStats(interaction, userData)
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

    private async saveUserStats(interaction: ChatInputCommandInteraction<CacheType>, stats: rocketLeagueDbData) {
        const user = await this.client.database.getUser(interaction.user.id)
        user.rocketLeagueStats = stats
        this.client.database.updateUser(user)
    }

    private async getUserStats(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        if (user.rocketLeagueStats === undefined) return emptyStats
        return user.rocketLeagueStats
    }

    private async rocketLeagueTournaments(interaction: ChatInputCommandInteraction<CacheType>) {
        const data = await this.getRocketLeagueTournaments()
        if (data) {
            this.messageHelper.replyToInteraction(interaction, data.embed)
            this.messageHelper.sendMessage(interaction.channelId, { components: [data.buttons] })
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Trigger DayJobs...', {ephemeral: true})
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
        rt.forEach((t, idx) => {
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

    private async createTournamentReminder(interaction: ButtonInteraction<CacheType>) {
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
                const mainMsg = await MessageUtils.findMessageById(storage.rocketLeagueTournaments.mainMessageId, this.client)
                if (mainMsg) {
                    mainMsg.edit({ components: [RocketLeagueCommands.getButtonRow(tournaments)] })
                }
            }
        }
    }

    public getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'rocket',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.rocketLeagueRanks(interaction)
                        },
                    },
                    {
                        commandName: 'tournament',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.rocketLeagueTournaments(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'RL_TOURNAMENT',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.createTournamentReminder(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
