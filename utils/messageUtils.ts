import { Message } from 'discord.js'
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
}
