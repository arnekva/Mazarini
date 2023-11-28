import fetch from 'node-fetch'
import { rapidApiKey2 } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { MessageHelper } from '../helpers/messageHelper'
import { MazariniUser, RocketLeagueTournament } from '../interfaces/database/databaseInterface'
import { DateUtils } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'
export class DailyJobs {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }

    async runJobs(onlyBd?: boolean, noRL?: boolean) {
        const users = await this.client.db.getAllUsers()
        if (!onlyBd) {
            await this.validateAndResetDailyClaims(users)
            await this.updateJailAndJailbreakCounters(users)
        }
        this.checkForUserBirthdays(users)
        if (!noRL) this.updateRLTournaments()
    }

    private updateRLTournaments() {
        const data = fetch('https://rocket-league1.p.rapidapi.com/tournaments/europe', {
            headers: {
                'User-Agent': 'RapidAPI Playground',
                'Accept-Encoding': 'identity',
                '_X-RapidAPI-Key': rapidApiKey2,
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
                    this.messageHelper.sendLogMessage(`Klarte ikke hente Rocket League turneringer`)
                } else {
                    tournaments.forEach((t, idx) => {
                        t.id = idx
                    })
                    this.client.db.updateStorage({
                        rocketLeagueTournaments: tournaments,
                    })
                }
            })
            .catch((err) => {
                this.messageHelper.sendLogMessage(`Klarte ikke hente Rocket League Tournaments. Error: \n${err}`)
            })
    }

    private async validateAndResetDailyClaims(users: MazariniUser[]) {
        const updates = this.client.db.getUpdatesObject<'daily'>()
        users.forEach((user) => {
            const daily = user.daily
            if (!daily.streak) return //Verify that the user as a streak/claim, otherwise skip
            //Check if user has frozen their streak
            const hasFrozenStreak = daily.dailyFreezeCounter

            if (hasFrozenStreak && !isNaN(hasFrozenStreak) && hasFrozenStreak > 0) {
                daily.dailyFreezeCounter = daily.dailyFreezeCounter ? --daily.dailyFreezeCounter : 0
            } else {
                if (!daily.claimedToday) daily.streak = 0 //If not claimed today, also reset the streak
                daily.claimedToday = false //Reset check for daily claim
            }

            const updatePath = this.client.db.getUserPathToUpdate(user.id, 'daily')
            updates[updatePath] = daily
        })
        this.client.db.updateData(updates)
    }

    private async checkForUserBirthdays(users: MazariniUser[]) {
        users.forEach((user) => {
            const birthday: string | undefined = user?.birthday
            if (!birthday) return
            const bdTab = birthday.split('-').map((d) => Number(d))
            const date = new Date(bdTab[2], bdTab[1], bdTab[0])
            const isBirthdayToday = DateUtils.isToday(new Date(date))

            if (isBirthdayToday) {
                this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.GENERAL, {
                    text: `Gratulerer med dagen ${UserUtils.findMemberByUserID(user.id, this.client.guilds[0])}!`,
                })
            }
        })
    }

    private async updateJailAndJailbreakCounters(users: MazariniUser[]) {
        const updates = this.client.db.getUpdatesObject<'jail'>()
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
                const updatePath = this.client.db.getUserPathToUpdate(user.id, 'jail')
                updates[updatePath] = user.jail
            }
        })
        this.client.db.updateData(updates)
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        console.log(`Daily jobs ran at ${todaysTime}`)
    }
}
