import { CacheType, ChatInputCommandInteraction, EmbedBuilder, Interaction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { DailyReward } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { TextUtils } from '../../utils/textUtils'

export class MoneyCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async vippsChips(interaction: ChatInputCommandInteraction<CacheType>) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)

        const user = await this.client.database.getUser(interaction.user.id)
        const targetUser = await this.client.database.getUser(target.id)
        const userBalance = user.chips

        if (isNaN(amount) || amount < 0) {
            this.messageHelper.replyToInteraction(interaction, `Det e kje lov å vippsa någen et negativt beløp ;)`, { ephemeral: true })
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

    private async openWallet(interaction: ChatInputCommandInteraction<CacheType>) {
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

    /** Missing streak counter and increased reward */
    private async handleDailyClaimInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
        const numDays = Number(interaction.options.get('dager')?.value)

        if (!numDays) {
            const reply = await this.claimDailyChipsAndCoins(interaction)
            this.messageHelper.replyToInteraction(interaction, reply)
        } else if (numDays) {
            const reply = await this.freezeDailyClaim(interaction, numDays)
            this.messageHelper.replyToInteraction(interaction, reply)
        }
    }

    private async claimDailyChipsAndCoins(interaction: ChatInputCommandInteraction<CacheType>): Promise<EmbedBuilder> {
        const embed = new EmbedBuilder()
        embed.setTitle(`📅  Daily  🗓️`)

        const user = await this.client.database.getUser(interaction.user.id)
        const canClaim = !user.daily?.claimedToday
        const hasFreeze = user.daily?.dailyFreezeCounter
        if (hasFreeze && !isNaN(hasFreeze) && hasFreeze > 0) {
            embed.setDescription('Du har frosset daily claimet ditt i ' + hasFreeze + ' dager til. Vent til da og prøv igjen')
        } else if (canClaim) {
            const updates = {}
            const oldData: DailyReward = user.daily || { claimedToday: false, streak: 0 }
            const newData: DailyReward = { streak: oldData?.streak + 1 ?? 1, claimedToday: true, prestige: oldData?.prestige ?? 0, dailyFreezeCounter: 0 }

            let reward = this.findDailyReward(newData)
            reward = this.client.bank.giveMoney(user, reward)
            embed.setDescription(`Du har henta dine daglige ${reward} chips`)
            embed.addFields([
                { name: 'Streak', value: `${newData.streak ?? 1}` + ' dager', inline: true },
                { name: 'Prestige', value: `${oldData?.prestige ?? 1}`, inline: true },
            ])
            const maxLimit = 7
            if (newData.streak >= maxLimit) {
                newData.prestige = 1 + (newData.prestige ?? 0)
                embed.addFields([
                    {
                        name: 'Prestige opp',
                        value: `\nDægårten! Du har henta daglige chips i ${newData.streak} dager i strekk! Gz dude, nå prestige du. Du e nå prestige ${
                            newData.prestige
                        } og får ${this.findPrestigeMultiplier(newData.prestige).toFixed(
                            2
                        )}x i multiplier på alle daily's framøve! \n\n*Streaken din resettes nå te 1*`,
                    },
                ])

                newData.streak = 1
            }
            updates[`/users/${user.id}/daily`] = newData
            this.client.database.updateData(updates)
            return embed
        } else {
            return embed.setDescription('Du har allerede henta daily i dag. Vent te imårå klokkå 06:00')
        }
    }

    private async freezeDailyClaim(interaction: Interaction<CacheType>, numDays: number): Promise<string> {
        const user = await this.client.database.getUser(interaction.user.id)

        const hasFreeze = user?.daily?.dailyFreezeCounter
        if (isNaN(numDays) || numDays > 8) {
            return 'Tallet var ikke gyldig'
        } else if (hasFreeze && hasFreeze > 0) {
            return 'Du har allerede frosset daily claimet ditt i ' + hasFreeze + ' dager til'
        } else {
            const updates = {}
            updates[`/users/${user.id}/daily/dailyFreezeCounter`] = numDays
            this.client.database.updateData(updates)
            return (
                'Du har frosset daily claimen din i ' +
                numDays +
                ' dager. Du får ikke hente ut daily chips og coins før da, men streaken din vil heller ikke forsvinne. Denne kan ikke overskrives eller fjernes'
            )
        }
    }

    private findDailyReward(daily: DailyReward): number {
        const dailyPrice = 200
        const additionalCoins = this.findAdditionalCoins(daily.streak)
        const prestigeMultiplier = this.findPrestigeMultiplier(daily.prestige)

        return Math.floor((dailyPrice + Number(additionalCoins ?? 0)) * prestigeMultiplier)
    }

    private findPrestigeMultiplier(p: number | undefined) {
        if (p && !isNaN(p) && p > 0) {
            return 1 + 0.3475 * p
        }
        return 1
    }

    private findAdditionalCoins(streak: number): number | undefined {
        if (streak > 5) return 200
        if (streak > 3) return 130
        if (streak > 1) return 90
        return undefined
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'daily',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleDailyClaimInteraction(rawInteraction)
                        },
                    },
                    {
                        commandName: 'vipps',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.vippsChips(rawInteraction)
                        },
                    },
                    {
                        commandName: 'wallet',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.openWallet(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
