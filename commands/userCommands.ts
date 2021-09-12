import { Message, MessageEmbed } from 'discord.js'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { Roles } from '../utils/roles'
import { ICommandElement } from './commands'

export class User {
    static getWarnings(message: Message, content: string, args: string[]) {
        const userNameToFind = args.join(' ')
        const userExists = DatabaseHelper.findUserByUsername(userNameToFind, message)
        const warningCounter = DatabaseHelper.getValue('warningCounter', userExists?.username ?? message.author.username, message)
        if (userExists)
            MessageHelper.sendMessage(message, `${userExists?.username} har ${warningCounter} ${Number(warningCounter) === 1 ? 'advarsel' : 'advarsler'}`)
        else MessageHelper.sendMessage(message, `${message.author.username} har ${warningCounter} ${Number(warningCounter) === 1 ? 'advarsel' : 'advarsler'}`)
    }

    static async roleAssignment(message: Message, content: string, args: string[]) {
        const roles = Roles.allRoles

        const msg = new MessageEmbed().setTitle('Rolle').setDescription(`Reager med emojiene nedenfor for å få tildelt roller`)

        roles.forEach((role) => {
            msg.addField(`${role.name}`, `${role.emoji}`, true)
        })

        const sentMessage = await MessageHelper.sendFormattedMessage(message, msg)
        roles.forEach((r) => sentMessage.react(r.emoji))
        sentMessage.createReactionCollector().on('collect', (reaction) => {
            const users = reaction.users.cache.filter((u) => u.id !== '802945796457758760')
            const roleId = roles.find((rEmoji) => rEmoji.emoji === reaction.emoji.name)
            if (roleId) {
                const role = message.guild?.roles?.cache.find((r) => r.id === roleId.id)
                users.forEach((u) => {
                    const userAsMember = message.guild?.members?.cache.find((m) => m.id === u.id)
                    if (role && userAsMember) {
                        userAsMember.roles.add(role)
                    }
                })
            }
        })
    }

    static readonly seeWarningCounterCommand: ICommandElement = {
        commandName: 'warnings',
        description: 'Se antall advarsler du har',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            User.getWarnings(rawMessage, messageContent, args)
        },
        category: 'annet',
    }
    static readonly sendRoleAssignmentCommand: ICommandElement = {
        commandName: 'role',
        description: 'Trigger role assignment',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            User.roleAssignment(rawMessage, messageContent, args)
        },
        category: 'annet',
    }
}
