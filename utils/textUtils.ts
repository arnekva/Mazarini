export namespace TextUtils {
    export function reverseMessageString(str: string) {
        const splitOnEmojiChar = str.split(/<([^<>]+)>/g) //Used to have \ before < and >
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

    export function replaceLast(mainString: string, searchString: string, replaceWith: string) {
        const a = mainString.split('')
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

    export function formatMoney(n: number, maxDigit?: number, minDigit?: number) {
        return n.toLocaleString('nb', {
            maximumFractionDigits: maxDigit || 2,
            minimumFractionDigits: minDigit || 2,
        })
    }

    export function formatAsCodeBlock(text: string) {
        return `\`\`\`${text}\`\`\``
    }
}
