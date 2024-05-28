import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SelectMenuComponentOptionData,
    StringSelectMenuInteraction,
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

        const options: SelectMenuComponentOptionData[] = Object.keys(allUserTabs).map((key) => ({
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

            if (typeof userData === 'object') {
                userData = Object.entries(userData).map((entry, val) => {
                    return `\n${entry[0]} - ${entry[1]}`
                })
            }

            await selectMenu.update({
                embeds: [EmbedUtils.createSimpleEmbed(`Se brukerinfo for ${selectMenu.user.username}`, `Verdien for ${value} er ${userData}`)],
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

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
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
            },
        }
    }
}
