import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'

export class WeeklyJobs {
    static async awardWeeklyCoins() {
        const brukere = await DatabaseHelper.getAllUsers()
        Object.keys(brukere).forEach((username: string) => {
            const currentBalance = DatabaseHelper.getValueWithoutMessage('dogeCoin', username)
            const newBalance = Number(currentBalance) + 200
            DatabaseHelper.setValue('dogeCoin', username.toString(), newBalance.toString())
        })
    }
    static logEvent() {
        const today = new Date()
        const timeString = `${today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds()}`
        MessageHelper.SendMessageWithoutMessageObject(`Ukentlige jobber kjørte ${timeString} (NAV-penger)`, '810832760364859432')
        console.log(`Weekly jobs ran at ${timeString}`)
    }
}
