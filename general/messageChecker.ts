import { Message } from 'discord.js'
import { MazariniClient } from '../client/MazariniClient'
import { HelgHelper } from '../helpers/helgHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils } from '../utils/dateUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { MessageUtils } from '../utils/messageUtils'
import { MiscUtils } from '../utils/miscUtils'

export class MessageChecker {
    private client: MazariniClient
    polseRegex = new RegExp(/(p)(ø|ö|y|e|o|a|u|i|ô|ò|ó|â|ê|å|æ|ê|è|é|à|á)*(ls)(e|a|å|o|i)|(pause)|(🌭)|(hotdog)|(sausage)|(hot-dog)/gi)
    helgeRegex = new RegExp(/(helg|Helg|hælj|hælg)(å|en|ene|a|e|æ)*|(weekend)/gi)

    emojiRegex = new RegExp(/<:(\S+):(\d+)>/gi)

    constructor(client: MazariniClient) {
        this.client = client
    }

    /** Checks for pølse, eivindpride etc. */
    async checkMessageForJokes(message: Message) {
        if (!this.client.lockHandler.checkIfLockedPath(message)) {
            if (message.id === '802945796457758760') return

            let matches
            let polseCounter = 0
            this.polseRegex.lastIndex = 0
            while ((matches = this.polseRegex.exec(message.content))) {
                if (matches) {
                    polseCounter++
                }
            }
            const hasHelg = this.helgeRegex.test(message.content)
            this.helgeRegex.lastIndex = 0

            if (hasHelg) {
                const val = await HelgHelper.checkForHelg(undefined, this.client)
                this.client.messageHelper.sendMessage(message.channelId, { text: val }, { sendAsSilent: true })
            }
            const matchedCountdowns = this.client.storageCache.countdown?.allCountdowns?.filter((c) => {
                const regex = new RegExp('(' + c.tags.join(')|(') + ')')
                return regex.test(message.content)
            })
            if (matchedCountdowns) {
                matchedCountdowns.forEach((c) => {
                    //TODO: Send tid igjen til countdown er ferdig
                })
            }

            if (message.attachments) {
                if (this.polseRegex.exec(message.attachments.first()?.name ?? '')) polseCounter++
            }

            if (polseCounter > 0)
                this.client.messageHelper.sendMessage(
                    message.channelId,
                    { text: 'Hæ, ' + (polseCounter > 1 ? polseCounter + ' ' : '') + 'pølse' + (polseCounter > 1 ? 'r' : '') + '?' },
                    { sendAsSilent: true }
                )

            //If eivind, eivindpride him
            if (message.author.id == '239154365443604480' && message.guild) {
                const react = message.guild.emojis.cache.find((emoji) => emoji.name == (DateUtils.isDecember() ? 'eivindclausepride' : 'eivindpride'))
                //check for 10% chance of eivindpriding
                if (MiscUtils.doesThisMessageNeedAnEivindPride(message.content, polseCounter) && react) message.react(react)
            }

            //TODO: Refactor this
            if (message.author.id == '733320780707790898' && message.guild) {
                this.applyJoiijJokes(message)
            }
            const idJoke = MessageUtils.doesMessageIdHaveCoolNumber(message)
            if (idJoke == '1337') {
                this.client.messageHelper.replyToMessage(message, 'nice, id-en te meldingen din inneholde 1337. Gz, du har vonne 1.000 chips', {
                    sendAsSilent: true,
                })

                const user = await this.client.db.getUser(message.author.id)
                user.chips += 1000
                this.client.db.updateUser(user)
            }
        }
    }

    applyJoiijJokes(message: Message) {
        //"733320780707790898" joiij
        const numbers = MessageUtils.doesMessageContainNumber(message)
        const kekw = message.client.emojis.cache.find((emoji) => emoji.name == 'kekw_animated')
        let arg1
        let arg2

        if (numbers.length == 1) {
            arg1 = numbers[0]
            arg2 = numbers[0] * 5
        } else if (numbers.length == 2) {
            arg1 = numbers[0] + '-' + numbers[1]
            arg2 = numbers[0] * 5 + '-' + numbers[1] * 5
        }
        const responses = [
            'hahaha, du meine ' + arg2 + ', sant?',
            arg2 + '*',
            'det va vel litt vel ambisiøst.. ' + arg2 + ' hørres mer rett ud',
            'hmm... ' + arg1 + ' ...føle eg har hørt den før 🤔',
            arg1 + ' ja.. me lyge vel alle litt på CVen, hæ?',
            arg1 + ' e det løgnaste eg har hørt',
            arg1 + '? Komman Joiij, alle vett du meine ' + arg2,
            `vedde hundre kroner på at du egentlig meine ${arg2}`,
            `https://tenor.com/view/donald-trump-fake-news-gif-11382583`,
        ]
        if (numbers.length > 0 && numbers.length < 3) {
            message.react(kekw ?? '😂')
            this.client.messageHelper.replyToMessage(message, ArrayUtils.randomChoiceFromArray(responses))
        }
        if (message.mentions.roles.find((e) => e.id === MentionUtils.ROLE_IDs.WARZONE)) {
            message.react(kekw ?? '😂')
            this.client.messageHelper.replyToMessage(message, 'lol')
        }
    }
}
