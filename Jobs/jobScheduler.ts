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
        this.dailyJobs = schedule.scheduleJob('0 5 * * *', async function () {
            const jobs = new DailyJobs(msgHelper, client)
            jobs.runJobs()
        })

        /** Runs once a week on mondays at 06:01 to avoid write collision with dailyJobs */
        this.weeklyJobs = schedule.scheduleJob('1 5 * * 1', async function () {
            const jobs = new WeeklyJobs(msgHelper, client)
            jobs.runJobs()
        })
        this.fridayJobs = schedule.scheduleJob('0 16 * * 5', async function () {
            const jobs = new DayJob(msgHelper, 'friday')
            jobs.runJobs()
        })
        this.hourlyJobs = schedule.scheduleJob('0 * * * *', async function () {
            const jobs = new HourJob(msgHelper, client)
            jobs.runJobs()
        })
    }
}
