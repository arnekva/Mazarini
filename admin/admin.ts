import { Client, GuildMember, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { DatabaseHelper, dbPrefix } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { splitUsername } from '../utils/textUtils'
import { UserUtils } from '../utils/userUtils'

export class Admin extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private setSpecificValue(message: Message, messageContent: string, args: string[]) {
        //setValueObject
        const prefix = args[0] as dbPrefix
        let username = splitUsername(args[1])
        let oldValue = DatabaseHelper.getValue(prefix, username, message, true)
        const user = UserUtils.findUserByUsername(username, message)
        if (!user || !oldValue) {
            const incorrectPart = user ? `Prefixen '${prefix}' er feil` : `Brukeren '${username}' eksisterer ikke`
            this.messageHelper.sendMessageToActionLogWithCustomMessage(
                message,
                `${message.author.username} brukte feil syntax i setvalue.` + incorrectPart,
                `${incorrectPart}. Husk at syntaxen er <prefix> <brukernavn> <verdi>`,
                true
            )
            return
        }
        const val = args[2]
        DatabaseHelper.setValue(prefix, username, val)
        this.messageHelper.reactWithRandomEmoji(message)
        if (args[3] !== 'silent')
            this.messageHelper.sendMessageToActionLog(
                message.channel as TextChannel,
                `Setvalue ble brukt av ${message.author.username} i kanalen ${message.channel}. Prefix: ${prefix}, nøkkel: ${username}, verdi: ${val}. Gammel verdi for objektet var: ${oldValue} `
            )
    }
    private setSpinValue(message: Message, messageContent: string) {
        const content = messageContent.split(' ')
        const key = content[0] as dbPrefix
        let value = ''
        const newCont = content.slice(1)
        newCont.forEach((el) => (value += el.trim()))
        DatabaseHelper.setValue('ATHspin', key, value)
    }
    private deleteSpecificValue(message: Message, messageContent: string) {
        const cmdSplit = messageContent.split(' ')
        const prefix = cmdSplit[0]
        const key = cmdSplit[1]
        const keyToDelete = prefix + '-' + key
    }

    private async getSpecificValue(message: Message, messageContent: string) {
        const content = messageContent.split(' ')
        const prefix = content[0] as dbPrefix
        const key = content[1]
        const val = await DatabaseHelper.getValue(prefix, key, message)
    }

    private async replyToMsgAsBot(rawMessage: Message, content: string) {
        const allChannels = [...rawMessage.client.channels.cache.values()].filter((channel) => channel instanceof TextChannel) as TextChannel[]

        const id = content.substr(0, content.indexOf(' '))
        const replyString = content.substr(content.indexOf(' ') + 1)
        allChannels.forEach((channel: TextChannel) => {
            if (channel) {
                channel.messages
                    .fetch(id)
                    .then(async (message) => {
                        if (message.guild) {
                            message.reply(replyString)
                        }
                    })
                    .catch((error) => {
                        //Catch thrown error
                    })
            }
        })
    }
    private async reactToMsgAsBot(rawMessage: Message, content: string) {
        const allChannels = [...rawMessage.client.channels.cache.values()].filter((channel) => channel instanceof TextChannel) as TextChannel[]

        const c = content.split(' ')
        const id = c[0].trim()
        const emojiString = c[1]
        if (!!id && !!emojiString) {
            allChannels.forEach((channel: TextChannel) => {
                if (channel) {
                    channel.messages
                        .fetch(id)
                        .then((message) => {
                            if (message.guild) {
                                const reactionEmoji = message.client.emojis.cache.find((emoji) => emoji.name == emojiString)
                                if (reactionEmoji) {
                                    message.react(reactionEmoji)
                                } else {
                                    // this.messageHelper.sendDM(message.author, 'Fant ikke emojien')
                                }
                            }
                        })
                        .catch((error) => {
                            //Catch thrown error
                        })
                }
            })
        } else {
            this.messageHelper.replyFormattingError(rawMessage, '<message id> <emoji navn>')
        }
    }
    private async sendMessageAsBotToSpecificChannel(message: Message) {
        const content = message.content.replace('!mz send ', '')

        const id = content.substr(0, content.indexOf(' ')).trim()
        const replyString = content.substr(content.indexOf(' ') + 1)
        const channel = [...message.client.channels.cache.values()].find((channel) => channel.id === id) as TextChannel
        if (channel) channel.send(replyString)
    }

    private async warnUser(message: Message, messageContent: string, args: string[]) {
        const username = splitUsername(args[0])

        const user = DatabaseHelper.findUserByUsername(username, message)

        const replyString = messageContent.replace(username, '').replace('""', '').trim()
        if (user) {
            if (user.username == message.author.username) {
                message.reply('Du kan kje warna deg sjøl, bro')
                return
            }
            const userWarnings = DatabaseHelper.getValue('warningCounter', user.username, message)

            if (!isNaN(userWarnings)) {
                let newVal = parseInt(userWarnings)
                newVal += 1
                DatabaseHelper.setValue('warningCounter', user.username, newVal.toString())
                this.messageHelper.sendMessage(message.channelId, user.username + ', du har fått en advarsel. Du har nå ' + newVal + ' advarsler.')
                //Send msg to action-log
                this.messageHelper.sendMessageToActionLog(
                    message.channel as TextChannel,
                    message.author.username +
                        ' ga en advarsel til ' +
                        user.username +
                        ' på grunn av: ' +
                        replyString +
                        '. ' +
                        user.username +
                        ' har nå ' +
                        newVal +
                        ' advarsler'
                )
            } else {
                this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, 'Verdien for warningcounter er NaN: <' + userWarnings + '>.')
            }
        } else {
            this.messageHelper.sendMessage(
                message.channelId,
                'Feil: Du har enten skrevet feil bruker navn eller ikke inkludert en melding. *Hvis brukeren har mellomrom i navnet, bruk under_strek*'
            )
        }
    }

    private cancelUser(message: Message, messageContent: string, args: string[]) {
        message.reply('Det går dessverre ikkje an å cancella folk lenger :(')
        return
    }

    private deleteXLastMessagesByUserInChannel(message: Message, messageContent: string, args: string[]) {
        const userToDelete = splitUsername(args[0])
        const user = DatabaseHelper.findUserByUsername(userToDelete, message)

        const reason = userToDelete ? args.slice(3).join(' ') : args.slice(2).join(' ')
        if (!user) {
            message.reply('du må oppgi et gyldig brukernavn. <brukernavn> <antall meldinger>')
            return
        }
        const currentChannel = message.channel
        const maxDelete = Number(args[1]) ?? 1
        let deleteCounter = 0
        currentChannel.messages
            .fetch({ limit: 100 })
            .then((el) => {
                el.forEach((message) => {
                    if (message && message.author.username == user.username && deleteCounter < maxDelete) {
                        try {
                            message.delete()
                            deleteCounter++
                        } catch (error) {
                            this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                            return
                        }
                    }
                })
                this.messageHelper.sendMessageToActionLog(
                    message.channel as TextChannel,
                    `${message.author.username} slettet ${maxDelete} meldinger fra ${user.username} i channel ${message.channel} på grunn av: "${
                        reason.length > 0 ? reason : 'ingen grunn oppgitt'
                    }"`
                )

                message.delete()
            })
            .catch((error: any) => {
                this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            })
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'debug',
                description: 'For testing. Resultat vil variere. ',
                hideFromListing: true,
                command: async (rawMessage: Message, messageContent: string) => {
                    rawMessage.reply('Slettet alle coins og chips for bruker <' + rawMessage.author.username + '>.')
                    setTimeout(() => {
                        rawMessage.reply('Bare kødda, ingenting har skjedd.')
                    }, 7000)
                },
                category: 'admin',
            },
            {
                commandName: 'deletekeys',
                description: 'Slett alle databasenøkler og tilhørende verdier for den gitte prefixen (Virker ikke)',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    const prefix = rawMessage.content.replace('!mz deletekeys ', '') as dbPrefix
                    DatabaseHelper.deleteSpecificPrefixValues(prefix)
                },
                category: 'admin',
            },
            {
                commandName: 'deletemessages',
                description: 'Slett X siste meldinger fra en bruker i en channel',
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.deleteXLastMessagesByUserInChannel(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
            {
                commandName: 'cancel',
                description: 'Cancel en bruker',
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.cancelUser(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
            {
                commandName: 'deletekey',
                description: 'Slett en gitt nøkkel med oppgitt prefix. <prefix> <nøkkel> (Virker ikke)',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.deleteSpecificValue(rawMessage, messageContent)
                },
                category: 'admin',
            },
            {
                commandName: 'send',
                description: 'send en melding som boten. <channel id> <melding>',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.sendMessageAsBotToSpecificChannel(rawMessage)
                },
                category: 'admin',
            },
            {
                commandName: 'react',
                description: 'reager på en melding som botten. <message id> <emoji>',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.reactToMsgAsBot(rawMessage, messageContent)
                },
                category: 'admin',
            },
            {
                commandName: 'reply',
                description: 'reager på en melding som botten.',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.replyToMsgAsBot(rawMessage, messageContent)
                },
                category: 'admin',
            },
            {
                commandName: 'setvalue',
                description: 'Sett en spesifikk verdi i databasen. <prefix> <nøkkel> <verdi>',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.setSpecificValue(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
            {
                commandName: 'setspin',
                description: 'Sett en spin score for en bruker. <nøkkel> <verdi>',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.setSpinValue(rawMessage, messageContent)
                },
                category: 'admin',
            },
            {
                commandName: 'getvalue',
                description: 'Hent en spesifikk verdi i databasen. <prefix> <nøkkel> ',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.getSpecificValue(rawMessage, messageContent)
                },
                category: 'admin',
            },
            {
                commandName: 'warn',
                description: 'Gi en advarsel til en bruker. <nøkkel> <grunn> ',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.warnUser(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
        ]
    }

    static isAuthorAdmin(member: GuildMember | null) {
        if (member) return member.roles.cache.has('821709203470680117')
        return false
    }
    static isAuthorSuperAdmin(member: GuildMember | null) {
        // TODO: Role instead of user id
        if (member) return member.id == '245607554254766081' || member.id == '397429060898390016' || member.id == '239154365443604480'
        return false
    }
}
