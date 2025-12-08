import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'

import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { TextUtils } from '../../utils/textUtils'

export class MoneyCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async vippsChips(interaction: ChatInteraction) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)

        const user = await this.client.database.getUser(interaction.user.id)
        const targetUser = await this.client.database.getUser(target.id)
        const userBalance = user.chips

        if (interaction.user.id === target.id) {
            this.messageHelper.replyToInteraction(interaction, `Du kan kje vippsa deg sjøl`, { ephemeral: true })
        } else if (isNaN(amount) || amount < 0 || amount === 0) {
            this.messageHelper.replyToInteraction(interaction, `Du må vippsa minst 1 chip.`, { ephemeral: true })
        } else if (userBalance >= amount) {
            const oldChips = user.chips
            user.chips = oldChips - amount
            const newChips = targetUser.chips
            targetUser.chips = newChips + amount
            this.client.database.updateUser(user)
            this.client.database.updateUser(targetUser)
            this.messageHelper.replyToInteraction(
                interaction,
                `${interaction.user.username} vippset ${MentionUtils.mentionUser(targetUser.id)} ${amount} chips.`
            )
        } else {
            this.messageHelper.replyToInteraction(
                interaction,
                'Dette har du kje råd te, bro. Du mangle ' + (amount - userBalance) + ' for å få lov te å vippsa ' + amount,
                { ephemeral: true }
            )
        }
    }

    private async openWallet(interaction: ChatInteraction) {
        const target = interaction.options.get('bruker')?.user

        let id = interaction.user.id
        let name = interaction.user.username
        if (target) {
            id = target.id
            name = target.username
        }
        const user = await this.client.database.getUser(id)
        const chips = user.chips
        let embed = EmbedUtils.createSimpleEmbed(`💳 Lommeboken til ${name} 🏧`, `${chips} chips`)
        if (!target && user.hasBeenRobbed) {
            embed = EmbedUtils.createSimpleEmbed(
                `💳 Lommeboken til ${name} 🏧`,
                `Hehe ser ut som noen har stjålet fra deg` + `\nDu har nå ${TextUtils.formatMoney(chips)} chips`
            )
            user.hasBeenRobbed = false
            this.client.database.updateUser(user)
        }
        this.messageHelper.replyToInteraction(interaction, embed)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'vipps',
                        command: (rawInteraction: ChatInteraction) => {
                            this.vippsChips(rawInteraction)
                        },
                    },
                    {
                        commandName: 'wallet',
                        command: (rawInteraction: ChatInteraction) => {
                            this.openWallet(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
