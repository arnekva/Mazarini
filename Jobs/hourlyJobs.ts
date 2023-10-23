import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MentionUtils } from '../utils/mentionUtils'

export class HourJob {
    private messageHelper: MessageHelper

    constructor(messageHelper: MessageHelper) {
        this.messageHelper = messageHelper
    }
    runJobs() {
        this.checkForRLTournaments()
    }

    private checkForRLTournaments() {
        const tournaments = DatabaseHelper.getStorage().rocketLeagueTournaments
        if (tournaments) {
            const nextTournaments = tournaments.filter((t) => new Date(t.starts).getHours() === new Date().getHours() + 1 && t.shouldNotify)

            if (nextTournaments.length > 0) {
                let message = `Det er ${nextTournaments.length} turnering${nextTournaments.length > 1 ? 'er' : ''} om 1 time`
                nextTournaments.forEach((t) => {
                    message += `\n${t.players}v${t.players} - ${t.mode}`
                })
                this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.ROCKET_LEAGUE, `${message}`)
            }
        }
    }
}
