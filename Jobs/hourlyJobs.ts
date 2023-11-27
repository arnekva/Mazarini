import { MazariniClient } from '../client/MazariniClient'
import { MessageHelper } from '../helpers/messageHelper'
import { MentionUtils } from '../utils/mentionUtils'

export class HourJob {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }
    runJobs() {
        this.checkForRLTournaments()
    }

    private async checkForRLTournaments() {
        const storage = await this.client.db.getStorage()
        const tournaments = storage?.rocketLeagueTournaments
        if (tournaments) {
            const nextTournaments = tournaments.filter((t) => new Date(t.starts).getHours() === new Date().getHours() + 1 && t.shouldNotify)

            if (nextTournaments.length > 0) {
                let message = `Det er ${nextTournaments.length} turnering${nextTournaments.length > 1 ? 'er' : ''} om 1 time`
                nextTournaments.forEach((t) => {
                    message += `\n${t.players}v${t.players} - ${t.mode}`
                })
                this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.ROCKET_LEAGUE, { text: `${message}` })
            }
        }
    }
}
