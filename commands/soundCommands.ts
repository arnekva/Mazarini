import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { MentionUtils } from '../utils/mentionUtils'
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
            await this.messageHelper.replyToInteraction(interaction, `Du fekk meg te å sei *${text}* i voice chatten`, true)
            await SoundUtils.connectToVoiceAndSpeak(
                {
                    adapterCreator: interaction.guild?.voiceAdapterCreator,
                    channelID: memb.voice?.channelId ?? 'None',
                    guildID: interaction?.guildId ?? 'None',
                },
                `${text}`
            )
            this.messageHelper.sendMessageToActionLog(
                `${interaction.user.username} fikk botten til å si *${text}* i ${MentionUtils.mentionChannel(memb.voice?.channelId)}`
            )
            // SoundUtils.disconnectFromVoiceChannel(interaction.guildId)
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må være koblet til en voice channel for å bruke denne funksjonen`, true)
        }
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'snakk',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.speak(interaction)
                },
            },
        ]
    }
}
