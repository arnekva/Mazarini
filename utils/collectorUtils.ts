import { CacheType, ChatInputCommandInteraction, Message, MessageReaction } from 'discord.js'
import { Admin } from '../admin/admin'
import { UserUtils } from './userUtils'

export namespace CollectorUtils {
    export const shouldStopCollector = (reaction: MessageReaction, interaction: ChatInputCommandInteraction<CacheType> | Message) => {
        return (
            CollectorUtils.isThumbsDown(reaction.emoji.name) &&
            reaction.users.cache.find(
                (u) =>
                    u.username === (interaction instanceof Message ? interaction.author.username : interaction.user.username) ||
                    Admin.isAuthorAdmin(UserUtils.findMemberByUsername(u.username, interaction))
            )
        )
    }

    export const isThumbsDown = (emoji: string | null | undefined) => {
        return emoji === '👎🏻' || emoji === '👎' || emoji === '👎🏻' || emoji === '👎🏽' || emoji === '👎🏿' || emoji === '👎🏼'
    }
}
