import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
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

    private spinFromInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        const min = weightedRandomObject(spinMinutes).number
        const sec = RandomUtils.getRndInteger(0, 60)

        const winnings = this.getSpinnerWinnings(Number(min), Number(sec))
        if (winnings > 0) {
            user.chips += winnings
        }
        const winningsText = winnings > 0 ? `Du får ${winnings} chips.` : ''
        this.messageHelper.replyToInteraction(
            interaction,
            interaction.user.username + ' spant fidget spinneren sin i ' + min + ' minutt og ' + sec + ' sekund!' + ` ${winningsText}`
        )

        if (min == 10 && sec == 59) {
            this.messageHelper.sendMessage(interaction?.channelId, 'gz med 10:59 bro')
            user.chips += 975000000

            this.messageHelper.sendMessage(interaction?.channelId, 'Du får 975 000 000 chips for det der mannen')
        } else if (min == 10) {
            this.messageHelper.sendMessage(interaction?.channelId, 'gz med 10 min bro')
            user.chips += 95000000

            this.messageHelper.sendMessage(interaction?.channelId, 'Du får 95 000 000 chips for det der mannen')
        }

        DatabaseHelper.updateUser(user)

        this.incrementCounter(interaction.user.id)
    }

    private getSpinnerWinnings(min: number, seconds: number) {
        switch (min) {
            case 5:
                return 75
            case 6:
                return 250
            case 7:
                return 1250
            case 8:
                return 5500
            case 9:
                return 150000
            case 10:
                if (seconds === 59) return 750000000
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

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'spin',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.spinFromInteraction(interaction)
                        },
                    },
                ],
            },
        }
    }
}
