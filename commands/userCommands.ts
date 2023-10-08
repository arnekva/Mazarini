import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    SelectMenuComponentOptionData,
    StringSelectMenuInteraction
} from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { ActionMenuHelper } from '../helpers/actionMenuHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ChipsStats, RulettStats } from '../interfaces/database/databaseInterface'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { Roles } from '../utils/roles'
import { UserUtils } from '../utils/userUtils'

export class UserCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async roleAssignment(interaction: ChatInputCommandInteraction<CacheType>) {
        const roles = Roles.allRoles

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
        await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [row])
    }

    private setStatus(interaction: ChatInputCommandInteraction<CacheType>) {
        const isVis = interaction.options.getSubcommand() === 'vis'
        const isSet = interaction.options.getSubcommand() === 'sett'
        if (isSet) {
            const statusText = interaction.options.get('tekst')?.value as string
            const user = DatabaseHelper.getUser(interaction.user.id)
            user.status = statusText
            DatabaseHelper.updateUser(user)

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} har oppdatert statusen sin`)
                .setDescription(`${statusText}`)
                .setThumbnail(`${interaction.user.avatarURL()}`)
                .setFooter({ text: `${DateUtils.getCurrentTimeFormatted()}` })

            this.messageHelper.replyToInteraction(interaction, embed)
        } else if (isVis) {
            const val = DatabaseHelper.getAllUsers()
            const embed = new EmbedBuilder().setTitle('Statuser')
            Object.keys(val).forEach((key) => {
                const user = DatabaseHelper.getUser(key)
                const status = user?.status
                if (status && status !== 'undefined') {
                    const name = UserUtils.findUserById(key, interaction)?.username ?? user.displayName ?? 'Ukjent brukernavn'
                    embed.addFields({ name: name, value: status })
                }
            })
            if (!embed.data?.fields?.length) embed.addFields({ name: 'Helt tomt', value: 'Ingen har satt statusen sin i dag' })
            this.messageHelper.replyToInteraction(interaction, embed)
        }
    }

    private findUserInfo(interaction: ChatInputCommandInteraction<CacheType>) {
        const allUserTabs = DatabaseHelper.getUser(interaction.user.id)

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
            let userData = DatabaseHelper.getUser(selectMenu.user.id)[value]

            if (typeof userData === 'object') {
                userData = Object.entries(userData).map((entry, val) => {
                    return `\n${entry[0]} - ${entry[1]}`
                })
            }
            userData.toString()
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
                    {
                        commandName: 'brukerstats',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.findUserStats(rawInteraction)
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
