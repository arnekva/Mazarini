import { MazariniClient } from '../client/MazariniClient'
import { MessageHelper } from '../helpers/messageHelper'
import { DailyJobs } from './dailyJobs'
import { DayJob } from './dayJobs'
import { HourJob } from './hourlyJobs'
import { WeeklyJobs } from './weeklyJobs'

const schedule = require('node-schedule')
export class JobScheduler {
    fridayJobs: any
    dailyJobs: any
    weeklyJobs: any
    hourlyJobs: any
    constructor(msgHelper: MessageHelper, client: MazariniClient) {
        this.dailyJobs = schedule.scheduleJob('0 6 * * *', async function () {
            const jobs = new DailyJobs(msgHelper, client)
            jobs.runJobs()
        })

        /** Runs once a week at mondays 06:00 */
        this.weeklyJobs = schedule.scheduleJob('0 6 * * 1', async function () {
            const jobs = new WeeklyJobs(msgHelper)
            jobs.runJobs()
        })
        this.fridayJobs = schedule.scheduleJob('0 16 * * 5', async function () {
            const jobs = new DayJob(msgHelper, 'friday')
            jobs.runJobs()
        })
        this.hourlyJobs = schedule.scheduleJob('0 * * * *', async function () {
            const jobs = new HourJob(msgHelper)
            jobs.runJobs()
        })
    }
}
