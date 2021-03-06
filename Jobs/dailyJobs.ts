import { IDailyPriceClaim } from '../commands/gamblingCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { MessageUtils } from '../utils/messageUtils'

export class DailyJobs {
    private messageHelper: MessageHelper

    constructor(messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
    }

    runJobs(onlyBd?: boolean) {
        if (!onlyBd) {
            this.validateAndResetDailyClaims()
            this.resetStatuses()
        }
        this.checkForUserBirthdays()
        // this.logEvent()
    }

    private validateAndResetDailyClaims() {
        const brukere = DatabaseHelper.getAllUsers()
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
                user.dailyFreezeCounter = user.dailyFreezeCounter ? user.dailyFreezeCounter-- : 0
            } else {
                streak.wasAddedToday = false //Reset check for daily claim
                if (!currentStreak.wasAddedToday) streak.streak = 0 //If not claimed today, also reset the streak
                user.dailyClaimStreak = streak
            }
            user.dailyClaim = 0
            DatabaseHelper.updateUser(user)
        })
    }

    private checkForUserBirthdays() {
        const brukere = DatabaseHelper.getAllUsers()
        Object.keys(brukere).forEach((userID: string) => {
            const user = DatabaseHelper.getUser(userID)
            const birthday: string | undefined = user?.birthday

            if (!birthday) return
            const bdTab = birthday.split('-').map((d) => Number(d))
            const date = new Date(bdTab[2], bdTab[1], bdTab[0])
            const isBirthdayToday = DateUtils.isToday(new Date(date))

            if (isBirthdayToday) {
                this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.GENERAL, `Gratulerer med dagen ${user.displayName}!`)
            }
        })

        DatabaseHelper.deleteSpecificPrefixValues('dailyClaim')
    }

    private async resetStatuses() {
        DatabaseHelper.deleteSpecificPrefixValues('status')
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage('810832760364859432', `Daglige jobber kj??rte ${todaysTime} (Resett status, resett daily price claim)`)
        console.log(`Daily jobs ran at ${todaysTime}`)
    }
}
