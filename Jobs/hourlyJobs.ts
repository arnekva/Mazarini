import { MazariniClient } from '../client/MazariniClient'
import { MoreOrLess } from '../commands/games/moreOrLess'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds, MentionUtils } from '../utils/mentionUtils'

export class HourJob {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }
    /** Called every minute (see JobScheduler). Scheduled messages are checked each time - they're sent at the minute they were set for -
     * and everything else only on the hour. */
    async runJobs() {
        await this.sendScheduledMessage()
        const isTopOfHour = new Date().getMinutes() === 0
        if (isTopOfHour) {
            this.client.onTimedEvent('hourly')
            await this.checkForUpcomingRLTournaments()
            if (new Date().getHours() === 18) {
                await MoreOrLess.instance?.sendScheduledResults()
            }
        }
        // Daily events disabled
        // await this.client.mazariniEvents.activateDueEvents()
    }

    private async checkForUpcomingRLTournaments() {
        const storage = await this.client.database.getStorage()
        const tournaments = storage?.rocketLeagueTournaments?.tournaments
        if (tournaments) {
            // The hour (and day) it is one hour from now - not "this hour + 1", which is 24 at 23:00 and matches nothing.
            const inAnHour = new Date(Date.now() + 60 * 60 * 1000)
            const nextTournaments = tournaments.filter((t) => {
                const starts = new Date(t.starts)
                return starts.getHours() === inAnHour.getHours() && starts.getDate() === inAnHour.getDate() && t.shouldNotify
            })

            if (nextTournaments.length > 0) {
                const embed = EmbedUtils.createSimpleEmbed(
                    `🚗 Rocket League Turnering ⚽`,
                    ` Det er ${nextTournaments.length} turnering${nextTournaments.length > 1 ? 'er' : ''} om 1 time`
                )
                nextTournaments.forEach((t) => {
                    embed.addFields({ name: `${t.players}v${t.players}`, value: `${t.mode}` })
                })
                this.messageHelper.sendMessage(ChannelIds.ROCKET_LEAGUE, { embed: embed })
            }
        }
    }

    private async sendScheduledMessage() {
        let shceduledMessages = (await this.client.database.getStorage())?.scheduledMessages
        if (shceduledMessages) {
            const messagesToSend = shceduledMessages.filter((msg) => {
                const date = new Date(msg.dateToSendOn * 1000)
                const today = new Date()
                // getDate() is the day of the month; getDay() (which this used) is the weekday, and sent the message on the first
                // matching weekday of the month instead.
                const dateMatches = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
                const timeMatches = date.getHours() === today.getHours() && date.getMinutes() === today.getMinutes()
                return dateMatches && timeMatches
            })
            if (messagesToSend.length === 0) return
            messagesToSend.forEach((msg) => {
                this.messageHelper.sendMessage(msg.channelId, { text: msg.message })
                this.messageHelper.sendLogMessage(`En planlagt melding ble sendt til ${MentionUtils.mentionChannel(msg.channelId)}`)
                shceduledMessages = ArrayUtils.removeItemOnce(shceduledMessages, msg)
            })
            await this.client.database.updateStorage({ scheduledMessages: shceduledMessages })
        }
    }
}
