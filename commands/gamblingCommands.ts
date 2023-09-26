import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Interaction,
    User
} from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { SlashCommandHelper } from '../helpers/slashCommandHelper'
import { ChipsStats, MazariniUser, RulettStats } from '../interfaces/database/databaseInterface'
import { EmbedUtils } from '../utils/embedUtils'
import { MentionUtils } from '../utils/mentionUtils'
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

    static checkBalance(users: { userID: string }[], amountAsNumber: number): boolean {
        let notEnough = false
        users.forEach((u) => {
            const balance = DatabaseHelper.getUser(u.userID).chips
            if (Number(balance) < amountAsNumber || Number(balance) === 0) notEnough = true
        })
        return notEnough
    }

    static getUserWallets(engagerID: string, victimID: string): { engagerChips: number; victimChips: number } {
        const engagerValue = DatabaseHelper.getUser(engagerID).chips
        const victimValue = DatabaseHelper.getUser(victimID).chips
        return {
            engagerChips: engagerValue,
            victimChips: victimValue,
        }
    }

    private async krig(interaction: ChatInputCommandInteraction<CacheType>) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)

        const userWallets = GamblingCommands.getUserWallets(interaction.user.id, target.id)
        const hasAmount = !!amount

        const largestPossibleValue = Math.min(userWallets.engagerChips, userWallets.victimChips)
        let amountAsNum = hasAmount ? Number(amount) : largestPossibleValue
        const notEnoughChips = GamblingCommands.checkBalance([{ userID: interaction.user.id }, { userID: target.id }], amountAsNum)

        if (notEnoughChips) {
            this.messageHelper.replyToInteraction(interaction, `En av dere har ikke råd til dette`, { ephemeral: true })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du har startet en krig mot ${target.username}`, { ephemeral: true })
            await this.messageHelper.sendMessage(
                interaction?.channelId,
                `${interaction.user.username} vil gå til krig med deg ${MentionUtils.mentionUser(
                    target.id
                )} for ${amountAsNum} chips. Trykk på knappen for å godkjenne. Den som starter krigen ruller for 0-49.`
            )

            const row = new ActionRowBuilder<ButtonBuilder>()

            row.addComponents(
                new ButtonBuilder({
                    custom_id: `KRIG;${target.id};${interaction.user.id};${amountAsNum}`,
                    style: ButtonStyle.Success,
                    label: `⚔️ Krig ⚔️`,
                    disabled: false,
                    type: 2,
                })
            )
            await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [row])
        }
    }

    /** FIXME: Should refactor instead of just duplicating it as a static. */
    static async krig(
        interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>,
        msgHelper: MessageHelper,
        target: User,
        amount: number
    ) {
        const userWallets = this.getUserWallets(interaction.user.id, target.id)
        const hasAmount = !!amount

        const largestPossibleValue = Math.min(userWallets.engagerChips, userWallets.victimChips)
        let amountAsNum = hasAmount ? Number(amount) : largestPossibleValue
        const notEnoughChips = this.checkBalance([{ userID: interaction.user.id }, { userID: target.id }], amountAsNum)

        if (notEnoughChips) {
            msgHelper.replyToInteraction(interaction, `En av dere har ikke råd til dette`, { ephemeral: true })
        } else {
            msgHelper.replyToInteraction(interaction, `Du har startet en krig mot ${target.username}`, { ephemeral: true })
            await msgHelper.sendMessage(
                interaction?.channelId,
                `${interaction.user.username} vil gå til krig med deg ${MentionUtils.mentionUser(
                    target.id
                )} for ${amountAsNum} chips. Trykk på knappen for å godkjenne. Den som starter krigen ruller for 0-49.`
            )

            const row = new ActionRowBuilder<ButtonBuilder>()

            row.addComponents(
                new ButtonBuilder({
                    custom_id: `KRIG;${target.id};${interaction.user.id};${amountAsNum}`,
                    style: ButtonStyle.Primary,
                    label: `⚔️ Krig ⚔️`,
                    disabled: false,
                    type: 2,
                })
            )
            await msgHelper.sendMessageWithComponents(interaction?.channelId, [row])
        }
    }

    private diceGamble(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)
        const userMoney = user.chips
        let chipsToGamble = amount

        if (!amount || amount > userMoney || isNaN(amount)) chipsToGamble = userMoney
        if (amount < 1) chipsToGamble = 1
        if (userMoney) {
            const roll = RandomUtils.getRandomInteger(0, 100)

            let newMoneyValue = 0
            let multiplier = this.getMultiplier(roll)
            const calculatedValue = this.calculatedNewMoneyValue(interaction.user.id, multiplier, chipsToGamble, userMoney)

            if (roll >= 50) {
                newMoneyValue = calculatedValue.newMoneyValue
                DatabaseHelper.incrementChipsStats(user, 'gambleWins')
            } else {
                newMoneyValue = Number(userMoney) - chipsToGamble
                DatabaseHelper.incrementChipsStats(user, 'gambleLosses')
            }
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

    private roulette(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        let userMoney = user.chips
        const isForNumber = interaction.options.getSubcommand() === 'tall'
        const isForCategory = interaction.options.getSubcommand() === 'kategori'

        const stake = SlashCommandHelper.getCleanNumberValue(interaction.options.get('satsing')?.value)
        const betOn: string | number = interaction.options.get(isForNumber ? 'tall' : 'kategori')?.value as string | number
        const betOnNumber = Number(betOn)
        if (Number(stake) > Number(userMoney) || !userMoney || userMoney < 0) {
            this.messageHelper.replyToInteraction(interaction, 'Du har ikke nok penger til å gamble så mye. Ta å spin fidget spinneren litt for någe cash')
        } else if (Number(stake) <= 0 || Number(stake) === 0 || (isForNumber && (betOnNumber < 0 || betOnNumber > 37))) {
            this.messageHelper.replyToInteraction(interaction, 'Du prøver å gamble med en ulovlig verdi.')
        } else if (Number(stake) && betOn) {
            const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
            const valAsNum = Number(Number(stake).toFixed(2))
            const roll = RandomUtils.getRandomInteger(0, 36)
            let multiplier = 1
            let won = false

            if (!isNaN(betOnNumber) && betOnNumber >= 0 && betOnNumber <= 37) {
                if (roll == betOnNumber) {
                    won = true
                    multiplier = 36
                }
            } else if (typeof betOn === 'string') {
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
                }
            }

            let newMoneyValue = 0

            if (won) newMoneyValue = this.calculatedNewMoneyValue(interaction.user.id, multiplier, valAsNum, userMoney).newMoneyValue
            else newMoneyValue = Number(userMoney) - valAsNum
            user.chips = newMoneyValue

            DatabaseHelper.incrementChipsStats(user, won ? 'roulettWins' : 'rouletteLosses')
            DatabaseHelper.incrementRulettStats(user, roll % 2 == 0 ? 'even' : 'odd')

            let result = ''
            if (roll == 0) {
                result = roll + ' grønn(!)'
                DatabaseHelper.incrementRulettStats(user, 'green')
            } else if (red.includes(roll)) {
                result = roll + ' rød'
                DatabaseHelper.incrementRulettStats(user, 'red')
            } else {
                result = roll + ' svart'
                DatabaseHelper.incrementRulettStats(user, 'black')
            }

            DatabaseHelper.updateUser(user)

            const gambling = new EmbedBuilder()
                .setTitle('Rulett 🎲')
                .setDescription(
                    `${interaction.user.username} satset ${valAsNum} av ${userMoney} chips på ${
                        isForCategory ? this.getPrettyName(betOn.toString()) : betOn
                    }.\nBallen landet på: ${result}. Du ${won ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'}\nDu har nå ${TextUtils.formatMoney(
                        newMoneyValue,
                        2,
                        2
                    )} chips.`
                )

            this.messageHelper.replyToInteraction(interaction, gambling)
        }
    }
    private getPrettyName(n: string) {
        if (n === 'green') return 'grønn'
        if (n === 'red') return 'rød'
        if (n === 'black') return 'svart'
        if (n === 'odd') return 'oddetall'
        if (n === 'even') return 'partall'
        return 'ukjent'
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
            this.messageHelper.replyToInteraction(interaction, `Det e kje lov å vippsa någen et negativt beløp ;)`, { ephemeral: true })
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
                { ephemeral: true }
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
        if (Number(userMoney) < 200) {
            this.messageHelper.replyToInteraction(interaction, `Det koste 200 chips for å bruga maskinen, og du har kje råd bro`)
        } else {
            //Remove 100 chips
            let emojiString = ''
            const newMoneyVal = Number(userMoney) - 200
            user.chips = newMoneyVal
            DatabaseHelper.updateUser(user)
            const randArray = []
            for (let i = 0; i < 6; i++) {
                randArray.push(RandomUtils.getRandomInteger(0, 9))
            }
            randArray.forEach((num) => {
                emojiString += MiscUtils.findLetterEmoji(num.toString())
            })

            const msg = new EmbedBuilder().setTitle('🎰 Gambling 🎰').setDescription(`${emojiString}`).setFields()

            const amountOfCorrectNums: { val: number; num: number }[] = []
            const sequenceWins = ['123', '1234', '12345', '123456', '1337', '80085']
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
                    msg.addFields({ name: `${correctNum.val}`, value: `Kom ${correctNum.num + 1} ganger på rad. Du har vunnet ${currentWinnings} chips` })
                })
            }
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
            if (hasSequence || amountOfCorrectNums.length > 0) {
                DatabaseHelper.incrementChipsStats(user, 'slotWins')
            } else {
                DatabaseHelper.incrementChipsStats(user, 'slotLosses')
            }
            const currentMoney = user.chips
            const newMoney = Number(currentMoney) + winnings
            user.chips = newMoney
            DatabaseHelper.updateUser(user)

            if (!hasSequence && amountOfCorrectNums.length < 1) msg.addFields({ name: 'Du tapte', value: '-200 chips' })

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
            const dailyPrice = '500'
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

    private async rollDice(interaction: ChatInputCommandInteraction<CacheType>) {
        const customTarget = interaction.options.get('sider')?.value as number
        const diceTarget = customTarget ? customTarget : 6
        if (diceTarget <= 0) this.messageHelper.replyToInteraction(interaction, `Du kan ikke trille en terning med mindre enn 1 side`, { ephemeral: true })
        else {
            const explanation = !!customTarget ? `*(1 - ${customTarget})*` : ``
            const number = RandomUtils.getRandomInteger(1, diceTarget)
            const numberEmoji = customTarget ? number : (await EmojiHelper.getEmoji(`dice_${number}`, interaction)).id
            this.messageHelper.replyToInteraction(interaction, `${numberEmoji} ${explanation}`)
        }
    }

    private async handleKrig(interaction: ButtonInteraction<CacheType>) {
        const ids = interaction.customId.split(';')
        const engagerId = ids[2]
        const eligibleTargetId = ids[1]
        const amountAsNum = Number(ids[3])
        /** Victim */
        const userAsMember = UserUtils.findMemberByUserID(interaction.user.id, interaction)
        /** Engager */
        const engagerUser = UserUtils.findUserById(engagerId, interaction)
        if (userAsMember.id === eligibleTargetId && interaction.message.components.length) {
            const notEnoughChips = GamblingCommands.checkBalance([{ userID: engagerId }, { userID: eligibleTargetId }], amountAsNum)
            if (notEnoughChips) {
                this.messageHelper.replyToInteraction(interaction, `En av dere har ikke lenger råd til krigen`, { ephemeral: true })
            } else {
                //We update the row with a new, disabled button, so that the user cannot enage the Krig more than once
                const row = new ActionRowBuilder<ButtonBuilder>()
                row.addComponents(
                    new ButtonBuilder({
                        custom_id: `KRIG;COMPLETED`,
                        style: ButtonStyle.Secondary,
                        label: `🏳️ Krig 🏳️`,
                        disabled: true,
                        type: 2,
                    })
                )
                await interaction.message.edit({
                    components: [row],
                })

                const engager = DatabaseHelper.getUser(engagerId)
                const target = DatabaseHelper.getUser(eligibleTargetId)

                let engagerValue = engager.chips
                let victimValue = target.chips

                const shouldAlwaysLose = engager.id === interaction.user.id
                let roll = RandomUtils.getRandomInteger(0, 100)
                if ((engager.id === '239154365443604480' && roll < 50) || (target.id === '239154365443604480' && roll > 50)) {
                    roll = RandomUtils.getRandomInteger(0, 100)
                }
                let description = `Terningen trillet: ${roll}/100. ${
                    roll < 51 ? (roll == 50 ? 'Bot Høie' : engagerUser.username) : userAsMember.user.username
                } vant! 💰💰`
                if (shouldAlwaysLose) {
                    description += `${
                        engager.id === interaction.user.id
                            ? 'Men, du gikk til krig mot deg selv. Dette liker ikke Bot Høie, og tar derfor pengene.'
                            : 'Du gikk til krig mot Bot Høie, så huset vinner alltid uansett'
                    }`
                }

                const oldTarVal = target.chips
                const oldEngVal = engager.chips
                if (roll == 50 || shouldAlwaysLose) {
                    engagerValue -= amountAsNum
                    victimValue -= amountAsNum
                    DatabaseHelper.incrementChipsStats(engager, 'krigLosses')
                    DatabaseHelper.incrementChipsStats(target, 'krigLosses')
                } else if (roll < 50) {
                    engagerValue += amountAsNum
                    victimValue -= amountAsNum
                    DatabaseHelper.incrementChipsStats(engager, 'krigWins')
                    DatabaseHelper.incrementChipsStats(target, 'krigLosses')
                } else if (roll > 50) {
                    engagerValue -= amountAsNum
                    victimValue += amountAsNum
                    DatabaseHelper.incrementChipsStats(engager, 'krigLosses')
                    DatabaseHelper.incrementChipsStats(target, 'krigWins')
                }

                const users = shouldAlwaysLose
                    ? [{ username: interaction.user.username, balance: engagerValue, oldBalance: oldEngVal }]
                    : [
                          { username: engagerUser.username, balance: engagerValue, oldBalance: oldEngVal },
                          { username: userAsMember.user.username, balance: victimValue, oldBalance: oldTarVal },
                      ]

                this.messageHelper.sendMessage(
                    interaction?.channelId,
                    `${MentionUtils.mentionUser(engager.id)} ${MentionUtils.mentionUser(interaction.user.id)}`
                )
                const gambling = new EmbedBuilder().setTitle('⚔️ Krig ⚔️').setDescription(`${description}`)
                users.forEach((user) => {
                    gambling.addFields({
                        name: `${user.username}`,
                        value: `Har nå ${TextUtils.formatMoney(user.balance, 2, 2)} chips (hadde ${TextUtils.formatMoney(user.oldBalance, 2, 2)})`,
                    })
                })

                this.messageHelper.replyToInteraction(interaction, gambling)

                engager.chips = engagerValue
                target.chips = victimValue
                DatabaseHelper.updateUser(engager)
                DatabaseHelper.updateUser(target)

                const rematchRow = new ActionRowBuilder<ButtonBuilder>()

                const updatedMax = Math.min(engagerValue, victimValue)

                const oldEngager = engagerUser.id
                const oldTarget = userAsMember.id

                if (updatedMax > 0) {
                    rematchRow.addComponents(
                        new ButtonBuilder({
                            custom_id: `KRIG_REMATCH;${oldEngager};${oldTarget};${amountAsNum < updatedMax ? amountAsNum : updatedMax}`,
                            style: ButtonStyle.Primary,
                            label: `⚔️ Omkamp ⚔️`,
                            disabled: false,
                            type: 2,
                        })
                    )
                    await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [rematchRow])
                }
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du kan kje starta denne krigen`, { ephemeral: true })
        }
    }

    private async handleRematch(interaction: ButtonInteraction<CacheType>) {
        const params = interaction.customId.split(';')
        const oldEngager = params[1]
        const oldTarget = params[2]
        const updatedTargetId = oldTarget === interaction.user.id ? oldEngager : oldTarget
        const amount = Number(params[3])

        if ([oldEngager, oldTarget].includes(interaction.user.id)) {
            const victimUser = UserUtils.findUserById(updatedTargetId, interaction)
            if (victimUser) {
                GamblingCommands.krig(interaction, this.messageHelper, victimUser, amount)
            }
            const row = new ActionRowBuilder<ButtonBuilder>()
            row.addComponents(
                new ButtonBuilder({
                    custom_id: `KRIG_REMATCH;COMPLETED`,
                    style: ButtonStyle.Secondary,
                    label: `🏳️ Omkamp 🏳️`,
                    disabled: true,
                    type: 2,
                })
            )
            await interaction.message.edit({
                components: [row],
            })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du kan bare starta ein omkamp for ein krig du deltok i sjøl`, { ephemeral: true })
        }
    }

    //TODO: Move this away from gamblingCommands
    private findUserStats(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = DatabaseHelper.getUser(interaction.user.id)
        const userStats = user.userStats?.chipsStats
        const rulettStats = user.userStats?.rulettStats
        let reply = ''
        if (userStats) {
            reply += '**Gambling**\n'
            reply += Object.entries(userStats)
                .map((stat) => {
                    return `${this.findPrettyNameForChipsKey(stat[0] as keyof ChipsStats)}: ${stat[1]}`
                })
                .sort()
                .join('\n')
        }
        if (rulettStats) {
            reply += '\n\n**Rulett**\n'
            reply += Object.entries(rulettStats)
                .map((stat) => {
                    return `${this.findPrettyNameForRulettKey(stat[0] as keyof RulettStats)}: ${stat[1]}`
                })
                .sort()
                .join('\n')
        }
        if (reply == '') {
            reply = 'Du har ingen statistikk å visa'
        }
        this.messageHelper.replyToInteraction(interaction, reply)
    }

    private findPrettyNameForChipsKey(prop: keyof ChipsStats) {
        switch (prop) {
            case 'gambleLosses':
                return 'Gambling tap'
            case 'gambleWins':
                return 'Gambling gevinst'
            case 'krigLosses':
                return 'Krig tap'
            case 'krigWins':
                return 'Krig seier'
            case 'roulettWins':
                return 'Rulett gevinst'
            case 'rouletteLosses':
                return 'Rulett tap'
            case 'slotLosses':
                return 'Roll tap'
            case 'slotWins':
                return 'Roll gevinst'
            default:
                return 'Ukjent'
        }
    }
    private findPrettyNameForRulettKey(prop: keyof RulettStats) {
        switch (prop) {
            case 'black':
                return 'Svart'
            case 'green':
                return 'Grønn'
            case 'red':
                return 'Rød'
            case 'even':
                return 'Partall'
            case 'odd':
                return 'Oddetall'
            default:
                return 'Ukjent'
        }
    }

    private findAndIncrementValue(streak: number, dailyPrice: string, user: MazariniUser): { dailyChips: string } {
        const additionalCoins = this.findAdditionalCoins(streak)
        const prestigeMultiplier = this.findPrestigeMultiplier(user.prestige)

        const dailyChips = ((Number(dailyPrice) + Number(additionalCoins ?? 0)) * prestigeMultiplier).toFixed(0)
        user.chips = user.chips + Number(dailyChips)
        user.dailyClaim = 1
        DatabaseHelper.updateUser(user)

        return { dailyChips: dailyChips }
    }

    private findPrestigeMultiplier(p: number | undefined) {
        if (p && !isNaN(p) && p > 0) {
            return 1 + 0.43752 * p
        }
        return 1
    }

    private findAdditionalCoins(streak: number): number | undefined {
        if (streak > 5) return 1000
        if (streak > 3) return 475
        if (streak >= 2) return 250
        return undefined
    }

    private findSequenceWinningAmount(s: string) {
        switch (s) {
            case '123':
                return 1500
            case '1234':
                return 15500
            case '12345':
                return 3575000
            case '1337':
                return 301337
            default:
                return 400
        }
    }

    private findSlotMachineWinningAmount(numCorrect: number) {
        switch (numCorrect) {
            case 2:
                return 200
            case 3:
                return 1750
            case 4:
                return 14500
            case 5:
                return 475000
            case 6:
                return 35750000
            default:
                return 200
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'daily',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleDailyClaimInteraction(rawInteraction)
                        },
                    },
                    {
                        commandName: 'vipps',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.vippsChips(rawInteraction)
                        },
                    },
                    {
                        commandName: 'wallet',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.openWallet(rawInteraction)
                        },
                    },
                    {
                        commandName: 'krig',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.krig(rawInteraction)
                        },
                    },
                    {
                        commandName: 'gamble',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.diceGamble(rawInteraction)
                        },
                    },
                    {
                        commandName: 'roll',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.rollSlotMachine(rawInteraction)
                        },
                    },
                    {
                        commandName: 'rulett',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.roulette(rawInteraction)
                        },
                    },
                    {
                        commandName: 'terning',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.rollDice(rawInteraction)
                        },
                    },
                    {
                        commandName: 'brukerstats',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.findUserStats(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'KRIG',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.handleKrig(rawInteraction)
                        },
                    },
                    {
                        commandName: 'KRIG_REMATCH',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.handleRematch(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
