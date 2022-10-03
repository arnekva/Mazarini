import { CacheType, ChatInputCommandInteraction, Client, EmbedBuilder, Message, SelectMenuComponentOptionData, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { SelectMenuHandler } from '../General/selectMenuHandler'
import { ActionMenuHelper } from '../helpers/actionMenuHelpert'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { Roles } from '../utils/roles'
import { UserUtils } from '../utils/userUtils'

export class UserCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private getWarnings(message: Message, content: string, args: string[]) {
        const userNameToFind = args.join(' ')
        const userExists = UserUtils.findUserByUsername(userNameToFind, message)
        const user = DatabaseHelper.getUser(userExists?.id ?? message.author.id)
        const warningCounter = user.warningCounter
        if (userExists)
            this.messageHelper.sendMessage(
                message.channelId,
                `${userExists?.username} har ${warningCounter} ${Number(warningCounter) === 1 ? 'advarsel' : 'advarsler'}`
            )
        else
            this.messageHelper.sendMessage(
                message.channelId,
                `${message.author.username} har ${warningCounter} ${Number(warningCounter) === 1 ? 'advarsel' : 'advarsler'}`
            )
    }

    private async roleAssignment(interaction: ChatInputCommandInteraction<CacheType>) {
        const roles = Roles.allRoles

        const msg = new EmbedBuilder().setTitle('Rolle').setDescription(`Reager med emojiene nedenfor for å få tildelt roller`)

        roles.forEach((role) => {
            msg.addFields({ name: `${role.name}`, value: `${role.emoji}`, inline: true })
        })
        this.messageHelper.replyToInteraction(interaction, `Se meldingen under for roller`, true)
        const sentMessage = await this.messageHelper.sendFormattedMessage(interaction.channel as TextChannel, msg)
        roles.forEach((r) => sentMessage?.react(r.emoji))
        if (sentMessage)
            sentMessage?.createReactionCollector().on('collect', (reaction) => {
                const users = reaction.users.cache.filter((u) => u.id !== '802945796457758760')
                const roleId = roles.find((rEmoji) => rEmoji.emoji === reaction.emoji.name)
                if (roleId) {
                    const role = interaction.guild?.roles?.cache.find((r) => r.id === roleId.id)
                    users.forEach((u) => {
                        const userAsMember = interaction.guild?.members?.cache.find((m) => m.id === u.id)
                        if (role && userAsMember) {
                            userAsMember.roles.add(role)
                        }
                    })
                }
            })
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

        const menu = ActionMenuHelper.creatSelectMenu(SelectMenuHandler.userInfoId, 'Velg databaseinnlegg', options)
        const embed = EmbedUtils.createSimpleEmbed(`Se brukerinfo for ${interaction.user.username}`, 'Ingen data å vise')
        this.messageHelper.replyToInteraction(interaction, embed, false, false, menu)
    }

    public getAllCommands(): ICommandElement[] {
        return []
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'status',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.setStatus(interaction)
                },
                category: 'annet',
            },
            {
                commandName: 'brukerinfo',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.findUserInfo(interaction)
                },
                category: 'annet',
            },
            {
                commandName: 'role',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.roleAssignment(interaction)
                },
                category: 'annet',
            },
        ]
    }
}
