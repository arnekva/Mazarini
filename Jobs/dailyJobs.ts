import { IDailyPriceClaim } from '../commands/gamblingCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'

export class DailyJobs {
    private messageHelper: MessageHelper

    constructor(messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
    }

    runJobs() {
        this.validateAndResetDailyClaims()
        this.resetStatuses()
        this.logEvent()
    }

    private async validateAndResetDailyClaims() {
        const brukere = await DatabaseHelper.getAllUsers()
        Object.keys(brukere).forEach((username: string) => {
            const userStreak = DatabaseHelper.getValueWithoutMessage('dailyClaimStreak', username)
            if (!userStreak) return //Verify that the user as a streak/claim, otherwise skip
            const currentStreak = JSON.parse(DatabaseHelper.getValueWithoutMessage('dailyClaimStreak', username)) as IDailyPriceClaim
            if (!currentStreak) return
            const streak: IDailyPriceClaim = { streak: currentStreak.streak, wasAddedToday: false }

            streak.wasAddedToday = false //Reset check for daily claim
            if (!currentStreak.wasAddedToday) streak.streak = 0 //If not claimed today, also reset the streak

            DatabaseHelper.setObjectValue('dailyClaimStreak', username, JSON.stringify(streak))
        })

        DatabaseHelper.deleteSpecificPrefixValues('dailyClaim')
    }

    private async resetStatuses() {
        DatabaseHelper.deleteSpecificPrefixValues('mygling')
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage('810832760364859432', `Daglige jobber kjørte ${todaysTime} (Resett status, resett daily price claim)`)
        console.log(`Daily jobs ran at ${todaysTime}`)
    }
}
