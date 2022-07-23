import { Client, EmbedBuilder, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { Admin } from '../admin/admin'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { DatabaseHelper, MazariniUser } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { CollectorUtils } from '../utils/collectorUtils'
import { Roles } from '../utils/roles'
import { UserUtils } from '../utils/userUtils'

export class UserCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private getWarnings(message: Message, content: string, args: string[]) {
        const userNameToFind = args.join(' ')
        const userExists = DatabaseHelper.findUserByUsername(userNameToFind, message)
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

    private async roleAssignment(message: Message, content: string, args: string[]) {
        const roles = Roles.allRoles

        const msg = new EmbedBuilder().setTitle('Rolle').setDescription(`Reager med emojiene nedenfor for å få tildelt roller`)

        roles.forEach((role) => {
            msg.addFields({ name: `${role.name}`, value: `${role.emoji}`, inline: true })
        })

        const sentMessage = await this.messageHelper.sendFormattedMessage(message.channel as TextChannel, msg)
        roles.forEach((r) => sentMessage?.react(r.emoji))
        if (sentMessage)
            sentMessage?.createReactionCollector().on('collect', (reaction) => {
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

    private async addQuote(message: Message, content: string, args: string[]) {
        const isUpperCase = (letter: string) => {
            return letter === letter.toUpperCase()
        }
        if (args.length > 1) {
            const quoteBy = args[0]
            if (!isUpperCase(quoteBy[0])) {
                message.reply(`Argument 1 (${args[0]}) må ha stor forbokstav. Dette er navnet på personen som sa quotet.`)
            } else {
                const quoteText = args.slice(1).join(' ')
                if (!!quoteBy && !!quoteText) {
                    this.messageHelper.reactWithThumbs(message, 'up')
                    const reply = await message.reply('Trenge 4 thumbs up for å godkjenne')
                    const collector = message.createReactionCollector()
                    collector.on('collect', (reaction) => {
                        if (CollectorUtils.shouldStopCollector(reaction, message)) {
                            if (message) message.edit(`${message.content} (STANSET MED TOMMEL NED)`)
                            collector.stop()
                        }

                        if (reaction.emoji.name === '👍' && reaction.users.cache.size > 3) {
                            DatabaseHelper.setQuoteObject(quoteBy, quoteText)
                            collector.stop()
                            if (reply) reply.delete()
                        }
                    })
                }
            }
        } else {
            const quotes = DatabaseHelper.getAllNonUserValueFromPrefix('quotes')
            let name = ArrayUtils.randomChoiceFromArray(Object.keys(quotes))
            //User may specify which person he wants a quote from, so we check if it exists
            if (!!args[0] && isUpperCase(args[0][0]) && quotes[args[0]]) name = args[0]

            const randomQuote = ArrayUtils.randomChoiceFromArray(quotes[name])
            this.messageHelper.sendMessage(message.channelId, `*" ${randomQuote} "*\n- ${name}`)
        }
    }

    private updateDisplayName(message: Message, messageContent: string, args: string[]) {
        const updateOtherUSer = UserUtils.findUserByUsername(args[0], message)
        let user: MazariniUser
        let name: string
        let canUpdate = true
        if (updateOtherUSer && !!args[1]) {
            if (Admin.isAuthorAdmin(UserUtils.findMemberByUsername(message.author.username, message))) user = DatabaseHelper.getUser(updateOtherUSer.id)
            else {
                message.reply('Kun administratorer kan endre displaynavnet til andre brukere')
                canUpdate = false
            }
            name = args.slice(1).join(' ')
        } else {
            user = DatabaseHelper.getUser(message.author.id)
            name = args.slice(0).join(' ')
        }
        if (canUpdate) {
            user.displayName = name ?? message.author.username
            DatabaseHelper.updateUser(user)
            this.messageHelper.reactWithThumbs(message, 'up')
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'quote',
                description: 'Legg til eller hent et tilfeldig quote',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.addQuote(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'warnings',
                description: 'Se antall advarsler du har',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.getWarnings(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'role',
                description: 'Trigger role assignment',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.roleAssignment(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
            {
                commandName: 'name',
                description: 'Endre displaynavnet ditt i databasen',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.updateDisplayName(rawMessage, messageContent, args)
                },
                category: 'annet',
            },
        ]
    }

    getAllInteractions(): IInteractionElement[] {
        return []
    }
}
