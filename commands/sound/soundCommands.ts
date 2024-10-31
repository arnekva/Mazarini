import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { IInteractionElement } from '../../interfaces/interactionInterface'

export class SoundCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async speak() {
        // const text = interaction.options.get('tekst')?.value as string
        // const memb = UserUtils.findMemberByUserID(interaction.user.id, interaction)
        // if (memb?.voice?.channel) {
        //     await this.messageHelper.replyToInteraction(interaction, `Du fekk meg te å sei *${text}* i voice chatten`, { ephemeral: true })
        //     await SoundUtils.connectToVoiceAndSpeak(
        //         {
        //             adapterCreator: interaction.guild?.voiceAdapterCreator,
        //             channelID: memb.voice?.channelId ?? 'None',
        //             guildID: interaction?.guildId ?? 'None',
        //         },
        //         `${text}`
        //     )
        //     this.messageHelper.sendLogMessage(
        //         `${interaction.user.username} fikk botten til å si *${text}* i ${MentionUtils.mentionChannel(memb.voice?.channelId)}`
        //     )
        //     // SoundUtils.disconnectFromVoiceChannel(interaction.guildId)
        // } else {
        //     this.messageHelper.replyToInteraction(interaction, `Du må være koblet til en voice channel for å bruke denne funksjonen`, { ephemeral: true })
        // }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'snakk',
                        disabled: true,
                        command: () => {
                            // this.speak(interaction)
                        },
                    },
                ],
            },
        }
    }
}
