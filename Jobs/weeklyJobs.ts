import { EmbedBuilder } from 'discord.js'
import moment from 'moment'
import { MazariniClient } from '../client/MazariniClient'
import { PoletCommands } from '../commands/drinks/poletCommands'
import { EmojiHelper, JobStatus } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { IUserBuffs } from '../interfaces/database/databaseInterface'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds } from '../utils/mentionUtils'

export class WeeklyJobs {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }
    async runJobs() {
        const embed = EmbedUtils.createSimpleEmbed(`Weekly Jobs`, `Kjører 5 jobber`)
        const polet = await this.checkPoletHours()
        embed.addFields({ name: 'Polet status', value: EmojiHelper.getStatusEmoji(polet) })
        const statusReset = await this.resetStatuses()
        embed.addFields({ name: 'Status reset', value: EmojiHelper.getStatusEmoji(statusReset) })
        const deleteOldCountdowns = await this.deleteOldCountdowns()
        embed.addFields({ name: 'Countdown sletting', value: EmojiHelper.getStatusEmoji(deleteOldCountdowns) })
        const resetWeeklyDeathrollStats = await this.resetWeeklyDeathrollStats()
        embed.addFields({ name: 'Weekly deathroll reset', value: EmojiHelper.getStatusEmoji(resetWeeklyDeathrollStats) })
        const weeklyEffects = await this.setWeeklyEffects()
        embed.addFields({ name: 'Weekly user effects', value: EmojiHelper.getStatusEmoji(weeklyEffects) })
        const todaysTime = new Date().toLocaleTimeString()
        embed.setFooter({ text: todaysTime })
        this.messageHelper.sendMessage(ChannelIds.ACTION_LOG, { embed: embed })
    }

    private async checkPoletHours(): Promise<JobStatus> {
        const data = await PoletCommands.fetchPoletData('116')
        const dates = data.openingHours.exceptionHours
        if (!data) return 'failed'
        if (data && data?.openingHours?.exceptionHours?.length > 0) {
            const fmMessage = new EmbedBuilder()
                .setTitle(`Det er endrede åpningstider på polet denne ${dates.length ? 'uken' : 'måneden'}`)
                .setDescription(`Bruker ${data.storeName} (${data.address.postalCode}, ${data.address.city}) som utgangspunkt`)

            data.openingHours.exceptionHours
                .filter((d) => DateUtils.dateIsInCurrentWeek(moment(d?.date).format('dddd')))
                .forEach((h) => {
                    const dateName = moment(h?.date).format('dddd')
                    if (h.openingTime !== '10:00' || h.closingTime !== '18:00') {
                        let message = ''
                        if (h.openingTime && h.closingTime) {
                            message = `Det er forkortet åpningstid. Det er åpent mellom ${h.openingTime} - ${h.closingTime}`
                        } else {
                            message = h?.message ? h.message : 'Ingen forklaring'
                        }
                        fmMessage.addFields({
                            name: dateName ? `${dateName} (${h?.date})` : 'Ukjent dag',
                            value: `${message}`,
                        })
                    }
                })

            this.messageHelper.sendMessage(ChannelIds.VINMONOPOLET, { embed: fmMessage })
            return 'success'
        }
        return 'not sendt'
    }
    private async resetStatuses(): Promise<JobStatus> {
        await this.client.database.deleteSpecificPrefixValues('status')
        return 'success'
    }

    private async deleteOldCountdowns(): Promise<JobStatus> {
        const storage = await this.client.database.getStorage()
        if (!storage) return 'failed'
        const countdowns = storage?.countdown
        let hasDeleted = false
        if (countdowns) {
            if (countdowns.allCountdowns.filter((c) => !DateUtils.dateHasPassed(c.date)).length > 0) hasDeleted = true
            countdowns.allCountdowns = countdowns.allCountdowns.filter((c) => !DateUtils.dateHasPassed(c.date))
            this.client.database.updateStorage({ countdown: countdowns })
        }
        return hasDeleted ? 'success' : 'not sendt'
    }

    private async resetWeeklyDeathrollStats(): Promise<JobStatus> {
        // const winner = await this.client.database.findAndRewardWeeklyDeathrollWinner()
        // if (winner) {
        //     const embed = EmbedUtils.createSimpleEmbed(`:game_die: Ukens deathrollvinner er... :game_die:`, `${MentionUtils.mentionUser(winner.id)}!`
        //                 + `\nDu tapte ${winner.userStats.deathrollStats.weeklyLosses > 0 ? 'bare ' : 'faktisk '}${((winner.userStats.deathrollStats.weeklyLosses/winner.userStats.deathrollStats.weeklyGames)*100).toFixed(1)}% av spillene dine forrige uke.`
        //                 + `\n\n:moneybag: Det er lavest av alle, og du vinne ${100 * winner.userStats.deathrollStats.weeklyGames} chips! :moneybag:`)
        //     this.messageHelper.sendMessage(ThreadIds.GENERAL_TERNING, {embed: embed})
        // }
        await this.client.database.resetWeeklyDeathrollStats()
        return 'success'
    }

    private async setWeeklyEffects(): Promise<JobStatus> {
        const users = await this.client.database.getAllUsers()
        const updates = this.client.database.getUpdatesObject<'effects'>()
        users.forEach((user) => {
            user.effects = user.effects ?? { positive: {} }
            const buffs: IUserBuffs = user.effects?.positive ?? {}
            if (buffs) {
                buffs.blackjackReDeals = buffs.blackjackReDeals > 0 ? buffs.blackjackReDeals : 1
                user.effects.positive = buffs
                const updatePath = this.client.database.getUserPathToUpdate(user.id, 'effects')
                updates[updatePath] = user.effects
            }
        })
        this.client.database.updateData(updates)
        return 'success'
    }
}
