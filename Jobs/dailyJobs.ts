import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import moment from 'moment'
import fetch from 'node-fetch'
import { rapidApiKey, rapidApiKey2 } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { MessageHelper } from '../helpers/messageHelper'
import { MazariniUser, RocketLeagueTournament } from '../interfaces/database/databaseInterface'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'
export class DailyJobs {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }

    async runJobs(onlyRl?: boolean) {
        if (onlyRl) {
            this.updateRLTournaments(rapidApiKey)
        } else {
            const users = await this.client.database.getAllUsers()
            await this.validateAndResetDailyClaims(users)
            await this.updateJailAndJailbreakCounters(users)
            this.checkForUserBirthdays(users)
            this.updateRLTournaments(rapidApiKey)
        }
    }

    private updateRLTournaments(apiKey: string) {
        const retryFetch = () => {
            if (apiKey === rapidApiKey) this.updateRLTournaments(rapidApiKey2)
        }
        const data = fetch('https://rocket-league1.p.rapidapi.com/tournaments/europe', {
            headers: {
                'User-Agent': 'RapidAPI Playground',
                'Accept-Encoding': 'identity',
                '_X-RapidAPI-Key': apiKey,
                get 'X-RapidAPI-Key'() {
                    return this['_X-RapidAPI-Key']
                },
                set 'X-RapidAPI-Key'(value) {
                    this['_X-RapidAPI-Key'] = value
                },
                'X-RapidAPI-Host': 'rocket-league1.p.rapidapi.com',
            },
        })
            .then(async (res) => {
                const data = await res.json()

                const tournaments = data.tournaments as RocketLeagueTournament[]
                if (!tournaments) {
                    this.messageHelper.sendLogMessage(
                        `Klarte ikke hente Rocket League turneringer. Det var ingen turneringer i objektet fra fetchen. ${
                            apiKey === rapidApiKey ? 'Forsøker å hente på ny' : 'Fetch 2 feilet også'
                        }`
                    )
                    retryFetch()
                } else {
                    //FIXME: This codeblock is repeated here and and rocketLeagueCommands. Should be refactored
                    tournaments.forEach((t, idx) => {
                        t.id = idx
                    })
                    this.client.database.updateStorage({
                        rocketLeagueTournaments: tournaments,
                    })
                    const embed = EmbedUtils.createSimpleEmbed(
                        `Rocket League Turningeringer`,
                        `For ${DateUtils.formatDate(new Date())}. Trykk på en av knappene for å bli varslet 1 time før turneringen starter`
                    )
                    const activeGameButtonRow = new ActionRowBuilder<ButtonBuilder>()
                    tournaments.forEach((t, idx) => {
                        activeGameButtonRow.addComponents(
                            new ButtonBuilder({
                                custom_id: `RL_TOURNAMENT;${t.id}`,
                                style: ButtonStyle.Primary,
                                label: `${t.players}v${t.players} ${t.mode} ${DateUtils.getTimeFormatted(new Date(t.starts))}${t.shouldNotify ? ' (*)' : ''}`,
                                disabled: false,
                                type: 2,
                            })
                        )
                    })
                    this.messageHelper.sendMessage(ChannelIds.ROCKET_LEAGUE, { embed: embed, components: [activeGameButtonRow] }, { sendAsSilent: true })
                }
            })
            .catch((err) => {
                this.messageHelper.sendLogMessage(`Klarte ikke hente Rocket League Tournaments. Error: \n${err}`)
                retryFetch()
            })
    }

    private async validateAndResetDailyClaims(users: MazariniUser[]) {
        const updates = this.client.database.getUpdatesObject<'daily'>()
        users.forEach((user) => {
            const daily = user?.daily
            if (!daily?.streak) return //Verify that the user as a streak/claim, otherwise skip
            //Check if user has frozen their streak
            const hasFrozenStreak = daily.dailyFreezeCounter

            if (hasFrozenStreak && !isNaN(hasFrozenStreak) && hasFrozenStreak > 0) {
                daily.dailyFreezeCounter = daily.dailyFreezeCounter ? --daily.dailyFreezeCounter : 0
            } else {
                if (!daily.claimedToday) daily.streak = 0 //If not claimed today, also reset the streak
                daily.claimedToday = false //Reset check for daily claim
            }

            const updatePath = this.client.database.getUserPathToUpdate(user.id, 'daily')
            updates[updatePath] = daily
        })
        this.client.database.updateData(updates)
    }

    private async checkForUserBirthdays(users: MazariniUser[]) {
        users.forEach((user) => {
            const birthday = user?.birthday
            if (birthday) {
                const date = moment.utc(`${birthday} 12:00`, 'DD-MM-YYYY HH:mm:ss') // new Date(bdTab[2], bdTab[1], bdTab[0])
                const isBirthdayToday = DateUtils.isToday(date.toDate(), true)
                if (isBirthdayToday) {
                    this.messageHelper.sendMessage(ChannelIds.GENERAL, {
                        text: `Gratulerer med dagen ${UserUtils.findMemberByUserID(user.id, this.client.guilds[0])}!`,
                    })
                }
            }
        })
    }

    private async updateJailAndJailbreakCounters(users: MazariniUser[]) {
        const updates = this.client.database.getUpdatesObject<'jail'>()
        users.forEach((user) => {
            const daysLeftInJail = user.jail?.daysInJail
            if (user.jail) {
                if (daysLeftInJail && !isNaN(daysLeftInJail) && daysLeftInJail > 0) {
                    user.jail.daysInJail = user.jail.daysInJail ? --user.jail.daysInJail : 0
                }
                if (!user.jail?.daysInJail) {
                    user.jail.jailState = 'none'
                }
                user.jail.attemptedJailbreaks = 0
                user.jail.timesJailedToday = 0
                const updatePath = this.client.database.getUserPathToUpdate(user.id, 'jail')
                updates[updatePath] = user.jail
            }
        })
        this.client.database.updateData(updates)
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        console.log(`Daily jobs ran at ${todaysTime}`)
    }
}
