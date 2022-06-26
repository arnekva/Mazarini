import { Client, Message, MessageEmbed, TextChannel, User } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { environment } from '../client-env'
import { ICommandElement } from '../General/commands'
import { globals } from '../globals'
import { betObject, betObjectReturned, DatabaseHelper, dbPrefix, MazariniUser } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { CollectorUtils } from '../utils/collectorUtils'
import { MessageUtils } from '../utils/messageUtils'
import { MiscUtils } from '../utils/miscUtils'
import { RandomUtils } from '../utils/randomUtils'
import { TextUtils } from '../utils/textUtils'
import { UserUtils } from '../utils/userUtils'

export interface IDailyPriceClaim {
    streak: number
    wasAddedToday: boolean
}
export class GamblingCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async createBet(message: Message, messageContent: string, args: string[]) {
        const hasActiveBet = DatabaseHelper.getActiveBetObject(message.author.username)
        const user = DatabaseHelper.getUser(message.author.id)
        const userBalance = user.chips
        let desc = messageContent
        let betVal = 100
        if (hasActiveBet) {
            message.reply('Du kan bare ha ett aktivt veddemål om gangen. Gjør ferdig ditt gamle, og prøv på nytt')
        } else if (!isNaN(Number(args[0]))) {
            betVal = Number(args[0])
            desc = desc.slice(args[0].length)
        } else if (betVal > Number(userBalance)) {
            message.reply('Du har kje råd te dette bro')
        } else {
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
                            const localUser = DatabaseHelper.getUser(us.id)
                            if (localUser) {
                                const userBal = localUser.chips
                                if (us.id === '802945796457758760') return
                                if (Number(userBal) < betVal && us.id !== '802945796457758760') {
                                    fullString += us.username + '(har ikke råd og blir ikke telt med),'
                                } else {
                                    if (us.username !== 'MazariniBot') {
                                        localUser.chips = Number(userBal) - betVal
                                        DatabaseHelper.updateUser(localUser)
                                        positive.push(us.username)
                                        fullString += us.username == 'Mazarini Bot' ? '' : ' ' + us.username + ','
                                    }
                                }
                            }
                        })
                        fullString += '\n'
                    }
                    const thumbsDown = startMessage.reactions.cache.find((emoji) => emoji.emoji.name == '👎')
                    if (thumbsDown) {
                        const users = await thumbsDown.users.fetch()
                        users.forEach((us, ind) => {
                            const localUser = DatabaseHelper.getUser(us.id)
                            if (localUser) {
                                const userBal = localUser.chips
                                if (Number(userBal) < betVal && us.username !== 'Mazarini Bot') {
                                    fullString += us.username + '(har ikke råd og blir ikke telt med),'
                                } else {
                                    if (us.username !== 'MazariniBot') {
                                        localUser.chips = Number(userBal) - betVal
                                        DatabaseHelper.updateUser(localUser)
                                        negative.push(us.username)
                                        fullString += us.username == 'Mazarini Bot' ? '' : ' ' + us.username + ','
                                    }
                                }
                            }
                        })
                        fullString += '\n'
                    }
                    if (positive.length == 0 && negative.length == 0) {
                        message.reply('Ingen svarte på veddemålet. ')
                    } else {
                        _msg.sendMessage(message.channelId, fullString)

                        const obj: betObject = {
                            description: desc,
                            messageId: startMessage.id,
                            positivePeople: positive,
                            negativePeople: negative,
                            value: betVal.toFixed(2),
                        }
                        DatabaseHelper.setActiveBetObject(message.author.username, obj)
                    }
                }, globals.TIMEOUT_TIME.time)
            }
        }
    }

    private async resolveBet(message: Message, messageContent: string, args: string[]) {
        const username = message.author.username
        const activeBet = DatabaseHelper.getActiveBetObject(message.author.username) as betObjectReturned
        if (!activeBet) {
            message.reply('Du kan kun lukke veddemål du har startet selv, og du har ingen aktive.')
        } else {
            if (args[0] === 'slett') {
                let numP = 0
                const negSplit = activeBet.negativePeople.split(',')
                const posSplit = activeBet.positivePeople.split(',')
                if (negSplit[0] !== '') numP += negSplit.length
                if (posSplit[0] !== '') numP += posSplit.length
                this.dealCoins(message, activeBet.value, activeBet.positivePeople.concat(activeBet.negativePeople), numP, true)
                DatabaseHelper.deleteActiveBet(username)
                message.reply('Veddemålet er slettet, og beløp er tilbakebetalt.')
            } else if (args[0].toLocaleLowerCase() !== 'nei' && args[0].toLocaleLowerCase() !== 'ja') {
                message.reply("Du må legge til om det var 'ja' eller 'nei' som var utfallet av veddemålet")
            } else {
                DatabaseHelper.deleteActiveBet(username)
                const resolveMessage = await this.messageHelper.sendMessage(
                    message.channelId,
                    `${username} vil gjøre opp ett veddemål: ${activeBet.description}. Reager med 👍 for å godkjenne (Trenger 3).`
                )

                if (resolveMessage) {
                    this.messageHelper.reactWithThumbs(resolveMessage, 'up')
                    const collector = resolveMessage.createReactionCollector()
                    collector.on('collect', (reaction) => {
                        if (CollectorUtils.shouldStopCollector(reaction, message)) {
                            if (resolveMessage) resolveMessage.edit(`${resolveMessage.content} (STANSET MED TOMMEL NED)`)
                            collector.stop()
                        }
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
        }
    }
    private showActiveBet(message: Message, content: string, args: string[]) {
        const username = args[0] ?? message.author.username
        const activeBet = DatabaseHelper.getActiveBetObject(username) as betObject
        if (!activeBet) {
            message.reply('Du har ingen aktive veddemål')
        } else {
            const betMessage = new MessageEmbed()
                .setTitle('🍀🎰 Veddemål 🤞🎲')
                .setDescription(`Du har et aktivt veddemål om: '${activeBet.description}'`)
                .addField('JA', `${activeBet.positivePeople.length < 1 ? 'Ingen' : activeBet.positivePeople}`)
                .addField('NEI', `${activeBet.negativePeople.length < 1 ? 'Ingen' : activeBet.negativePeople}`)
                .addField('Verdi', `${activeBet.value.length < 1 ? '0' : activeBet.value}`)
            this.messageHelper.sendFormattedMessage(message.channel as TextChannel, betMessage)
        }
    }

    private checkBalance(users: { userID: string }[], amountAsNumber: number): string | undefined {
        let user: string | undefined = undefined
        users.forEach((u) => {
            const balance = DatabaseHelper.getUser(u.userID).chips
            if (Number(balance) < amountAsNumber || Number(balance) === 0) user = DatabaseHelper.getUser(u.userID).displayName
        })
        return user
    }
    private findKrigValue(val: string, engagerUsername: string): number | undefined {
        if (val === 'alt') {
            return Number(DatabaseHelper.getUser(engagerUsername).chips)
        } else {
            const value = Number(val)
            if (isNaN(value) || value < 1) return undefined
            return value
        }
    }

    private async startVerdensKrig(message: Message, content: string, args: string[]) {
        const amount = this.findKrigValue(args[0], message.author.username)
        const user = DatabaseHelper.getUser(message.author.id)
        const userBalance = user.chips
        if (!amount) message.reply('Du har skrevet inn et ugyldig tall')
        else if (userBalance < amount) message.reply(`Du kan kje starta ein krig for ${amount} når du bare har ${userBalance} chips sjøl`)
        else if (userBalance <= 0) message.reply(`Du kan kje gå te krig når du bare har ${userBalance} i walleten`)
        else {
            const timer = !isNaN(Number(args[2])) && Number(args[2]) <= 800 ? Number(args[2]) * 1000 : 240000

            const resolveMessage = await this.messageHelper.sendMessage(
                message.channelId,
                `${message.author.username} har startet en verdenskrig! Reager med 👍 for å bli med. Krigen starter om ${
                    timer / 1000
                } sekund. ${MessageUtils.getRoleTagString(UserUtils.ROLE_IDs.NATO)}`
            )
            if (resolveMessage) {
                this.messageHelper.reactWithThumbs(resolveMessage, 'up')
                const _msgHelper = this.messageHelper

                const collector = resolveMessage.createReactionCollector()
                const nonValidAttempts: string[] = []

                const krigTimeout = setTimeout(
                    async function () {
                        let people: string[] = []
                        resolveMessage.reactions.cache.forEach((reaction) => {
                            if (reaction.emoji.name === '👍') {
                                people = reaction.users.cache
                                    .filter((u: User) => u.id !== '802945796457758760' && u.id !== message.author.id)
                                    .map((u: User) => u.id)
                            }
                        })

                        people.push(message.author.id)
                        people = people.filter((p) => {
                            const userWallet = DatabaseHelper.getUser(p).chips
                            return Number(userWallet) >= amount
                        })
                        if (people.length < 2) {
                            message.reply('Mer enn 1 person med råd må delta i krigen.')
                        } else if (people)
                            people.forEach((p) => {
                                const user = DatabaseHelper.getUser(p)
                                const oldCHips = user.chips
                                user.chips = oldCHips - amount
                                DatabaseHelper.updateUser(user)
                            })
                        const roll = RandomUtils.getRndInteger(0, people.length - 1)
                        const totalAmount = Number(amount) * people.length
                        const userWinner = DatabaseHelper.getUser(people[roll])
                        const oldWinnerCHips = userWinner.chips
                        userWinner.chips = oldWinnerCHips + totalAmount
                        DatabaseHelper.updateUser(userWinner)

                        const pingMap = people.map((p) => MessageUtils.getUserTagString(UserUtils.findUserByUsername(p, message)?.id) + ' ')
                        _msgHelper.sendMessage(
                            message.channelId,
                            `Terningen trillet ${roll + 1} av ${people.length}. ${people[roll]} vant! Du får ${totalAmount} chips. ${pingMap}.\n ` +
                                people.map((u) => ` \n${u} - ${DatabaseHelper.getUser(u).chips}`)
                        )

                        collector.stop()
                    },
                    environment === 'dev' ? 10000 : timer //For testing
                )

                collector.on('collect', (reaction) => {
                    if (CollectorUtils.shouldStopCollector(reaction, message)) {
                        if (resolveMessage) resolveMessage.edit(`${resolveMessage.content} (STANSET MED TOMMEL NED)`)
                        clearTimeout(krigTimeout)
                        collector.stop()
                    }
                })
            }
        }
    }

    private getUserWallets(engagerID: string, victimID: string): { engagerChips: number; victimChips: number } {
        const engagerValue = DatabaseHelper.getUser(engagerID).chips
        const victimValue = DatabaseHelper.getUser(victimID).chips
        return {
            engagerChips: engagerValue,
            victimChips: victimValue,
        }
    }

    private async krigWithAnyone(message: Message, content: string, args: string[]) {
        const amount = Number(this.findKrigValue(args[0], message.author.username))
        if (!amount) {
            message.reply('Du har skrevet inn et ugyldig tall')
        } else {
            const resolveMessage = await this.messageHelper.sendMessage(
                message.channelId,
                `${message.author.username} vil gå til krig mot hvem som helst for ${amount} chips. Reager med tommel opp for å svare`
            )
            if (resolveMessage) {
                this.messageHelper.reactWithThumbs(resolveMessage, 'up')

                const collector = resolveMessage.createReactionCollector()
                const nonValidAttempts: string[] = []
                collector.on('collect', (reaction) => {
                    if (CollectorUtils.shouldStopCollector(reaction, message)) {
                        if (resolveMessage) resolveMessage.edit(`${resolveMessage.content} (STANSET MED TOMMEL NED)`)
                        collector.stop()
                    }

                    if (reaction.emoji.name === '👍') {
                        const victim = reaction.users.cache
                            .filter((u: User) => u.id !== '802945796457758760' && u.id !== message.author.id && !nonValidAttempts.includes(u.id))
                            .first() as User
                        if (victim) {
                            const currentValue = this.getUserWallets(message.author.id, victim.id)
                            let engagerValue = currentValue.engagerChips
                            let victimValue = currentValue.victimChips

                            const notEnoughChips = this.checkBalance([{ userID: message.author.id }, { userID: victim.id }], amount)
                            if (notEnoughChips) {
                                nonValidAttempts.push(victim.id)
                                this.messageHelper.sendMessage(
                                    message.channelId,
                                    `${notEnoughChips} har ikke råd til å delta i ${message.author.username} sin krig for ${amount}`
                                )
                            } else {
                                const roll = RandomUtils.getRndInteger(0, 100)
                                let description = `Terningen trillet: ${roll}/100. ${
                                    roll < 51 ? (roll == 50 ? 'Bot Høie' : message.author.username) : victim.username
                                } vant! 💰💰`

                                if (roll == 50) {
                                    engagerValue -= amount
                                    victimValue -= amount
                                } else if (roll < 50) {
                                    engagerValue += amount
                                    victimValue -= amount
                                } else if (roll > 50) {
                                    engagerValue -= amount
                                    victimValue += amount
                                }

                                this.messageHelper.sendMessage(message.channelId, `<@${victim?.id}> <@${message.author.id}>`)
                                this.sendKrigMessage(
                                    message.channel as TextChannel,
                                    [
                                        { username: message.author.username, balance: engagerValue, oldBalance: currentValue.engagerChips },
                                        { username: victim.username, balance: victimValue, oldBalance: currentValue.victimChips },
                                    ],
                                    description
                                )
                                const authorUser = DatabaseHelper.getUser(message.author.id)
                                const victimUser = DatabaseHelper.getUser(victim.id)
                                authorUser.chips = engagerValue
                                victimUser.chips = victimValue
                                DatabaseHelper.updateUser(authorUser)
                                DatabaseHelper.updateUser(victimUser)

                                this.messageHelper.reactWithCheckmark(resolveMessage)
                                if (resolveMessage) {
                                    const oldContent = resolveMessage.content
                                    resolveMessage.edit(`${oldContent} (Fullført)`)
                                }
                                collector.stop()
                            }
                        }
                    }
                })
            }
        }
    }

    private sendKrigMessage(channel: TextChannel, users: { username: string; balance: number; oldBalance: number }[], winningText: string) {
        const gambling = new MessageEmbed().setTitle('⚔️ Krig ⚔️').setDescription(`Terningen trillet ${winningText}`)
        users.forEach((user) => {
            gambling.addField(
                `${user.username}`,
                `Har nå ${TextUtils.formatMoney(user.balance, 2, 2)} chips (hadde ${TextUtils.formatMoney(user.oldBalance, 2, 2)})`
            )
        })

        this.messageHelper.sendFormattedMessage(channel, gambling)
    }

    private async krig(message: Message, content: string, args: string[]) {
        if (args[1] === 'alle') {
            return this.startVerdensKrig(message, content, args)
        }

        let userID = ''
        let username1 = TextUtils.splitUsername(args[0])
        let username2 = TextUtils.splitUsername(args[1])

        const user0Exists = UserUtils.findUserByUsername(username1, message)
        const user1Exists = UserUtils.findUserByUsername(username2, message)
        const amount = user0Exists ? args[1] : args[0]

        if (user0Exists) userID = user0Exists.id
        if (user1Exists) userID = user1Exists.id

        if (!user0Exists && !user1Exists) {
            return this.krigWithAnyone(message, content, args)
        }
        if ((isNaN(Number(amount)) || Number(amount) < 1) && amount !== 'alt') {
            return message.reply('Tallet du har skrevet inn er ikke gyldig')
        }

        const userWallets = this.getUserWallets(message.author.id, userID)

        const amountIsAll = amount === 'alt'
        const largestPossibleValue = Math.min(userWallets.engagerChips, userWallets.victimChips)
        let amountAsNum = amountIsAll ? largestPossibleValue : Number(amount)
        const notEnoughChips = this.checkBalance([{ userID: message.author.id }, { userID: userID }], amountAsNum)
        if (notEnoughChips) {
            return message.reply(`${notEnoughChips} har ikke råd til å gå til krig.`)
        }

        const user = UserUtils.findUserById(userID, message)
        if (user) {
            const resolveMessage = await this.messageHelper.sendMessage(
                message.channelId,
                `${message.author.username} vil gå til krig med deg, ${
                    user?.id ? '<@' + user.id + '>' : user.username
                }. Reager med 👍 for å godkjenne. Den som starter krigen ruller for 0-49.`
            )
            if (resolveMessage) {
                this.messageHelper.reactWithThumbs(resolveMessage, 'up')

                const collector = resolveMessage.createReactionCollector()
                collector.on('collect', (reaction) => {
                    if (CollectorUtils.shouldStopCollector(reaction, message)) {
                        if (resolveMessage) resolveMessage.edit(`${resolveMessage.content} (STANSET MED TOMMEL NED)`)
                        collector.stop()
                    }

                    const currentValue = this.getUserWallets(message.author.id, user.id)
                    let engagerValue = currentValue.engagerChips
                    let victimValue = currentValue.victimChips
                    if (amountIsAll) {
                        amountAsNum = Math.min(engagerValue, victimValue)
                    }
                    const notEnoughChips = this.checkBalance([{ userID: message.author.id }, { userID: user.id }], amountAsNum)
                    if (notEnoughChips) {
                        this.messageHelper.sendMessage(
                            message.channelId,
                            `<@${UserUtils.findUserByUsername(notEnoughChips, message)?.id}>, du har kje råd te det`
                        )
                    } else if (reaction.emoji.name === '👍' && reaction.users.cache.find((u: User) => u.id === user.id)) {
                        const shouldAlwaysLose = user.id === message.author.id || user.id === '802945796457758760'
                        const roll = RandomUtils.getRndInteger(0, 100)
                        let description = `Terningen trillet: ${roll}/100. ${
                            roll < 51 ? (roll == 50 ? 'Bot Høie' : message.author.username) : user.username
                        } vant! 💰💰`
                        if (shouldAlwaysLose) {
                            description = `${
                                user.id === message.author.id
                                    ? 'Du gikk til krig mot deg selv. Dette liker ikke Bot Høie, og tar derfor pengene.'
                                    : 'Huset vinner alltid'
                            }`
                        }

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

                        const users = shouldAlwaysLose
                            ? [{ username: message.author.username, balance: engagerValue, oldBalance: currentValue.engagerChips }]
                            : [
                                  { username: message.author.username, balance: engagerValue, oldBalance: currentValue.engagerChips },
                                  { username: user.username, balance: victimValue, oldBalance: currentValue.victimChips },
                              ]

                        this.messageHelper.sendMessage(message.channelId, `<@${user?.id}> <@${message.author.id}>`)
                        this.sendKrigMessage(message.channel as TextChannel, users, description)

                        const authorUser = DatabaseHelper.getUser(message.author.id)
                        const victimUser = DatabaseHelper.getUser(user.id)
                        authorUser.chips = engagerValue
                        victimUser.chips = victimValue
                        DatabaseHelper.updateUser(authorUser)
                        DatabaseHelper.updateUser(victimUser)

                        collector.stop()
                    }
                })
            }
        }
    }

    private diceGamble(message: Message, content: string, args: string[]) {
        const user = DatabaseHelper.getUser(message.author.id)
        const userMoney = user.chips
        let value = args[0]
        if (value === 'alt' || value === 'all') value = userMoney.toString()
        if (value === 'halv' || value === 'halvparten') value = (userMoney * 0.5).toFixed(0)
        if (!value || isNaN(Number(value))) {
            message.reply('Du må si hvor mye du vil gamble')
        } else if (userMoney) {
            if (Number(value) > Number(userMoney)) {
                message.reply('Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank')
            } else if (Number(value) < 1) {
                message.reply('Du må satsa minst 1 chip')
            } else if (value && Number(value)) {
                const valAsNum = Number(Number(value).toFixed(0))
                const roll = Math.floor(Math.random() * 100) + 1
                const hasDebtPenalty = user.debtPenalty === 'true'

                let newMoneyValue = 0
                let multiplier = this.getMultiplier(roll, valAsNum)
                const calculatedValue = this.calculatedNewMoneyValue(message, multiplier, valAsNum, userMoney)
                let interest = calculatedValue.interestAmount
                if (roll >= 50) {
                    newMoneyValue = calculatedValue.newMoneyValue
                } else newMoneyValue = Number(userMoney) - valAsNum
                user.chips = newMoneyValue
                DatabaseHelper.updateUser(user)

                const gambling = new MessageEmbed()
                    .setTitle('Gambling 🎲')
                    .setDescription(
                        `${message.author.username} gamblet ${TextUtils.formatMoney(valAsNum, 2, 2)} av ${TextUtils.formatMoney(
                            Number(userMoney),
                            2,
                            2
                        )} chips.\nTerningen trillet: ${roll}/100. Du ${
                            roll >= 50 ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'
                        }\nDu har nå ${TextUtils.formatMoney(newMoneyValue, 2, 2)} chips.`
                    )
                if (roll >= 100) gambling.addField(`Trillet 100!`, `Du trillet 100 og vant ${multiplier} ganger så mye som du satset!`)
                if (hasDebtPenalty && roll >= 50)
                    gambling.addField(`Gjeld`, `Du er i høy gjeld, og banken har krevd inn ${interest.toFixed(0)} chips (${calculatedValue.rate.toFixed(0)}%)`)
                this.messageHelper.sendFormattedMessage(message.channel as TextChannel, gambling)
            }
        } else {
            message.reply('Du har nok ikkje råd te dette')
        }
    }

    private roulette(message: Message, content: string, args: string[]) {
        const user = DatabaseHelper.getUser(message.author.id)
        let userMoney = user.chips
        const stake = args[0]
        const betOn = args[1]
        if (!stake || isNaN(Number(stake))) {
            message.reply('Du må si hvor mye du vil gamble')
        } else if (!betOn) {
            message.reply('Så du bare setter chips på ingenting?')
        } else if (args.length > 2) {
            message.reply('Helvedde.. Tror kanskje du må spørre om hjelp for å formattere deg riktig')
        } else if (userMoney) {
            if (Number(stake) > Number(userMoney)) {
                message.reply('Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank')
            } else if (Number(stake) < 0 || Number(stake) === 0) {
                message.reply('Du prøver å gamble med en ulovlig verdi.')
            }
        } else if (stake && Number(stake) && betOn) {
            const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
            const valAsNum = Number(Number(stake).toFixed(2))
            const roll = Math.floor(Math.random() * 37)
            let multiplier = 1
            let won = false
            let incorrectFormat = false
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
                    incorrectFormat = true
                }
            }
            if (!incorrectFormat) {
                let newMoneyValue = 0

                if (won) newMoneyValue = this.calculatedNewMoneyValue(message, multiplier, valAsNum, userMoney).newMoneyValue
                else newMoneyValue = Number(userMoney) - valAsNum
                user.chips = newMoneyValue
                DatabaseHelper.updateUser(user)

                let result = ''
                if (roll == 0) {
                    result = roll + ' grønn(!)'
                } else if (red.includes(roll)) {
                    result = roll + ' rød'
                } else {
                    result = roll + ' sort'
                }
                const gambling = new MessageEmbed()
                    .setTitle('Rulett 🎲')
                    .setDescription(
                        `${message.author.username} satset ${valAsNum} av ${userMoney} chips på ${betOn}.\nBallen landet på: ${result}. Du ${
                            won ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'
                        }\nDu har nå ${TextUtils.formatMoney(newMoneyValue, 2, 2)} chips.`
                    )

                this.messageHelper.sendFormattedMessage(message.channel as TextChannel, gambling)
            }
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
        const user = DatabaseHelper.getUser(message.author.id)
        const hasDebtPenalty = user.debtPenalty === 'true'
        let newMoneyValue = 0
        let interest = 0
        let rate = 0
        if (hasDebtPenalty) {
            const mp = user.debtMultiplier

            rate = 1 - (100 - mp) / 100

            interest = valAsNum * rate
        }
        newMoneyValue = Number(userMoney) + multiplier * valAsNum - interest - valAsNum

        return { newMoneyValue: newMoneyValue, interestAmount: interest, rate: rate }
    }

    private takeUpLoan(message: Message, content: string, args: string[]) {
        let amountToLoan = 1000
        if (args[0]) {
            const argAsNum = Number(args[0])

            amountToLoan = argAsNum
        }
        if (isNaN(amountToLoan)) {
            message.reply('du har oppgitt et ugyldig tall')
        } else if (amountToLoan > 1500) {
            message.reply('du kan låne maks 1500 chips')
        } else if (amountToLoan < 1) {
            message.reply('Kan kje låna mindre enn 1 chip')
        } else {
            const user = DatabaseHelper.getUser(message.author.id)
            const username = message.author.username
            const totalLoans = user.loanCounter
            const totalDebt = user.debt
            const debtMultiplier = user.debtMultiplier
            const userMoney = user.chips
            if (Number(debtMultiplier) > 75) {
                message.reply('Du har kje lov å ta opp lån når rentå di e over 90%. Du får gambla, ble vippsa eller bruka "!mz daily" for å få mer chips')
            } else {
                const newTotalLoans = Number(totalLoans) + 1
                const newDebt = Number(totalDebt) + amountToLoan * 1.15
                if (newDebt > 20000) {
                    message.reply(
                        `Du har nå mye gjeld. Banken vil nå ta ${
                            15 + Number(debtMultiplier)
                        }% av alle gevinster som renter. Disse vil ikke telle på nedbetaling av lånet. Dersom du fortsetter å låne nå vil rentesatsen stige ytterligere `
                    )
                    user.debtPenalty = 'true'
                    user.debtMultiplier++
                    DatabaseHelper.updateUser(user)
                } else {
                    user.debtPenalty = 'false'
                    DatabaseHelper.updateUser(user)
                }
                const newCoinsVal = Number(userMoney) + amountToLoan
                user.loanCounter = newTotalLoans
                user.debt = newDebt
                user.chips = newCoinsVal
                DatabaseHelper.updateUser(user)

                this.messageHelper.sendMessage(
                    message.channelId,
                    `${username}, du har nå lånt ${amountToLoan.toFixed(2)} chips med 15% rente. Spend them well. Din totale gjeld er nå: ${newDebt.toFixed(
                        2
                    )} (${newTotalLoans} lån gjort)`
                )
            }
        }
    }

    private payDownDebt(message: Message, content: string, args: string[]) {
        const user = DatabaseHelper.getUser(message.author.id)

        const totalLoans = user.loanCounter
        const totalDebt = user.debt
        const debtMultiplier = user.debtMultiplier
        const username = message.author.username
        const hasDebtPenalty = user.debtPenalty
        const userMoney = user.chips
        const wantsToPayDownThisAmount = Number(args[0])
        if (Number(totalDebt) <= 0) {
            message.reply('Du har ingen lån')
        } else if (wantsToPayDownThisAmount < 0) {
            message.reply('skriv inn et positivt tall, bro')
        } else if (!isNaN(wantsToPayDownThisAmount)) {
            let newTotal = Number(totalDebt) - Number(args[0])

            const userMasNumber = Number(userMoney)
            if (userMasNumber < wantsToPayDownThisAmount) {
                message.reply('du har ikke råd til dette.')
            } else {
                let backToPayer = 0
                if (newTotal < 0) {
                    message.reply('du har betalt ' + Math.abs(newTotal) + ' for mye på lånet ditt. Dette blir tilbakebetalt. ')
                    backToPayer = Math.abs(newTotal)
                }
                newTotal += backToPayer
                user.debt = newTotal
                const newDogeCoinsCOunter = Number(userMoney) - wantsToPayDownThisAmount + backToPayer
                user.chips = newDogeCoinsCOunter
                if (wantsToPayDownThisAmount > 1000 && hasDebtPenalty === 'true' && newTotal > 20000) {
                    if (Number(debtMultiplier) > 15) {
                        message.reply('Du har betalt ned mer enn 1000 på lånet ditt. Banken senker strafferenten din med 0.01% :) ')
                        user.debtMultiplier--
                    }
                }

                if (hasDebtPenalty === 'true' && newTotal < 20000) {
                    message.reply('Du har senket lånet ditt til under 20.000 chips. Banken fjerner strafferenten (for nå) :)')
                    user.debtPenalty = 'false'
                    //Resett multiplier
                    user.debtMultiplier = 15
                }
                this.messageHelper.sendMessage(
                    message.channelId,
                    `Du har nå betalt ned ${wantsToPayDownThisAmount.toFixed(2)} av lånet ditt på ${totalDebt}. Lånet er nå på ${newTotal.toFixed(
                        2
                    )} og du har ${newDogeCoinsCOunter.toFixed(2)} chips igjen.`
                )
                DatabaseHelper.updateUser(user)
            }
        } else {
            message.reply('Du har ikke skrevet inn et tall')
        }
    }

    private vippsCoins(message: Message, content: string, args: string[]) {
        const targetUser = UserUtils.findUserByUsername(TextUtils.splitUsername(args[0]), message)
        const transactionAmount = Number(args[1])

        if (args.length < 3) {
            message.reply('Feil formattering. Det er <brukernavn> <antall> <chips|coins>')
        } else if (!targetUser) {
            message.reply('Brukeren eksisterer ikke')
        } else if (isNaN(transactionAmount) || transactionAmount < 1) {
            message.reply('Du må skriva inn et gyldig tegn. Det må være større enn 0')
        } else {
            const transactionType = args[2]
            let trType: dbPrefix
            if (transactionType === 'coins') {
                trType = 'dogeCoin'
            } else if (transactionType === 'chips') {
                trType = transactionType
            } else {
                message.reply('Du må spesifisere om du vil vippse "coins" eller "chips"')
            }
            if (trType) {
                const user = DatabaseHelper.getUser(message.author.id)
                const target = DatabaseHelper.getUser(targetUser.id)
                const userBalance = user.chips

                if (userBalance >= transactionAmount) {
                    const oldChips = user.chips
                    user.chips = oldChips - transactionAmount
                    const newChips = target.chips
                    target.chips = newChips + transactionAmount
                    DatabaseHelper.updateUser(user)
                    DatabaseHelper.updateUser(target)
                    this.messageHelper.sendMessage(
                        message.channelId,
                        `${message.author.username} vippset ${targetUser.username} ${transactionAmount} ${transactionType}.`
                    )
                } else {
                    message.reply('du har ikkje råd te å vippsa så møye, bro.')
                }
            }
        }
    }

    private dealCoins(message: Message, value: string, peopleGettingCoins: string, numP: number, noDefaultPott?: boolean) {
        const peopleCoins = peopleGettingCoins.split(',').filter((u: string) => u !== 'Mazarini Bot')
        const basePot = noDefaultPott ? 0 : 50
        let pot = basePot
        const val = Number(value)
        pot += val * numP
        const shareOfCoins = pot / peopleCoins.length
        let moneyString = ''
        peopleCoins.forEach((username) => {
            if (!!username.trim()) {
                const user = DatabaseHelper.getUser(message.author.id)

                const userCoins = user.chips
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
                user.chips = newValue
                DatabaseHelper.updateUser(user)
                moneyString += `${username}: ${userCoins} -> ${newValue}\n`
            }
        })
        this.messageHelper.sendMessage(message.channelId, moneyString)
    }

    private async checkCoins(message: Message, messageContent: string, args: string[]) {
        let username: string
        if (!args[0]) {
            username = message.author.username
        } else username = TextUtils.splitUsername(args[0])
        if (!UserUtils.findUserByUsername(username, message)) {
            message.reply('Brukeren finnes ikke')
        } else {
            const uID = UserUtils.findUserByUsername(username, message)
            if (uID) {
                const user = DatabaseHelper.getUser(uID.id)
                const coins = user.coins
                const chips = user.chips
                this.messageHelper.sendMessage(
                    message.channelId,
                    `${username} har ${TextUtils.formatMoney(Number(coins), 2, 2)} coins og ${TextUtils.formatMoney(Number(chips), 2, 2)} chips`
                )
            }
        }
    }

    private rollSlotMachine(message: Message, messageContent: string, args: string[]) {
        const user = DatabaseHelper.getUser(message.author.id)
        const userMoney = user.chips
        if (Number(userMoney) < 100) {
            message.reply('Det koste 100 chips for å bruga maskinen, og du har kje råd bro')
        } else {
            //Remove 100 chips
            let emojiString = ''
            const newMoneyVal = Number(userMoney) - 100
            user.chips = newMoneyVal
            DatabaseHelper.updateUser(user)
            const randArray = []
            for (let i = 0; i < 5; i++) {
                randArray.push(RandomUtils.getRndInteger(0, 9))
            }
            randArray.forEach((num) => {
                emojiString += MiscUtils.findLetterEmoji(num.toString())
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
                const currentMoney = user.chips
                const newMoney = Number(currentMoney) + winnings
                user.chips = newMoney
                DatabaseHelper.updateUser(user)
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
    }

    /** Missing streak counter and increased reward */
    private claimDailyChipsAndCoins(message: Message, messageContent: string, args: string[]) {
        const user = DatabaseHelper.getUser(message.author.id)
        const canClaim = user.dailyClaim
        const dailyPrice = { chips: '300', coins: '80' }
        const hasFreeze = user.dailyFreezeCounter
        if (hasFreeze && !isNaN(hasFreeze) && hasFreeze > 0) {
            message.reply('Du har frosset daily claimet ditt i ' + hasFreeze + ' dager til. Vent til da og prøv igjen')
        } else if (canClaim === 0) {
            const oldData = user.dailyClaimStreak

            let streak: IDailyPriceClaim = { streak: 1, wasAddedToday: true }
            if (oldData) {
                const oldStreak = oldData
                streak = { streak: oldStreak?.streak + 1 ?? 1, wasAddedToday: true }
            } else {
                streak = { streak: 1, wasAddedToday: true }
            }

            const daily = this.findAndIncrementValue(streak.streak, dailyPrice, user)

            const prestige = user.prestige
            message.reply(
                `Du har hentet dine daglige ${daily.dailyChips} chips og ${daily.dailyCoins} coins! ${
                    streak.streak > 1 ? '(' + streak.streak + ' dager i streak)' : ''
                } ${prestige ? '(' + prestige + ' prestige)' : ''}`
            )

            if (streak.streak >= 100) {
                user.prestige = 1 + (user.prestige ?? 0)

                const prestige = user.prestige
                streak = { streak: 1, wasAddedToday: true }
                const congrats = `Dægårten! Du har henta daglige chips i 100 dager i strekk! Gz dude, nå prestige du. Du e nå prestige ${prestige} og får ${this.findPrestigeMultiplier(
                    prestige
                )}x i multiplier på alle daily's framøve! \n\n*Streaken din resettes nå te 1, så du kan ta ein pause hvis du vil*`
                message.reply(congrats)
            }
            if (!user.dailyClaimStreak) {
                user.dailyClaimStreak = {
                    streak: 1,
                    wasAddedToday: true,
                }
            } else {
                user.dailyClaimStreak.streak = streak?.streak ?? 1
                user.dailyClaimStreak.wasAddedToday = streak?.wasAddedToday ?? true
            }
            user.dailyClaim = 1
            DatabaseHelper.updateUser(user)
        } else {
            message.reply('Du har allerede hentet dine daglige chips og coins. Prøv igjen i morgen etter klokken 06:00')
        }
    }

    private freezeDailyClaim(message: Message, messageContent: string, args: string[]) {
        const user = DatabaseHelper.getUser(message.author.id)
        const numDays = Number(args[0])
        const hasFreeze = user.dailyFreezeCounter
        if (isNaN(numDays) || numDays > 8) {
            message.reply('Du må skrive inn et gyldig tall lavere enn 8')
        } else if (hasFreeze && hasFreeze > 0) {
            message.reply('Du har allerede frosset daily claimet ditt i ' + hasFreeze + ' dager til')
        } else {
            user.dailyFreezeCounter = numDays
            DatabaseHelper.updateUser(user)
            message.reply(
                'Du har frosset daily claimen din i ' +
                    numDays +
                    ' dager. Du får ikke hente ut daily chips og coins før da, men streaken din vil heller ikke forsvinne. Denne kan ikke overskrives eller fjernes'
            )
        }
    }

    private findAndIncrementValue(
        streak: number,
        dailyPrice: { chips: string; coins: string },
        user: MazariniUser
    ): { dailyCoins: string; dailyChips: string } {
        const additionalCoins = this.findAdditionalCoins(streak)
        const prestigeMultiplier = this.findPrestigeMultiplier(user.prestige)

        const dailyCoins = ((Number(dailyPrice.coins) + Number(additionalCoins?.coins ?? 0)) * prestigeMultiplier).toFixed(0)
        const dailyChips = ((Number(dailyPrice.chips) + Number(additionalCoins?.chips ?? 0)) * prestigeMultiplier).toFixed(0)
        user.chips = user.chips + Number(dailyChips)
        user.coins = user.coins + Number(dailyCoins)

        user.dailyClaim = 1
        DatabaseHelper.updateUser(user)

        return { dailyChips: dailyChips, dailyCoins: dailyCoins }
    }

    private findPrestigeMultiplier(p: number | undefined) {
        if (p && !isNaN(p) && p > 0) {
            return 1.15
        }
        return 1
    }

    private findAdditionalCoins(streak: number): { coins: number; chips: number } | undefined {
        if (streak == 69) return { coins: 6889, chips: 4000 }
        if (streak >= 100) return { coins: 5000, chips: 50000 }
        if (streak > 75) return { coins: 565, chips: 5500 }
        if (streak > 50) return { coins: 500, chips: 2400 }
        if (streak > 25) return { coins: 175, chips: 1500 }
        if (streak > 15) return { coins: 125, chips: 980 }
        if (streak >= 10) return { coins: 80, chips: 600 }
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
                commandName: 'lån',
                description: 'Lån chips fra banken. Maks 1500. ',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.takeUpLoan(rawMessage, messageContent, args)
                },
                category: 'gambling',
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
            {
                commandName: 'betal',
                description: 'Betal på lånet ditt. <tall>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.payDownDebt(rawMessage, messageContent, args)
                },
                category: 'gambling',
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
            {
                commandName: 'krig',
                description: 'Gå til krig mot noen. <nummer> <brukernavn>',

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
                description: 'Vipps til en annen bruker. <brukernavn> <tall>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.vippsCoins(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: 'verdenskrig',
                description: 'Start en krig mot alle som vil bli med',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.startVerdensKrig(rawMessage, messageContent, args)
                },
                category: 'gambling',
            },
            {
                commandName: ['gamble', 'g'],
                description: 'Gambla coinså dine! Skriv inn mengde coins du vil gambla, så kan du vinna.',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.diceGamble(rawMessage, messageContent, args)
                },
                category: 'gambling',
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
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
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
            {
                commandName: 'wallet',
                description: 'Se antall coins og chips til en person',
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
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
        ]
    }
}
