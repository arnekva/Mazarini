import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, Client, EmbedBuilder, Interaction } from 'discord.js'
import { GamblingCommands } from '../commands/gamblingCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MentionUtils } from '../utils/mentionUtils'
import { RandomUtils } from '../utils/randomUtils'
import { TextUtils } from '../utils/textUtils'
import { UserUtils } from '../utils/userUtils'

export class ButtonHandler {
    private client: Client
    private messageHelper: MessageHelper

    static USER_ROLE_ID = 'UserRoleId_'
    static KRIG_ID = 'KrigId_'
    static KRIG_REMATCH = 'KrigRematchId_'
    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
    }

    handleIncomingButtonInteraction(interaction: Interaction<CacheType>) {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith(ButtonHandler.USER_ROLE_ID)) {
                this.handleAssignmentOfRoles(interaction)
            } else if (interaction.customId.startsWith(ButtonHandler.KRIG_ID)) {
                this.handleKrig(interaction)
            } else if (interaction.customId.startsWith(ButtonHandler.KRIG_REMATCH)) {
                this.handleRematch(interaction)
            }

            return true
        }
        return false
    }

    private async handleRematch(interaction: ButtonInteraction<CacheType>) {
        const params = interaction.customId.replace(ButtonHandler.KRIG_REMATCH, '').split('&')
        const oldEngager = params[0]
        const oldTarget = params[1]
        const updatedTargetId = oldTarget === interaction.user.id ? oldEngager : oldTarget
        const amount = Number(params[2])
        console.log(oldEngager, oldTarget, updatedTargetId)
        if ([oldEngager, oldTarget].includes(interaction.user.id)) {
            const victimUser = UserUtils.findUserById(updatedTargetId, interaction)
            if (victimUser) {
                GamblingCommands.krig(interaction, this.messageHelper, victimUser, amount)
            }
            const row = new ActionRowBuilder<ButtonBuilder>()
            row.addComponents(
                new ButtonBuilder({
                    custom_id: `${ButtonHandler.KRIG_REMATCH}COMPLETED`,
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
            this.messageHelper.replyToInteraction(interaction, `Du kan bare starta ein omkamp for ein krig du deltok i sjøl`, true)
        }
    }

    private async handleKrig(interaction: ButtonInteraction<CacheType>) {
        const ids = interaction.customId.replace(ButtonHandler.KRIG_ID, '').split('&')
        const engagerId = ids[1]
        const eligibleTargetId = ids[0]
        const amountAsNum = Number(ids[2])
        /** Victim */
        const userAsMember = UserUtils.findMemberByUserID(interaction.user.id, interaction)
        /** Engager */
        const engagerUser = UserUtils.findUserById(engagerId, interaction)
        if (userAsMember.id === eligibleTargetId && interaction.message.components.length) {
            //We update the row with a new, disabled button, so that the user cannot enage the Krig more than once
            const row = new ActionRowBuilder<ButtonBuilder>()
            row.addComponents(
                new ButtonBuilder({
                    custom_id: `${ButtonHandler.KRIG_ID}COMPLETED`,
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
            const roll = RandomUtils.getRndInteger(0, 100)
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
            } else if (roll < 50) {
                engagerValue += amountAsNum
                victimValue -= amountAsNum
            } else if (roll > 50) {
                engagerValue -= amountAsNum
                victimValue += amountAsNum
            }

            const users = shouldAlwaysLose
                ? [{ username: interaction.user.username, balance: engagerValue, oldBalance: oldEngVal }]
                : [
                      { username: engagerUser.username, balance: engagerValue, oldBalance: oldEngVal },
                      { username: userAsMember.user.username, balance: victimValue, oldBalance: oldTarVal },
                  ]

            this.messageHelper.sendMessage(interaction.channelId, `${MentionUtils.mentionUser(engager.id)} ${MentionUtils.mentionUser(interaction.user.id)}`)
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
                        custom_id: `${ButtonHandler.KRIG_REMATCH}${oldEngager}&${oldTarget}&${amountAsNum < updatedMax ? amountAsNum : updatedMax}`,
                        style: ButtonStyle.Success,
                        label: `⚔️ Omkamp ⚔️`,
                        disabled: false,
                        type: 2,
                    })
                )
                await this.messageHelper.sendMessageWithComponents(interaction.channelId, [rematchRow])
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du kan kje starta denne krigen`, true)
        }
    }

    private handleAssignmentOfRoles(interaction: ButtonInteraction<CacheType>) {
        const roleId = interaction.customId.replace(ButtonHandler.USER_ROLE_ID, '')
        const role = interaction.guild?.roles?.cache.find((r) => r.id === roleId)
        if (roleId && role) {
            const userAsMember = UserUtils.findMemberByUserID(interaction.user.id, interaction)
            userAsMember.roles.add(role)
            this.messageHelper.replyToInteraction(interaction, `Du har nå fått tildelt rollen ${role.name}`, true)
        }
    }
}
