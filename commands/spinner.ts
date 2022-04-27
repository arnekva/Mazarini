import { Client, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { AchievementHelper } from '../helpers/achievementHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { TextUtils } from '../utils/textUtils'

const weightedRandomObject = require('weighted-random-object')

const spinMinutes = [
    {
        number: '0',
        weight: 30,
    },
    {
        number: '1',
        weight: 30,
    },
    {
        number: '2',
        weight: 17,
    },
    {
        number: '3',
        weight: 7,
    },
    {
        number: '4',
        weight: 6,
    },
    {
        number: '5',
        weight: 5,
    },
    {
        number: '6',
        weight: 2.75,
    },
    {
        number: '7',
        weight: 1.3,
    },
    {
        number: '8',
        weight: 0.75,
    },
    {
        number: '9',
        weight: 0.11,
    },
    {
        number: '10',
        weight: 0.06,
    },
]

export class Spinner extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    private spin(message: Message) {
        const min = weightedRandomObject(spinMinutes).number
        const sec = Math.floor(Math.random() * 60)
        const cleanUsername = TextUtils.escapeString(message.author.username)

        if (cleanUsername.length < 2) {
            message.reply(
                'Det kan virke som om brukernavnet ditt inneholder for få lovlige tegn (' + cleanUsername + '). Dette må rettes opp i før du får spinne.'
            )
        } else {
            const winnings = this.getSpinnerWinnings(Number(min))
            if (winnings > 0) {
                DatabaseHelper.incrementValue('chips', message.author.username, winnings.toString())
            }
            const winningsText = winnings > 0 ? `Du får ${winnings} chips.` : ''
            this.messageHelper.sendMessage(
                message.channelId,
                message.author.username + ' spant fidget spinneren sin i ' + min + ' minutt og ' + sec + ' sekund!' + ` ${winningsText}`
            )
            if (min == 0 && sec == 0) {
                DatabaseHelper.incrementValue('chips', message.author.username, '500')
                const _msg = this.messageHelper
                this.messageHelper.sendMessage(message.channelId, 'Oj, 00:00? Du får 500 chips i trøstepremie')
                setTimeout(function () {
                    DatabaseHelper.decrementValue('chips', message.author.username, '600')

                    const kekw = EmojiHelper.getEmoji('kekwhoie_animated', message).then((em) => {
                        _msg.sendMessage(
                            message.channelId,
                            'hahaha trodde du på meg? Du suge ' + '<@' + message.author.id + '>' + ', du muste 100 chips i stedet ' + em.id
                        )
                    })
                }, 10000)
            } else if (min == 10 && sec == 59) {
                this.messageHelper.sendMessage(message.channelId, 'gz med 10:59 bro')
                DatabaseHelper.incrementValue('chips', message.author.username, '975000000')
                this.messageHelper.sendMessage(message.channelId, 'Du får 975 000 000 chips for det der mannen')
            } else if (min == 10) {
                this.messageHelper.sendMessage(message.channelId, 'gz med 10 min bro')
                DatabaseHelper.incrementValue('chips', message.author.username, '95000000')
                this.messageHelper.sendMessage(message.channelId, 'Du får 95 000 000 chips for det der mannen')
            }
            const formatedScore = this.formatScore(min + sec)

            this.compareScore(message, formatedScore)
            this.incrementCounter(message)
        }
    }

    private getSpinnerWinnings(min: number) {
        switch (min) {
            case 5:
                return 300
            case 6:
                return 900
            case 7:
                return 4500
            case 8:
                return 9000
            case 9:
                return 125000
            case 10:
                return 65750001
            default:
                return 0
        }
    }

    private async incrementCounter(message: Message) {
        // const currentVal = DatabaseHelper.getValue("counterSpin", message.author.username, () => { });
        const currentTotalspin = DatabaseHelper.getValue('counterSpin', message.author.username, message)
        if (currentTotalspin) {
            try {
                let cur = parseInt(currentTotalspin)
                cur = cur += 1
                AchievementHelper.awardSpinningAch(message.author.username, cur.toString(), message)

                DatabaseHelper.setValue('counterSpin', message.author.username, cur.toString())
            } catch (error) {
                this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            }
        }
    }

    private async compareScore(message: Message, newScore: string) {
        const val = DatabaseHelper.getValue('spin', message.author.username, message)
        if (parseInt(val) < parseInt(newScore)) {
            DatabaseHelper.setValue('spin', message.author.username, newScore)
        }
    }

    private formatScore(score: string) {
        if (score.charAt(0) + score.charAt(1) == '10' && score.length == 3) return '100' + score.charAt(2)
        return score.length === 2 ? score.charAt(0) + '0' + score.charAt(1) : score
    }

    private async listSpinCounter(message: Message) {
        const val = DatabaseHelper.getAllValuesFromPrefix('counterSpin')
        ArrayUtils.sortUserValuePairArray(val)
        const printList = ArrayUtils.makeValuePairIntoOneString(val, undefined, 'Total antall spins')
        this.messageHelper.sendMessage(message.channelId, printList)
    }

    private formatValue(val: string) {
        if (val.length == 2) return `0${val.charAt(0)}:0${val.charAt(1)}`

        if (val.length == 3) return `0${val.charAt(0)}:${val.charAt(1)}${val.charAt(2)}`
        if (val.length == 4) return `${val.charAt(0)}${val.charAt(1)}:${val.charAt(2)}${val.charAt(3)}`
        return 'Ugyldig verdi'
    }

    private updateATH() {
        DatabaseHelper.compareAndUpdateValue('ATHspin', 'spin')
    }

    private async allTimeHigh(message: Message) {
        this.updateATH()
        const val = DatabaseHelper.getAllValuesFromPrefix('ATHspin')
        ArrayUtils.sortUserValuePairArray(val)
        const printList = ArrayUtils.makeValuePairIntoOneString(val, this.formatValue)
        this.messageHelper.sendMessage(message.channelId, printList)
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'ATH',
                description: 'Printer hver person sin beste spin!',
                command: (rawMessage: Message, messageContent: string) => {
                    this.allTimeHigh(rawMessage)
                },
                category: 'spin',
            },
            {
                commandName: 'spin',
                description:
                    'Spin fidgetspinneren. Beste tid per bruker registreres i databasen. Tallene er tilfeldige, men vektet. Du vinner chips hvis du spinner mer enn 5 minutter. (Høyeste gevinst er 100.000.000 chips for 10 min) ',
                command: (rawMessage: Message, messageContent: string) => {
                    this.spin(rawMessage)
                },
                category: 'spin',
            },
            {
                commandName: 'totalspins',
                description: 'Antall spins per person',
                command: (rawMessage: Message, messageContent: string) => {
                    this.listSpinCounter(rawMessage)
                },
                category: 'spin',
            },
        ]
    }
}
