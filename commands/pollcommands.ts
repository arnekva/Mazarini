import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'

export class PollCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
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
