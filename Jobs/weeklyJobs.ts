import { DatabaseHelper } from '../helpers/databaseHelper'

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
        console.log('Weekly jobs ran at 08:00')
    }
}
