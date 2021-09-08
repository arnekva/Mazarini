import { Message, MessageEmbed } from 'discord.js'
import { Channel, Client, DMChannel, NewsChannel, TextChannel } from 'discord.js'
import { globals } from '../globals'
import { betObject, betObjectReturned, DatabaseHelper, dbPrefix } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { ObjectUtils } from '../utils/objectUtils'
import { getUsernameInQuotationMarks } from '../utils/textUtils'
import { ICommandElement } from './commands'

export class GamblingCommands {
    //Todo: Add mz startPoll
    //Todo: Add mz endPoll
    //TOdo: Fikse coins converter
    //Todo: Add Butikk

    static async manageCoins(message: Message, messageContent: string, args: string[]) {
        if (!args[0] && !args[1]) {
            MessageHelper.sendMessage(message, `Feil formattering. <brukernavn> <coins>`)
            return
        }
        const user = args[0]
        const prefix = 'dogeCoin'
        let val: string | number = args[1]
        if (Number(val)) {
            const currentVal = DatabaseHelper.getValue(prefix, user, message)
            if (Number(currentVal)) val = Number(val) + Number(currentVal)
            DatabaseHelper.setValue(prefix, user, val.toString())
            MessageHelper.sendMessage(message, `${user} har nå ${val} dogecoins.`)
        } else MessageHelper.sendMessage(message, `Du må bruke et tall som verdi`)
    }

    static async createBet(message: Message, messageContent: string, args: string[]) {
        const hasActiveBet = DatabaseHelper.getActiveBetObject(message.author.username)
        const userBalance = DatabaseHelper.getValue('chips', message.author.username, message)
        let desc = messageContent
        if (hasActiveBet) {
            message.reply('Du kan bare ha ett aktivt veddemål om gangen. Gjør ferdig ditt gamle, og prøv på nytt')
            return
        }
        let betVal = 100
        if (!isNaN(Number(args[0]))) {
            betVal = Number(args[0])
            desc = desc.slice(args[0].length)
        }
        if (betVal > Number(userBalance)) {
            message.reply('Du har kje råd te dette bro')
            return
        }
        const betString = `${message.author.username} har startet et veddemål: ${desc} (${betVal} chips). Reager med 👍 for JA, 👎 for NEI. Resultat vises om ${globals.TIMEOUT_TIME.name}`
        const startMessage = await MessageHelper.sendMessage(message, betString)
        if (startMessage) {
            startMessage.react('👍')
            startMessage.react('👎')

            setTimeout(function () {
                let fullString = ''
                const positive: string[] = []
                const negative: string[] = []
                const allReactions = startMessage.reactions.cache.forEach((reaction) => {
                    fullString += 'Folk som reagerte med ' + reaction.emoji.name + ':'
                    const users = reaction.users
                    users.cache.forEach((us, ind) => {
                        const userBal = DatabaseHelper.getValue('chips', us.username, message)
                        if (Number(userBal) < betVal && us.username !== 'Mazarini Bot') {
                            fullString += us.username + '(har ikke råd og blir ikke telt med),'
                        } else {
                            if (us.username !== 'Mazarini Bot') {
                                DatabaseHelper.setValue('chips', us.username, (Number(userBal) - betVal).toFixed(2))
                                if (reaction.emoji.name == '👍') positive.push(us.username)
                                else if (reaction.emoji.name == '👎') negative.push(us.username)
                                fullString += us.username == 'Mazarini Bot' ? '' : ' ' + us.username + ','
                            }
                        }
                    })
                    fullString += '\n'
                })
                if (positive.length == 0 && negative.length == 0) {
                    message.reply('Ingen svarte på veddemålet. ')
                    return
                }
                MessageHelper.sendMessage(message, fullString)

                const obj: betObject = {
                    description: desc,
                    messageId: startMessage.id,
                    positivePeople: positive,
                    negativePeople: negative,
                    value: betVal.toFixed(2),
                }
                DatabaseHelper.setActiveBetObject(message.author.username, obj)
            }, globals.TIMEOUT_TIME.time)
        }
    }

    static async resolveBet(message: Message, messageContent: string, args: string[]) {
        const username = message.author.username
        const activeBet = DatabaseHelper.getActiveBetObject(message.author.username) as betObjectReturned
        if (!activeBet) {
            message.reply('Du kan kun lukke veddemål du har startet selv, og du har ingen aktive.')
            return
        }
        if (args[0] === 'slett') {
            let numP = 0
            const negSplit = activeBet.negativePeople.split(',')
            const posSplit = activeBet.positivePeople.split(',')
            if (negSplit[0] !== '') numP += negSplit.length
            if (posSplit[0] !== '') numP += posSplit.length
            GamblingCommands.dealCoins(message, activeBet.value, activeBet.positivePeople.concat(activeBet.negativePeople), numP, true)
            DatabaseHelper.deleteActiveBet(username)
            message.reply('Veddemålet er slettet, og beløp er tilbakebetalt.')
            return
        }
        if (args[0].toLocaleLowerCase() !== 'nei' && args[0].toLocaleLowerCase() !== 'ja') {
            message.reply("Du må legge til om det var 'ja' eller 'nei' som var utfallet av veddemålet")
            return
        }
        DatabaseHelper.deleteActiveBet(username)
        if (ObjectUtils.instanceOfBetObject(activeBet)) {
            const resolveMessage = await MessageHelper.sendMessage(
                message,
                `${username} vil gjøre opp ett veddemål: ${activeBet.description}. Reager med 👍 for å godkjenne (Trenger 3). Venter ${globals.TIMEOUT_TIME.name}. `
            )
            if (resolveMessage) {
                resolveMessage.react('👍')
                let positiveCounter = 0

                setTimeout(function () {
                    const allReactions = resolveMessage.reactions.cache.forEach((reaction) => {
                        const users = reaction.users
                        users.cache.forEach((us, ind) => {
                            if (reaction.emoji.name == '👍') positiveCounter++
                        })
                    })
                    if (positiveCounter > 2) {
                        const isPositive = args[0].toLocaleLowerCase() === 'ja'
                        MessageHelper.sendMessage(message, `Veddemålsresultatet er godkjent. Beløpene blir nå lagt til på kontoene. `)
                        const value = activeBet.value

                        GamblingCommands.dealCoins(
                            message,
                            activeBet.value,
                            isPositive ? activeBet.positivePeople : activeBet.negativePeople,
                            activeBet.negativePeople.split(',').length + activeBet.positivePeople.split(',').length
                        )
                        DatabaseHelper.deleteActiveBet(username)
                    } else {
                        MessageHelper.sendMessage(message, `Veddemålsresultatet ble ikke godkjent. Diskuter og prøv igjen.`)
                        DatabaseHelper.setActiveBetObject(message.author.username, activeBet)
                    }
                }, globals.TIMEOUT_TIME.time) //Sett til 60000
            }
        } else {
            message.reply('object is not instance of betObject. why tho')
        }
    }
    static showActiveBet(message: Message, content: string, args: string[]) {
        const username = args[0] ?? message.author.username
        const activeBet = DatabaseHelper.getActiveBetObject(username) as betObject
        if (!activeBet) {
            message.reply('Du har ingen aktive veddemål')
            return
        }

        const betMessage = new MessageEmbed()
            .setTitle('🍀🎰 Veddemål 🤞🎲')
            .setDescription(`Du har et aktivt veddemål om: '${activeBet.description}'`)
            .addField('JA', `${activeBet.positivePeople.length < 1 ? 'Ingen' : activeBet.positivePeople}`)
            .addField('NEI', `${activeBet.negativePeople.length < 1 ? 'Ingen' : activeBet.negativePeople}`)
            .addField('Verdi', `${activeBet.value.length < 1 ? '0' : activeBet.value}`)
        MessageHelper.sendFormattedMessage(message, betMessage)
    }
    static async krig(message: Message, content: string, args: string[]) {
        if (!ArrayUtils.checkArgsLength(args, 2)) {
            message.reply('du må oppgi mengde og person. <nummer> <username>')
            return
        }

        let username = getUsernameInQuotationMarks(content) ?? args[1]
        const amount = args[0]

        if (isNaN(Number(amount)) || Number(amount) < 1) {
            message.reply('du må oppgi et gyldig tall')
            return
        }
        let engagerValue = Number(DatabaseHelper.getValue('chips', message.author.username, message))
        let victimValue = Number(DatabaseHelper.getValue('chips', username, message))
        const amountAsNum = Number(amount)
        if (Number(engagerValue) < amountAsNum || Number(victimValue) < amountAsNum) {
            message.reply('en av dere har ikke råd til å utføre denne krigen her.')
            return
        }
        const resolveMessage = await MessageHelper.sendMessage(
            message,
            `${message.author.username} vil gå til krig med deg, ${username}. Reager med 👍 for å godkjenne. Venter ${globals.TIMEOUT_TIME.name}. Den som starter krigen ruller for 0-49.`
        )
        if (resolveMessage) {
            resolveMessage.react('👍')
            let positiveCounter = 0

            setTimeout(async function () {
                const thumbsUp = resolveMessage.reactions.cache.find((emoji) => emoji.emoji.name == '👍')
                // console.log(reaction.users)
                if (thumbsUp) {
                    const users = await thumbsUp.users.fetch()
                    users.forEach((us, ind) => {
                        if (us.username == username) positiveCounter++
                    })
                }
                if (positiveCounter > 0) {
                    const roll = Math.floor(Math.random() * 101)

                    const gambling = new MessageEmbed()
                        .setTitle('⚔️ Krig ⚔️')
                        .setDescription(
                            `Terningen trillet: ${roll}/100. ${roll < 51 ? (roll == 50 ? 'Bot Høie' : message.author.username) : username} vant! 💰💰`
                        )

                    if (roll < 50) {
                        engagerValue += amountAsNum
                        victimValue -= amountAsNum
                    } else if (roll > 50) {
                        engagerValue -= amountAsNum
                        victimValue += amountAsNum
                    } else if (roll == 50) {
                        engagerValue -= amountAsNum
                        victimValue -= amountAsNum
                    }

                    gambling.addField(
                        `${message.author.username}`,
                        `Du har nå ${engagerValue.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                        })} chips`
                    )
                    gambling.addField(
                        `${username}`,
                        `Du har nå ${victimValue.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                        })} chips`
                    )
                    MessageHelper.sendFormattedMessage(message, gambling)
                    DatabaseHelper.setValue('chips', message.author.username, engagerValue.toFixed(2))
                    DatabaseHelper.setValue('chips', username, victimValue.toFixed(2))
                } else {
                    MessageHelper.sendMessage(message, `${username} godkjente ikke krigen.`)
                    // DatabaseHelper.setValue("dogeCoin", message.author.username, (engagerValue-100).toFixed(2))
                }
            }, globals.TIMEOUT_TIME.time) //Sett til 60000
        }
    }

    static diceGamble(message: Message, content: string, args: string[]) {
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        const argumentVal = args[0]
        if (!argumentVal || isNaN(Number(argumentVal))) {
            message.reply('Du må si hvor mye du vil gamble')
            return
        }
        if (userMoney) {
            if (Number(argumentVal) > Number(userMoney)) {
                message.reply('Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank')
                return
            } else if (Number(argumentVal) < 0) {
                message.reply('Du må gamble med et positivt tall, bro')
                return
            }
        }
        if (argumentVal && Number(argumentVal)) {
            const valAsNum = Number(Number(argumentVal).toFixed(2))
            const roll = Math.floor(Math.random() * 100) + 1
            const hasDebtPenalty = DatabaseHelper.getValueWithoutMessage('debtPenalty', message.author.username) === 'true'
            let rate = 185

            let newMoneyValue = 0
            let interest = 0
            let multiplier = GamblingCommands.getMultiplier(roll, valAsNum)
            if (roll >= 50) {
                newMoneyValue = this.calculatedNewMoneyValue(message, multiplier, valAsNum, userMoney)
            } else newMoneyValue = Number(userMoney) - valAsNum

            if (newMoneyValue > Number.MAX_SAFE_INTEGER) {
                message.reply(
                    'Du har nådd et så høyt tall at programmeringsspråket ikke lenger kan gjøre trygge operasjoner på det. Du kan fortsette å gamble, men noen funksjoner kan virke ustabile'
                )
            }
            DatabaseHelper.setValue('chips', message.author.username, newMoneyValue.toFixed(2))

            const gambling = new MessageEmbed().setTitle('Gambling 🎲').setDescription(
                `${message.author.username} gamblet ${valAsNum} av ${userMoney} chips.\nTerningen trillet: ${roll}/100. Du ${
                    roll >= 50 ? 'vant! 💰💰 (' + (Number(multiplier) + 1) + 'x)' : 'tapte 💸💸'
                }\nDu har nå ${newMoneyValue.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                })} chips.`
            )
            if (roll >= 100) gambling.addField(`Trillet 100!`, `Du trillet 100 og vant ${multiplier} ganger så mye som du satset!`)
            if (hasDebtPenalty && roll >= 50)
                gambling.addField(
                    `Gjeld`,
                    `Du er i høy gjeld, og banken har krevd inn ${interest.toFixed(2)} chips (${(100 - (100 - (1 - rate) * 100)).toFixed(0)}%)`
                )
            MessageHelper.sendFormattedMessage(message, gambling)
        }
    }
    static roulette(message: Message, content: string, args: string[]) {
        let userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        const stake = args[0]
        const betOn = args[1]
        if (!stake || isNaN(Number(stake))) {
            message.reply('Du må si hvor mye du vil gamble')
            return
        }
        if (!betOn) {
            message.reply('Så du bare setter chips på ingenting?')
            return
        }
        if (args.length > 2) {
            message.reply('Helvedde.. Tror kanskje du må spørre om hjelp for å formattere deg riktig')
            return
        }
        if (userMoney) {
            if (Number(stake) > Number(userMoney)) {
                message.reply('Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank')
                return
            } else if (Number(stake) < 0 || Number(stake) === 0) {
                message.reply('Du prøver å gamble med en ulovlig verdi.')
                return
            }
        }
        //FIXME: multiplier is wrong (1 instead of 2) because no money is taken before the gamble. Therefore, awarding x2 on win results in x3, as the initial bet was not drawn from the account
        //E.g. having 1000 coins, then gambling 500 and winning should first take you down to 500 chips, and then be awarding 2x500=1000 chips for a total sum of 1500 chips. Now you would get 1000+(500x2) = 2000, since the initial 500 was never taken away.
        if (stake && Number(stake) && betOn) {
            const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
            const valAsNum = Number(Number(stake).toFixed(2))
            const roll = Math.floor(Math.random() * 37)
            let multiplier = 1
            let won = false
            if (!isNaN(Number(betOn)) && Number(betOn) >= 0 && Number(betOn) <= 37) {
                if (roll == Number(betOn)) {
                    won = true
                    multiplier = 36
                }
            } else {
                if (['red', 'rød', 'raud', 'røde'].includes(betOn.toLowerCase())) {
                    if (red.includes(roll)) {
                        won = true
                        multiplier = 1
                    }
                } else if (['svart', 'black', 'sort', 'sorte'].includes(betOn.toLowerCase())) {
                    if (!red.includes(roll) && !(roll == 0)) {
                        won = true
                        multiplier = 1
                    }
                } else if (['green', 'grønn', 'grøn'].includes(betOn.toLowerCase())) {
                    if (roll == 0) {
                        won = true
                        multiplier = 36
                    }
                } else if (['odd', 'oddetall'].includes(betOn.toLowerCase())) {
                    if (roll % 2 == 1) {
                        won = true
                        multiplier = 1
                    }
                } else if (['par', 'partall', 'even'].includes(betOn.toLowerCase())) {
                    if (roll % 2 == 0) {
                        won = true
                        multiplier = 1
                    }
                } else {
                    message.reply('Lol, kan du ikke rulett eller?')
                    return
                }
            }

            const hasDebtPenalty = DatabaseHelper.getValueWithoutMessage('debtPenalty', message.author.username) === 'true'
            let rate = 185
            let newMoneyValue = 0
            let interest = 0

            if (won) newMoneyValue = this.calculatedNewMoneyValue(message, multiplier, valAsNum, userMoney)
            else newMoneyValue = Number(userMoney) - valAsNum

            if (newMoneyValue > Number.MAX_SAFE_INTEGER) {
                message.reply(
                    'Du har nådd et så høyt tall at programmeringsspråket ikke lenger kan gjøre trygge operasjoner på det. Du kan fortsette å gamble, men noen funksjoner kan virke ustabile'
                )
            }
            DatabaseHelper.setValue('chips', message.author.username, newMoneyValue.toFixed(2))

            let result = ''
            if (roll == 0) {
                result = roll + ' grønn(!)'
            } else if (red.includes(roll)) {
                result = roll + ' rød'
            } else {
                result = roll + ' sort'
            }
            const gambling = new MessageEmbed().setTitle('Rulett 🎲').setDescription(
                `${message.author.username} satset ${valAsNum} av ${userMoney} chips på ${betOn}.\nBallen landet på: ${result}. Du ${
                    won ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'
                }\nDu har nå ${newMoneyValue.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                })} chips.`
            )
            if (hasDebtPenalty && roll >= 50)
                gambling.addField(
                    `Gjeld`,
                    `Du er i høy gjeld, og banken har krevd inn ${interest.toFixed(2)} chips (${(100 - (100 - (1 - rate) * 100)).toFixed(0)}%)`
                )
            MessageHelper.sendFormattedMessage(message, gambling)
        }
    }
    static getMultiplier(roll: number, amountBet: number) {
        if (roll >= 100) return 5
        return 2
    }

    static calculatedNewMoneyValue(message: Message, multiplier: number, valAsNum: number, userMoney: number) {
        const hasDebtPenalty = DatabaseHelper.getValueWithoutMessage('debtPenalty', message.author.username) === 'true'
        let rate = 185
        let newMoneyValue = 0
        let interest = 0

        if (hasDebtPenalty) {
            const mp = DatabaseHelper.getValue('debtMultiplier', message.author.username, message)
            rate = (rate - mp) / 100 - 1

            interest = multiplier * valAsNum - valAsNum * rate
        }
        newMoneyValue = Number(userMoney) + multiplier * valAsNum - interest - valAsNum
        return newMoneyValue
    }
    static bailout(message: Message) {
        const canBailout = false
        const userCoins = DatabaseHelper.getValue('chips', message.author.username, message)
        // if(canBailout === "true" && Number(userCoins) < 100000){
        //     message.reply(`${message.author.username} har mottatt en redningspakke fra MazariniBank på 500,000,000.`)
        //     DatabaseHelper.setValue("dogeCoin", message.author.username, "500000000");
        // } else {
        message.reply('Beklager, MazariniBank gir ikke ut redningspakker.')
        // }
    }

    static takeUpLoan(message: Message, content: string, args: string[]) {
        let amountToLoan = 1000
        if (args[0]) {
            const argAsNum = Number(args[0])

            if (isNaN(argAsNum)) {
                message.reply('du har oppgitt et ugyldig tall')
                return
            } else if (argAsNum > 1000) {
                message.reply('du kan låne maks 1000 chips')
                return
            } else if (argAsNum < 1) {
                message.reply('Kan kje låna mindre enn 1 chip')
                return
            }
            amountToLoan = argAsNum
        }
        const username = message.author.username
        const totalLoans = DatabaseHelper.getValue('loanCounter', username, message)
        const totalDebt = DatabaseHelper.getValue('debt', username, message)
        const debtMultiplier = DatabaseHelper.getValue('debtMultiplier', username, message)
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        if (Number(debtMultiplier) > 184) {
            message.reply('Nå e du bare 100% fucked, snakkes')
            return
        }
        const newTotalLoans = Number(totalLoans) + 1
        const newDebt = Number(totalDebt) + amountToLoan * 1.15
        if (newDebt > 20000) {
            message.reply(
                `Du har nå mye gjeld. Banken vil nå ta ${
                    15 + Number(debtMultiplier)
                }% av alle gevinster som renter. Disse vil ikke telle på nedbetaling av lånet. Dersom du fortsetter å låne nå vil rentesatsen stige ytterligere `
            )
            DatabaseHelper.setValue('debtPenalty', username, 'true')
            DatabaseHelper.incrementValue('debtMultiplier', username, '1')
        } else {
            DatabaseHelper.setValue('debtPenalty', username, 'false')
        }
        DatabaseHelper.setValue('loanCounter', username, newTotalLoans.toString())
        DatabaseHelper.setValue('debt', username, newDebt.toFixed(2))
        const newCoinsVal = Number(userMoney) + amountToLoan
        DatabaseHelper.setValue('chips', username, newCoinsVal.toFixed(2))

        MessageHelper.sendMessage(
            message,
            `${username}, du har nå lånt ${amountToLoan.toFixed(2)} chips med 15% rente. Spend them well. Din totale gjeld er nå: ${newDebt.toFixed(
                2
            )} (${newTotalLoans} lån gjort)`
        )
    }

    static payDownDebt(message: Message, content: string, args: string[]) {
        const username = message.author.username
        const totalDebt = DatabaseHelper.getValue('debt', username, message)
        const hasDebtPenalty = DatabaseHelper.getValue('debtPenalty', username, message)
        const debtMultiplier = DatabaseHelper.getValue('debtMultiplier', username, message)
        if (Number(totalDebt) <= 0) {
            message.reply('Du har ingen lån')
            return
        }
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        const wantsToPayDownThisAmount = Number(args[0])
        if (wantsToPayDownThisAmount < 0) {
            message.reply('skriv inn et positivt tall, bro')
            return
        }
        if (!isNaN(wantsToPayDownThisAmount)) {
            let newTotal = Number(totalDebt) - Number(args[0])

            const userMasNumber = Number(userMoney)
            if (userMasNumber < wantsToPayDownThisAmount) {
                message.reply('du har ikke råd til dette.')
                return
            } else {
                let backToPayer = 0
                if (newTotal < 0) {
                    message.reply('du har betalt ' + Math.abs(newTotal) + ' for mye på lånet ditt. Dette blir tilbakebetalt. ')
                    backToPayer = Math.abs(newTotal)
                }
                newTotal += backToPayer
                DatabaseHelper.setValue('debt', username, newTotal.toFixed(2))
                const newDogeCoinsCOunter = Number(userMoney) - wantsToPayDownThisAmount + backToPayer
                DatabaseHelper.setValue('chips', username, newDogeCoinsCOunter.toFixed(2))
                if (wantsToPayDownThisAmount > 1000 && hasDebtPenalty === 'true' && newTotal > 20000) {
                    if (Number(debtMultiplier) > 15) {
                        message.reply('Du har betalt ned mer enn 1000 på lånet ditt. Banken senker strafferenten din med 0.01% :) ')
                        DatabaseHelper.decrementValue('debtMultiplier', username, '1')
                    }
                }

                if (hasDebtPenalty === 'true' && newTotal < 20000) {
                    message.reply('Du har senket lånet ditt til under 20.000 chips. Banken fjerner strafferenten (for nå) :)')
                    DatabaseHelper.setValue('debtPenalty', username, 'false')
                    //Resett multiplier
                    DatabaseHelper.setValue('debtMultiplier', username, '15')
                }
                MessageHelper.sendMessage(
                    message,
                    `Du har nå betalt ned ${wantsToPayDownThisAmount.toFixed(2)} av lånet ditt på ${totalDebt}. Lånet er nå på ${newTotal.toFixed(
                        2
                    )} og du har ${newDogeCoinsCOunter.toFixed(2)} chips igjen.`
                )
            }
        } else {
            message.reply('Du har ikke skrevet inn et tall')
        }
    }
    static vippsCoins(message: Message, content: string, args: string[]) {
        if (!args[0]) {
            message.reply('du må sei kem du ska vippsa, bro')
            return
        }
        if (!args[1]) {
            message.reply('du må sei kor møye du ska vippsa, bro')
            return
        }

        let userWhoGetsCoins = args[0]
        let coinsToVipps = args[1]
        if (isNaN(Number(args[1]))) {
            userWhoGetsCoins = args[0] + ' ' + args[1]
            coinsToVipps = args[2]
        }
        if (Number(coinsToVipps) < 1) {
            message.reply('Må vippse minst 1 coin, bro')
            return
        }

        const authorBalance = Number(DatabaseHelper.getValue('dogeCoin', message.author.username, message))
        if (authorBalance >= Number(coinsToVipps)) {
            //go ahead
            if (DatabaseHelper.findUserByUsername(userWhoGetsCoins, message)) {
                const newBalance = authorBalance - Number(coinsToVipps)
                DatabaseHelper.setValue('dogeCoin', message.author.username, newBalance.toFixed(2))
                DatabaseHelper.incrementValue('dogeCoin', userWhoGetsCoins, coinsToVipps)
                MessageHelper.sendMessage(message, `${message.author.username} vippset ${userWhoGetsCoins} ${coinsToVipps}.`)
            } else {
                message.reply('finner ingen bruker med det navnet')
            }
        } else {
            message.reply('du har ikkje råd te å vippsa så møye, bro (Man kan ikkje vippsa chips for gambling).')
        }
    }
    static dealCoins(message: Message, value: string, peopleGettingCoins: string, numP: number, noDefaultPott?: boolean) {
        const peopleCoins = peopleGettingCoins.split(',').filter((u) => u !== 'Mazarini Bot')
        const basePot = noDefaultPott ? 0 : 50
        let pot = basePot
        const val = Number(value)
        pot += val * numP
        const shareOfCoins = pot / peopleCoins.length
        let moneyString = ''
        peopleCoins.forEach((username) => {
            if (!!username.trim()) {
                const currentUser = DatabaseHelper.findUserByUsername(username, message)
                const userCoins = DatabaseHelper.getValue('chips', username, message) as number
                const newValue = Number(userCoins) + Number(shareOfCoins.toFixed(0))
                if (isNaN(newValue) || isNaN(userCoins)) {
                    message.reply(
                        "en av verdiene fra databasen kan ikke konverteres til et tall. newValue: '" +
                            newValue +
                            "', userCoins: '" +
                            userCoins +
                            "'. Hendelsen blir loggført slik at en nerd kan se nærmere på det."
                    )
                    MessageHelper.sendMessageToActionLogWithDefaultMessage(message, `Trigget dealcoins med enten undefined eller NaN verdi på coins. `)
                }
                DatabaseHelper.setValue('chips', username, newValue.toString())
                moneyString += `${username}: ${userCoins} -> ${newValue}\n`
            }
        })
        MessageHelper.sendMessage(message, moneyString)
    }

    static async checkCoins(message: Message, messageContent: string, args: string[]) {
        let username: string
        if (!args[0]) {
            username = message.author.username
        } else username = getUsernameInQuotationMarks(messageContent) ?? args[0]

        const val = DatabaseHelper.getValue('dogeCoin', username, message)
        MessageHelper.sendMessage(
            message,
            `${username} har ${Number(val).toLocaleString(undefined, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
            })} coins`
        )
    }
    static async checkChips(message: Message, messageContent: string, args: string[]) {
        let username
        if (!args[0]) {
            username = message.author.username
        } else username = getUsernameInQuotationMarks(messageContent) ?? args[0]

        const val = DatabaseHelper.getValue('chips', username, message)
        MessageHelper.sendMessage(
            message,
            `${username} har ${Number(val).toLocaleString(undefined, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
            })} chips`
        )
    }

    static readonly addCoinsCommand: ICommandElement = {
        commandName: 'coins',
        description: 'Legg til eller fjern coins fra en person. <Brukernavn> <verdi> (pluss/minus)',
        hideFromListing: true,
        isAdmin: true,
        isSuperAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.manageCoins(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly takeLoanCommand: ICommandElement = {
        commandName: 'lån',
        description: 'Lån chips fra banken',

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.takeUpLoan(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly payDebtCommand: ICommandElement = {
        commandName: 'betal',
        description: 'Betal på lånet ditt. <number>',

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.payDownDebt(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly bailoutCommand: ICommandElement = {
        commandName: 'bailout',
        description: 'Motta en bailout fra MazariniBank',

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.bailout(rawMessage)
        },
        category: 'gambling',
    }
    static readonly krigCommand: ICommandElement = {
        commandName: 'krig',
        description: 'Gå til krig. <nummer> <username>',

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.krig(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly showActiveBetCommand: ICommandElement = {
        commandName: 'visbet',
        description: 'Vis en brukers aktive veddemål',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.showActiveBet(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly vippsCommand: ICommandElement = {
        commandName: 'vipps',
        description: 'Vipps til en annen bruker. <number>',

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.vippsCoins(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly gambleCoins: ICommandElement = {
        commandName: 'gamble',
        description:
            'Gambla coinså dine! Skriv inn mengde coins du vil gambla, så kan du vinna. Tilbakebetaling blir høyere jo høyere terningen triller (1.1x for 50 opp till 5x for 100)',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.diceGamble(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly rulett: ICommandElement = {
        commandName: 'rulett',
        description:
            'Gambla chipså dine! Skriv inn mengde coins du vil gambla og ikke minst ka du gamble de på, så kan du vinna. Tilbakebetaling blir høyere jo større risiko du tar. Lykke til!' +
            "\nHer kan du gambla på tall, farge eller partall/oddetall. Eksempel: '!mz rulett 1000 svart",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.roulette(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly gambleCoinsShort: ICommandElement = {
        commandName: 'g',
        description: "Se 'gamble'",
        hideFromListing: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.diceGamble(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }

    static readonly walletCommand: ICommandElement = {
        commandName: 'wallet',
        description: 'Se antall coins til en person',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.checkCoins(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly checkChipsCommand: ICommandElement = {
        commandName: 'chips',
        description: 'Se antall chips en person har til gambling',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.checkChips(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly createBetCommand: ICommandElement = {
        commandName: 'bet',
        description: 'Start et ja/nei veddemål',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.createBet(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
    static readonly resolveBetCommand: ICommandElement = {
        commandName: 'resolve',
        description: 'Resolve veddemålet',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.resolveBet(rawMessage, messageContent, args)
        },
        category: 'gambling',
    }
}
