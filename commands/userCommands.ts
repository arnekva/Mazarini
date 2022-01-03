import { Message, MessageEmbed } from 'discord.js'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { Roles } from '../utils/roles'
import { ICommandElement } from './commands'

export class UserCommands {
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

    static async addQuote(message: Message, content: string, args: string[]) {
        const isUpperCase = (letter: string) => {
            return letter === letter.toUpperCase()
        }
        if (args.length > 1) {
            const quoteBy = args[0]
            if (!isUpperCase(quoteBy[0])) {
                message.reply(`Argument 1 (${args[0]}) må ha stor forbokstav. Dette er navnet på personen som sa quotet.`)
                return
            }
            const quoteText = args.slice(1).join(' ')
            if (!!quoteBy && !!quoteText) {
                message.react('👍')
                const reply = await message.reply('Trenge 2 thumbs up for å godkjenne')
                const collector = message.createReactionCollector()
                collector.on('collect', (reaction) => {
                    if (reaction.emoji.name === '👍' && reaction.users.cache.size > 2) {
                        DatabaseHelper.setQuoteObject(quoteBy, quoteText)
                        collector.stop()
                        if (reply) reply.delete()
                    }
                })
            }
        } else {
            const quotes = DatabaseHelper.getAllNonUserValueFromPrefix('quotes')
            let name = ArrayUtils.randomChoiceFromArray(Object.keys(quotes))
            //User may specify which person he wants a quote from, so we check if it exists
            if (!!args[0] && isUpperCase(args[0][0]) && quotes[args[0]]) name = args[0]

            const randomQuote = ArrayUtils.randomChoiceFromArray(quotes[name])
            MessageHelper.sendMessage(message, `*" ${randomQuote} "*\n- ${name}`)
        }
    }

    static readonly addQuoteCommand: ICommandElement = {
        commandName: 'quote',
        description: 'Legg til eller hent et tilfeldig quote',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            UserCommands.addQuote(rawMessage, messageContent, args)
        },
        category: 'annet',
    }
    static readonly seeWarningCounterCommand: ICommandElement = {
        commandName: 'warnings',
        description: 'Se antall advarsler du har',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            UserCommands.getWarnings(rawMessage, messageContent, args)
        },
        category: 'annet',
    }
    static readonly sendRoleAssignmentCommand: ICommandElement = {
        commandName: 'role',
        description: 'Trigger role assignment',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            UserCommands.roleAssignment(rawMessage, messageContent, args)
        },
        category: 'annet',
    }
}
