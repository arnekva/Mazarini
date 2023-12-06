import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { ChannelIds } from '../utils/mentionUtils'

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
        this.messageHelper.sendMessage(ChannelIds.GENERAL, { text: `${ArrayUtils.randomChoiceFromArray(this.getHelgMessage())}` })
    }
    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        // this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.ACTION_LOG, `Dag-job for ${this.day} kjørte ${todaysTime} `)
    }

    private getHelgMessage() {
        return [
            'HEEEEEEEEEEEELG',
            'Aellen, det e helg gutta',
            'Någen så e down for et glass rødt? Ejo helg nå',
            'Aell, ud i quell? Ejo helg nå https://open.spotify.com/track/4xbxqbVMtEqTEwYrrNkArU?si=f6c96603113b4dfd',
            'Komma dokk hjem folkens, det e helg',
            'Sa någen helg? Ja, eg sa det for det e faenmeg helg nå',
            'Helg folkens. Skru av maskinane og komma seg hjem asap',
        ]
    }
}
