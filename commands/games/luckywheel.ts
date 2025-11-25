import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { discordSecret } from '../../client-env'
import { IInteractionElement } from '../../interfaces/interactionInterface'

export class LuckyWheel extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async launchActivity(interaction: ChatInputCommandInteraction<CacheType>) {
        const invite = await fetch(`https://discord.com/api/v10/channels/${interaction.channelId}/invites`, {
            method: 'POST',
            headers: {
                Authorization: `Bot ${discordSecret}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                max_age: 0,
                max_uses: 0,
                target_application_id: '1430294434100281404', //Hent Bøie
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
                        commandName: 'luckywheel',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.launchActivity(interaction)
                        },
                    },
                ],
            },
        }
    }
}
