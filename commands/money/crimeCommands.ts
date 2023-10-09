import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder, User
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { IInteractionElement } from '../../general/commands'
import { DatabaseHelper } from '../../helpers/databaseHelper'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { MessageHelper } from '../../helpers/messageHelper'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { MazariniUser } from '../../interfaces/database/databaseInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { TextUtils } from '../../utils/textUtils'
import { UserUtils } from '../../utils/userUtils'

export interface IDailyPriceClaim {
    streak: number
    wasAddedToday: boolean
}
export class CrimeCommands extends AbstractCommands {
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

    private async krig(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, target: User, amount: number) {

        const userWallets = CrimeCommands.getUserWallets(interaction.user.id, target.id)
        const hasAmount = !!amount

        const largestPossibleValue = Math.min(userWallets.engagerChips, userWallets.victimChips)
        let amountAsNum = hasAmount ? Number(amount) : largestPossibleValue
        const notEnoughChips = CrimeCommands.checkBalance([{ userID: interaction.user.id }, { userID: target.id }], amountAsNum)

        if (notEnoughChips) {
            this.messageHelper.replyToInteraction(interaction, `En av dere har ikke råd til dette`, { ephemeral: true })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du har startet en krig mot ${target.username}`, { ephemeral: true })
            await this.messageHelper.sendMessage(
                interaction?.channelId,
                `${interaction.user.username} vil gå til krig med deg ${MentionUtils.mentionUser(target.id)} for ${TextUtils.formatMoney(
                    amountAsNum
                )} chips. Trykk på knappen for å godkjenne. Den som starter krigen ruller for 0-49.`
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
            const notEnoughChips = CrimeCommands.checkBalance([{ userID: engagerId }, { userID: eligibleTargetId }], amountAsNum)
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
                        value: `Har nå ${TextUtils.formatMoney(user.balance)} chips (hadde ${TextUtils.formatMoney(user.oldBalance)})`,
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
                this.krig(interaction, victimUser, amount)
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

    private async pickpocket(interaction: ChatInputCommandInteraction<CacheType>) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)
        const amountAsNum = Number(amount)

        const engager = DatabaseHelper.getUser(interaction.user.id)
        const victim = DatabaseHelper.getUser(target.id)
        
        if (await this.handleTheftEdgeCases(interaction,engager,victim,amountAsNum)) return

        if (this.theftAttemptIsSuccessful(amountAsNum)) {
            engager.chips += amountAsNum
            victim.chips -= amountAsNum
            victim.hasBeenRobbed = true
            DatabaseHelper.updateUser(engager)
            DatabaseHelper.updateUser(victim)
            const arneSuperior = await EmojiHelper.getEmoji('arnesuperior', interaction)
            this.messageHelper.replyToInteraction(interaction, `Hehe det va jo lett ${arneSuperior.id} ` +
                `\nGz med nye ${TextUtils.formatMoney(amountAsNum)} på konto - oppe i ${TextUtils.formatMoney(engager.chips)} nå`, {ephemeral:true})
        } else {
            engager.daysInJail = 4
            engager.dailyFreezeCounter = 0
            DatabaseHelper.updateUser(engager)
            const siren = await EmojiHelper.getEmoji('redbluesiren', interaction)
            let embed = EmbedUtils.createSimpleEmbed(`${siren.id}  Caught in 4K ${siren.id}`
                                                    ,`${MentionUtils.mentionUser(engager.id)} har blitt tatt i å prøva å stjela ${TextUtils.formatMoney(amountAsNum)} fra ${MentionUtils.mentionUser(victim.id)}` +
                                                     `\n:lock: Eg dømme deg te ${engager.daysInJail} dager i fengsel :lock:`)
            this.messageHelper.replyToInteraction(interaction, embed)
        }
        
    }

    //returns a bool indicating if the interaction has been handled or not
    private async handleTheftEdgeCases(
        interaction: ChatInputCommandInteraction<CacheType>, 
        engager: MazariniUser, victim: MazariniUser, amount: number
    ) {
        const victimIsEngager = engager.id === victim.id
        const isNegativeAmount = amount < 0
        const victimHasAmount = victim.chips >= amount
        const victimIsBotHoie = victim.id === MentionUtils.User_IDs.BOT_HOIE
        const kekw = await EmojiHelper.getEmoji('kekw', interaction)
        const amountOrBalance = Math.abs(amount) > engager.chips ? engager.chips : Math.abs(amount)

        if (victimIsBotHoie) {
            victim.chips += engager.chips
            engager.chips = 0
            DatabaseHelper.updateUser(victim)
            DatabaseHelper.updateUser(engager)
            this.messageHelper.replyToInteraction(interaction, `Du prøve å stjela fra meg?? Du mysta nettopp alle chipså dine for det`)
            return true
        } else if (victimIsEngager) {
            engager.chips -= amountOrBalance
            DatabaseHelper.updateUser(engager)
            this.messageHelper.replyToInteraction(interaction, `Du prøve å stjela fra deg sjøl? Greit det ${kekw.id}`)
            return true
        } else if (isNegativeAmount) {
            engager.chips -= amountOrBalance
            victim.chips += amountOrBalance
            DatabaseHelper.updateUser(engager)
            DatabaseHelper.updateUser(victim)
            this.messageHelper.replyToInteraction(interaction, `Stjela ${TextUtils.formatMoney(amount)}? Du konne bare vippsa, bro ${kekw.id} \nGz ${MentionUtils.mentionUser(victim.id)}`)
            return true
        } else if (!victimHasAmount) {
            this.messageHelper.replyToInteraction(interaction, `Du prøve å stjela merr enn an har`, {ephemeral:true})
            return true
        }
        return false
    }

    private theftAttemptIsSuccessful(amount: number) {

        // a suiteable 1/x function where the probability of success rapidly approaches a limit of 0
        const chanceOfSuccess = ((1)/(((amount/1000)/(2))+10.1))*1000 
        console.log('odds:', chanceOfSuccess);
        
        // need a roll with 3 decimals for proper accuracy given a high amount
        const roll = (RandomUtils.getRandomInteger(0,100000))/1000 
        console.log('roll:', roll);
        
        return roll < chanceOfSuccess
    }

    private async jailbreak(interaction: ChatInputCommandInteraction<CacheType>) {
        const prisoner = DatabaseHelper.getUser(interaction.user.id)
        const daysLeftInJail = prisoner?.daysInJail

        if (!daysLeftInJail || isNaN(daysLeftInJail) || daysLeftInJail == 0) {
            this.messageHelper.replyToInteraction(interaction, `Ka er det du prøve å bryta ud av?`, {ephemeral:true})
        } else if ((prisoner.attemptedJailbreaks ?? 0) >= 1) {
            this.messageHelper.replyToInteraction(interaction, `Du har bare ett rømningsforsøk per dag`, {ephemeral:true})
        } else {
            const prevAttempts = prisoner.attemptedJailbreaks
            prisoner.attemptedJailbreaks = (prevAttempts && !isNaN(prevAttempts)) ? prevAttempts + 1 : 1
            const number1 = RandomUtils.getRandomInteger(1, 6)
            const number2 = RandomUtils.getRandomInteger(1, 6)
            const number1Emoji = (await EmojiHelper.getEmoji(`dice_${number1}`, interaction)).id
            const number2Emoji = (await EmojiHelper.getEmoji(`dice_${number2}`, interaction)).id
            let message = EmbedUtils.createSimpleEmbed(`:lock: Jailbreak :lock:`
                ,`${MentionUtils.mentionUser(prisoner.id)} prøvde å rømma fra fengsel, men trilla ${number1Emoji} ${number2Emoji}` +
                `\nDu har fortsatt ${daysLeftInJail} dager igjen i fengsel`)
            if (number1 === number2) {
                prisoner.daysInJail = 0
                message = EmbedUtils.createSimpleEmbed(`:unlock: Jailbreak :unlock:`
                        ,`${MentionUtils.mentionUser(prisoner.id)} trilla to lige ${number1Emoji} ${number2Emoji} og har rømt fra fengsel!`)
            } 
            DatabaseHelper.updateUser(prisoner)
            this.messageHelper.replyToInteraction(interaction, message)
        }
    }

    private async printPrisoners(interaction: ChatInputCommandInteraction<CacheType>) {

        let formattedMsg = new EmbedBuilder().setTitle(':lock: Fengsel :lock:')
        const users = DatabaseHelper.getAllUsers()
        let someoneInJail = false
        Object.keys(users).forEach((userID: string) => {
            const user = DatabaseHelper.getUser(userID)
            const daysLeftInJail = user?.daysInJail

            if (daysLeftInJail && !isNaN(daysLeftInJail) && daysLeftInJail > 0) {
                someoneInJail = true
                formattedMsg.addFields({
                    name: `${UserUtils.findUserById(user.id, interaction).username}`,
                    value: `${daysLeftInJail} dager igjen `,
                    inline: false,
                })
            }
        })
        this.messageHelper.replyToInteraction(interaction, someoneInJail ? formattedMsg : 'Det er ingen i fengsel atm')
    }

    
    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'krig',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            const target = rawInteraction.options.get('bruker')?.user
                            const amount = SlashCommandHelper.getCleanNumberValue(rawInteraction.options.get('chips')?.value)
                            this.krig(rawInteraction, target, amount)
                        },
                    },
                    {
                        commandName: 'pickpocket',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.pickpocket(rawInteraction)
                        },
                    },
                    {
                        commandName: 'jailbreak',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.jailbreak(rawInteraction)
                        },
                    },
                    {
                        commandName: 'jail',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.printPrisoners(rawInteraction)
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

export const illegalCommandsWhileInJail = [
    'krig',
    'pickpocket',
    'KRIG',
    'KRIG_REMATCH',
    'vipps',
    'daily',
    'gamble',
    'roll',
    'rulett',
    'spin',
]