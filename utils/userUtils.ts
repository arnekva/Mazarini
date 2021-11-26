import { Message, User } from 'discord.js'

export namespace UserUtils {
    export const findMemberByUserID = (userId: string, message: Message) => {
        return message.guild?.members?.cache.find((m) => m.id === userId)
    }

    export const findUserByUsername = (username: string, rawMessage: Message) => {
        return rawMessage.client.users.cache.find((user) => user.username == username)
    }
    export const findUserById = (id: string, rawMessage: Message) => {
        return rawMessage.client.users.cache.find((user) => user.id == id)
    }

    export const findMemberByUsername = (username: string, rawMessage: Message) => {
        const user = UserUtils.findUserByUsername(username, rawMessage)
        if (user) return UserUtils.findMemberByUserID(user.id, rawMessage)
        return undefined
    }
}
