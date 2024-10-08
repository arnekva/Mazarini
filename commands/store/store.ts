import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
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
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {},
                    },
                ],
            },
        }
    }
}
