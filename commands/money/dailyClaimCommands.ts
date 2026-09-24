import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'

export class DailyClaimCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    /** Launches the daily activity hub (Daily Claim, Lykkehjul, and the daily challenges) as a Discord
     * Activity in this channel. Uses interaction.launchActivity() (Discord's LAUNCH_ACTIVITY response
     * type) rather than creating a target_type:2 channel invite - that invite mechanism only works on
     * voice channels, which doesn't match how this server actually uses the bot (text channels only). */
    private async launchActivity(interaction: ChatInteraction) {
        await interaction.launchActivity()
        // Discord only posts its own "Game Invitation" card when *it* handles the launch (the app's Entry Point command).
        // Answering with launchActivity() ourselves leaves nothing behind in the channel, so post a card of our own that
        // looks and works the same way: who opened it, and a Play button anyone else can use to jump straight in.
        const embed = EmbedUtils.createSimpleEmbed('Game Invitation', `**Daily Activity**\n${MentionUtils.mentionUser(interaction.user.id)} har åpnet den - klikk for å bli med`)
        const avatar = this.client.user?.displayAvatarURL()
        if (avatar) embed.setThumbnail(avatar)
        this.messageHelper.sendMessage(interaction.channelId, { embed: embed, components: [joinDailyButtonRow] })
    }

    private async joinFromButton(interaction: BtnInteraction) {
        await interaction.launchActivity()
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'daily',
                        command: (rawInteraction: ChatInteraction) => {
                            this.launchActivity(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'DAILY_LAUNCH',
                        command: (rawInteraction: BtnInteraction) => {
                            this.joinFromButton(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

const joinDailyButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: 'DAILY_LAUNCH',
        style: ButtonStyle.Primary,
        label: 'Play',
        disabled: false,
        type: 2,
    })
)
