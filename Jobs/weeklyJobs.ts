import { MessageEmbed } from 'discord.js'
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
        this.awardWeeklyCoins()
        this.checkPoletHours()
        // this.logEvent()
    }
    private async awardWeeklyCoins() {
        const brukere = await DatabaseHelper.getAllUsers()
        Object.keys(brukere).forEach((userID: string) => {
            const currUser = DatabaseHelper.getUser(userID)
            currUser.chips += 1000
            DatabaseHelper.updateUser(currUser)
        })
    }
    private async checkPoletHours() {
        const data = await PoletCommands.fetchPoletData(undefined, '416')
        if (data && data?.openingHours?.exceptionHours?.length > 0) {
            const fmMessage = new MessageEmbed()
                .setTitle(`Det er endrede åpningstider på polet denne uken `)
                .setDescription(`Bruker ${data.storeName} (${data.address.postalCode}, ${data.address.city}) som utgangspunkt`)
            data.openingHours.exceptionHours.forEach((h) => fmMessage.addField(h.dayOfTheWeek, h.closed ? 'Stengt' : `${h.openingTime} - ${h.closingTime}\n`))
            this.messageHelper.sendFormattedMessage(MessageUtils.CHANNEL_IDs.VINMONOPOLET, fmMessage)
        }
    }
    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        this.messageHelper.sendMessage('810832760364859432', `Ukentlige jobber kjørte ${todaysTime} (NAV-penger)`)
        console.log(`Weekly jobs ran at ${todaysTime}`)
    }
}
