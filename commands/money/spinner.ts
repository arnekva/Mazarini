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
        const user = await this.client.database.getUser(interaction.user.id)
        if (user.dailySpins === undefined) user.dailySpins = 1
        // user.dailySpins = 1
        const canWinMore = user.dailySpins && user.dailySpins > 0

        if (!canWinMore) {
            this.messageHelper.replyToInteraction(interaction, 'Du har allerede brukt opp dagens spinn.')
        } else {
            const tenRandomSpins: { min: number; sec: number }[] = []
            const amountOfSpins = 10
            for (let i = 0; i < amountOfSpins; i++) {
                //Can probably just remove 0 and 1 from table at some point
                let num = RandomUtils.chooseWeightedItem(spinMinutes)
                while (num < 2) num = RandomUtils.chooseWeightedItem(spinMinutes)
                tenRandomSpins.push({
                    min: num,
                    sec: RandomUtils.getRandomInteger(0, 59),
                })
            }

            let text = ``
            let winnings = 0
            tenRandomSpins.forEach((spin, index) => {
                const currWinning = this.getSpinnerWinnings(spin.min, spin.sec) + spin.sec * 2
                winnings += currWinning
                text += `*Spinn ${index + 1}*: ${spin.min} minutt og ${spin.sec} sekund - ${currWinning} chips.\n`
            })
            if (winnings > 0) {
                user.dailySpins-- //This will be updated by giveMoney below
                winnings = this.client.bank.giveMoney(user, winnings)
                text += winnings > 0 && canWinMore ? `\nDu får ${winnings} chips.` : ''
            }

            this.messageHelper.replyToInteraction(interaction, text, { ephemeral: true })
        }
    }

    //TODO: Revert back to this with new loot series
    private getSpinnerWinnings(min: number, seconds: number) {
        switch (min) {
            case 2:
                return 50
            case 3:
                return 125
            case 4:
                return 250
            case 5:
                return 500
            case 6:
                return 800
            case 7:
                return 1600
            case 8:
                return 3000
            case 9:
                return 6000
            case 10:
                if (seconds === 59) return 30000
                return 12000
            default:
                return 0
        }
    }
    private getSpinnerWinningsBuffed(min: number, seconds: number) {
        switch (min) {
            case 2:
                return 250
            case 3:
                return 450
            case 4:
                return 650
            case 5:
                return 1150
            case 6:
                return 1750
            case 7:
                return 3600
            case 8:
                return 6000
            case 9:
                return 8000
            case 10:
                if (seconds === 59) return 30000
                return 12000
            default:
                return 0
        }
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
