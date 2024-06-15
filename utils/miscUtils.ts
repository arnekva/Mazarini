import { ArrayUtils } from './arrayUtils'
import { RandomUtils } from './randomUtils'

const prideReg = new RegExp(/(xD)|(:3)|(pls)|(dritt)|(tinder)|(date)|(pølse)|(eivindpride)|(pride)|(rip)|(søren)|(malin)/gi)

export namespace MiscUtils {
    export function doesThisMessageNeedAnEivindPride(content: string, polseCounter: number) {
        return Math.random() < 0.1 || polseCounter > 0 || prideReg.test(content)
    }

    /** Return a matching emoji for the given letter. Some letters have more than one matching emoji (set isSecond to true to get second one), and there can be up to 7 spaces */
    export function findLetterEmoji(sentLetter: string, isSecond?: boolean, spaceCounter?: number) {
        let letter = ''
        switch (sentLetter.toUpperCase()) {
            case 'A':
                letter = isSecond ? '🅰' : '🇦'
                break
            case 'B':
                letter = isSecond ? '🅱' : '🇧'
                break
            case 'C':
                letter = isSecond ? '©️' : '🇨'
                break
            case 'D':
                letter = '🇩'
                break
            case 'E':
                letter = '🇪'
                break
            case 'F':
                letter = '🇫'
                break
            case 'G':
                letter = '🇬'
                break
            case 'H':
                letter = '🇭'
                break
            case 'I':
                letter = isSecond ? 'ℹ' : '🇮'
                break
            case 'J':
                letter = '🇯'
                break
            case 'K':
                letter = '🇰'
                break
            case 'L':
                letter = '🇱'
                break
            case 'M':
                letter = isSecond ? 'Ⓜ️' : '🇲'
                break
            case 'N':
                letter = '🇳'
                break
            case 'O':
                letter = isSecond ? '🅾' : '🇴'
                break
            case 'P':
                letter = isSecond ? '🅿️' : '🇵'
                break
            case 'Q':
                letter = '🇶'
                break
            case 'R':
                letter = isSecond ? '®️' : '🇷'
                break
            case 'S':
                letter = isSecond ? '💲' : '🇸'
                break
            case 'T':
                letter = isSecond ? '✝️' : '🇹'
                break
            case 'U':
                letter = '🇺'
                break
            case 'V':
                letter = isSecond ? '☑️' : '🇻'
                break
            case 'W':
                letter = '🇼'
                break
            case 'X':
                letter = isSecond ? '✖' : '🇽'
                break
            case 'Y':
                letter = '🇾'
                break
            case 'Z':
                letter = '🇿'
                break
            case 'Æ':
                letter = '🈷️'
                break
            case 'Ø':
                letter = '🚫'
                break
            case ' ':
                letter = '⬛'
                if (spaceCounter == 1) letter = '🟦'
                if (spaceCounter == 2) letter = '🟪'
                if (spaceCounter == 3) letter = '🟥'
                if (spaceCounter == 4) letter = '⬜'
                if (spaceCounter == 5) letter = '🟫'
                if (spaceCounter == 6) letter = '🟩'

                break

            case '0':
                letter = '0️⃣'
                break
            case '1':
                letter = '1️⃣'
                break
            case '2':
                letter = '2️⃣'
                break
            case '3':
                letter = '3️⃣'
                break
            case '4':
                letter = '4️⃣'
                break
            case '5':
                letter = '5️⃣'
                break
            case '6':
                letter = '6️⃣'
                break
            case '7':
                letter = '7️⃣'
                break
            case '8':
                letter = '8️⃣'
                break
            case '9':
                letter = '9️⃣'
                break
            case '!':
                letter = isSecond ? '❗' : '❕'
                break
            case '?':
                letter = isSecond ? '❓' : '❔'
                break
            case '$':
                letter = '💲'
                break

            default:
                break
        }
        return letter
    }

    export function findFeseText(author: string | undefined, randomName: string | undefined) {
        const isAuthorVictim = RandomUtils.getRandomPercentage(50)
        return ArrayUtils.randomChoiceFromArray(
            isAuthorVictim ? feseArray(randomName ?? 'Thomas', author ?? 'Thomas') : feseArray(author ?? 'Thomas', randomName ?? 'Thomas')
        )
    }

    export function feseArray(user1: string, user2: string) {
        return [
            `${user1} har fese`,
            `${user1} har skamfese`,
            `${user1} feis på ${user2}`,
            `${user1} fise så ${user2} riste`,
            `${user1} traff ${user2} i fjese`,
            `${user1} blei troffen i fjese av ${user2}`,
            `${user1} feis, men ${user2} brukte speil`,
            `${user1} traff ${user2} rett i fleisen`,
            `${user1} va på besøg hos ${user2} og nuka dassen`,
            `${user1} lukta ${user2} sin fis, men den som kjente sendte`,
            `${user1} slapp ein silent but deadly ein på ${user2} `,
            `${user1} feis på Thomas`,
            `${user1} dreid på seg`,
            `${user1}? Har du drede på deg? Lokte jaffal sånn`,
            `${user2}? Har du drede på deg? Lokte jaffal sånn`,
            `${user1} e ein liden prompegutt ja`,
        ]
    }
}
