import { EmbedBuilder } from '@discordjs/builders'
import moment from 'moment'
import { PoletCommands } from '../commands/poletCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'

export class WeeklyJobs {
    private messageHelper: MessageHelper

    constructor(messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
    }
    runJobs() {
        this.awardWeeklyChips()
        this.checkPoletHours()
        this.resetStatuses()
        this.deleteOldCountdowns()
        // this.logEvent()
    }
    private async awardWeeklyChips() {
        const brukere = await DatabaseHelper.getAllUsers()
        Object.keys(brukere).forEach((userID: string) => {
            const currUser = DatabaseHelper.getUser(userID)
            currUser.chips += 1000
            DatabaseHelper.updateUser(currUser)
        })
    }
    private async checkPoletHours() {
        const data = await PoletCommands.fetchPoletData(undefined, '116')
        const dates = data.openingHours.exceptionHours.filter((eh) => {
            const now = moment()
            const input = moment(eh.date)
            return now.isoWeek() == input.isoWeek()
        })
        if (data && data?.openingHours?.exceptionHours?.length > 0) {
            const fmMessage = new EmbedBuilder()
                .setTitle(`Det er endrede åpningstider på polet denne ${!!dates.length ? 'uken' : 'måneden'}`)
                .setDescription(`Bruker ${data.storeName} (${data.address.postalCode}, ${data.address.city}) som utgangspunkt`)

            data.openingHours.exceptionHours.forEach((h, index) => {
                const dateName = moment(h?.date).format('dddd')

                let message = ''
                if (h.openingTime && h.closingTime) {
                    message = `Det er forkortet åpningstid. Det er åpent mellom ${h.openingTime} - ${h.closingTime}`
                } else {
                    message = h?.message ? h.message : 'Ingen forklaring'
                }
                fmMessage.addFields({
                    name: dateName ? `${dateName} (${h?.date})` : 'Ukjent dag',
                    value: `${message}`,
                })
            })

            this.messageHelper.sendFormattedMessage(MentionUtils.CHANNEL_IDs.VINMONOPOLET, fmMessage)
        }
    }
    private async resetStatuses() {
        DatabaseHelper.deleteSpecificPrefixValues('status')
    }

    private async deleteOldCountdowns() {
        const countdowns = DatabaseHelper.getStorage().countdown
        countdowns.allCountdowns = countdowns.allCountdowns.filter((c) => !DateUtils.dateHasPassed(c.date))
        DatabaseHelper.updateStorage({ countdown: countdowns })
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.ACTION_LOG, `Ukentlige jobber kjørte ${todaysTime} (NAV-penger)`)
        console.log(`Weekly jobs ran at ${todaysTime}`)
    }
}
