import { Channel, GuildMember, Message, TextChannel } from 'discord.js'
import { botLocked, lockedThread, lockedUser, numMessages, startTime } from '..'
import { ICommandElement } from '../commands/commands'
import { DateCommands } from '../commands/dateCommands'
import { Spinner } from '../commands/spinner'
import { globalArrays } from '../globals'
import { DatabaseHelper, dbPrefix } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils } from '../utils/dateUtils'
import { getUsernameInQuotationMarks, isInQuotation } from '../utils/textUtils'

export class Admin {
    static readonly command: ICommandElement = {
        commandName: 'debug',
        description: 'For testing. Resultat vil variere. ',
        hideFromListing: true,
        isAdmin: true,
        isSuperAdmin: true,
        command: async (rawMessage: Message, messageContent: string) => {
            const las_vegas = rawMessage.client.channels.cache.get('808992127249678386') as TextChannel
            if (!las_vegas) {
                console.log('Fant ikke last_vegas i resetSpinJob')
                return
            }
            const spinnerMention = '<@&823504322213838888>'
            const message = await las_vegas.send('DEBUG TEST' + ', ukens spin har blitt nullstilt. Her er ukens score:\n')
            const listing = await Spinner.listScores(message, true)
            if (!listing) {
                if (las_vegas) las_vegas.send('Hvis denne meldingen kommer har ingen spunnet denne uken, eller så har Arne failet igjen')
                return
            } else {
                console.log('no crash')
            }
            Spinner.updateATH()
            DatabaseHelper.deleteSpecificPrefixValues('spin')

            // const spinnerRole = rawMessage.client.guild.roles.fetch('823504322213838888')
        },
        category: 'admin',
    }
    static setSpecificValue(message: Message, messageContent: string, args: string[]) {
        //setValueObject
        const prefix = args[0] as dbPrefix
        let username = getUsernameInQuotationMarks(messageContent) ?? args[1]
        const val = getUsernameInQuotationMarks(args[1]) ? args.slice(3).join(' ') : args.slice(2).join(' ')
        const content = messageContent.split(' ')

        username = username.replace('"', '').replace('"', '')
        DatabaseHelper.setValue(prefix, username, val)
        message.react(ArrayUtils.randomChoiceFromArray(globalArrays.emojiesList))
    }
    static setSpinValue(message: Message, messageContent: string) {
        const content = messageContent.split(' ')
        const key = content[0] as dbPrefix
        let value = ''
        const newCont = content.slice(1)
        newCont.forEach((el) => (value += el.trim()))
        DatabaseHelper.setValue('ATHspin', key, value)
    }
    static deleteSpecificValue(message: Message, messageContent: string) {
        const cmdSplit = messageContent.split(' ')
        const prefix = cmdSplit[0]
        const key = cmdSplit[1]
        const keyToDelete = prefix + '-' + key
        //TODO:
        // DatabaseHelper.deleteValue(keyToDelete, () => {
        // 	MessageHelper.sendMessage(message.channel, "Slettet nøkkel <" + keyToDelete + ">.")

        // })
    }

    static async getSpecificValue(message: Message, messageContent: string) {
        const content = messageContent.split(' ')
        const prefix = content[0] as dbPrefix
        const key = content[1]
        const val = await DatabaseHelper.getValue(prefix, key, message)
    }

    static getStats(message: Message, messageContent: string) {
        const start = startTime
        const timeSince = DateUtils.getTimeSince(start)
        if (timeSince) {
            let text = DateCommands.formatCountdownText(timeSince, 'siden sist oppstart')
            text += `\nAntall meldinger siden sist oppstart: ${numMessages}`
            text += `\nLåste kanaler: ${lockedThread.length > 0 ? lockedThread.toString() : 'Ingen'}`
            text += `\nLåste brukere: ${lockedUser.length > 0 ? lockedUser.toString() : 'Ingen'}`
            MessageHelper.sendMessage(message, text)
        } else MessageHelper.sendMessage(message, 'Ingen statistikk å vise')
    }

    static async replyToMsgAsBot(rawMessage: Message, content: string) {
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
    static async reactToMsgAsBot(rawMessage: Message, content: string) {
        /*
            For å sleppe å måtte sende med channel id for meldingen (kun id på selve meld) så må man loope gjennom alle channels på leting. 
        */
        //Filter out non-text channel and cast as TextChannel
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
                                    MessageHelper.sendDM(message.author, 'Fant ikke emojien', message)
                                }
                            }
                        })
                        .catch((error) => {
                            //Catch thrown error
                        })
                }
            })
        } else {
            MessageHelper.replyFormattingError(rawMessage, '<message id> <emoji navn>')
        }
    }
    static async sendMessageAsBotToSpecificChannel(message: Message) {
        const content = message.content.replace('!mz send ', '')

        const id = content.substr(0, content.indexOf(' ')).trim()
        const replyString = content.substr(content.indexOf(' ') + 1)
        const channel = [...message.client.channels.cache.values()].find((channel) => channel.id === id) as TextChannel
        if (channel) channel.send(replyString)
    }

    static async warnUser(message: Message, messageContent: string) {
        let username = messageContent.substr(0, messageContent.indexOf(' '))
        if (messageContent.includes('"')) {
            username = isInQuotation(messageContent)
        }
        // const username = messageContent.substr(0, messageContent.indexOf(" "));

        const user = DatabaseHelper.findUserByUsername(username, message) // message.client.users.cache.find(user => user.username == username);
        // const id = c[0].trim();

        const replyString = messageContent.replace(username, '').replace('""', '').trim() //substr(messageContent.indexOf(username) + username.length + 1);
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
                MessageHelper.sendMessage(message, user.username + ', du har fått en advarsel. Du har nå ' + newVal + ' advarsler.')
                //Send msg to action-log
                MessageHelper.sendMessageToActionLog(
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
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, 'Verdien for warningcounter er NaN: <' + userWarnings + '>.')
            }
        } else {
            MessageHelper.sendMessage(
                message,
                'Feil: Du har enten skrevet feil bruker navn eller ikke inkludert en melding. *Hvis brukeren har mellomrom i navnet, bruk "hermetegn"*'
            )
        }
    }

    static deleteXLastMessagesByUserInChannel(message: Message, messageContent: string, args: string[]) {
        const userToDeleteBool = getUsernameInQuotationMarks(messageContent)
        const userToDelete = userToDeleteBool ?? args[0]

        const user = DatabaseHelper.findUserByUsername(userToDelete, message)

        const reason = userToDelete ? args.slice(3).join(' ') : args.slice(2).join(' ')
        if (!user) {
            message.reply('du må oppgi et gyldig brukernavn. <brukernavn> <antall meldinger>')
            return
        }
        const currentChannel = message.channel
        const maxDelete = userToDeleteBool ? Number(args[2]) ?? 1 : Number(args[1]) ?? 1
        let deleteCounter = 0
        currentChannel.messages
            .fetch({ limit: 100 })
            .then((el) => {
                el.forEach((message) => {
                    if (message && message.author.username == user.username && deleteCounter < maxDelete) {
                        message.delete()
                        deleteCounter++
                    }
                })
                MessageHelper.sendMessageToActionLog(
                    message.channel as TextChannel,
                    `${message.author.username} slettet ${maxDelete} meldinger fra ${user.username} i channel ${message.channel} på grunn av: "${
                        reason.length > 0 ? reason : 'ingen grunn oppgitt'
                    }"`
                )
                // if (user.username !== message.author.username)
                //     message.delete();
                message.delete()
            })
            .catch((error: any) => {
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            })
    }
    //TODO:
    static changeUserNameInDataBase(message: Message, messageContent: string, args: string[]) {
        const oldUsername = args[0]
        const newUsername = args[1]
    }

    static logInncorectCommandUsage(message: Message, messageContent: string, args: string[]) {
        const command = message.content.split(' ')[1]
        const numberOfFails = DatabaseHelper.getNonUserValue('incorrectCommand', command)
        let newFailNum = 1
        if (numberOfFails && Number(numberOfFails)) newFailNum = Number(numberOfFails) + 1
        MessageHelper.sendMessageToActionLog(message.channel as TextChannel, `${command} ble forsøkt brukt, men finnes ikke (${newFailNum})`)
        DatabaseHelper.setNonUserValue('incorrectCommand', command, newFailNum.toString())
    }

    static readonly deleteValFromPrefix: ICommandElement = {
        commandName: 'deletekeys',
        description: 'Slett alle databasenøkler og tilhørende verdier for den gitte prefixen (Virker ikke)',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            const prefix = rawMessage.content.replace('!mz deletekeys ', '') as dbPrefix
            DatabaseHelper.deleteSpecificPrefixValues(prefix)
        },
        category: 'admin',
    }
    static readonly deleteMessages: ICommandElement = {
        commandName: 'deletemessages',
        description: 'Slett X siste meldinger fra en bruker i en channel',
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            Admin.deleteXLastMessagesByUserInChannel(rawMessage, messageContent, args)
        },
        category: 'admin',
    }
    static readonly deleteSpecificKey: ICommandElement = {
        commandName: 'deletekey',
        description: 'Slett en gitt nøkkel med oppgitt prefix. <prefix> <nøkkel> (Virker ikke)',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.deleteSpecificValue(rawMessage, messageContent)
        },
        category: 'admin',
    }
    static readonly sendMsgAsBot: ICommandElement = {
        commandName: 'send',
        description: 'send en melding som boten. <channel id> <melding>',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.sendMessageAsBotToSpecificChannel(rawMessage)
        },
        category: 'admin',
    }
    static readonly reactToMsg: ICommandElement = {
        commandName: 'react',
        description: 'reager på en melding som botten. <message id> <emoji>',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.reactToMsgAsBot(rawMessage, messageContent)
        },
        category: 'admin',
    }
    static readonly statsCommand: ICommandElement = {
        commandName: 'stats',
        description: 'Se enkle statistikker',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.getStats(rawMessage, messageContent)
        },
        category: 'admin',
    }
    static readonly replyToMsg: ICommandElement = {
        commandName: 'reply',
        description: 'reager på en melding som botten.',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.replyToMsgAsBot(rawMessage, messageContent)
        },
        category: 'admin',
    }
    static readonly setVal: ICommandElement = {
        commandName: 'setvalue',
        description: 'Sett en spesifikk verdi i databasen. <prefix> <nøkkel> <verdi>',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            Admin.setSpecificValue(rawMessage, messageContent, args)
        },
        category: 'admin',
    }
    static readonly setSpinVal: ICommandElement = {
        commandName: 'setspin',
        description: 'Sett en spin score for en bruker. <nøkkel> <verdi>',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.setSpinValue(rawMessage, messageContent)
        },
        category: 'admin',
    }
    static readonly getVal: ICommandElement = {
        commandName: 'getvalue',
        description: 'Hent en spesifikk verdi i databasen. <prefix> <nøkkel> ',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.getSpecificValue(rawMessage, messageContent)
        },
        category: 'admin',
    }
    static readonly warnUserCommand: ICommandElement = {
        commandName: 'warn',
        description: 'Gi en advarsel til en bruker. <nøkkel> <grunn> ',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            Admin.warnUser(rawMessage, messageContent)
        },
        category: 'admin',
    }

    static isAuthorAdmin(member: GuildMember | null) {
        // member.roles.cache.some(role => role.name === "Mazarini-Bot-Admin")
        if (member) return member.roles.cache.has('821709203470680117')
        return false
    }
    static isAuthorSuperAdmin(member: GuildMember | null) {
        // member.roles.cache.some(role => role.name === "Mazarini-Bot-Admin")
        if (member)
            return (
                member.id == '245607554254766081' || member.id == '397429060898390016' || member.id == '239154365443604480' // Maggi: || member.id == '221739293889003520'
            )
        return false
    }
}
