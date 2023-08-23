import * as cleanTextUtils from 'clean-text-utils'
import { Message } from 'discord.js'

export namespace TextUtils {
    export function escapeString(text: string) {
        let cleanKey = cleanTextUtils.strip.nonASCII(text)
        // cleanKey = cleanTextUtils.replace.exoticChars(text);
        return cleanKey
    }

    export function isUpperCase(str: string) {
        return str === str.toUpperCase()
    }

    export function reverseMessageString(str: string) {
        const splitOnEmojiChar = str.split(/\<([^<>]+)\>/g)
        let retString = ''
        if (splitOnEmojiChar.length > 1) {
            splitOnEmojiChar.forEach((seq) => {
                if (!seq.includes(':')) retString += seq.split('').reverse().join('')
                else {
                    retString += ' <'.concat(seq) + '>'
                }
            })
            return retString
        } else return str.split('').reverse().join('')
    }
    export function insert(str: string, index: number, value: string) {
        return str.substr(0, index) + value + str.substr(index)
    }

    export function msToTime(duration: number, onlyHours?: boolean) {
        var milliseconds = Math.floor((duration % 1000) / 100),
            seconds = Math.floor((duration / 1000) % 60),
            minutes = Math.floor((duration / (1000 * 60)) % 60),
            hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

        const newHours = hours < 10 ? '0' + hours : hours
        const newminutes = minutes < 10 ? '0' + minutes : minutes
        const newseconds = seconds < 10 ? '0' + seconds : seconds

        return onlyHours ? hours : newHours + ':' + newminutes + ':' + newseconds + '.' + milliseconds
    }
    export function replaceLast(mainString: string, searchString: string, replaceWith: string) {
        var a = mainString.split('')
        a[mainString.lastIndexOf(searchString)] = replaceWith
        return a.join('')
    }

    export const isInQuotation = (content: string) => {
        const matches = content.match(/"(.*?)"/)
        return matches ? matches[1] : content
    }
    export function getUsernameInQuotationMarks(content: string) {
        if (content.includes('_')) {
            return isInQuotation(content)
        } else {
            return undefined
        }
    }

    export function splitUsername(u: string) {
        return u ? u.replace('_', ' ') : u
    }

    export function doesTextIncludeUsername(content: string) {
        const regex = new RegExp(/(?<=\<)(.*?)(?=\>)/gi)
        return content.match(regex)
    }

    /** Replace a tagged username as only the escaped, clean username text - i.e. not triggering a tag notification */
    export function replaceAtWithTextUsername(content: string, message: Message, displayName?: boolean) {
        const matchedUsrname = doesTextIncludeUsername(content)
        if (matchedUsrname) {
            const id = matchedUsrname.forEach((el, index) => {
                const mentionedId = el.replace('@!', '')
                message.mentions.users.forEach((el: any) => {
                    if (mentionedId == el.id) {
                        const replaceThis = '<' + matchedUsrname[index] + '>'
                        content = content.replace(replaceThis, el.username)
                    }
                })
            })
        }
        return content
    }

    export function formatMoney(n: number, maxDigit?: number, minDigit?: number) {
        return n.toLocaleString('nb', {
            maximumFractionDigits: maxDigit,
            minimumFractionDigits: minDigit,
        })
    }

    export function formatAsCodeBlock(text: string) {
        return `\`\`\`${text}\`\`\``
    }
}
