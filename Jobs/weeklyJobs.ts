import { EmbedBuilder } from 'discord.js'
import moment from 'moment'
import { MazariniClient } from '../client/MazariniClient'
import { PoletCommands } from '../commands/poletCommands'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'

export class WeeklyJobs {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }
    runJobs() {
        this.awardWeeklyChips()
        this.checkPoletHours()
        this.resetStatuses()
        this.deleteOldCountdowns()
        // this.logEvent()
    }
    private async awardWeeklyChips() {
        const brukere = await this.client.db.getAllUsers()
        brukere.forEach((user) => {
            if (user.chips) {
                user.chips += 1500
                this.client.db.updateUser(user)
            }
        })
    }
    private async checkPoletHours() {
        const data = await PoletCommands.fetchPoletData('116')
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

            this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.VINMONOPOLET, { embed: fmMessage })
        }
    }
    private async resetStatuses() {
        this.client.db.deleteSpecificPrefixValues('status')
    }

    private async deleteOldCountdowns() {
        const storage = await this.client.db.getStorage()
        const countdowns = storage?.countdown
        if (countdowns) {
            countdowns.allCountdowns = countdowns.allCountdowns.filter((c) => !DateUtils.dateHasPassed(c.date))
            this.client.db.updateStorage({ countdown: countdowns })
        }
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.ACTION_LOG, { text: `Ukentlige jobber kjørte ${todaysTime} (NAV-penger)` })
        console.log(`Weekly jobs ran at ${todaysTime}`)
    }
}
