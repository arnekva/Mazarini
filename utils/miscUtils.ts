import { ArrayUtils } from './arrayUtils'
import { RandomUtils } from './randomUtils'

const prideReg = new RegExp(
    /(penis)|(sex)|(gay)|(xD)|(:3)|(pls)|(mamma)|(porno)|(jÃ¦vla)|(dritt)|(komme)|(tinder)|(date)|(pÃ¸lse)|(eivindpride)|(pride)|(daily)|(rip)|(kekw)|(cat)|(enig)|(komt)/gi
)
const putinReg = new RegExp(
    /(krig)|(ukraina)|(russland)|(invadere)|(invasjon)|(russiske)|(russisk)|(russer)|(russia)|(putin)|(kiev)|(putinpride)|(kyiv)|(europa)|(kina)/gi
)
export namespace MiscUtils {
    export function doesThisMessageNeedAnEivindPride(content: string, polseCounter: number) {
        return Math.random() < 0.1 || polseCounter > 0 || prideReg.test(content)
    }
    export function doesThisMessageNeedAPutinPride(content: string, polseCounter: number) {
        return Math.random() < 0.1 || putinReg.test(content)
    }

    /** Return a matching emoji for the given letter. Some letters have more than one matching emoji (set isSecond to true to get second one), and there can be up to 7 spaces */
    export function findLetterEmoji(sentLetter: string, isSecond?: boolean, spaceCounter?: number) {
        let letter = ''
        switch (sentLetter.toUpperCase()) {
            case 'A':
                letter = isSecond ? 'ð°' : 'ð¦'
                break
            case 'B':
                letter = isSecond ? 'ð±' : 'ð§'
                break
            case 'C':
                letter = isSecond ? 'Â©ï¸' : 'ð¨'
                break
            case 'D':
                letter = 'ð©'
                break
            case 'E':
                letter = 'ðª'
                break
            case 'F':
                letter = 'ð«'
                break
            case 'G':
                letter = 'ð¬'
                break
            case 'H':
                letter = 'ð­'
                break
            case 'I':
                letter = isSecond ? 'â¹' : 'ð®'
                break
            case 'J':
                letter = 'ð¯'
                break
            case 'K':
                letter = 'ð°'
                break
            case 'L':
                letter = 'ð±'
                break
            case 'M':
                letter = isSecond ? 'âï¸' : 'ð²'
                break
            case 'N':
                letter = 'ð³'
                break
            case 'O':
                letter = isSecond ? 'ð¾' : 'ð´'
                break
            case 'P':
                letter = isSecond ? 'ð¿ï¸' : 'ðµ'
                break
            case 'Q':
                letter = 'ð¶'
                break
            case 'R':
                letter = isSecond ? 'Â®ï¸' : 'ð·'
                break
            case 'S':
                letter = isSecond ? 'ð²' : 'ð¸'
                break
            case 'T':
                letter = isSecond ? 'âï¸' : 'ð¹'
                break
            case 'U':
                letter = 'ðº'
                break
            case 'V':
                letter = isSecond ? 'âï¸' : 'ð»'
                break
            case 'W':
                letter = 'ð¼'
                break
            case 'X':
                letter = isSecond ? 'â' : 'ð½'
                break
            case 'Y':
                letter = 'ð¾'
                break
            case 'Z':
                letter = 'ð¿'
                break
            case 'Ã':
                letter = 'ð·ï¸'
                break
            case 'Ã':
                letter = 'ð«'
                break
            case ' ':
                letter = 'â¬'
                if (spaceCounter == 1) letter = 'ð¦'
                if (spaceCounter == 2) letter = 'ðª'
                if (spaceCounter == 3) letter = 'ð¥'
                if (spaceCounter == 4) letter = 'â¬'
                if (spaceCounter == 5) letter = 'ð«'
                if (spaceCounter == 6) letter = 'ð©'

                break

            case '0':
                letter = '0ï¸â£'
                break
            case '1':
                letter = '1ï¸â£'
                break
            case '2':
                letter = '2ï¸â£'
                break
            case '3':
                letter = '3ï¸â£'
                break
            case '4':
                letter = '4ï¸â£'
                break
            case '5':
                letter = '5ï¸â£'
                break
            case '6':
                letter = '6ï¸â£'
                break
            case '7':
                letter = '7ï¸â£'
                break
            case '8':
                letter = '8ï¸â£'
                break
            case '9':
                letter = '9ï¸â£'
                break
            case '!':
                letter = isSecond ? 'â' : 'â'
                break
            case '?':
                letter = isSecond ? 'â' : 'â'
                break
            case '$':
                letter = 'ð²'
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
            `${user1} feis pÃ¥ ${user2}`,
            `${user1} fise sÃ¥ ${user2} riste`,
            `${user1} fise sÃ¥ han riste`,
            `${user1} traff ${user2} i fjese`,
            `${user1} blei troffen i fjese av ${user2}`,
            `${user1} feis, men ${user2} brukte speil`,
            `${user1} feis, men ${user2} brukte speil. ${user1} brukte skjold, sÃ¥ ${user2} blei fort eid der ja`,
            `${user1} traff ${user2} rett i fleisen`,
            `${user1} va pÃ¥ besÃ¸g hos ${user2} og nuka dassen`,
            `${user1} lukta ${user2} sin fis, men den som kjente sendte`,
            `${user1} va pÃ¥ besÃ¸g hos ${user2} og nuka dassen`,
            `${user1} slapp ein silent but deadly ein pÃ¥ ${user2} `,
            `${user1}: "Har du fese?". ${user2}: "DEN SÃ KJENTE SENDTE" `,
            `${user1} feis pÃ¥ Thomas`,
            `Yo, ${user1}, gidde du roa deg, eg prÃ¸ve Ã¥ sova her. Heila huse riste`,
        ]
    }
}
