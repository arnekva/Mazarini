import { EmbedBuilder } from '@discordjs/builders'
import moment from 'moment'
import { PoletCommands } from '../commands/poletCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MessageUtils } from '../utils/messageUtils'

export class WeeklyJobs {
    private messageHelper: MessageHelper

    constructor(messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
    }
    runJobs() {
        this.awardWeeklyChips()
        this.checkPoletHours()
        this.resetStatuses()
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

            this.messageHelper.sendFormattedMessage(MessageUtils.CHANNEL_IDs.VINMONOPOLET, fmMessage)
        }
    }
    private async resetStatuses() {
        DatabaseHelper.deleteSpecificPrefixValues('status')
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage('810832760364859432', `Ukentlige jobber kjørte ${todaysTime} (NAV-penger)`)
        console.log(`Weekly jobs ran at ${todaysTime}`)
    }
}
