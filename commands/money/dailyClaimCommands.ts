import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { discordAppId, discordSecret } from '../../client-env'
import { IInteractionElement } from '../../interfaces/interactionInterface'

export class DailyClaimCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    /** Launches the daily activity hub (Daily Claim, Lykkehjul, and the daily challenges) as a Discord Activity in this channel. */
    private async launchActivity(interaction: ChatInteraction) {
        const invite = await fetch(`https://discord.com/api/v10/channels/${interaction.channelId}/invites`, {
            method: 'POST',
            headers: {
                Authorization: `Bot ${discordSecret}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                max_age: 0,
                max_uses: 0,
                target_application_id: discordAppId,
                target_type: 2, // 2 = Embedded Application
                temporary: false,
            }),
        }).then((res) => res.json())
        this.messageHelper.replyToInteraction(interaction, `https://discord.com/invite/${invite.code}`)
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
            },
        }
    }
}
