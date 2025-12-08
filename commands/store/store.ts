import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'

export class Store extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }
    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'store',
                        command: (rawInteraction: ChatInteraction) => {},
                    },
                ],
            },
        }
    }
}
