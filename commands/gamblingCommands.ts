import { Client, Message, MessageEmbed, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { globals } from '../globals'
import { betObject, betObjectReturned, DatabaseHelper, dbPrefix } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { findLetterEmoji } from '../utils/miscUtils'
import { getRndInteger } from '../utils/randomUtils'
import { splitUsername } from '../utils/textUtils'
import { UserUtils } from '../utils/userUtils'

export interface IDailyPriceClaim {
    streak: number
    wasAddedToday: boolean
}
export class GamblingCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async manageCoins(message: Message, messageContent: string, args: string[]) {
        if (!args[0] && !args[1]) {
            this.messageHelper.sendMessage(message.channelId, `Feil formattering. <brukernavn> <coins>`)
            return
        }
        const user = args[0]
        const prefix = 'dogeCoin'
        let val: string | number = args[1]
        if (Number(val)) {
            const currentVal = DatabaseHelper.getValue(prefix, user, message)
            if (Number(currentVal)) val = Number(val) + Number(currentVal)
            DatabaseHelper.setValue(prefix, user, val.toString())
            this.messageHelper.sendMessage(message.channelId, `${user} har nå ${val} dogecoins.`)
        } else this.messageHelper.sendMessage(message.channelId, `Du må bruke et tall som verdi`)
    }

    private async createBet(message: Message, messageContent: string, args: string[]) {
        const hasActiveBet = DatabaseHelper.getActiveBetObject(message.author.username)
        const userBalance = DatabaseHelper.getValue('chips', message.author.username, message)
        let desc = messageContent
        this
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
        const startMessage = await this.messageHelper.sendMessage(message.channelId, betString)
        if (startMessage) {
            this.messageHelper.reactWithThumbs(startMessage, 'up')
            this.messageHelper.reactWithThumbs(startMessage, 'down')
            const _msg = this.messageHelper
            setTimeout(async function () {
                let fullString = ''
                const positive: string[] = []
                const negative: string[] = []

                const thumbsUp = startMessage.reactions.cache.find((emoji) => emoji.emoji.name == '👍')
                if (thumbsUp) {
                    const users = await thumbsUp.users.fetch()
                    users.forEach((us, ind) => {
                        const userBal = DatabaseHelper.getValue('chips', us.username, message)
                        if (us.id === '802945796457758760') return
                        if (Number(userBal) < betVal && us.id !== '802945796457758760') {
                            fullString += us.username + '(har ikke råd og blir ikke telt med),'
                        } else {
                            if (us.username !== 'MazariniBot') {
                                DatabaseHelper.setValue('chips', us.username, (Number(userBal) - betVal).toFixed(2))
                                positive.push(us.username)
                                fullString += us.username == 'Mazarini Bot' ? '' : ' ' + us.username + ','
                            }
                        }
                    })
                    fullString += '\n'
                }
                const thumbsDown = startMessage.reactions.cache.find((emoji) => emoji.emoji.name == '👎')
                if (thumbsDown) {
                    const users = await thumbsDown.users.fetch()
                    users.forEach((us, ind) => {
                        const userBal = DatabaseHelper.getValue('chips', us.username, message)
                        if (Number(userBal) < betVal && us.username !== 'Mazarini Bot') {
                            fullString += us.username + '(har ikke råd og blir ikke telt med),'
                        } else {
                            if (us.username !== 'MazariniBot') {
                                DatabaseHelper.setValue('chips', us.username, (Number(userBal) - betVal).toFixed(2))
                                negative.push(us.username)
                                fullString += us.username == 'Mazarini Bot' ? '' : ' ' + us.username + ','
                            }
                        }
                    })
                    fullString += '\n'
                }
                if (positive.length == 0 && negative.length == 0) {
                    message.reply('Ingen svarte på veddemålet. ')
                    return
                }
                _msg.sendMessage(message.channelId, fullString)

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

    private async resolveBet(message: Message, messageContent: string, args: string[]) {
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
            this.dealCoins(message, activeBet.value, activeBet.positivePeople.concat(activeBet.negativePeople), numP, true)
            DatabaseHelper.deleteActiveBet(username)
            message.reply('Veddemålet er slettet, og beløp er tilbakebetalt.')
            return
        }
        if (args[0].toLocaleLowerCase() !== 'nei' && args[0].toLocaleLowerCase() !== 'ja') {
            message.reply("Du må legge til om det var 'ja' eller 'nei' som var utfallet av veddemålet")
            return
        }
        DatabaseHelper.deleteActiveBet(username)
        const resolveMessage = await this.messageHelper.sendMessage(
            message.channelId,
            `${username} vil gjøre opp ett veddemål: ${activeBet.description}. Reager med 👍 for å godkjenne (Trenger 3).`
        )
        if (resolveMessage) {
            this.messageHelper.reactWithThumbs(resolveMessage, 'up')
            const collector = resolveMessage.createReactionCollector()
            collector.on('collect', (reaction) => {
                if (reaction.emoji.name === '👍' && reaction.users.cache.size > 2) {
                    const isPositive = args[0].toLocaleLowerCase() === 'ja'
                    this.messageHelper.sendMessage(message.channelId, `Veddemålsresultatet er godkjent. Beløpene blir nå lagt til på kontoene. `)

                    this.dealCoins(
                        message,
                        activeBet.value,
                        isPositive ? activeBet.positivePeople : activeBet.negativePeople,
                        activeBet.negativePeople.split(',').length + activeBet.positivePeople.split(',').length
                    )
                    DatabaseHelper.deleteActiveBet(username)
                    collector.stop()
                }
            })
        }
    }
    private showActiveBet(message: Message, content: string, args: string[]) {
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
        this.messageHelper.sendFormattedMessage(message.channel as TextChannel, betMessage)
    }

    private async krig(message: Message, content: string, args: string[]) {
        if (!ArrayUtils.checkArgsLength(args, 2)) {
            message.reply('du må oppgi mengde og person')
            return
        }
        let username = ''
        let username1 = splitUsername(args[0])
        let username2 = splitUsername(args[1])

        const user0Exists = UserUtils.findUserByUsername(username1, message)
        const user1Exists = UserUtils.findUserByUsername(username2, message)
        const amount = user0Exists ? args[1] : args[0]

        if (user0Exists) username = user0Exists.username
        if (user1Exists) username = user1Exists.username

        if (!user0Exists && !user1Exists) {
            message.reply('Du må skrive inn et gyldig brukernavn')
            return
        }
        if ((isNaN(Number(amount)) || Number(amount) < 1) && amount !== 'alt') {
            message.reply('Tallet du har skrevet inn er ikke gyldig')
            return
        }
        const getUserWallets = (engagerUsername: string, victimUsername: string): { engagerChips: number; victimChips: number } => {
            const engagerValue = Number(DatabaseHelper.getValue('chips', message.author.username, message))
            const victimValue = Number(DatabaseHelper.getValue('chips', username, message))
            return {
                engagerChips: engagerValue,
                victimChips: victimValue,
            }
        }
        const userWallets = getUserWallets(message.author.username, username)
        let engagerValue = userWallets.engagerChips
        let victimValue = userWallets.victimChips
        const amountIsAll = amount === 'alt'
        const largestPossibleValue = Math.min(engagerValue, victimValue)
        let amountAsNum = amountIsAll ? largestPossibleValue : Number(amount)
        if (Number(engagerValue) < amountAsNum) {
            message.reply('Dette har du ikke råd til.')
            return
        } else if (Number(victimValue) < amountAsNum) {
            message.reply('Dette har ikke motstanderen din råd til.')
            return
        } else if (amountAsNum === 0) {
            message.reply('Du kan kje gå te krig over 0 chips')
            return
        }
        const user = UserUtils.findUserByUsername(username, message)
        const resolveMessage = await this.messageHelper.sendMessage(
            message.channelId,
            `${message.author.username} vil gå til krig med deg, ${
                user ? '<@' + user.id + '>' : username
            }. Reager med 👍 for å godkjenne. Den som starter krigen ruller for 0-49.`
        )
        if (resolveMessage) {
            this.messageHelper.reactWithThumbs(resolveMessage, 'up')

            const collector = resolveMessage.createReactionCollector()
            collector.on('collect', (reaction) => {
                const currentValue = getUserWallets(message.author.username, username)
                engagerValue = currentValue.engagerChips
                victimValue = currentValue.victimChips
                if (amountIsAll) {
                    amountAsNum = Math.min(engagerValue, victimValue)
                }
                if (engagerValue < amountAsNum || victimValue < amountAsNum) {
                    message.reply('En av deltakerene har ikke lenger råd til å fullføre krigen. ')
                    collector.stop()
                    return
                }
                if (reaction.emoji.name === '👍' && reaction.users.cache.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
                    const shouldAlwaysLose = username === message.author.username || username === 'MazariniBot'
                    const roll = getRndInteger(0, 100)
                    let description = `Terningen trillet: ${roll}/100. ${roll < 51 ? (roll == 50 ? 'Bot Høie' : message.author.username) : username} vant! 💰💰`
                    if (shouldAlwaysLose) {
                        description = `${
                            username === message.author.username
                                ? 'Du gikk til krig mot deg selv. Dette liker ikke Bot Høie, og tar derfor pengene.'
                                : 'Huset vinner alltid'
                        }`
                    }
                    const gambling = new MessageEmbed().setTitle('⚔️ Krig ⚔️').setDescription(description)
                    if (roll == 50 || shouldAlwaysLose) {
                        engagerValue -= amountAsNum
                        victimValue -= amountAsNum
                    } else if (roll < 50) {
                        engagerValue += amountAsNum
                        victimValue -= amountAsNum
                    } else if (roll > 50) {
                        engagerValue -= amountAsNum
                        victimValue += amountAsNum
                    }
                    if (shouldAlwaysLose) {
                        gambling.addField(
                            `${message.author.username}`,
                            `Du har nå ${engagerValue.toLocaleString('nb', {
                                maximumFractionDigits: 2,
                                minimumFractionDigits: 2,
                            })} chips`
                        )
                    } else {
                        gambling.addField(
                            `${message.author.username}`,
                            `Du har nå ${engagerValue.toLocaleString('nb', {
                                maximumFractionDigits: 2,
                                minimumFractionDigits: 2,
                            })} chips`
                        )
                        gambling.addField(
                            `${username}`,
                            `Du har nå ${victimValue.toLocaleString('nb', {
                                maximumFractionDigits: 2,
                                minimumFractionDigits: 2,
                            })} chips`
                        )
                    }
                    this.messageHelper.sendFormattedMessage(message.channel as TextChannel, gambling)
                    DatabaseHelper.setValue('chips', message.author.username, engagerValue.toFixed(2))
                    DatabaseHelper.setValue('chips', username, victimValue.toFixed(2))
                    collector.stop()
                }
            })
        }
    }

    private isLegalWar(engager: string, victim: string) {}

    private diceGamble(message: Message, content: string, args: string[]) {
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        let value = args[0]
        if (value === 'alt' || value === 'all') value = userMoney
        if (!value || isNaN(Number(value))) {
            message.reply('Du må si hvor mye du vil gamble')
            return
        }
        if (userMoney) {
            if (Number(value) > Number(userMoney)) {
                message.reply('Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank')
                return
            } else if (Number(value) < 1) {
                message.reply('Du må satsa minst 1 chip')
                return
            }
        } else {
            message.reply('Du har nok ikkje råd te dette')
            return
        }
        if (value && Number(value)) {
            const valAsNum = Number(Number(value).toFixed(0))
            const roll = Math.floor(Math.random() * 100) + 1
            const hasDebtPenalty = DatabaseHelper.getValueWithoutMessage('debtPenalty', message.author.username) === 'true'

            let newMoneyValue = 0
            let multiplier = this.getMultiplier(roll, valAsNum)
            const calculatedValue = this.calculatedNewMoneyValue(message, multiplier, valAsNum, userMoney)
            let interest = calculatedValue.interestAmount
            if (roll >= 50) {
                newMoneyValue = calculatedValue.newMoneyValue
            } else newMoneyValue = Number(userMoney) - valAsNum

            if (newMoneyValue > Number.MAX_SAFE_INTEGER) {
                message.reply(
                    'Du har nådd et så høyt tall at programmeringsspråket ikke lenger kan gjøre trygge operasjoner på det. Du kan fortsette å gamble, men noen funksjoner kan virke ustabile'
                )
            }
            DatabaseHelper.setValue('chips', message.author.username, newMoneyValue.toFixed(0))

            const gambling = new MessageEmbed().setTitle('Gambling 🎲').setDescription(
                `${message.author.username} gamblet ${valAsNum.toLocaleString('nb', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                })} av ${Number(userMoney).toLocaleString('nb', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                })} chips.\nTerningen trillet: ${roll}/100. Du ${
                    roll >= 50 ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'
                }\nDu har nå ${newMoneyValue.toLocaleString('nb', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                })} chips.`
            )
            if (roll >= 100) gambling.addField(`Trillet 100!`, `Du trillet 100 og vant ${multiplier} ganger så mye som du satset!`)
            if (hasDebtPenalty && roll >= 50)
                gambling.addField(`Gjeld`, `Du er i høy gjeld, og banken har krevd inn ${interest.toFixed(0)} chips (${calculatedValue.rate.toFixed(0)}%)`)
            this.messageHelper.sendFormattedMessage(message.channel as TextChannel, gambling)
        }
    }

    private roulette(message: Message, content: string, args: string[]) {
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
                        multiplier = 2
                    }
                } else if (['svart', 'black', 'sort', 'sorte'].includes(betOn.toLowerCase())) {
                    if (!red.includes(roll) && !(roll == 0)) {
                        won = true
                        multiplier = 2
                    }
                } else if (['green', 'grønn', 'grøn'].includes(betOn.toLowerCase())) {
                    if (roll == 0) {
                        won = true
                        multiplier = 36
                    }
                } else if (['odd', 'oddetall'].includes(betOn.toLowerCase())) {
                    if (roll % 2 == 1) {
                        won = true
                        multiplier = 2
                    }
                } else if (['par', 'partall', 'even'].includes(betOn.toLowerCase())) {
                    if (roll % 2 == 0) {
                        won = true
                        multiplier = 2
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

            if (won) newMoneyValue = this.calculatedNewMoneyValue(message, multiplier, valAsNum, userMoney).newMoneyValue
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
            this.messageHelper.sendFormattedMessage(message.channel as TextChannel, gambling)
        }
    }
    private getMultiplier(roll: number, amountBet: number) {
        if (roll >= 100) return 5
        return 2
    }

    private calculatedNewMoneyValue(
        message: Message,
        multiplier: number,
        valAsNum: number,
        userMoney: number
    ): { newMoneyValue: number; interestAmount: number; rate: number } {
        const hasDebtPenalty = DatabaseHelper.getValueWithoutMessage('debtPenalty', message.author.username) === 'true'
        let newMoneyValue = 0
        let interest = 0
        let rate = 0
        if (hasDebtPenalty) {
            const mp = Number(DatabaseHelper.getValue('debtMultiplier', message.author.username, message))
            console.log('multi' + mp)

            rate = 1 - (100 - mp) / 100
            console.log('RATE: ' + rate)

            interest = valAsNum * rate
        }
        newMoneyValue = Number(userMoney) + multiplier * valAsNum - interest - valAsNum
        console.log(newMoneyValue, userMoney)

        return { newMoneyValue: newMoneyValue, interestAmount: interest, rate: rate }
    }

    private takeUpLoan(message: Message, content: string, args: string[]) {
        let amountToLoan = 1000
        if (args[0]) {
            const argAsNum = Number(args[0])

            if (isNaN(argAsNum)) {
                message.reply('du har oppgitt et ugyldig tall')
                return
            } else if (argAsNum > 1500) {
                message.reply('du kan låne maks 1500 chips')
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
        if (Number(debtMultiplier) > 75) {
            message.reply('Du har kje lov å ta opp lån når rentå di e over 90%. Du får gambla, ble vippsa eller bruka "!mz daily" for å få mer chips')
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

        this.messageHelper.sendMessage(
            message.channelId,
            `${username}, du har nå lånt ${amountToLoan.toFixed(2)} chips med 15% rente. Spend them well. Din totale gjeld er nå: ${newDebt.toFixed(
                2
            )} (${newTotalLoans} lån gjort)`
        )
    }

    private payDownDebt(message: Message, content: string, args: string[]) {
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
                this.messageHelper.sendMessage(
                    message.channelId,
                    `Du har nå betalt ned ${wantsToPayDownThisAmount.toFixed(2)} av lånet ditt på ${totalDebt}. Lånet er nå på ${newTotal.toFixed(
                        2
                    )} og du har ${newDogeCoinsCOunter.toFixed(2)} chips igjen.`
                )
            }
        } else {
            message.reply('Du har ikke skrevet inn et tall')
        }
    }

    private userHasEnoughBalance(username: string, balance: number) {}

    private vippsCoins(message: Message, content: string, args: string[]) {
        if (args.length < 3) {
            message.reply('Feil formattering. Det er <brukernavn> <antall> <chips|coins>')
            return
        }
        const targetUser = UserUtils.findUserByUsername(splitUsername(args[0]), message)

        if (!targetUser) {
            message.reply('Brukeren eksisterer ikke')
            return
        }

        const transactionAmount = Number(args[1])

        if (isNaN(transactionAmount) || transactionAmount < 1) {
            message.reply('Du må skriva inn et gyldig tegn. Det må være større enn 0')
            return
        }

        const transactionType = args[2]
        let trType: dbPrefix
        if (transactionType === 'coins') {
            trType = 'dogeCoin'
        } else if (transactionType === 'chips') {
            trType = transactionType
        } else {
            message.reply('Du må spesifisere om du vil vippse "coins" eller "chips"')
            return
        }

        const userBalance = DatabaseHelper.getValueWithoutMessage(trType, message.author.username)

        if (userBalance >= transactionAmount) {
            DatabaseHelper.decrementValue(trType, message.author.username, transactionAmount.toString())
            DatabaseHelper.incrementValue(trType, targetUser.username, transactionAmount.toString())
            this.messageHelper.sendMessage(
                message.channelId,
                `${message.author.username} vippset ${targetUser.username} ${transactionAmount} ${transactionType}.`
            )
        } else {
            message.reply('du har ikkje råd te å vippsa så møye, bro.')
            return
        }
    }

    private dealCoins(message: Message, value: string, peopleGettingCoins: string, numP: number, noDefaultPott?: boolean) {
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
                    this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, `Trigget dealcoins med enten undefined eller NaN verdi på coins. `)
                }
                DatabaseHelper.setValue('chips', username, newValue.toString())
                moneyString += `${username}: ${userCoins} -> ${newValue}\n`
            }
        })
        this.messageHelper.sendMessage(message.channelId, moneyString)
    }

    private async checkCoins(message: Message, messageContent: string, args: string[]) {
        let username: string
        if (!args[0]) {
            username = message.author.username
        } else username = splitUsername(args[0])
        if (!UserUtils.findUserByUsername(username, message)) {
            message.reply('Brukeren finnes ikke')
            return
        }
        const coins = DatabaseHelper.getValue('dogeCoin', username, message)
        const chips = DatabaseHelper.getValue('chips', username, message)
        this.messageHelper.sendMessage(
            message.channelId,
            `${username} har ${Number(coins).toLocaleString('nb', {
                maximumFractionDigits: 0,
                minimumFractionDigits: 0,
            })} coins og ${Number(chips).toLocaleString('nb', {
                maximumFractionDigits: 0,
                minimumFractionDigits: 0,
            })} chips`
        )
    }

    /** TODO: Remove this when deprecated phase is over
     *  @deprecated this is now under checkcoins
     */
    private async checkChips(message: Message, messageContent: string, args: string[]) {
        let username: string
        if (!args[0]) {
            username = message.author.username
        } else username = splitUsername(args[0])

        const val = DatabaseHelper.getValue('chips', username, message)
        this.messageHelper.sendMessage(
            message.channelId,
            `${username} har ${Number(val).toLocaleString('nb', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
            })} chips`
        )
    }

    private rollSlotMachine(message: Message, messageContent: string, args: string[]) {
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        if (Number(userMoney) < 100) {
            message.reply('Det koste 100 chips for å bruga maskinen, og du har kje råd bro')
            return
        }
        //Remove 100 chips
        let emojiString = ''
        const newMoneyVal = Number(userMoney) - 100
        DatabaseHelper.setValue('chips', message.author.username, newMoneyVal.toFixed(0))

        const randArray = []
        for (let i = 0; i < 5; i++) {
            randArray.push(getRndInteger(0, 9))
        }
        randArray.forEach((num) => {
            emojiString += findLetterEmoji(num.toString())
        })

        const msg = new MessageEmbed().setTitle('🎰 Gambling 🎰').setDescription(`${emojiString}`).setFields()

        const amountOfCorrectNums: { val: number; num: number }[] = []
        const sequenceWins = ['123', '1234', '12345', '1337']
        let currentNum = randArray[0]
        let numOfOccurence = 0
        //Gå gjennom array
        for (let i = 0; i < randArray.length; i++) {
            //Hvis nåværende + neste tall er like
            if (randArray[i + 1] == currentNum) {
                //Oppdater antall repeats
                numOfOccurence++
            } else {
                //Hvis de ikke er like, men de forrige har vært like, push te til "Funnet"-lista me antall like + tallet selv
                if (numOfOccurence > 0) {
                    amountOfCorrectNums.push({ val: currentNum, num: numOfOccurence })
                }
                //Sett nåværende like tall til 0
                numOfOccurence = 0
                //Bytt nåværende søke-tall
                currentNum = randArray[i + 1]
            }
        }
        let winnings = 0
        if (amountOfCorrectNums.length > 0) {
            amountOfCorrectNums.forEach((correctNum) => {
                let currentWinnings = this.findSlotMachineWinningAmount(correctNum.num + 1)
                winnings += currentWinnings
                msg.addField(`${correctNum.val}`, `Kom ${correctNum.num + 1} ganger. Du har vunnet ${currentWinnings} chips`)
            })
            const currentMoney = DatabaseHelper.getValue('chips', message.author.username, message)
            const newMoney = Number(currentMoney) + winnings
            DatabaseHelper.setValue('chips', message.author.username, newMoney.toFixed(0))
        } else {
            const arrayAsString = randArray.join('')
            let hasSequence = false
            sequenceWins.forEach((seq) => {
                if (arrayAsString.includes(seq)) {
                    const seqWorth = this.findSequenceWinningAmount(seq)
                    winnings += seqWorth
                    msg.addField(`${seq}`, `Du fikk sekvensen ${seq}. Du har vunnet ${seqWorth} chips`)
                    hasSequence = true
                }
            })
            if (!hasSequence) msg.addField('Du tapte', '-100 chips')
        }
        this.messageHelper.sendFormattedMessage(message.channel as TextChannel, msg)
    }

    /** Missing streak counter and increased reward */
    private claimDailyChipsAndCoins(message: Message, messageContent: string, args: string[]) {
        const canClaim = DatabaseHelper.getValue('dailyClaim', message.author.username, message)
        const dailyPrice = { chips: '500', coins: '80' }
        const hasFreeze = Number(DatabaseHelper.getValueWithoutMessage('dailyFreezeCounter', message.author.username))
        if (!isNaN(hasFreeze) && hasFreeze > 0) {
            message.reply('Du har frosset daily claimet ditt i ' + hasFreeze + ' dager til. Vent til da og prøv igjen')
            return
        }
        if (canClaim === '0') {
            const oldData = DatabaseHelper.getValue('dailyClaimStreak', message.author.username, message, true)

            let streak: IDailyPriceClaim = { streak: 1, wasAddedToday: true }
            if (oldData) {
                const oldStreak = JSON.parse(oldData) as IDailyPriceClaim
                streak = { streak: oldStreak?.streak + 1 ?? 1, wasAddedToday: true }
            } else {
                streak = { streak: 1, wasAddedToday: true }
            }

            const daily = this.findAndIncrementValue(streak.streak, dailyPrice, message)

            const prestige = DatabaseHelper.getValueWithoutMessage('prestige', message.author.username)
            message.reply(
                `Du har hentet dine daglige ${daily.dailyChips} chips og ${daily.dailyCoins} coins! ${
                    streak.streak > 1 ? '(' + streak.streak + ' dager i streak)' : ''
                } ${prestige ? '(' + prestige + ' prestige)' : ''}`
            )

            if (streak.streak >= 100) {
                DatabaseHelper.incrementValue('prestige', message.author.username, '1')
                const prestige = DatabaseHelper.getValueWithoutMessage('prestige', message.author.username)
                streak = { streak: 1, wasAddedToday: true }
                const congrats = `Dægårten! Du har henta daglige chips i 100 dager i strekk! Gz dude, nå prestige du. Du e nå prestige ${prestige} og får ${this.findPrestigeMultiplier(
                    prestige
                )}x i multiplier på alle daily's framøve! \n\n*Streaken din resettes nå te 1, så du kan ta ein pause hvis du vil*`
                message.reply(congrats)
            }
            DatabaseHelper.setValue('dailyClaimStreak', message.author.username, JSON.stringify(streak))
        } else {
            message.reply('Du har allerede hentet dine daglige chips og coins. Prøv igjen i morgen etter klokken 08:00')
        }
    }

    private freezeDailyClaim(message: Message, messageContent: string, args: string[]) {
        const numDays = Number(args[0])
        if (isNaN(numDays) || numDays > 4) {
            message.reply('Du må skrive inn et gyldig tall lavere enn 4')
            return
        }
        const hasFreeze = Number(DatabaseHelper.getValueWithoutMessage('dailyFreezeCounter', message.author.username))
        if (hasFreeze && hasFreeze > 0) {
            message.reply('Du har allerede frosset daily claimet ditt i ' + hasFreeze + ' dager til')
            return
        }
        DatabaseHelper.setValue('dailyFreezeCounter', message.author.username, numDays.toString())
        message.reply(
            'Du har frosset daily claimen din i ' +
                numDays +
                ' dager. Du får ikke hente ut daily chips og coins før da, men streaken din vil heller ikke forsvinne. Denne kan ikke overskrives eller fjernes'
        )
    }

    private findAndIncrementValue(streak: number, dailyPrice: { chips: string; coins: string }, message: Message): { dailyCoins: string; dailyChips: string } {
        const additionalCoins = this.findAdditionalCoins(streak)
        const prestigeMultiplier = this.findPrestigeMultiplier(DatabaseHelper.getValueWithoutMessage('prestige', message.author.username))

        const dailyCoins = ((Number(dailyPrice.coins) + Number(additionalCoins?.coins ?? 0)) * prestigeMultiplier).toFixed(0)
        const dailyChips = ((Number(dailyPrice.chips) + Number(additionalCoins?.chips ?? 0)) * prestigeMultiplier).toFixed(0)
        DatabaseHelper.incrementValue('dogeCoin', message.author.username, dailyCoins)
        DatabaseHelper.incrementValue('chips', message.author.username, dailyChips)
        DatabaseHelper.setValue('dailyClaim', message.author.username, '1')

        return { dailyChips: dailyChips, dailyCoins: dailyCoins }
    }

    private findPrestigeMultiplier(p: number | undefined) {
        if (p && !isNaN(p) && p > 0) {
            return 1.15
        }
        return 1
    }

    private findAdditionalCoins(streak: number): { coins: number; chips: number } | undefined {
        if (streak == 69) return { coins: 6889, chips: 696469 }
        if (streak >= 100) return { coins: 5000, chips: 200000000 }
        if (streak > 75) return { coins: 565, chips: 125000 }
        if (streak > 50) return { coins: 500, chips: 25000 }
        if (streak > 25) return { coins: 175, chips: 7500 }
        if (streak > 15) return { coins: 125, chips: 1250 }
        if (streak >= 10) return { coins: 80, chips: 1000 }
        if (streak > 5) return { coins: 30, chips: 100 }
        if (streak > 3) return { coins: 20, chips: 75 }
        if (streak >= 2) return { coins: 10, chips: 25 }
        return undefined
    }

    private findSequenceWinningAmount(s: string) {
        switch (s) {
            case '123':
                return 1000
            case '1234':
                return 15500
            case '12345':
                return 3575000
            case '1337':
                return 345750
            default:
                return 400
        }
    }

    private findSlotMachineWinningAmount(numCorrect: number) {
        switch (numCorrect) {
            case 2:
                return 100
            case 3:
                return 1500
            case 4:
                return 14500
            case 5:
                return 475000
            case 6:
                return 35750000
            default:
                return 100
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'coins',
                description: 'Legg til eller fjern coins fra en person. <Brukernavn> <verdi> (pluss/minus)',
                hideFromListing: true,
                isAdmin: true,
                isSuperAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.manageCoins(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'lån',
                description: 'Lån chips fra banken',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.takeUpLoan(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'betal',
                description: 'Betal på lånet ditt. <number>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.payDownDebt(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'krig',
                description: 'Gå til krig. <nummer> <username>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.krig(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'visbet',
                description: 'Vis en brukers aktive veddemål',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.showActiveBet(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'vipps',
                description: 'Vipps til en annen bruker. <number>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.vippsCoins(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: ['gamble', 'g'],
                description:
                    'Gambla coinså dine! Skriv inn mengde coins du vil gambla, så kan du vinna. Tilbakebetaling blir høyere jo høyere terningen triller (1.1x for 50 opp till 5x for 100)',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.diceGamble(rawMessage, messageContent, args)
                },
                category: 'gambling',
                canOnlyBeUsedInSpecificChannel: ['808992127249678386'],
            },
            {
                commandName: 'rulett',
                description:
                    'Gambla chipså dine! Skriv inn mengde coins du vil gambla og ikke minst ka du gamble de på, så kan du vinna. Tilbakebetaling blir høyere jo større risiko du tar. Lykke til!' +
                    "\nHer kan du gambla på tall, farge eller partall/oddetall. Eksempel: '!mz rulett 1000 svart",
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.roulette(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'wallet',
                description: 'Se antall coins til en person',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.checkCoins(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'daily',
                description: 'Hent dine daglige chips og coins. Hvis det gjøres i flere dager sammenhengene vil du få større og større rewards',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.claimDailyChipsAndCoins(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'freezedaily',
                description: 'Frys daily rewarden din i X antall dager (maks 4)',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.freezeDailyClaim(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'chips',
                description: 'Se antall chips en person har til gambling',
                deprecated: 'wallet',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.checkChips(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'bet',
                description: 'Start et ja/nei veddemål',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.createBet(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'resolve',
                description: 'Resolve veddemålet',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.resolveBet(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'roll',
                description: 'Rull spillemaskinen. Du vinner hvis du får 2 eller flere like tall',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.rollSlotMachine(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
        ]
    }
}
