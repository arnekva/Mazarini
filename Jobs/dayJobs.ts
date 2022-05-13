import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
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
        this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.GENERAL, `${ArrayUtils.randomChoiceFromArray(this.getHelgMessage())}`)
        console.log(`Sendte melding til General om helg. ${todaysTime}`)
    }
    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage('810832760364859432', `Dag-job for ${this.day} kjørte ${todaysTime} `)
    }

    private getHelgMessage() {
        return [
            'Aellen, det e helg gutta',
            'Det e mådderfåkkings heeeeelg',
            'HEEEEEEEEEEEEEEEEEEEEEEEEELG',
            'Komma dokk hjem folkens, det e helg',
            'omw dirr hjem for å krækka åpen a cold one, det e helg boys',
            'ud å fyra elle? Ejo helg',
            'Helg folkens. Skru av maskinane og komma seg hjem asap',
        ]
    }
}
