import { MessageHelper } from '../helpers/messageHelper'
import { MessageUtils } from '../utils/messageUtils'

type dayJobs = 'friday' | 'none'
export class DayJob {
    private messageHelper: MessageHelper
    private day: dayJobs = 'none'
    constructor(messageHelper: MessageHelper, day: dayJobs) {
        this.messageHelper = messageHelper
        this.day = day
    }
    runJobs() {
        if (this.day === 'friday') {
            this.itsWeekend()
        }
        // this.logEvent()
    }

    private itsWeekend() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.GENERAL, `Det e helg!`)
        console.log(`Sendte melding til General om helg. ${todaysTime}`)
    }
    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage('810832760364859432', `Dag-job for ${this.day} kjørte ${todaysTime} `)
    }
}
