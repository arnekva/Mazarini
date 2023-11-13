import { Message, TextChannel } from 'discord.js'
import { MazariniClient } from '../client/MazariniClient'
import { MentionUtils } from './mentionUtils'
import { UserUtils } from './userUtils'
const leetReg = new RegExp(/(1337)/gi)

export namespace MessageUtils {
    export const doesMessageIdHaveCoolNumber = (message: Message) => {
        const msgId = message.id
        leetReg.lastIndex = 0
        if (leetReg.test(msgId)) return '1337'
        return 'none'
    }

    export const doesMessageContainNumber = (message: Message) => {
        let arr = new Array<number>()
        const content = message.content
        if (/\d/.test(content)) {
            const words = content.split(' ')
            words.forEach(function (value) {
                if (/^(\d+-?)+\d+$/.test(value)) {
                    const numbers = value.split('-')
                    numbers.forEach(function (number) {
                        let num = Number(number)
                        arr.push(num)
                    })
                } else {
                    let num = Number(value)
                    if (!isNaN(num)) {
                        arr.push(num)
                    }
                }
            })
        }
        return arr
    }

    export const findMessageById = async (id: string, client: MazariniClient, onErr?: () => void): Promise<Message<boolean> | undefined> => {
        const allChannels = [...client.channels.cache.values()].filter((channel) => channel instanceof TextChannel) as TextChannel[]
        let messageToReturn

        for (const channel of allChannels) {
            if (
                channel &&
                channel.permissionsFor(UserUtils.findMemberByUserID(MentionUtils.User_IDs.BOT_HOIE, channel.guild)).toArray().includes('SendMessages')
            ) {
                await channel.messages
                    .fetch(id)
                    .then(async (message) => {
                        messageToReturn = message
                    })
                    .catch((error) => {
                        if (onErr) onErr()
                    })
            }
        }
        return messageToReturn
    }
}
