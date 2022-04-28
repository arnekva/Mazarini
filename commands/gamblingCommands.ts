import { Client, Message, MessageEmbed, TextChannel, User } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { environment } from '../client-env'
import { ICommandElement } from '../General/commands'
import { globals } from '../globals'
import { betObject, betObjectReturned, DatabaseHelper, dbPrefix } from '../helpers/databaseHelper'
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

    private async manageCoins(message: Message, messageContent: string, args: string[]) {
        if (!args[0] && !args[1]) {
            return this.messageHelper.sendMessage(message.channelId, `Feil formattering. <brukernavn> <coins>`)
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
            return message.reply('Du kan bare ha ett aktivt veddemål om gangen. Gjør ferdig ditt gamle, og prøv på nytt')
        }
        let betVal = 100
        if (!isNaN(Number(args[0]))) {
            betVal = Number(args[0])
            desc = desc.slice(args[0].length)
        }
        if (betVal > Number(userBalance)) {
            return message.reply('Du har kje råd te dette bro')
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
                    return message.reply('Ingen svarte på veddemålet. ')
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
            return message.reply('Du kan kun lukke veddemål du har startet selv, og du har ingen aktive.')
        }
        if (args[0] === 'slett') {
            let numP = 0
            const negSplit = activeBet.negativePeople.split(',')
            const posSplit = activeBet.positivePeople.split(',')
            if (negSplit[0] !== '') numP += negSplit.length
            if (posSplit[0] !== '') numP += posSplit.length
            this.dealCoins(message, activeBet.value, activeBet.positivePeople.concat(activeBet.negativePeople), numP, true)
            DatabaseHelper.deleteActiveBet(username)
            return message.reply('Veddemålet er slettet, og beløp er tilbakebetalt.')
        }
        if (args[0].toLocaleLowerCase() !== 'nei' && args[0].toLocaleLowerCase() !== 'ja') {
            return message.reply("Du må legge til om det var 'ja' eller 'nei' som var utfallet av veddemålet")
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
    private showActiveBet(message: Message, content: string, args: string[]) {
        const username = args[0] ?? message.author.username
        const activeBet = DatabaseHelper.getActiveBetObject(username) as betObject
        if (!activeBet) {
            return message.reply('Du har ingen aktive veddemål')
        }

        const betMessage = new MessageEmbed()
            .setTitle('🍀🎰 Veddemål 🤞🎲')
            .setDescription(`Du har et aktivt veddemål om: '${activeBet.description}'`)
            .addField('JA', `${activeBet.positivePeople.length < 1 ? 'Ingen' : activeBet.positivePeople}`)
            .addField('NEI', `${activeBet.negativePeople.length < 1 ? 'Ingen' : activeBet.negativePeople}`)
            .addField('Verdi', `${activeBet.value.length < 1 ? '0' : activeBet.value}`)
        this.messageHelper.sendFormattedMessage(message.channel as TextChannel, betMessage)
    }

    private findUserBalance(username: string) {}

    private doesUserHaveValidBalance(username: string) {}

    private checkBalance(users: { username: string }[], amountAsNumber: number): string | undefined {
        let user: string | undefined = undefined
        users.forEach((u) => {
            const balance = DatabaseHelper.getValueWithoutMessage('chips', u.username)
            if (Number(balance) < amountAsNumber) user = u.username
        })
        return user
    }
    private findKrigValue(val: string, engagerUsername: string): Number | undefined {
        if (val === 'alt') {
            return Number(DatabaseHelper.getValueWithoutMessage('chips', engagerUsername))
        } else {
            const value = Number(val)
            if (isNaN(value) || value < 1) return undefined
            return value
        }
    }

    private async startVerdensKrig(message: Message, content: string, args: string[]) {
        const amount = this.findKrigValue(args[0], message.author.username)
        const userBalance = Number(DatabaseHelper.getValueWithoutMessage('chips', message.author.username) ?? 0)
        if (!amount) return message.reply('Du har skrevet inn et ugyldig tall')
        if (userBalance < amount) return message.reply(`Du kan kje starta ein krig for ${amount} når du bare har ${userBalance} chips sjøl`)

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
                                .map((u: User) => u.username)
                        }
                    })

                    people.push(message.author.username)
                    people = people.filter((p) => {
                        const userWallet = DatabaseHelper.getValueWithoutMessage('chips', p)
                        return Number(userWallet) >= amount
                    })
                    if (people.length < 2) {
                        return message.reply('Mer enn 1 person med råd må delta i krigen.')
                    }
                    if (people) people.forEach((p) => DatabaseHelper.decrementValue('chips', p, amount.toString()))
                    const roll = RandomUtils.getRndInteger(0, people.length - 1)
                    const totalAmount = Number(amount) * people.length

                    DatabaseHelper.incrementValue('chips', people[roll], totalAmount.toString())
                    const pingMap = people.map((p) => MessageUtils.getUserTagString(UserUtils.findUserByUsername(p, message)?.id) + ' ')
                    _msgHelper.sendMessage(
                        message.channelId,
                        `Terningen trillet ${roll + 1} av ${people.length}. ${people[roll]} vant! Du får ${totalAmount} chips. ${pingMap}.\n ` +
                            people.map((u) => ` \n${u} - ${DatabaseHelper.getValueWithoutMessage('chips', u)}`)
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

    private getUserWallets(engagerUsername: string, victimUsername: string): { engagerChips: number; victimChips: number } {
        const engagerValue = Number(DatabaseHelper.getValueWithoutMessage('chips', engagerUsername))
        const victimValue = Number(DatabaseHelper.getValueWithoutMessage('chips', victimUsername))
        return {
            engagerChips: engagerValue,
            victimChips: victimValue,
        }
    }

    private async krigWithAnyone(message: Message, content: string, args: string[]) {
        const amount = Number(this.findKrigValue(args[0], message.author.username))
        if (!amount) {
            return message.reply('Du har skrevet inn et ugyldig tall')
        }

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
                        const currentValue = this.getUserWallets(message.author.username, victim.username)
                        let engagerValue = currentValue.engagerChips
                        let victimValue = currentValue.victimChips

                        const notEnoughChips = this.checkBalance([{ username: message.author.username }, { username: victim.username }], amount)
                        if (notEnoughChips) {
                            nonValidAttempts.push(victim.id)
                            return this.messageHelper.sendMessage(
                                message.channelId,
                                `${notEnoughChips} har ikke råd til å delta i ${message.author.username} sin krig for ${amount}`
                            )
                        }

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
                        DatabaseHelper.setValue('chips', message.author.username, engagerValue.toFixed(2))
                        DatabaseHelper.setValue('chips', victim.id, victimValue.toFixed(2))
                        this.messageHelper.reactWithCheckmark(resolveMessage)
                        if (resolveMessage) {
                            const oldContent = resolveMessage.content
                            resolveMessage.edit(`${oldContent} (Fullført)`)
                        }
                        collector.stop()
                    }
                }
            })
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

        let username = ''
        let username1 = TextUtils.splitUsername(args[0])
        let username2 = TextUtils.splitUsername(args[1])

        const user0Exists = UserUtils.findUserByUsername(username1, message)
        const user1Exists = UserUtils.findUserByUsername(username2, message)
        const amount = user0Exists ? args[1] : args[0]

        if (user0Exists) username = user0Exists.username
        if (user1Exists) username = user1Exists.username

        if (!user0Exists && !user1Exists) {
            return this.krigWithAnyone(message, content, args)
        }
        if ((isNaN(Number(amount)) || Number(amount) < 1) && amount !== 'alt') {
            return message.reply('Tallet du har skrevet inn er ikke gyldig')
        }

        const userWallets = this.getUserWallets(message.author.username, username)

        const amountIsAll = amount === 'alt'
        const largestPossibleValue = Math.min(userWallets.engagerChips, userWallets.victimChips)
        let amountAsNum = amountIsAll ? largestPossibleValue : Number(amount)
        const notEnoughChips = this.checkBalance([{ username: message.author.username }, { username: username }], amountAsNum)
        if (notEnoughChips) {
            return message.reply(`${notEnoughChips} har ikke råd. Krigen står fortsatt åpen`)
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
                if (CollectorUtils.shouldStopCollector(reaction, message)) {
                    if (resolveMessage) resolveMessage.edit(`${resolveMessage.content} (STANSET MED TOMMEL NED)`)
                    collector.stop()
                }

                const currentValue = this.getUserWallets(message.author.username, username)
                let engagerValue = currentValue.engagerChips
                let victimValue = currentValue.victimChips
                if (amountIsAll) {
                    amountAsNum = Math.min(engagerValue, victimValue)
                }
                const notEnoughChips = this.checkBalance([{ username: message.author.username }, { username: username }], amountAsNum)
                if (notEnoughChips) {
                    return this.messageHelper.sendMessage(
                        message.channelId,
                        `<@${UserUtils.findUserByUsername(notEnoughChips, message)?.id}>, du har kje råd te det`
                    )
                }
                if (reaction.emoji.name === '👍' && reaction.users.cache.find((u: User) => u.username.toLowerCase() === username.toLowerCase())) {
                    const shouldAlwaysLose = username === message.author.username || username === 'MazariniBot'
                    const roll = RandomUtils.getRndInteger(0, 100)
                    let description = `Terningen trillet: ${roll}/100. ${roll < 51 ? (roll == 50 ? 'Bot Høie' : message.author.username) : username} vant! 💰💰`
                    if (shouldAlwaysLose) {
                        description = `${
                            username === message.author.username
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
                              { username: username, balance: victimValue, oldBalance: currentValue.victimChips },
                          ]

                    this.messageHelper.sendMessage(message.channelId, `<@${user?.id}> <@${message.author.id}>`)
                    this.sendKrigMessage(message.channel as TextChannel, users, description)
                    DatabaseHelper.setValue('chips', message.author.username, engagerValue.toFixed(2))
                    DatabaseHelper.setValue('chips', username, victimValue.toFixed(2))
                    collector.stop()
                }
            })
        }
    }

    private diceGamble(message: Message, content: string, args: string[]) {
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        let value = args[0]
        if (value === 'alt' || value === 'all') value = userMoney
        if (!value || isNaN(Number(value))) {
            return message.reply('Du må si hvor mye du vil gamble')
        }
        if (userMoney) {
            if (Number(value) > Number(userMoney)) {
                return message.reply('Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank')
            } else if (Number(value) < 1) {
                return message.reply('Du må satsa minst 1 chip')
            }
        } else {
            return message.reply('Du har nok ikkje råd te dette')
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

            DatabaseHelper.setValue('chips', message.author.username, newMoneyValue.toFixed(0))

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
    }

    private roulette(message: Message, content: string, args: string[]) {
        let userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        const stake = args[0]
        const betOn = args[1]
        if (!stake || isNaN(Number(stake))) {
            return message.reply('Du må si hvor mye du vil gamble')
        }
        if (!betOn) {
            return message.reply('Så du bare setter chips på ingenting?')
        }
        if (args.length > 2) {
            return message.reply('Helvedde.. Tror kanskje du må spørre om hjelp for å formattere deg riktig')
        }
        if (userMoney) {
            if (Number(stake) > Number(userMoney)) {
                return message.reply('Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank')
            } else if (Number(stake) < 0 || Number(stake) === 0) {
                return message.reply('Du prøver å gamble med en ulovlig verdi.')
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
                    return message.reply('Lol, kan du ikke rulett eller?')
                }
            }

            const hasDebtPenalty = DatabaseHelper.getValueWithoutMessage('debtPenalty', message.author.username) === 'true'
            let rate = 185
            let newMoneyValue = 0
            let interest = 0

            if (won) newMoneyValue = this.calculatedNewMoneyValue(message, multiplier, valAsNum, userMoney).newMoneyValue
            else newMoneyValue = Number(userMoney) - valAsNum

            DatabaseHelper.setValue('chips', message.author.username, newMoneyValue.toFixed(2))

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
            //TODO: Legg inn debt-penalty igjen
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

            if (isNaN(argAsNum)) {
                return message.reply('du har oppgitt et ugyldig tall')
            } else if (argAsNum > 1500) {
                return message.reply('du kan låne maks 1500 chips')
            } else if (argAsNum < 1) {
                return message.reply('Kan kje låna mindre enn 1 chip')
            }
            amountToLoan = argAsNum
        }
        const username = message.author.username
        const totalLoans = DatabaseHelper.getValue('loanCounter', username, message)
        const totalDebt = DatabaseHelper.getValue('debt', username, message)
        const debtMultiplier = DatabaseHelper.getValue('debtMultiplier', username, message)
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        if (Number(debtMultiplier) > 75) {
            return message.reply('Du har kje lov å ta opp lån når rentå di e over 90%. Du får gambla, ble vippsa eller bruka "!mz daily" for å få mer chips')
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
            return message.reply('Du har ingen lån')
        }
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        const wantsToPayDownThisAmount = Number(args[0])
        if (wantsToPayDownThisAmount < 0) {
            return message.reply('skriv inn et positivt tall, bro')
        }
        if (!isNaN(wantsToPayDownThisAmount)) {
            let newTotal = Number(totalDebt) - Number(args[0])

            const userMasNumber = Number(userMoney)
            if (userMasNumber < wantsToPayDownThisAmount) {
                return message.reply('du har ikke råd til dette.')
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
            return message.reply('Feil formattering. Det er <brukernavn> <antall> <chips|coins>')
        }
        const targetUser = UserUtils.findUserByUsername(TextUtils.splitUsername(args[0]), message)

        if (!targetUser) {
            return message.reply('Brukeren eksisterer ikke')
        }

        const transactionAmount = Number(args[1])

        if (isNaN(transactionAmount) || transactionAmount < 1) {
            return message.reply('Du må skriva inn et gyldig tegn. Det må være større enn 0')
        }

        const transactionType = args[2]
        let trType: dbPrefix
        if (transactionType === 'coins') {
            trType = 'dogeCoin'
        } else if (transactionType === 'chips') {
            trType = transactionType
        } else {
            return message.reply('Du må spesifisere om du vil vippse "coins" eller "chips"')
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
            return message.reply('du har ikkje råd te å vippsa så møye, bro.')
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
        } else username = TextUtils.splitUsername(args[0])
        if (!UserUtils.findUserByUsername(username, message)) {
            return message.reply('Brukeren finnes ikke')
        }
        const coins = DatabaseHelper.getValue('dogeCoin', username, message)
        const chips = DatabaseHelper.getValue('chips', username, message)
        this.messageHelper.sendMessage(
            message.channelId,
            `${username} har ${TextUtils.formatMoney(Number(coins), 2, 2)} coins og ${TextUtils.formatMoney(Number(chips), 2, 2)} chips`
        )
    }

    /** TODO: Remove this when deprecated phase is over
     *  @deprecated this is now under checkcoins
     */
    private async checkChips(message: Message, messageContent: string, args: string[]) {
        let username: string
        if (!args[0]) {
            username = message.author.username
        } else username = TextUtils.splitUsername(args[0])

        const val = DatabaseHelper.getValue('chips', username, message)
        this.messageHelper.sendMessage(message.channelId, `${username} har ${TextUtils.formatMoney(Number(val), 2, 2)}chips`)
    }

    private rollSlotMachine(message: Message, messageContent: string, args: string[]) {
        const userMoney = DatabaseHelper.getValue('chips', message.author.username, message)
        if (Number(userMoney) < 100) {
            return message.reply('Det koste 100 chips for å bruga maskinen, og du har kje råd bro')
        }
        //Remove 100 chips
        let emojiString = ''
        const newMoneyVal = Number(userMoney) - 100
        DatabaseHelper.setValue('chips', message.author.username, newMoneyVal.toFixed(0))

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
        const dailyPrice = { chips: '300', coins: '80' }
        const hasFreeze = Number(DatabaseHelper.getValueWithoutMessage('dailyFreezeCounter', message.author.username))
        if (!isNaN(hasFreeze) && hasFreeze > 0) {
            return message.reply('Du har frosset daily claimet ditt i ' + hasFreeze + ' dager til. Vent til da og prøv igjen')
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
            message.reply('Du har allerede hentet dine daglige chips og coins. Prøv igjen i morgen etter klokken 06:00')
        }
    }

    private freezeDailyClaim(message: Message, messageContent: string, args: string[]) {
        const numDays = Number(args[0])
        if (isNaN(numDays) || numDays > 8) {
            return message.reply('Du må skrive inn et gyldig tall lavere enn 8')
        }
        const hasFreeze = Number(DatabaseHelper.getValueWithoutMessage('dailyFreezeCounter', message.author.username))
        if (hasFreeze && hasFreeze > 0) {
            return message.reply('Du har allerede frosset daily claimet ditt i ' + hasFreeze + ' dager til')
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
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
            {
                commandName: 'betal',
                description: 'Betal på lånet ditt. <number>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.payDownDebt(rawMessage, messageContent, args)
                },
                category: 'gambling',
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
            {
                commandName: 'krig',
                description: 'Gå til krig mot noen. <nummer> <username>',

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
                commandName: 'verdenskrig',
                description: 'Start en krig mot alle som vil bli med',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.startVerdensKrig(rawMessage, messageContent, args)
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
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
        ]
    }
}
