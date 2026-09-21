import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'

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
