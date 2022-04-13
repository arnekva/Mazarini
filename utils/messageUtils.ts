import { Message } from 'discord.js'
const leetReg = new RegExp(/(1337)/gi)

export namespace MessageUtils {
    export const doesMessageIdHaveCoolNumber = (message: Message) => {
        const msgId = message.id
        if (leetReg.test(msgId)) return '1337'
        return 'none'
    }

    export const isArgsAtleastThisLong = (args: string[], neededLength: number) => {
        return args.length - 1 === neededLength
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
                    return arr
                } else {
                    let num = Number(value)
                    if (!isNaN(num)) {
                        arr.push(num)
                        return arr
                    }
                }
            })
        }
        return arr
    }

    export const findCommandName = (message: Message): string | undefined => {
        if (message.content.includes('!mz')) return message.content.split(' ')[1]
        return undefined
    }

    export const messageHasCommand = (message: Message) => {
        return message.content.includes('!mz')
    }

    export const getRoleTagString = (roleId: string) => {
        return `<@&${roleId}`
    }

    export const CHANNEL_IDs = {
        LAS_VEGAS: '808992127249678386',
        BOT_UTVIKLING: '802716150484041751',
        GENERAL: '340626855990132747',
    }
}
