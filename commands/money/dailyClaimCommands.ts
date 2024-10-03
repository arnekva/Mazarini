import { ActionRowBuilder, APIEmbedField, ButtonBuilder, ButtonInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { DailyReward } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
// import { LootboxCommands } from '../store/lootboxCommands'

export class DailyClaimCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async claimDailyReward(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const embed = new EmbedBuilder()
        embed.setTitle(`📅  Daily  🗓️`)

        const user = await this.client.database.getUser(interaction.user.id)
        const canClaim = !user.daily?.claimedToday
        if (canClaim) {
            const updates = {}
            const oldData: DailyReward = user.daily || { claimedToday: false, streak: 0 }
            const newData: DailyReward = { ...oldData, streak: oldData?.streak + 1 ?? 1, claimedToday: true }

            let reward = this.getDailyReward(newData)
            reward = this.client.bank.giveMoney(user, reward)
            const lootButton = this.getLootboxReward(user.id, newData)
            embed.setDescription(`Du har henta dine daglige ${reward} chips`)
            embed.addFields([{ name: 'Streak', value: `${newData.streak ?? 1}` + ' dager', inline: true }])
            const lootboxField = this.getLootboxField(newData)
            if (lootboxField) embed.addFields([lootboxField])
            if (newData.streak === 7) {
                newData.streak = 1
                embed.setFooter({ text: 'Streaken din resettes nå te 1' })
            }
            updates[`/users/${user.id}/daily`] = newData
            this.client.database.updateData(updates)
            this.messageHelper.replyToInteraction(interaction, embed, undefined, lootButton)
        } else {
            embed.setDescription('Du har allerede henta daily i dag. Vent te imårå klokkå 05:00')
            this.messageHelper.replyToInteraction(interaction, embed)
        }
    }

    private getDailyReward(daily: DailyReward): number {
        const dailyPrice = 500
        return Math.floor(dailyPrice + dailyPrice * (daily.streak ?? 1))
    }

    private getLootboxReward(userId: string, daily: DailyReward): ActionRowBuilder<ButtonBuilder>[] {
        // if (daily.streak === 4) return [LootboxCommands.getDailyLootboxRewardButton(userId, LootboxQuality.Basic)]
        // else if (daily.streak === 7) return [LootboxCommands.getDailyLootboxRewardButton(userId, LootboxQuality.Premium)]
        // else
        return undefined
    }

    private getLootboxField(daily: DailyReward): APIEmbedField {
        if (daily.streak === 4)
            return { name: 'Lootbox', value: 'Dægårten! Du har henta daglige chips i 4 dager i strekk!\nDå får du en basic lootbox i tillegg!' }
        else if (daily.streak === 7)
            return { name: 'Lootbox', value: 'Dægårten! Du har henta daglige chips i 7 dager i strekk!\nDå får du en premium lootbox i tillegg!' }
        else return undefined
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'daily',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.claimDailyReward(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
