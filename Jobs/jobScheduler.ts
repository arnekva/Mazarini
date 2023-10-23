import { MessageHelper } from '../helpers/messageHelper'
import { DailyJobs } from './dailyJobs'
import { DayJob } from './dayJobs'
import { WeeklyJobs } from './weeklyJobs'

const schedule = require('node-schedule')
export class JobScheduler {
    fridayJobs: any
    dailyJobs: any
    weeklyJobs: any
    constructor(msgHelper: MessageHelper) {
        this.dailyJobs = schedule.scheduleJob('0 6 * * *', async function () {
            const jobs = new DailyJobs(msgHelper)
            jobs.runJobs()
        })
        /** Runs once a week at mondays 06:00 */
        this.weeklyJobs = schedule.scheduleJob('0 9 * * 1', async function () {
            const jobs = new WeeklyJobs(msgHelper)
            jobs.runJobs()
        })
        this.fridayJobs = schedule.scheduleJob('0 16 * * 5', async function () {
            const jobs = new DayJob(msgHelper, 'friday')
            jobs.runJobs()
        })
    }
}
