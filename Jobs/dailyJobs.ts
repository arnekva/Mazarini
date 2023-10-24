import fetch from 'node-fetch'
import { rapidApiKey2 } from '../client-env'
import { GameCommands } from '../commands/gameCommands'
import { IDailyPriceClaim } from '../commands/money/gamblingCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { RocketLeagueTournament } from '../interfaces/database/databaseInterface'
import { DateUtils } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'
export class DailyJobs {
    private messageHelper: MessageHelper

    constructor(messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
    }

    runJobs(onlyBd?: boolean) {
        if (!onlyBd) {
            this.validateAndResetDailyClaims()
            this.updateJailAndJailbreakCounters()
        }
        this.checkForUserBirthdays()
        this.updateRLTournaments()
    }

    updateRLTournaments() {
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
                tournaments.forEach((t, idx) => {
                    t.id = idx
                })
                DatabaseHelper.updateStorage({
                    rocketLeagueTournaments: tournaments,
                })
                const msgData = GameCommands.getRocketLeagueTournaments()
                this.messageHelper.sendMessage(
                    MentionUtils.CHANNEL_IDs.ROCKET_LEAGUE,
                    `Dagens turneringer. Trykk på en av knappene for å bli varslet 1 time før start`
                )
                this.messageHelper.sendMessageWithComponents(MentionUtils.CHANNEL_IDs.ROCKET_LEAGUE, [msgData.buttons])
            })
            .catch((err) => {
                this.messageHelper.sendLogMessage(`Klarte ikke hente Rocket League Tournaments. Error: \n${err}`)
            })
    }

    private validateAndResetDailyClaims() {
        const brukere = DatabaseHelper.getAllUserIdsAsObject()
        Object.keys(brukere).forEach((userID: string) => {
            const user = DatabaseHelper.getUser(userID)

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
            DatabaseHelper.updateUser(user)
            DatabaseHelper.deleteSpecificPrefixValues('dailyClaim')
        })
    }

    private checkForUserBirthdays() {
        const brukere = DatabaseHelper.getAllUserIdsAsObject()

        Object.keys(brukere).forEach((userID: string) => {
            const user = DatabaseHelper.getUser(userID)
            const birthday: string | undefined = user?.birthday

            if (!birthday) return
            const bdTab = birthday.split('-').map((d) => Number(d))
            const date = new Date(bdTab[2], bdTab[1], bdTab[0])
            const isBirthdayToday = DateUtils.isToday(new Date(date))

            if (isBirthdayToday) {
                this.messageHelper.sendMessage(
                    MentionUtils.CHANNEL_IDs.GENERAL,
                    `Gratulerer med dagen ${UserUtils.findMemberByUserID(user.id, this.messageHelper.msgClient.guilds[0])}!`
                )
            }
        })
    }

    private updateJailAndJailbreakCounters() {
        const users = DatabaseHelper.getAllUsers()
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
                DatabaseHelper.updateUser(user)
            }
        })
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.ACTION_LOG, `Daglige jobber kjørte ${todaysTime}`)
        console.log(`Daily jobs ran at ${todaysTime}`)
    }
}
