import { Message, MessageReaction } from 'discord.js'
import { Admin } from '../admin/admin'
import { UserUtils } from './userUtils'

export namespace CollectorUtils {
    export const shouldStopCollector = (reaction: MessageReaction, message: Message) => {
        return (
            reaction.emoji.name === '👎' &&
            reaction.users.cache.find(
                (u) => u.username === message.author.username || Admin.isAuthorSuperAdmin(UserUtils.findMemberByUsername(u.username, message))
            )
        )
    }
}
