import { ActionRowBuilder, APIEmbedField, ButtonBuilder, EmbedBuilder } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'

import { DailyReward, LootboxQuality } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { DealOrNoDeal, DonDQuality } from '../games/dealOrNoDeal'
import { LootboxCommands } from '../store/lootboxCommands'

export class DailyClaimCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async claimDailyReward(interaction: ChatInteraction | BtnInteraction) {
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
            // const lootButton = this.getLootboxReward(user.id, newData)
            embed.setDescription(`Du har henta dine daglige ${reward} chips`)
            embed.addFields([{ name: 'Streak', value: `${newData.streak ?? 1}` + ' dager', inline: true }])
            // const lootboxField = this.getLootboxField(newData)
            // if (lootboxField) embed.addFields([lootboxField])
            if (newData.streak === 7) {
                newData.streak = 0
                embed.setFooter({ text: 'Streaken din resettes nå te 0' })
            }
            updates[`/users/${user.id}/daily`] = newData
            this.client.database.updateData(updates)
            this.messageHelper.replyToInteraction(interaction, embed, undefined /*, lootButton*/)
        } else {
            embed.setDescription('Du har allerede henta daily i dag. Vent te imårå klokkå 05:00')
            this.messageHelper.replyToInteraction(interaction, embed)
        }
    }

    private getDailyReward(daily: DailyReward): number {
        const dailyPrice = GameValues.daily.baseReward
        return Math.floor(dailyPrice + dailyPrice * (daily.streak ?? 1) * (GameValues.daily.streakMultiplier ?? 1))
    }

    private getLootboxReward(userId: string, daily: DailyReward): ActionRowBuilder<ButtonBuilder>[] {
        if (daily.streak === 4 || daily.streak === 7) {
            const buttons = new ActionRowBuilder<ButtonBuilder>()
            const reward = daily.streak === 7 ? GameValues.daily.streak7Reward : GameValues.daily.streak4Reward
            if (reward === 'chest') return [LootboxCommands.getLootRewardButton(userId, LootboxQuality.Basic, true)]
            else if (reward === 'box') return [LootboxCommands.getLootRewardButton(userId, LootboxQuality.Basic)]
            else if (reward === 'dond') {
                const dond = DealOrNoDeal.getDealOrNoDealButton(userId, DonDQuality.Basic)
                buttons.addComponents(dond)
                return [buttons]
            }
        }
        return undefined
    }

    private getLootboxField(daily: DailyReward): APIEmbedField {
        if (daily.streak === 4) return { name: 'Lootbox', value: '4? Keep up the good work' }
        else if (daily.streak === 7) return { name: 'Lootbox', value: 'Sakko! 7 dager i strekk!?\nSe her, ta deg ein boks!' }
        else return undefined
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'daily',
                        command: (rawInteraction: ChatInteraction) => {
                            this.claimDailyReward(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
