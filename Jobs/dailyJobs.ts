import { IDailyPriceClaim } from '../commands/gamblingCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'

export class DailyJobs {
    static async validateAndResetDailyClaims() {
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

    static async resetStatuses() {
        DatabaseHelper.deleteSpecificPrefixValues('mygling')
    }

    static logEvent() {
        const today = new Date()
        const timeString = `${today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds()}`
        MessageHelper.SendMessageWithoutMessageObject(`Daglige jobber kjørte ${timeString} (Resett status, resett daily price claim)`, '810832760364859432')
        console.log(`Daily jobs ran at ${timeString}`)
    }
}
