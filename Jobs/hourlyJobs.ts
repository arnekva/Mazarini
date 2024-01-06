import { MazariniClient } from '../client/MazariniClient'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds } from '../utils/mentionUtils'

export class HourJob {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }
    async runJobs() {
        await this.checkForUpcomingRLTournaments()
        await this.sendScheduledMessage()
    }

    private async checkForUpcomingRLTournaments() {
        const storage = await this.client.db.getStorage()
        const tournaments = storage?.rocketLeagueTournaments
        if (tournaments) {
            const nextTournaments = tournaments.filter((t) => new Date(t.starts).getHours() === new Date().getHours() + 1 && t.shouldNotify)

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
        let shceduledMessages = (await this.client.db.getStorage())?.scheduledMessages
        if (shceduledMessages) {
            const messagesToSend = shceduledMessages.filter((msg) => {
                const date = new Date(msg.dateToSendOn * 1000)
                const today = new Date()
                const dateMatches = date.getDay() === today.getDay() && date.getMonth() === today.getMonth()
                const timeMatches = date.getHours() === today.getHours()
                return dateMatches && timeMatches
            })
            messagesToSend.forEach((msg) => {
                this.messageHelper.sendMessage(msg.channelId, { text: msg.message })
                shceduledMessages = ArrayUtils.removeItemOnce(shceduledMessages, msg)
            })
            this.client.db.updateStorage({ scheduledMessages: shceduledMessages })
        }
    }
}
