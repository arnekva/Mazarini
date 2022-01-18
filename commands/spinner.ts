import { Message } from 'discord.js'
import { Channel, Client, DMChannel, NewsChannel, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { AchievementHelper } from '../helpers/achievementHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { getWeekNumber } from '../utils/dateUtils'
import { getRandomPercentage } from '../utils/randomUtils'
import { escapeString } from '../utils/textUtils'
import { Achievements } from './achievements'
import { ICommandElement } from './commands'

const weightedRandomObject = require('weighted-random-object')

const spinMinutes = [
    {
        number: '0',
        weight: 40,
    },
    {
        number: '1',
        weight: 30,
    },
    {
        number: '2',
        weight: 10,
    },
    {
        number: '3',
        weight: 4,
    },
    {
        number: '4',
        weight: 3,
    },
    {
        number: '5',
        weight: 2,
    },
    {
        number: '6',
        weight: 1,
    },
    {
        number: '7',
        weight: 0.5,
    },
    {
        number: '8',
        weight: 0.5,
    },
    {
        number: '9',
        weight: 0.09,
    },
    {
        number: '10',
        weight: 0.005,
    },
]

export class Spinner extends AbstractCommands {
    constructor(client: Client) {
        super(client)
    }
    static spin(message: Message) {
        const min = weightedRandomObject(spinMinutes).number
        const sec = Math.floor(Math.random() * 60)
        const cleanUsername = escapeString(message.author.username)

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
            MessageHelper.sendMessage(
                message,
                message.author.username + ' spant fidget spinneren sin i ' + min + ' minutt og ' + sec + ' sekund!' + ` ${winningsText}`
            )
            if (min == 0 && sec == 0) {
                DatabaseHelper.incrementValue('chips', message.author.username, '500')
                MessageHelper.sendMessage(message, 'Oj, 00:00? Du får 500 chips i trøstepremie')
                setTimeout(function () {
                    DatabaseHelper.decrementValue('chips', message.author.username, '600')
                    const kekw = EmojiHelper.getEmoji('kekwhoie_animated', message).then((em) => {
                        MessageHelper.sendMessage(
                            message,
                            'hahaha trodde du på meg? Du suge ' + '<@' + message.author.id + '>' + ', du muste 100 chips i stedet ' + em.id
                        )
                    })
                }, 10000)
            } else if (min == 10 && sec == 59) {
                MessageHelper.sendMessage(message, 'gz med 10:59 bro')
                DatabaseHelper.incrementValue('chips', message.author.username, '375000000')
                MessageHelper.sendMessage(message, 'Du får 375 000 000 chips for det der mannen')
            }
            const formatedScore = Spinner.formatScore(min + sec)

            Spinner.compareScore(message, formatedScore)
            Spinner.incrementCounter(message)
        }
    }

    static getSpinnerWinnings(min: number) {
        switch (min) {
            case 5:
                return 500
            case 6:
                return 2500
            case 7:
                return 12500
            case 8:
                return 110000
            case 9:
                return 550000
            case 10:
                return 65750001
            default:
                return 0
        }
    }

    static async incrementCounter(message: Message) {
        // const currentVal = DatabaseHelper.getValue("counterSpin", message.author.username, () => { });
        const currentTotalspin = DatabaseHelper.getValue('counterSpin', message.author.username, message)
        if (currentTotalspin) {
            try {
                let cur = parseInt(currentTotalspin)
                cur = cur += 1
                AchievementHelper.awardSpinningAch(message.author.username, cur.toString(), message)

                DatabaseHelper.setValue('counterSpin', message.author.username, cur.toString())
            } catch (error) {
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            }
        }
    }

    static async compareScore(message: Message, newScore: string) {
        const val = DatabaseHelper.getValue('spin', message.author.username, message)
        if (parseInt(val) < parseInt(newScore)) {
            DatabaseHelper.setValue('spin', message.author.username, newScore)
        }
    }

    static formatScore(score: string) {
        if (score.charAt(0) + score.charAt(1) == '10' && score.length == 3) return '100' + score.charAt(2)
        return score.length === 2 ? score.charAt(0) + '0' + score.charAt(1) : score
    }

    static async listSpinCounter(message: Message) {
        const val = DatabaseHelper.getAllValuesFromPrefix('counterSpin', message)
        ArrayUtils.sortUserValuePairArray(val)
        const printList = ArrayUtils.makeValuePairIntoOneString(val, undefined, 'Total antall spins')
        MessageHelper.sendMessage(message, printList)
    }

    static formatValue(val: string) {
        if (val.length == 2) return `0${val.charAt(0)}:0${val.charAt(1)}`

        if (val.length == 3) return `0${val.charAt(0)}:${val.charAt(1)}${val.charAt(2)}`
        if (val.length == 4) return `${val.charAt(0)}${val.charAt(1)}:${val.charAt(2)}${val.charAt(3)}`
        return 'Ugyldig verdi'
    }

    static async addSpinnerRole(message: Message) {
        if (message.guild == null || message.member == null) {
            return
        }
        const role = await message.guild.roles.fetch('823504322213838888')

        if (role) {
            message.member.roles.add(role)
        }
    }

    static updateATH() {
        DatabaseHelper.compareAndUpdateValue('ATHspin', 'spin')
    }

    static async allTimeHigh(message: Message) {
        Spinner.updateATH()
        const val = DatabaseHelper.getAllValuesFromPrefix('ATHspin', message)
        ArrayUtils.sortUserValuePairArray(val)
        const printList = ArrayUtils.makeValuePairIntoOneString(val, Spinner.formatValue)
        MessageHelper.sendMessage(message, printList)
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'ATH',
                description: 'Printer hver person sin beste spin!',
                command: (rawMessage: Message, messageContent: string) => {
                    Spinner.allTimeHigh(rawMessage)
                },
                category: 'spin',
            },
            {
                commandName: 'spin',
                description:
                    'Spin fidgetspinneren. Beste tid per bruker registreres i databasen. Tallene er tilfeldige, men vektet. Du vinner chips hvis du spinner mer enn 5 minutter. (Høyeste gevinst er 100.000.000 chips for 10 min) ',
                command: (rawMessage: Message, messageContent: string) => {
                    Spinner.spin(rawMessage)
                },
                category: 'spin',
            },
            {
                commandName: 'totalspins',
                description: 'Antall spins per person',
                command: (rawMessage: Message, messageContent: string) => {
                    Spinner.listSpinCounter(rawMessage)
                },
                category: 'spin',
            },
        ]
    }
}
