import fetch from 'node-fetch'
import { rapidApiKey2 } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { IDailyPriceClaim } from '../commands/money/gamblingCommands'
import { MessageHelper } from '../helpers/messageHelper'
import { RocketLeagueTournament } from '../interfaces/database/databaseInterface'
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

    runJobs(onlyBd?: boolean) {
        if (!onlyBd) {
            this.validateAndResetDailyClaims()
            this.updateJailAndJailbreakCounters()
        }
        this.checkForUserBirthdays()
        this.updateRLTournaments()
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

    private async validateAndResetDailyClaims() {
        const users = await this.client.db.getAllUsers()
        users.forEach((user) => {
            const userStreak = user.dailyClaimStreak
            if (!userStreak) return //Verify that the user as a streak/claim, otherwise skip
            const currentStreak = user.dailyClaimStreak
            if (!currentStreak) return
            const streak: IDailyPriceClaim = { streak: currentStreak.streak, wasAddedToday: false }
            //Check if user has frozen their streak
            const hasFrozenStreak = user.dailyFreezeCounter

            if (hasFrozenStreak && !isNaN(hasFrozenStreak) && hasFrozenStreak > 0) {
                user.dailyFreezeCounter = user.dailyFreezeCounter ? --user.dailyFreezeCounter : 0
            } else {
                streak.wasAddedToday = false //Reset check for daily claim
                if (!currentStreak.wasAddedToday) streak.streak = 0 //If not claimed today, also reset the streak
                user.dailyClaimStreak = streak
            }
            user.dailyClaim = 0
            this.client.db.updateUser(user)
            this.client.db.deleteSpecificPrefixValues('dailyClaim')
        })
    }

    private async checkForUserBirthdays() {
        const users = await this.client.db.getAllUsers()

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

    private async updateJailAndJailbreakCounters() {
        const users = await this.client.db.getAllUsers()
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
                this.client.db.updateUser(user)
            }
        })
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        console.log(`Daily jobs ran at ${todaysTime}`)
    }
}
