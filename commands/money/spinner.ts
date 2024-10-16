import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { IInteractionElement } from '../../interfaces/interactionInterface'
import { RandomUtils } from '../../utils/randomUtils'

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
    constructor(client: MazariniClient) {
        super(client)
    }

    private async spinFromInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
        const min = weightedRandomObject(spinMinutes).number
        const sec = RandomUtils.getRandomInteger(0, 59)

        let winnings = this.getSpinnerWinnings(Number(min), Number(sec))
        let text = ``
        if (winnings > 0) {
            const user = await this.client.database.getUser(interaction.user.id)
            const canWinMore = !user.dailySpinRewards || user.dailySpinRewards < 10
            if (canWinMore) {
                if (!user.dailySpinRewards) user.dailySpinRewards = 1
                else {
                    user.dailySpinRewards++ //This will be updated by giveMoney below
                    if (user.dailySpinRewards === 10) text = `Du har nå brukt opp dagens spinn`
                }
                winnings = this.client.bank.giveMoney(user, winnings)
                text += winnings > 0 && canWinMore ? `Du får ${winnings} chips.` : ''
            }
        }
        const secMsg = sec > 0 ? ' og ' + sec + ' sekund!' : '!'
        this.messageHelper.replyToInteraction(interaction, interaction.user.username + ' spant fidget spinneren sin i ' + min + ' minutt' + secMsg + ` ${text}`)

        if (min == 10 && sec == 59) {
            this.messageHelper.sendMessage(interaction?.channelId, { text: 'gz med 10:59 bro' })
        } else if (min == 10) {
            this.messageHelper.sendMessage(interaction?.channelId, { text: 'gz med 10 min bro' })
        }
    }

    private getSpinnerWinnings(min: number, seconds: number) {
        switch (min) {
            case 4:
                return 50
            case 5:
                return 100
            case 6:
                return 300
            case 7:
                return 700
            case 8:
                return 1250
            case 9:
                return 5000
            case 10:
                if (seconds === 59) return 40000
                return 20000

            default:
                return 0
        }
    }

    private async incrementCounter(userID: string) {
        const user = await this.client.database.getUser(userID)
        user.spinCounter++
        this.client.database.updateUser(user)
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
