import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { IInteractionElement } from '../../interfaces/interactionInterface'
import { RandomUtils } from '../../utils/randomUtils'

import { GameValues } from '../../general/values'
const spinMinutes: RandomUtils.WeightedItem[] = GameValues.spinner.spinWeights

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

            this.messageHelper.replyToInteraction(interaction, text)
        }
    }

    //TODO: Revert back to this with new loot series
    private getSpinnerWinnings(min: number, seconds: number) {
        if (min === 10 && seconds === 59) {
            return GameValues.spinner.rewards['10.59']
        }
        return GameValues.spinner.rewards[min]
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'spin',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            return this.messageHelper.replyToInteraction(interaction, 'Åpne lykkehjulet heller du')
                            // this.spinFromInteraction(interaction)
                        },
                    },
                ],
            },
        }
    }
}
