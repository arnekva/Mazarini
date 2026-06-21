import { MazariniClient } from '../client/MazariniClient'
import { MessageHelper } from '../helpers/messageHelper'
import * as schedule from 'node-schedule'
import type { Job } from 'node-schedule'
import { DailyJobs } from './dailyJobs'
import { DayJob } from './dayJobs'
import { HourJob } from './hourlyJobs'
import { WeeklyJobs } from './weeklyJobs'

export class JobScheduler {
    fridayJobs: Job
    dailyJobs: Job
    weeklyJobs: Job
    hourlyJobs: Job
    constructor(msgHelper: MessageHelper, client: MazariniClient) {
        this.dailyJobs = schedule.scheduleJob('0 5 * * *', function () {
            const jobs = new DailyJobs(msgHelper, client)
            jobs.runJobs()
        })

        /** Runs once a week on mondays at 06:01 to avoid write collision with dailyJobs */
        this.weeklyJobs = schedule.scheduleJob('1 5 * * 1', function () {
            const jobs = new WeeklyJobs(msgHelper, client)
            jobs.runJobs()
        })
        this.fridayJobs = schedule.scheduleJob('0 16 * * 5', function () {
            const jobs = new DayJob(msgHelper, 'friday')
            jobs.runJobs()
        })
        this.hourlyJobs = schedule.scheduleJob('* * * * *', function () {
            const jobs = new HourJob(msgHelper, client)
            jobs.runJobs()
        })
    }
}
