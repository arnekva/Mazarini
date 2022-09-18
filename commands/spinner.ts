import { CacheType, ChatInputCommandInteraction, Client, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { RandomUtils } from '../utils/randomUtils'

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
        const user = DatabaseHelper.getUser(message.author.id)
        const min = weightedRandomObject(spinMinutes).number
        const sec = RandomUtils.getRndInteger(0, 60)

        const winnings = this.getSpinnerWinnings(Number(min))
        if (winnings > 0) {
            user.chips += winnings
        }
        const winningsText = winnings > 0 ? `Du får ${winnings} chips.` : ''
        this.messageHelper.sendMessage(
            message.channelId,
            message.author.username + ' spant fidget spinneren sin i ' + min + ' minutt og ' + sec + ' sekund!' + ` ${winningsText}`
        )
        if (min == 10 && sec == 59) {
            this.messageHelper.sendMessage(message.channelId, 'gz med 10:59 bro')
            user.chips += 975000000

            this.messageHelper.sendMessage(message.channelId, 'Du får 975 000 000 chips for det der mannen')
        } else if (min == 10) {
            this.messageHelper.sendMessage(message.channelId, 'gz med 10 min bro')
            user.chips += 95000000

            this.messageHelper.sendMessage(message.channelId, 'Du får 95 000 000 chips for det der mannen')
        }

        DatabaseHelper.updateUser(user)
        // this.compareScore(message, formatedScore)
        this.incrementCounter(message.author.id)
    }
    private spinFromInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        const min = weightedRandomObject(spinMinutes).number
        const sec = RandomUtils.getRndInteger(0, 60)

        const winnings = this.getSpinnerWinnings(Number(min))
        if (winnings > 0) {
            user.chips += winnings
        }
        const winningsText = winnings > 0 ? `Du får ${winnings} chips.` : ''
        this.messageHelper.replyToInteraction(
            interaction,
            interaction.user.username + ' spant fidget spinneren sin i ' + min + ' minutt og ' + sec + ' sekund!' + ` ${winningsText}`
        )

        if (min == 10 && sec == 59) {
            this.messageHelper.sendMessage(interaction.channelId, 'gz med 10:59 bro')
            user.chips += 975000000

            this.messageHelper.sendMessage(interaction.channelId, 'Du får 975 000 000 chips for det der mannen')
        } else if (min == 10) {
            this.messageHelper.sendMessage(interaction.channelId, 'gz med 10 min bro')
            user.chips += 95000000

            this.messageHelper.sendMessage(interaction.channelId, 'Du får 95 000 000 chips for det der mannen')
        }

        DatabaseHelper.updateUser(user)

        this.incrementCounter(interaction.user.id)
    }

    private getSpinnerWinnings(min: number) {
        switch (min) {
            case 5:
                return 350
            case 6:
                return 925
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

    private async incrementCounter(userID: string) {
        const user = DatabaseHelper.getUser(userID)
        user.spinCounter++
        DatabaseHelper.updateUser(user)
    }

    private formatScore(score: string) {
        if (score.charAt(0) + score.charAt(1) == '10' && score.length == 3) return '100' + score.charAt(2)
        return score.length === 2 ? score.charAt(0) + '0' + score.charAt(1) : score
    }

    private async listSpinCounter(message: Message) {
        const val = DatabaseHelper.getAllUsers()
        let statuser = ''
        Object.keys(val).forEach((key) => {
            const user = DatabaseHelper.getUser(key)
            const spins = user?.spinCounter
            if (spins) statuser += `${user.displayName} ${user.spinCounter} \n `
        })
        statuser = statuser.trim() ? statuser : 'Ingen har satt statusen sin i dag'
        this.messageHelper.sendMessage(message.channelId, statuser)
    }

    private formatValue(val: string) {
        if (val.length == 2) return `0${val.charAt(0)}:0${val.charAt(1)}`

        if (val.length == 3) return `0${val.charAt(0)}:${val.charAt(1)}${val.charAt(2)}`
        if (val.length == 4) return `${val.charAt(0)}${val.charAt(1)}:${val.charAt(2)}${val.charAt(3)}`
        return 'Ugyldig verdi'
    }

    private updateATH() {
        // DatabaseHelper.compareAndUpdateValue('ATHspin', 'spin')
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'spin',
                description:
                    'Spin fidgetspinneren. Beste tid per bruker registreres i databasen. Tallene er tilfeldige, men vektet. Du vinner chips hvis du spinner mer enn 5 minutter. (Høyeste gevinst er 100.000.000 chips for 10 min) ',
                command: (rawMessage: Message, messageContent: string) => {
                    this.spin(rawMessage)
                },
                category: 'spin',
            },
        ]
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'spin',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.spinFromInteraction(interaction)
                },
                category: 'annet',
            },
        ]
    }
}
