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
import { MessageHelper } from '../../helpers/messageHelper'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
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

    private async krig(interaction: ChatInputCommandInteraction<CacheType>) {
        const target = interaction.options.get('bruker')?.user
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('chips')?.value)

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
                CrimeCommands.krig(interaction, this.messageHelper, victimUser, amount)
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

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'krig',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.krig(rawInteraction)
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
