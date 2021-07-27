const prideReg = new RegExp(/(penis)|(sex)|(gay)|(xD)|(:3)|(pls)|(mamma)|(porno)|(jævla)|(dritt)|(tinder)|(date)|(pølse)/ig);
export function doesThisMessageNeedAnEivindPride(content: string, polseCounter: number) {
    let needsToBePrided = false;
    if (Math.random() < 0.10)
        needsToBePrided = true;
    if (polseCounter > 0)
        needsToBePrided = true;
    if (prideReg.test(content))
        needsToBePrided = true
    return needsToBePrided;
}


export function findLetterEmoji(sentLetter: string, isSecond?: boolean, spaceCounter?: number) {
    let letter = "";
    switch (sentLetter.toUpperCase()) {
        case "A":
            letter = isSecond ? "🅰" : "🇦";
            break;
        case "B":
            letter = isSecond ? "🅱" : "🇧";
            break;
        case "C":
            letter = isSecond ? "©️" : "🇨";
            break;
        case "D":
            letter = "🇩";
            break;
        case "E":
            letter = "🇪";
            break;
        case "F":
            letter = "🇫";
            break;
        case "G":
            letter = "🇬";
            break;
        case "H":
            letter = "🇭";
            break;
        case "I":
            letter = isSecond ? "ℹ" : "🇮";
            break;
        case "J":
            letter = "🇯";
            break;
        case "K":
            letter = "🇰";
            break;
        case "L":
            letter = "🇱";
            break;
        case "M":
            letter = isSecond ? "Ⓜ️" : "🇲";
            break;
        case "N":
            letter = "🇳";
            break;
        case "O":
            letter = isSecond ? "🅾" : "🇴";
            break;
        case "P":
            letter = isSecond ? "🅿️" : "🇵";
            break;
        case "Q":
            letter = "🇶";
            break;
        case "R":
            letter = isSecond ? "®️" : "🇷";
            break;
        case "S":
            letter = isSecond ? "💲" : "🇸";
            break;
        case "T":
            letter = isSecond ? "✝️" : "🇹";
            break;
        case "U":
            letter = "🇺";
            break;
        case "V":
            letter = isSecond ? "☑️" : "🇻";
            break;
        case "W":
            letter = "🇼";
            break;
        case "X":
            letter = isSecond ? "✖" : "🇽";
            break;
        case "Y":
            letter = "🇾";
            break;
        case "Z":
            letter = "🇿";
            break;
        case "Æ":
            letter = "🈷️";
            break;
        case "Ø":
            letter = "🚫";
            break;
        case " ":
            letter = "⬛"
            if (spaceCounter == 1)
                letter = "🟦";
            if (spaceCounter == 2)
                letter = "🟪"
            if (spaceCounter == 3)
                letter = "🟥"
            if (spaceCounter == 4)
                letter = "⬜"
            if (spaceCounter == 5)
                letter = "🟫"
            if (spaceCounter == 6)
                letter = "🟩"

            break;

        case "0":
            letter = "0️⃣";
            break;
        case "1":
            letter = "1️⃣";
            break;
        case "2":
            letter = "2️⃣";
            break;
        case "3":
            letter = "3️⃣";
            break;
        case "4":
            letter = "4️⃣";
            break;
        case "5":
            letter = "5️⃣";
            break;
        case "6":
            letter = "6️⃣";
            break;
        case "7":
            letter = "7️⃣";
            break;
        case "8":
            letter = "8️⃣";
            break;
        case "9":
            letter = "9️⃣";
            break;
        case "!":
            letter = isSecond ? "❗" : "❕";
            break;
        case "?":
            letter = isSecond ? "❓" : "❔";
            break;
        case "$":
            letter = "💲";
            break;

        default:
            letter = "🚫";
            break;
    }
    return letter;
}