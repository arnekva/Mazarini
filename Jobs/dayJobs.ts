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
            'Heeeeelg',
            'HEEEEEEEEEEEELG',
            'Komma dokk hjem folkens, det e helg',
            'Ekje lenge te helg nå folkens. Faktisk så det e nå',
            'Helg folkens. Skru av maskinane og komma seg hjem asap',
            'Någen så e down for et glass rødt? Ejo helg nå',
        ]
    }
}
