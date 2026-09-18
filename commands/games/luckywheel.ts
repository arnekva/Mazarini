import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { IInteractionElement } from '../../interfaces/interactionInterface'

export class LuckyWheel extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'luckywheel',
                        command: (interaction: ChatInteraction) => {
                            this.messageHelper.replyToInteraction(interaction, 'Denne er nå flyttet til /daily')
                        },
                    },
                ],
            },
        }
    }
}
