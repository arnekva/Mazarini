import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { IInteractionElement } from '../../interfaces/interactionInterface'
import { RandomUtils } from '../../utils/randomUtils'

const spinMinutes: RandomUtils.WeightedItem[] = [
    {
        value: 0,
        weight: 38.39,
    },
    {
        value: 1,
        weight: 23.73,
    },
    {
        value: 2,
        weight: 14.66,
    },
    {
        value: 3,
        weight: 9.06,
    },
    {
        value: 4,
        weight: 5.6,
    },
    {
        value: 5,
        weight: 3.46,
    },
    {
        value: 6,
        weight: 2.14,
    },
    {
        value: 7,
        weight: 1.3,
    },
    {
        value: 8,
        weight: 0.82,
    },
    {
        value: 9,
        weight: 0.51,
    },
    {
        value: 10,
        weight: 0.31,
    },
]

export class Spinner extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async spinFromInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
        const min = RandomUtils.chooseWeightedItem(spinMinutes)
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
                    if (user.dailySpinRewards === 10) text = `\nDu har nå brukt opp dagens spinn\n`
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
            case 2:
                return 50
            case 3:
                return 100
            case 4:
                return 200
            case 5:
                return 400
            case 6:
                return 800
            case 7:
                return 1600
            case 8:
                return 3200
            case 9:
                return 6400
            case 10:
                if (seconds === 59) return 30000
                return 12800

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
