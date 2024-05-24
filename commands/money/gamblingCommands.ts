import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { DatabaseHelper } from '../../helpers/databaseHelper'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { MentionUtils } from '../../utils/mentionUtils'
import { MiscUtils } from '../../utils/miscUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'

export class GamblingCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async diceGamble(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)
        const userMoney = user.chips
        let chipsToGamble = amount

        if (!amount || amount > userMoney || isNaN(amount)) chipsToGamble = userMoney
        if (amount < 1) chipsToGamble = 1
        if (userMoney) {
            const roll = RandomUtils.getRandomInteger(0, 100)

            let newMoneyValue = 0
            let multiplier = this.getMultiplier(roll)
            const calculatedValue = await this.calculatedNewMoneyValue(interaction.user.id, multiplier, chipsToGamble, userMoney)

            if (roll >= 50) {
                newMoneyValue = calculatedValue.newMoneyValue
                DatabaseHelper.incrementChipsStats(user, 'gambleWins')
            } else {
                newMoneyValue = Number(userMoney) - chipsToGamble
                DatabaseHelper.incrementChipsStats(user, 'gambleLosses')
            }
            user.chips = newMoneyValue
            this.client.database.updateUser(user)

            const gambling = new EmbedBuilder()
                .setTitle('Gambling 🎲')
                .setDescription(
                    `${interaction.user.username} gamblet ${TextUtils.formatMoney(chipsToGamble)} av ${TextUtils.formatMoney(
                        Number(userMoney)
                    )} chips.\nTerningen trillet: ${roll}/100. Du ${
                        roll >= 50 ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'
                    }\nDu har nå ${TextUtils.formatMoney(newMoneyValue)} chips.`
                )
            if (roll >= 100) gambling.addFields({ name: `Trillet 100!`, value: `Du trillet 100 og vant ${multiplier} ganger så mye som du satset!` })
            this.messageHelper.replyToInteraction(interaction, gambling)
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må ha minst 1 chip for å gambla :'(`)
        }
    }

    private async roulette(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
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

            if (won) {
                const calculatedMoney = await this.calculatedNewMoneyValue(interaction.user.id, multiplier, valAsNum, userMoney)
                newMoneyValue = calculatedMoney.newMoneyValue
            } else newMoneyValue = Number(userMoney) - valAsNum
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

            this.client.database.updateUser(user)

            const gambling = new EmbedBuilder()
                .setTitle('Rulett 🎲')
                .setDescription(
                    `${interaction.user.username} satset ${TextUtils.formatMoney(valAsNum)} av ${TextUtils.formatMoney(userMoney)} chips på ${
                        isForCategory ? this.getPrettyName(betOn.toString()) : betOn
                    }.\nBallen landet på: ${result}. Du ${won ? 'vant! 💰💰 (' + Number(multiplier) + 'x)' : 'tapte 💸💸'}\nDu har nå ${TextUtils.formatMoney(
                        newMoneyValue
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

    private async calculatedNewMoneyValue(
        id: string,
        multiplier: number,
        valAsNum: number,
        userMoney: number
    ): Promise<{ newMoneyValue: number; interestAmount: number; rate: number }> {
        const user = await this.client.database.getUser(id)

        let newMoneyValue = 0
        let interest = 0
        let rate = 0

        newMoneyValue = Number(userMoney) + multiplier * valAsNum - interest - valAsNum

        return { newMoneyValue: newMoneyValue, interestAmount: interest, rate: rate }
    }

    private async rollSlotMachine(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const userMoney = user.chips
        const cost = 100
        if (Number(userMoney) < cost) {
            this.messageHelper.replyToInteraction(interaction, `Det koste ${cost} chips for å bruga maskinen, og du har kje råd bro`)
        } else {
            //Remove 100 chips
            let emojiString = ''
            const newMoneyVal = Number(userMoney) - cost
            user.chips = newMoneyVal
            this.client.database.updateUser(user)
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
            this.client.database.updateUser(user)

            if (!hasSequence && amountOfCorrectNums.length < 1) msg.addFields({ name: 'Du tapte', value: `-${cost} chips` })

            this.messageHelper.replyToInteraction(interaction, msg)
        }
    }

    private findSequenceWinningAmount(s: string) {
        switch (s) {
            case '123':
                return 500
            case '1234':
                return 5000
            case '12345':
                return 50000
            case '123456':
                return 500000
            case '1337':
                return 5000
            case '8008':
                return 5000
            case '80085':
                return 50000
            default:
                return 500
        }
    }

    private findSlotMachineWinningAmount(numCorrect: number) {
        switch (numCorrect) {
            case 2:
                return 100
            case 3:
                return 500
            case 4:
                return 5000
            case 5:
                return 50000
            case 6:
                return 500000
            default:
                return 100
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
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
                ],
            },
        }
    }
}
