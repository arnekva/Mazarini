import { EmbedBuilder } from 'discord.js'
import moment from 'moment'
import { MazariniClient } from '../client/MazariniClient'
import { PoletCommands } from '../commands/drinks/poletCommands'
import { EmojiHelper, JobStatus } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds } from '../utils/mentionUtils'

export class WeeklyJobs {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }
    async runJobs() {
        const embed = EmbedUtils.createSimpleEmbed(`Weekly Jobs`, `Kjører 4 jobber`)
        const weeklyPayout = await this.awardWeeklyChips()
        embed.addFields({ name: 'NAV-Penger', value: EmojiHelper.getStatusEmoji(weeklyPayout) })
        const polet = await this.checkPoletHours()
        embed.addFields({ name: 'Polet status', value: EmojiHelper.getStatusEmoji(polet) })
        const statusReset = await this.resetStatuses()
        embed.addFields({ name: 'Status reset', value: EmojiHelper.getStatusEmoji(statusReset) })
        const deleteOldCountdowns = await this.deleteOldCountdowns()
        embed.addFields({ name: 'Countdown sletting', value: EmojiHelper.getStatusEmoji(deleteOldCountdowns) })
        const todaysTime = new Date().toLocaleTimeString()
        embed.setFooter({ text: todaysTime })
        this.messageHelper.sendMessage(ChannelIds.ACTION_LOG, { embed: embed })
    }
    private async awardWeeklyChips(): Promise<JobStatus> {
        const brukere = await this.client.database.getAllUsers()
        let status: JobStatus = 'not sendt'
        if (!brukere) status = 'failed'
        brukere.forEach((user) => {
            if (user.chips !== undefined) {
                user.chips += 1500
                this.client.database.updateUser(user)
                status = 'success'
            }
        })
        return status
    }

    private async checkPoletHours(): Promise<JobStatus> {
        const data = await PoletCommands.fetchPoletData('116')
        const dates = data.openingHours.exceptionHours.filter((eh) => {
            const now = moment()
            const input = moment(eh.date)
            return now.isoWeek() == input.isoWeek()
        })
        if (!data) return 'failed'
        if (data && data?.openingHours?.exceptionHours?.length > 0) {
            const fmMessage = new EmbedBuilder()
                .setTitle(`Det er endrede åpningstider på polet denne ${dates.length ? 'uken' : 'måneden'}`)
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

            this.messageHelper.sendMessage(ChannelIds.VINMONOPOLET, { embed: fmMessage })
            return 'success'
        }
        return 'not sendt'
    }
    private async resetStatuses(): Promise<JobStatus> {
        await this.client.database.deleteSpecificPrefixValues('status')
        return 'success'
    }

    private async deleteOldCountdowns(): Promise<JobStatus> {
        const storage = await this.client.database.getStorage()
        if (!storage) return 'failed'
        const countdowns = storage?.countdown
        let hasDeleted = false
        if (countdowns) {
            if (countdowns.allCountdowns.filter((c) => !DateUtils.dateHasPassed(c.date)).length > 0) hasDeleted = true
            countdowns.allCountdowns = countdowns.allCountdowns.filter((c) => !DateUtils.dateHasPassed(c.date))
            this.client.database.updateStorage({ countdown: countdowns })
        }
        return hasDeleted ? 'success' : 'not sendt'
    }
}
