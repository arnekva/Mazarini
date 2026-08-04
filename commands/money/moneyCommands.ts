import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'

import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'

export class MoneyCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async vippsChips(interaction: ChatInteraction) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)

        const [user, targetUser] = await Promise.all([
            this.client.database.getUser(interaction.user.id),
            this.client.database.getUser(target.id),
        ])
        const userBalance = user.chips
        const isBotTarget = target.id === this.client.user.id

        if (interaction.user.id === target.id) {
            this.messageHelper.replyToInteraction(interaction, `Du kan kje vippsa deg sjøl`, { ephemeral: true })
        } else if (isNaN(amount) || amount < 0 || amount === 0) {
            this.messageHelper.replyToInteraction(interaction, `Du må vippsa minst 1 chip.`, { ephemeral: true })
        } else if (userBalance >= amount) {
            user.chips = userBalance - amount

            if (isBotTarget) {
                // Vippsing the bot doesn't transfer chips anywhere - they're gambled away for a chance at shards instead.
                const shardsWon = this.rollVippsShardReward(amount)
                let responseText = `${interaction.user.username} vippset boten ${amount} chips... og fikk ingenting tilbake. Kanskje neste gang.`
                if (shardsWon > 0) {
                    user.ccg = { ...user.ccg, shards: (user.ccg?.shards ?? 0) + shardsWon }
                    responseText = `${interaction.user.username} vippset boten ${amount} chips, og ble belønnet med **${shardsWon} shards**! 🎉`
                }
                this.client.database.updateUser(user)
                this.messageHelper.replyToInteraction(interaction, responseText)
            } else {
                targetUser.chips = targetUser.chips + amount
                this.client.database.updateUser(user)
                this.client.database.updateUser(targetUser)
                this.messageHelper.replyToInteraction(
                    interaction,
                    `${interaction.user.username} vippset ${MentionUtils.mentionUser(targetUser.id)} ${amount} chips.`
                )
            }
        } else {
            this.messageHelper.replyToInteraction(
                interaction,
                'Dette har du kje råd te, bro. Du mangle ' + (amount - userBalance) + ' for å få lov te å vippsa ' + amount,
                { ephemeral: true }
            )
        }
    }

    /** Win chance doubles every `doublingAmount` kr; a growing pity floor guarantees a minimum every `pityStepAmount` kr. */
    private rollVippsShardReward(amount: number): number {
        const config = GameValues.vipps.shardReward
        const winChance = 1 - Math.pow(2, -amount / config.doublingAmount)
        const won = RandomUtils.getRandomPercentage(winChance * 100)
        const reward = won ? Math.round(amount / config.krPerShard) : 0
        const pityFloor = Math.floor(amount / config.pityStepAmount) * config.pityShardsPerStep
        return Math.max(reward, pityFloor)
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
        const shards = user.ccg?.shards ?? 0
        let embed = EmbedUtils.createSimpleEmbed(`💳 Lommeboken til ${name} 🏧`, `${chips} chips\n${shards} shards`)
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
