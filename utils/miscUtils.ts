import { ArrayUtils } from './arrayUtils'
import { getRandomPercentage } from './randomUtils'

const prideReg = new RegExp(/(penis)|(sex)|(gay)|(xD)|(:3)|(pls)|(mamma)|(porno)|(jævla)|(dritt)|(komme)|(tinder)|(date)|(pølse)|(eivindpride)/gi)
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
    const isAuthorVictim = getRandomPercentage(50)
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
        `${user1} fise så han riste`,
        `${user1} traff ${user2} i fjese`,
        `${user1} blei troffen i fjese av ${user2}`,
        `${user1} feis, men ${user2} brukte speil`,
        `${user1} feis, men ${user2} brukte speil. ${user1} brukte skjold, så ${user2} blei fort eid der ja`,
        `${user1} traff ${user2} rett i fleisen`,
        `${user1} va på besøg hos ${user2} og nuka dassen`,
        `${user1} lukta ${user2} sin fis, men den som kjente sendte`,
        `${user1} va på besøg hos ${user2} og nuka dassen`,
        `${user1} slapp ein silent but deadly ein på ${user2} `,
        `${user1}: "Har du fese?". ${user2}: "DEN SÅ KJENTE SENDTE" `,
        `${user1} feis på Thomas`,
        `Yo, ${user1}, gidde du roa deg, eg prøve å sova her. Heila huse riste`,
    ]
}
