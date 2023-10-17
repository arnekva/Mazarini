import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'

export class PollCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private createPoll(interaction: ChatInputCommandInteraction<CacheType>) {
        const characterToSplit = ','
        const pollInfo = interaction.options.getString('beskrivelse', true)
        const optionsFromInteraction = interaction.options.getString('valg', true)

        const options = optionsFromInteraction.split(characterToSplit)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'poll',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.createPoll(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
