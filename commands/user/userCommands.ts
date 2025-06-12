import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    SelectMenuComponentOptionData,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { ActionMenuHelper } from '../../helpers/actionMenuHelper'
import { DateUtils } from '../../utils/dateUtils'
import { EmbedUtils } from '../../utils/embedUtils'

import { IInteractionElement } from '../../interfaces/interactionInterface'
import { UserUtils } from '../../utils/userUtils'

export class UserCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async roleAssignment(interaction: ChatInputCommandInteraction<CacheType>) {
        const roles = [
            { name: 'Battlefield', id: '886600170328952882', emoji: '🖐️' },
            { name: 'Warzone', id: '735253573025267883', emoji: '🙌' },
            { name: 'CoD Multiplayer', id: '1035476337135198238', emoji: '🤙' },
            { name: 'Rocket League', id: '928708534047244400', emoji: '👋' },
        ]

        const row = new ActionRowBuilder<ButtonBuilder>()

        roles.forEach((role) => {
            row.addComponents(
                new ButtonBuilder({
                    custom_id: `USER_ROLE;${role.id}`,
                    style: ButtonStyle.Primary,
                    label: `${role.name}`,
                    disabled: false,
                    type: 2,
                })
            )
        })
        this.messageHelper.replyToInteraction(interaction, `Trykk på knappene under for å få rollene`)
        await this.messageHelper.sendMessage(interaction?.channelId, { components: [row] })
    }

    private async setStatus(interaction: ChatInputCommandInteraction<CacheType>) {
        const isVis = interaction.options.getSubcommand() === 'vis'
        const isSet = interaction.options.getSubcommand() === 'sett'
        if (isSet) {
            const statusText = interaction.options.get('tekst')?.value as string
            const user = await this.client.database.getUser(interaction.user.id)
            user.status = statusText
            this.client.database.updateUser(user)

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} har oppdatert statusen sin`)
                .setDescription(`${statusText}`)
                .setThumbnail(`${interaction.user.avatarURL()}`)
                .setFooter({ text: `${DateUtils.getCurrentDateTimeFormatted()}` })

            this.messageHelper.replyToInteraction(interaction, embed)
        } else if (isVis) {
            const users = await this.client.database.getAllUsers()
            const embed = new EmbedBuilder().setTitle('Statuser')
            users.forEach((user) => {
                const status = user?.status
                if (status && status !== 'undefined') {
                    const name = UserUtils.findUserById(user.id, interaction)?.username ?? 'Ukjent brukernavn'
                    embed.addFields({ name: name, value: status })
                }
            })
            if (!embed.data?.fields?.length) embed.addFields({ name: 'Helt tomt', value: 'Ingen har satt statusen sin i dag' })
            this.messageHelper.replyToInteraction(interaction, embed)
        }
    }

    private async findUserInfo(interaction: ChatInputCommandInteraction<CacheType>) {
        const allUserTabs = await this.client.database.getUser(interaction.user.id)

        const options: SelectMenuComponentOptionData[] = Object.keys(allUserTabs)
            .slice(0, 25)
            .map((key) => ({
                label: key,
                value: key,
                description: `${typeof allUserTabs[key]}`,
            }))

        const menu = ActionMenuHelper.createSelectMenu(`USER_INFO_MENU;${interaction.user.id}`, 'Velg databaseinnlegg', options)
        const embed = EmbedUtils.createSimpleEmbed(`Se brukerinfo for ${interaction.user.username}`, 'Ingen data å vise')
        this.messageHelper.replyToInteraction(interaction, embed, undefined, [menu])
    }

    private async handleUserInfoViewingMenu(selectMenu: StringSelectMenuInteraction<CacheType>) {
        if (selectMenu.customId.split(';')[1] === selectMenu.user.id) {
            const value = selectMenu.values[0]
            const user = await this.client.database.getUser(selectMenu.user.id)
            let userData = user[value]

            // if (typeof userData === 'object') {
            //     userData = Object.entries(userData).map((entry, val) => {
            //         return `\n${entry[0]} - ${entry[1]}`
            //     })
            // }

            await selectMenu.update({
                embeds: [
                    EmbedUtils.createSimpleEmbed(
                        `Se brukerinfo for ${selectMenu.user.username}`,
                        `Verdien for ${value} er ${JSON.stringify(userData, null, 2)}`
                    ),
                ],
            })
        } else {
            return !!this.messageHelper.replyToInteraction(selectMenu, `Du kan bare sjekka dine egne ting. Bruke '/brukerinfo' for å se dine egne verdier`, {
                ephemeral: true,
            })
        }
    }

    private handleAssignmentOfRoles(interaction: ButtonInteraction<CacheType>) {
        const roleId = interaction.customId.split(';')[1]
        const role = interaction.guild?.roles?.cache.find((r) => r.id === roleId)

        if (roleId && role) {
            const userAsMember = UserUtils.findMemberByUserID(interaction.user.id, interaction)
            userAsMember.roles.add(role)
            this.messageHelper.replyToInteraction(interaction, `Du har nå fått tildelt rollen ${role.name}`, { ephemeral: true })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Det oppstod en feil med rollene. Prøv igjen senere`, { ephemeral: true })
        }
    }

    private updateUserSettings(interaction: ChatInputCommandInteraction<CacheType>) {
        this.buildSettingsModal(interaction)

        // this.messageHelper.replyToInteraction(interaction, embed)
    }

    private async buildSettingsModal(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            const modal = new ModalBuilder().setCustomId(UserCommands.userSettingsId).setTitle('Dine Innstillinger')
            const user = await this.database.getUser(interaction.user.id)
            const safeGamble = new TextInputBuilder()
                .setCustomId('safeGambleValue')
                // The label is the prompt the user sees for this input
                .setLabel('Sett høyeste verdi for auto-gamble. 0 slår av')
                .setPlaceholder(`0`)
                .setValue(`${user.userSettings?.safeGambleValue ?? 0}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)

            const tradeDups = new TextInputBuilder()
                .setCustomId('tradeDups')
                // The label is the prompt the user sees for this input
                .setLabel('Ønsker du å kun se duplikater når du trader?')
                .setPlaceholder(`Ja/Nei`)
                .setValue(`${user.userSettings?.onlyShowDupesOnTrade ? 'Ja' : 'Nei'}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)
            const molChest = new TextInputBuilder()
                .setCustomId('molChest')
                // The label is the prompt the user sees for this input
                .setLabel('Ønsker du å eksluderes fra MoL chest?')
                .setPlaceholder(`Ja/Nei`)
                .setValue(`${user.userSettings?.excludeFromMoL ? 'Ja' : 'Nei'}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)
            const reactionTimer = new TextInputBuilder()
                .setCustomId('reactionTimer')
                // The label is the prompt the user sees for this input
                .setLabel('Tid før reaction på loot (0 - 40 sek)')
                .setPlaceholder(`Ja/Nei`)
                .setValue(`${user.userSettings?.lootReactionTimer ?? 30}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)

            //FIXME: Typing doesn't work here for some reason
            const firstActionRow: any = new ActionRowBuilder().addComponents(safeGamble)
            const secondActionRow = new ActionRowBuilder().addComponents(tradeDups)
            const thirdActionRow = new ActionRowBuilder().addComponents(molChest)
            const fourthActionRow = new ActionRowBuilder().addComponents(reactionTimer)
            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow)
            await interaction.showModal(modal)
        }
    }

    private async handleUserSettingsModalDialog(modalInteraction: ModalSubmitInteraction) {
        const safeGamble = modalInteraction.fields.getTextInputValue('safeGambleValue')
        const tradeDups = modalInteraction.fields.getTextInputValue('tradeDups')
        const molChest = modalInteraction.fields.getTextInputValue('molChest')
        const reactionTimer = modalInteraction.fields.getTextInputValue('reactionTimer')
        const user = await this.database.getUser(modalInteraction.user.id)
        let infoString = '\n'
        if (safeGamble) {
            const num = Number(safeGamble)
            if (isNaN(num) || num < 0) {
                infoString += 'Safe Gamble: Du må skrive et tall større enn eller lik 0\n'
                return
            } else {
                if (user.userSettings) user.userSettings.safeGambleValue = num
                else {
                    user.userSettings = { safeGambleValue: num }
                }
            }
        }
        if (tradeDups) {
            const onlyShowDups = tradeDups.trim().toLowerCase() === 'ja'
            if (user.userSettings) user.userSettings.onlyShowDupesOnTrade = onlyShowDups
            else {
                user.userSettings = { onlyShowDupesOnTrade: onlyShowDups }
            }
        }
        if (molChest) {
            const excludeFromMoL = molChest.trim().toLowerCase() === 'ja'
            if (user.userSettings) user.userSettings.excludeFromMoL = excludeFromMoL
            else {
                user.userSettings = { excludeFromMoL: excludeFromMoL }
            }
        }
        if (reactionTimer) {
            const num = Number(reactionTimer)
            if (isNaN(num) || num < 0 || num > 40) {
                infoString += 'Reaction Timer: Du må skrive et tall mellom 0 og 40\n'
            } else {
                if (user.userSettings) user.userSettings.lootReactionTimer = num
                else {
                    user.userSettings = { lootReactionTimer: num }
                }
                if (num === 0) infoString += 'Reaction Timer: Du har satt timeren din til 0 - dette vil gi default verdi. Laveste tid er 1 sek.\n'
            }
        }

        this.database.updateUser(user)
        this.messageHelper.replyToInteraction(modalInteraction, 'Dine innstillinger er nå oppdatert' + infoString, { ephemeral: true })
    }

    static userSettingsId = 'userSettingsModal'

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'brukerinnstillinger',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.updateUserSettings(interaction)
                        },
                    },
                    {
                        commandName: 'status',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.setStatus(interaction)
                        },
                    },
                    {
                        commandName: 'brukerinfo',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.findUserInfo(interaction)
                        },
                    },
                    {
                        commandName: 'role',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.roleAssignment(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'USER_ROLE',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.handleAssignmentOfRoles(rawInteraction)
                        },
                    },
                ],
                selectMenuInteractionCommands: [
                    {
                        commandName: 'USER_INFO_MENU',
                        command: (rawInteraction: StringSelectMenuInteraction<CacheType>) => {
                            this.handleUserInfoViewingMenu(rawInteraction)
                        },
                    },
                ],
                modalInteractionCommands: [
                    {
                        commandName: UserCommands.userSettingsId,
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.handleUserSettingsModalDialog(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
