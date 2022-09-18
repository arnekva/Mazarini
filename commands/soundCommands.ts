import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { SoundUtils } from '../utils/soundUtils'
import { UserUtils } from '../utils/userUtils'

export class SoundCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async speak(interaction: ChatInputCommandInteraction<CacheType>) {
        const text = interaction.options.get('tekst')?.value as string
        const memb = UserUtils.findMemberByUserID(interaction.user.id, interaction)

        if (memb?.voice?.channel) {
            this.messageHelper.replyToInteraction(interaction, `${interaction.user.username} fekk meg te å sei *${text}* i voice chatten`)
            await SoundUtils.connectToVoiceAndSpeak(
                {
                    adapterCreator: interaction.guild?.voiceAdapterCreator,
                    channelID: memb.voice?.channelId ?? 'None',
                    guildID: interaction?.guildId ?? 'None',
                },
                `${text}`
            )
            // SoundUtils.disconnectFromVoiceChannel(interaction.guildId)
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må være koblet til en voice channel for å bruke denne funksjonen`, true)
        }
    }

    getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'snakk',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.speak(interaction)
                },
                category: 'annet',
            },
        ]
    }
}
