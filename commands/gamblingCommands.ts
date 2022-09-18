import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, Interaction, Message, TextChannel, User } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper, MazariniUser } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { SlashCommandHelper } from '../helpers/slashCommandHelper'
import { CollectorUtils } from '../utils/collectorUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { MentionUtils } from '../utils/mentionUtils'
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

    private checkBalance(users: { userID: string }[], amountAsNumber: number): string | undefined {
        let user: string | undefined = undefined
        users.forEach((u) => {
            const balance = DatabaseHelper.getUser(u.userID).chips
            if (Number(balance) < amountAsNumber || Number(balance) === 0) user = DatabaseHelper.getUser(u.userID).displayName ?? 'Ukjent'
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

    private getUserWallets(engagerID: string, victimID: string): { engagerChips: number; victimChips: number } {
        const engagerValue = DatabaseHelper.getUser(engagerID).chips
        const victimValue = DatabaseHelper.getUser(victimID).chips
        return {
            engagerChips: engagerValue,
            victimChips: victimValue,
        }
    }

    // private async krigWithAnyone(message: Message, content: string, args: string[]) {
    //     const amount = Number(this.findKrigValue(args[0], message.author.id))
    //     if (!amount) {
    //         message.reply('Du har skrevet inn et ugyldig tall')
    //     } else {
    //         const resolveMessage = await this.messageHelper.sendMessage(
    //             message.channelId,
    //             `${message.author.username} vil gå til krig mot hvem som helst for ${amount} chips. Reager med tommel opp for å svare`
    //         )
    //         if (resolveMessage) {
    //             this.messageHelper.reactWithThumbs(resolveMessage, 'up')

    //             const collector = resolveMessage.createReactionCollector()
    //             const nonValidAttempts: string[] = []
    //             collector.on('collect', (reaction) => {
    //                 if (CollectorUtils.shouldStopCollector(reaction, message)) {
    //                     if (resolveMessage) resolveMessage.edit(`${resolveMessage.content} (STANSET MED TOMMEL NED)`)
    //                     collector.stop()
    //                 }

    //                 if (reaction.emoji.name === '👍') {
    //                     const victim = reaction.users.cache
    //                         .filter((u: User) => u.id !== '802945796457758760' && u.id !== message.author.id && !nonValidAttempts.includes(u.id))
    //                         .first() as User
    //                     if (victim) {
    //                         const currentValue = this.getUserWallets(message.author.id, victim.id)
    //                         let engagerValue = currentValue.engagerChips
    //                         let victimValue = currentValue.victimChips

    //                         const notEnoughChips = this.checkBalance([{ userID: message.author.id }, { userID: victim.id }], amount)
    //                         if (notEnoughChips) {
    //                             nonValidAttempts.push(victim.id)
    //                             this.messageHelper.sendMessage(
    //                                 message.channelId,
    //                                 `${notEnoughChips} har ikke råd til å delta i ${message.author.username} sin krig for ${amount}`
    //                             )
    //                         } else {
    //                             const roll = RandomUtils.getRndInteger(0, 100)
    //                             let description = `Terningen trillet: ${roll}/100. ${
    //                                 roll < 51 ? (roll == 50 ? 'Bot Høie' : message.author.username) : victim.username
    //                             } vant! 💰💰`

    //                             if (roll == 50) {
    //                                 engagerValue -= amount
    //                                 victimValue -= amount
    //                             } else if (roll < 50) {
    //                                 engagerValue += amount
    //                                 victimValue -= amount
    //                             } else if (roll > 50) {
    //                                 engagerValue -= amount
    //                                 victimValue += amount
    //                             }

    //                             this.messageHelper.sendMessage(message.channelId, `<@${victim?.id}> <@${message.author.id}>`)
    //                             this.sendKrigMessage(
    //                                 message.channel as TextChannel,
    //                                 [
    //                                     { username: message.author.username, balance: engagerValue, oldBalance: currentValue.engagerChips },
    //                                     { username: victim.username, balance: victimValue, oldBalance: currentValue.victimChips },
    //                                 ],
    //                                 description
    //                             )
    //                             const authorUser = DatabaseHelper.getUser(message.author.id)
    //                             const victimUser = DatabaseHelper.getUser(victim.id)
    //                             authorUser.chips = engagerValue
    //                             victimUser.chips = victimValue
    //                             DatabaseHelper.updateUser(authorUser)
    //                             DatabaseHelper.updateUser(victimUser)

    //                             this.messageHelper.reactWithCheckmark(resolveMessage)
    //                             if (resolveMessage) {
    //                                 const oldContent = resolveMessage.content
    //                                 resolveMessage.edit(`${oldContent} (Fullført)`)
    //                             }
    //                             collector.stop()
    //                         }
    //                     }
    //                 }
    //             })
    //         }
    //     }
    // }

    private sendKrigMessage(channel: TextChannel, users: { username: string; balance: number; oldBalance: number }[], winningText: string) {
        const gambling = new EmbedBuilder().setTitle('⚔️ Krig ⚔️').setDescription(`${winningText}`)
        users.forEach((user) => {
            gambling.addFields({
                name: `${user.username}`,
                value: `Har nå ${TextUtils.formatMoney(user.balance, 2, 2)} chips (hadde ${TextUtils.formatMoney(user.oldBalance, 2, 2)})`,
            })
        })

        this.messageHelper.sendFormattedMessage(channel, gambling)
    }

    private async krig(interaction: ChatInputCommandInteraction<CacheType>) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)

        if (!isNaN(Number(amount)) || Number(amount) < 1) {
            this.messageHelper.replyToInteraction(interaction, `Tallet er ugyldig`, true)
        } else {
            const userWallets = this.getUserWallets(interaction.user.id, target.id)
            const hasAmount = !!amount

            const largestPossibleValue = Math.min(userWallets.engagerChips, userWallets.victimChips)
            let amountAsNum = hasAmount ? Number(amount) : largestPossibleValue
            const notEnoughChips = this.checkBalance([{ userID: interaction.user.id }, { userID: target.id }], amountAsNum)

            if (notEnoughChips) {
                this.messageHelper.replyToInteraction(interaction, `En av dere har ikke råd til dette`, true)
            } else {
                this.messageHelper.replyToInteraction(interaction, `Du har startet en krig mot ${target.username}`, true)
                const resolveMessage = await this.messageHelper.sendMessage(
                    interaction.channelId,
                    `${interaction.user.username} vil gå til krig med deg, ${MentionUtils.mentionUser(
                        target.id
                    )} for ${amountAsNum} chips. Reager med 👍 for å godkjenne. Den som starter krigen ruller for 0-49.`
                )
                if (resolveMessage) {
                    this.messageHelper.reactWithThumbs(resolveMessage, 'up')

                    const collector = resolveMessage.createReactionCollector()
                    collector.on('collect', (reaction) => {
                        if (CollectorUtils.shouldStopCollector(reaction, interaction)) {
                            if (resolveMessage) resolveMessage.edit(`${resolveMessage.content} (STANSET MED TOMMEL NED)`)
                            collector.stop()
                        }

                        const currentValue = this.getUserWallets(interaction.user.id, target.id)
                        let engagerValue = currentValue.engagerChips
                        let victimValue = currentValue.victimChips
                        if (!hasAmount) {
                            amountAsNum = Math.min(engagerValue, victimValue)
                        }
                        if (reaction.emoji.name === '👍' && reaction.users.cache.find((u: User) => u.id === target.id)) {
                            const notEnoughChips = this.checkBalance([{ userID: interaction.user.id }, { userID: target.id }], amountAsNum)
                            if (notEnoughChips) {
                                this.messageHelper.sendMessage(interaction.channelId, `Folkå har kje lenger råd te å kriga samen. Krigen bler stoppa`)
                                collector.stop()
                            } else {
                                const shouldAlwaysLose = target.id === interaction.user.id || target.id === UserUtils.User_IDs.BOT_HOIE
                                const roll = RandomUtils.getRndInteger(0, 100)
                                let description = `Terningen trillet: ${roll}/100. ${
                                    roll < 51 ? (roll == 50 ? 'Bot Høie' : interaction.user.username) : target.username
                                } vant! 💰💰`
                                if (shouldAlwaysLose) {
                                    description += `${
                                        target.id === interaction.user.id
                                            ? 'Men, du gikk til krig mot deg selv. Dette liker ikke Bot Høie, og tar derfor pengene.'
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
                                    ? [{ username: interaction.user.username, balance: engagerValue, oldBalance: currentValue.engagerChips }]
                                    : [
                                          { username: interaction.user.username, balance: engagerValue, oldBalance: currentValue.engagerChips },
                                          { username: target.username, balance: victimValue, oldBalance: currentValue.victimChips },
                                      ]

                                this.messageHelper.sendMessage(
                                    interaction.channelId,
                                    `${MentionUtils.mentionUser(target.id)} ${MentionUtils.mentionUser(interaction.user.id)}`
                                )
                                this.sendKrigMessage(interaction.channel as TextChannel, users, description)

                                const authorUser = DatabaseHelper.getUser(interaction.user.id)
                                const victimUser = DatabaseHelper.getUser(target.id)
                                authorUser.chips = engagerValue
                                victimUser.chips = victimValue
                                DatabaseHelper.updateUser(authorUser)
                                DatabaseHelper.updateUser(victimUser)

                                collector.stop()
                            }
                        }
                    })
                }
            }
        }
    }

    private diceGamble(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)
        const userMoney = user.chips
        let chipsToGamble = amount

        if (!amount || amount > userMoney) chipsToGamble = userMoney
        if (amount < 1 || isNaN(amount)) chipsToGamble = 1
        if (userMoney) {
            const roll = RandomUtils.getRndInteger(0, 100)

            let newMoneyValue = 0
            let multiplier = this.getMultiplier(roll)
            const calculatedValue = this.calculatedNewMoneyValue(interaction.user.id, multiplier, chipsToGamble, userMoney)

            if (roll >= 50) {
                newMoneyValue = calculatedValue.newMoneyValue
            } else newMoneyValue = Number(userMoney) - chipsToGamble
            user.chips = newMoneyValue
            DatabaseHelper.updateUser(user)

            const gambling = new EmbedBuilder()
                .setTitle('Gambling 🎲')
                .setDescription(
                    `${interaction.user.username} gamblet ${TextUtils.formatMoney(chipsToGamble, 2, 2)} av ${TextUtils.formatMoney(
                        Number(userMoney),
                        2,
                        2
                    )} chips.\nTerningen trillet: ${roll}/100. Du ${
                        roll >= 50 ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'
                    }\nDu har nå ${TextUtils.formatMoney(newMoneyValue, 2, 2)} chips.`
                )
            if (roll >= 100) gambling.addFields({ name: `Trillet 100!`, value: `Du trillet 100 og vant ${multiplier} ganger så mye som du satset!` })
            this.messageHelper.replyToInteraction(interaction, gambling)
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må ha minst 1 chip for å gambla :'(`)
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
        } else if (!userMoney || userMoney < 0) {
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

                if (won) newMoneyValue = this.calculatedNewMoneyValue(message.author.id, multiplier, valAsNum, userMoney).newMoneyValue
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
                const gambling = new EmbedBuilder()
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
    private getMultiplier(roll: number) {
        if (roll >= 100) return 5
        return 2
    }

    private calculatedNewMoneyValue(
        id: string,
        multiplier: number,
        valAsNum: number,
        userMoney: number
    ): { newMoneyValue: number; interestAmount: number; rate: number } {
        const user = DatabaseHelper.getUser(id)

        let newMoneyValue = 0
        let interest = 0
        let rate = 0

        newMoneyValue = Number(userMoney) + multiplier * valAsNum - interest - valAsNum

        return { newMoneyValue: newMoneyValue, interestAmount: interest, rate: rate }
    }

    private vippsChips(interaction: ChatInputCommandInteraction<CacheType>) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)

        const user = DatabaseHelper.getUser(interaction.user.id)
        const targetUser = DatabaseHelper.getUser(target.id)
        const userBalance = user.chips

        if (isNaN(amount) || amount < 0) {
            this.messageHelper.replyToInteraction(interaction, `Det e kje lov å vippsa någen et negativt beløp ;)`, true)
        } else if (userBalance >= amount) {
            const oldChips = user.chips
            user.chips = oldChips - amount
            const newChips = targetUser.chips
            targetUser.chips = newChips + amount
            DatabaseHelper.updateUser(user)
            DatabaseHelper.updateUser(targetUser)
            this.messageHelper.replyToInteraction(
                interaction,
                `${interaction.user.username} vippset ${MentionUtils.mentionUser(targetUser.id)} ${amount} chips.`
            )
        } else {
            this.messageHelper.replyToInteraction(
                interaction,
                'Dette har du kje råd te, bro. Du mangle ' + (amount - userBalance) + ' for å få lov te å vippsa ' + amount,
                true
            )
        }
    }

    private async openWallet(interaction: ChatInputCommandInteraction<CacheType>) {
        const target = interaction.options.get('bruker')?.user

        let id = interaction.user.id
        let name = interaction.user.username
        if (target) {
            id = target.id
            name = target.username
        }
        const user = DatabaseHelper.getUser(id)
        const chips = user.chips
        const embed = EmbedUtils.createSimpleEmbed(`💳 Lommeboken til ${name} 🏧`, `${chips} chips`)
        this.messageHelper.replyToInteraction(interaction, embed)
    }

    private rollSlotMachine(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        const userMoney = user.chips
        if (Number(userMoney) < 100) {
            this.messageHelper.replyToInteraction(interaction, `Det koste 100 chips for å bruga maskinen, og du har kje råd bro`)
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

            const msg = new EmbedBuilder().setTitle('🎰 Gambling 🎰').setDescription(`${emojiString}`).setFields()

            const amountOfCorrectNums: { val: number; num: number }[] = []
            const sequenceWins = ['123', '1234', '12345', '1337', '80085']
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
                    msg.addFields({ name: `${correctNum.val}`, value: `Kom ${correctNum.num + 1} ganger. Du har vunnet ${currentWinnings} chips` })
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
                        msg.addFields({ name: `${seq}`, value: `Du fikk sekvensen ${seq}. Du har vunnet ${seqWorth} chips` })
                        hasSequence = true
                    }
                })
                if (!hasSequence) msg.addFields({ name: 'Du tapte', value: '-100 chips' })
            }
            this.messageHelper.replyToInteraction(interaction, msg)
        }
    }

    /** Missing streak counter and increased reward */
    private handleDailyClaimInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
        const numDays = Number(interaction.options.get('dager')?.value)

        if (!numDays) {
            const reply = this.claimDailyChipsAndCoins(interaction)
            this.messageHelper.replyToInteraction(interaction, reply)
        } else if (numDays) {
            const reply = this.freezeDailyClaim(interaction, numDays)
            this.messageHelper.replyToInteraction(interaction, reply)
        } else {
            //Usikker på om dager er obligatorisk, så håndter en eventuell feil intill bekreftet oblig.
            SlashCommandHelper.handleInteractionParameterError(interaction)
        }
    }

    private claimDailyChipsAndCoins(interaction: ChatInputCommandInteraction<CacheType>): string {
        if (interaction) {
            const user = DatabaseHelper.getUser(interaction.user.id)
            const canClaim = user.dailyClaim
            const dailyPrice = { chips: '300', coins: '80' }
            const hasFreeze = user.dailyFreezeCounter
            if (hasFreeze && !isNaN(hasFreeze) && hasFreeze > 0) {
                return 'Du har frosset daily claimet ditt i ' + hasFreeze + ' dager til. Vent til da og prøv igjen'
            } else if (canClaim === 0 || canClaim === undefined) {
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
                let claimedMessage = `Du har hentet dine daglige ${daily.dailyChips} chips ${
                    streak.streak > 1 ? '(' + streak.streak + ' dager i streak)' : ''
                } ${prestige ? '(' + prestige + ' prestige)' : ''}`

                const maxLimit = 7
                if (streak.streak >= maxLimit) {
                    const remainingDays = streak.streak - maxLimit
                    user.prestige = 1 + (user.prestige ?? 0)

                    const prestige = user.prestige

                    claimedMessage += `\nDægårten! Du har henta daglige chips i ${
                        streak.streak
                    } dager i strekk! Gz dude, nå prestige du. Du e nå prestige ${prestige} og får ${this.findPrestigeMultiplier(prestige).toFixed(
                        2
                    )}x i multiplier på alle daily's framøve! \n\n*Streaken din resettes nå te ${!!remainingDays ? remainingDays : '1'}*`
                    streak = { streak: 1 + Math.max(remainingDays, 0), wasAddedToday: true }
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
                return claimedMessage
            } else {
                return 'Du har allerede hentet dine daglige chips. Prøv igjen i morgen etter klokken 06:00'
            }
        } else return 'Klarte ikke hente daily'
    }

    private freezeDailyClaim(interaction: Interaction<CacheType>, numDays: number): string {
        const user = DatabaseHelper.getUser(interaction.user.id)

        const hasFreeze = user.dailyFreezeCounter
        if (isNaN(numDays) || numDays > 8) {
            return 'Tallet var ikke gyldig'
        } else if (hasFreeze && hasFreeze > 0) {
            return 'Du har allerede frosset daily claimet ditt i ' + hasFreeze + ' dager til'
        } else {
            user.dailyFreezeCounter = numDays
            DatabaseHelper.updateUser(user)
            return (
                'Du har frosset daily claimen din i ' +
                numDays +
                ' dager. Du får ikke hente ut daily chips og coins før da, men streaken din vil heller ikke forsvinne. Denne kan ikke overskrives eller fjernes'
            )
        }
    }

    private findAndIncrementValue(streak: number, dailyPrice: { chips: string }, user: MazariniUser): { dailyChips: string } {
        const additionalCoins = this.findAdditionalCoins(streak)
        const prestigeMultiplier = this.findPrestigeMultiplier(user.prestige)

        const dailyChips = ((Number(dailyPrice.chips) + Number(additionalCoins?.chips ?? 0)) * prestigeMultiplier).toFixed(0)
        user.chips = user.chips + Number(dailyChips)

        user.dailyClaim = 1
        DatabaseHelper.updateUser(user)

        return { dailyChips: dailyChips }
    }

    private findPrestigeMultiplier(p: number | undefined) {
        if (p && !isNaN(p) && p > 0) {
            return 1 + 0.05 * p
        }
        return 1
    }

    private findAdditionalCoins(streak: number): { chips: number } | undefined {
        if (streak > 5) return { chips: 100 }
        if (streak > 3) return { chips: 75 }
        if (streak >= 2) return { chips: 25 }
        return undefined
    }

    private findSequenceWinningAmount(s: string) {
        switch (s) {
            case '123':
                return 1000
            case '1234':
                return 15500
            case '12345':
            case '80085':
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
                commandName: 'krig',
                description: 'Gå til krig mot noen. <nummer> <brukernavn>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {},
                category: 'gambling',
                isReplacedWithSlashCommand: 'krig',
            },
            {
                commandName: 'vipps',
                description: 'Vipps til en annen bruker. <brukernavn> <tall>',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    // this.vippsChips(rawMessage, messageContent, args)
                },
                category: 'gambling',
                isReplacedWithSlashCommand: 'vipps',
            },
            {
                commandName: 'verdenskrig',
                description: 'Start en krig mot alle som vil bli med',

                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    // this.startVerdensKrig(rawMessage, messageContent, args)
                },
                category: 'gambling',
                isReplacedWithSlashCommand: 'krig',
            },
            {
                commandName: ['gamble', 'g'],
                description: 'Gambla chips dine! Skriv inn mengde chips du vil gambla, så kan du vinna.',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    // this.diceGamble(rawMessage, messageContent, args)
                },
                category: 'gambling',
                isReplacedWithSlashCommand: 'gamble',
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },

            {
                commandName: 'rulett',
                description:
                    'Gambla chipså dine! Skriv inn mengde chips du vil gambla og ikke minst ka du gamble de på, så kan du vinna. Tilbakebetaling blir høyere jo større risiko du tar. Lykke til!' +
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
                    // this.openWallet(rawMessage, messageContent, args)
                },
                isReplacedWithSlashCommand: 'wallet',
                category: 'gambling',
            },
            {
                commandName: 'roll',
                description: 'Rull spillemaskinen. Du vinner hvis du får 2 eller flere like tall',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    // this.rollSlotMachine(rawMessage, messageContent, args)
                },
                category: 'gambling',
                isReplacedWithSlashCommand: 'roll',
                canOnlyBeUsedInSpecificChannel: [MessageUtils.CHANNEL_IDs.LAS_VEGAS],
            },
        ]
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'daily',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.handleDailyClaimInteraction(rawInteraction)
                },
                category: 'gambling',
            },
            {
                commandName: 'vipps',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.vippsChips(rawInteraction)
                },
                category: 'gambling',
            },
            {
                commandName: 'wallet',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.openWallet(rawInteraction)
                },
                category: 'gambling',
            },
            {
                commandName: 'krig',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.krig(rawInteraction)
                },
                category: 'gambling',
            },
            {
                commandName: 'gamble',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.diceGamble(rawInteraction)
                },
                category: 'gambling',
            },
            {
                commandName: 'roll',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.rollSlotMachine(rawInteraction)
                },
                category: 'gambling',
            },
        ]
    }
}
