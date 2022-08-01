import { ActivityType, APIInteractionGuildMember, CacheType, ChatInputCommandInteraction, Client, GuildMember, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { ClientHelper } from '../helpers/clientHelper'
import { DatabaseHelper, dbPrefix, prefixList, ValuePair } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MazariniClient } from '../main'
import { MessageUtils } from '../utils/messageUtils'
import { ObjectUtils } from '../utils/objectUtils'
import { TextUtils } from '../utils/textUtils'
import { UserUtils } from '../utils/userUtils'
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js')

const pm2 = require('pm2')

export class Admin extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private setSpecificValue(message: Message, messageContent: string, args: string[]) {
        const username = args[0]
        const prefix = args[1]
        const value = args.slice(2).join(' ')
        if (!username && !prefix && !value) {
            return message.reply('Du mangler argumenter')
        }
        let logMsg = ''
        const discordUser = UserUtils.findUserByUsername(username, message)
        if (discordUser) {
            const user = DatabaseHelper.getUntypedUser(discordUser.id)
            if (user) {
                const prop = user[prefix]
                if (prefixList.includes(prefix as dbPrefix) || prop) {
                    const oldVal = user[prefix] //Brukt til logging
                    if (typeof prop === 'object') return message.reply('Du kan ikke sette en primitiv type på et objekt. setvalue støtter ikke objekter')
                    else if (typeof prop === 'number') user[prefix] = Number(value)
                    else user[prefix] = value
                    DatabaseHelper.updateUser(user)
                    this.messageHelper.reactWithThumbs(message, 'up')
                    logMsg = `Setvalue ble brukt av ${message.author.username} for å sette verdi for bruker ${user.displayName} sin ${prefix}. Gammel verdi var ${oldVal}, ny verdi er ${value}`
                } else {
                    logMsg = `Setvalue ble brukt av ${message.author.username} for å sette verdi for bruker ${user.displayName} men brukte feil prefix. Prefix forsøkt brukt var ${prefix}`
                    message.reply(`${prefix} eksisterer ikke på ${discordUser.username}`)
                }
            } else {
                logMsg = `Setvalue ble brukt av ${message.author.username} for å sette verdi for bruker som ikke eksisterer i Databasen`
                return message.reply('Fant ikke brukeren i databasen')
            }
        } else {
            logMsg = `Setvalue ble brukt av ${message.author.username} for å sette verdi for bruker som ikke eksisterer`
            return message.reply('Fant ikke brukeren fra args[1] <' + username + '>')
        }
        return this.messageHelper.sendMessageToActionLog(message.channel as TextChannel, logMsg)
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

    private setBotStatus(message: Message, messageContent: string, args: string[]) {
        const activity = this.translateActivityType(args[0])
        const hasUrl = args[1].includes('www.')
        const status = hasUrl ? args.slice(2).join(' ') : args.slice(1).join(' ')
        DatabaseHelper.setBotData('status', status)
        DatabaseHelper.setBotData('statusType', activity)
        this.messageHelper.reactWithThumbs(message, 'up')
        this.messageHelper.sendMessageToActionLog(
            message.channel as TextChannel,
            `Bottens aktivitet er satt til '${activity}' med teksten '${status}' av ${message.author.username}. ${
                activity === ActivityType.Streaming && !hasUrl
                    ? 'Du kan ikke sette status til streaming uten å ha en URL som parameter 1. "!mz botstatus streaming www.twitch.tv/Deadmaggi Deadmaggis Tips n tricks". Den er derfor satt til Playing '
                    : ''
            }`
        )
        ClientHelper.updatePresence(this.client, activity, status, hasUrl ? args[1] : undefined)
    }

    private translateActivityType(type: string): Exclude<ActivityType, ActivityType.Custom> {
        switch (type.toUpperCase()) {
            case 'COMPETING':
                return ActivityType.Competing

            case 'LISTENING':
                return ActivityType.Listening
            case 'PLAYING':
                return ActivityType.Playing
            case 'STREAMING':
                return ActivityType.Streaming
            case 'WATCHING':
                return ActivityType.Watching

            default:
                return ActivityType.Playing
        }
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

    private getBotStatistics(message: Message, messageContent: string, args: string[]) {
        const numMessages = MazariniClient.numMessages
        const statsReply = `Statistikk:\nAntall meldinger siden sist oppstart: ${numMessages}`
        this.messageHelper.sendMessage(message.channelId, statsReply)
    }

    private botDownTime(message: Message, messageContent: string, args: string[]) {
        const scheduledTimeBackUp = args[0]
        const reason = args.slice(1)
        const mainMsg = `Planlagt nedetid for botten fra nå ${scheduledTimeBackUp ? 'frem til ca. ' + scheduledTimeBackUp : 'i ca. 30 minutter.'}. ${
            reason ?? ''
        }`

        this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING, mainMsg)
    }

    private async warnUser(message: Message, messageContent: string, args: string[]) {
        const username = TextUtils.splitUsername(args[0])

        const user = UserUtils.findUserByUsername(username, message)

        const replyString = messageContent.replace(username, '').replace('""', '').trim()
        if (user) {
            if (user.id == message.author.id) {
                return message.reply('Du kan kje warna deg sjøl, bro')
            }
            const warnedUser = DatabaseHelper.getUser(user.id)
            let userWarnings = warnedUser.warningCounter

            if (!isNaN(userWarnings)) {
                warnedUser.warningCounter = ++userWarnings
                DatabaseHelper.updateUser(warnedUser)
                this.messageHelper.sendMessage(
                    message.channelId,
                    warnedUser.displayName + ', du har fått en advarsel. Du har nå ' + userWarnings + ' advarsler.'
                )
                //Send msg to action-log
                return this.messageHelper.sendMessageToActionLog(
                    message.channel as TextChannel,
                    message.author.username +
                        ' ga en advarsel til ' +
                        warnedUser.displayName +
                        ' på grunn av: ' +
                        replyString +
                        '. ' +
                        warnedUser.displayName +
                        ' har nå ' +
                        userWarnings +
                        ' advarsler'
                )
            } else {
                return this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, 'Verdien for warningcounter er NaN: <' + userWarnings + '>.')
            }
        } else {
            return this.messageHelper.sendMessage(
                message.channelId,
                'Feil: Du har enten skrevet feil bruker navn eller ikke inkludert en melding. *Hvis brukeren har mellomrom i navnet, bruk under_strek*'
            )
        }
    }

    private runScript(message: Message, messageContent: string, args: string[]) {
        switch (args[0].toLowerCase()) {
            case 'dbget':
                this.dbGet(message, messageContent, args)
                break
            case 'listprefix':
                message.reply(prefixList.join(', '))
                break
            default:
                message.reply('Fant ikke funksjonen ' + (args[0] ?? '<tom>'))
                break
        }
    }

    private dbGet(message: Message, messageContent: string, args: string[]) {
        const p = args[1]

        const validatePath = (p: string): boolean => {
            switch (p.split('/')[0]) {
                case 'other':
                case 'bot':
                case 'textCommand':
                    return true
                default:
                    return false
            }
        }

        if (p) {
            if (validatePath(p)) {
                //Vil hente fra verdier som ikke er knyttet til bruker
                const data = DatabaseHelper.getAllValuesFromPath(`/${p}`)
                if (!data) {
                    return message.reply(`Pathen ${p} inneholder ingen data.`)
                }
                const values: ValuePair[] = []
                Object.keys(data).forEach((el) => {
                    let x = DatabaseHelper.getAllValuesFromPath(`/${p}/${el}`)
                    if (ObjectUtils.isObject(x)) {
                        //Hvis på root av et object, så man slipper å spesifisere hele pathen
                        x = JSON.stringify(x)
                    }

                    values.push({ key: el, val: x })
                })
                let formatted = values.map((d: ValuePair) => `${d.key} - ${d.val}`).join('\n')
                if (formatted.length > 1000) {
                    const totalLength = formatted.length
                    const slicedFormat = formatted.slice(0, 998)
                    formatted = slicedFormat + '...' + `\nViser ${slicedFormat.length} av ${totalLength}`
                }
                if (formatted) return this.messageHelper.sendMessage(message.channelId, formatted)
                return undefined
            } else {
                const username = args[1]
                const user = UserUtils.findUserByUsername(username, message)
                if (user) {
                    const prop = args[2] as dbPrefix
                    if (ObjectUtils.isObjectOfTypeDbPrefix(prop)) {
                        const dbUser = DatabaseHelper.getUser(user.id)
                        const value = dbUser[prop]
                        if (value) {
                            this.messageHelper.sendMessage(message.channelId, `Verdi er <${value}> (prop: ${prop}, bruker: ${user.username})`)
                        } else {
                            message.reply('Fant ingen verdi')
                        }
                    } else {
                        message.reply('Fant ikke egenskapen')
                    }
                } else {
                    message.reply('Fant ikke bruker')
                }
            }
        } else {
            return message.reply('Du må spesifisere path eller prefix')
        }
    }

    private deleteXLastMessagesByUserInChannel(message: Message, messageContent: string, args: string[]) {
        const userToDelete = TextUtils.splitUsername(args[0])
        const user = DatabaseHelper.findUserByUsername(userToDelete, message)

        const reason = userToDelete ? args.slice(3).join(' ') : args.slice(2).join(' ')
        if (!user) {
            message.reply('du må oppgi et gyldig brukernavn. <brukernavn> <antall meldinger>')
        } else {
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
                            } catch (error) {}
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
    }

    private debugMethod(message: Message, messageContent: string, args: string[]) {
        // SlashCommandHelper.buildCommands()
    }

    private async buildSendModal(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            const modal = new ModalBuilder().setCustomId(Admin.adminSendModalID).setTitle('Send melding som Høie')
            const channelID = new TextInputBuilder()
                .setCustomId('channelID')
                // The label is the prompt the user sees for this input
                .setLabel('ID-en til kanalen meldingen skal sendes til')
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)

            const message = new TextInputBuilder()
                .setCustomId('messageInput')
                .setLabel('Melding')
                // Paragraph means multiple lines of text.
                .setStyle(TextInputStyle.Paragraph)

            const firstActionRow = new ActionRowBuilder().addComponents(channelID)
            const secondActionRow = new ActionRowBuilder().addComponents(message)
            modal.addComponents(firstActionRow, secondActionRow)
            await interaction.showModal(modal)
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'debug',
                description: 'Superadminer kan kjøre denne for å kjøre funksjonen definert i debugMethod',
                hideFromListing: true,
                command: async (rawMessage: Message, messageContent: string, args: string[]) => {
                    if (Admin.isAuthorSuperAdmin(UserUtils.findMemberByUserID(rawMessage.author.id, rawMessage))) {
                        this.debugMethod(rawMessage, messageContent, args)
                    } else {
                        rawMessage.reply('Kun superadminer kan bruke denne')
                    }
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
                commandName: 'send',
                description: 'Send en melding som boten. <channel id> <melding>',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.sendMessageAsBotToSpecificChannel(rawMessage)
                },
                isReplacedWithSlashCommand: 'send',
                category: 'admin',
            },
            {
                commandName: 'react',
                description: 'Reager på en melding som botten. <message id> <emoji>',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.reactToMsgAsBot(rawMessage, messageContent)
                },
                category: 'admin',
            },
            {
                commandName: 'reply',
                description: 'Svar på en melding som botten. <melding-ID> <melding>',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    this.replyToMsgAsBot(rawMessage, messageContent)
                },
                category: 'admin',
            },
            {
                commandName: 'setvalue',
                description: 'Sett en spesifikk verdi i databasen. <brukernavn> <prefix> <verdi>. Sender feilmelding hvis verdi ikke kan settes',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.setSpecificValue(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
            {
                commandName: 'warn',
                description: 'Gi en advarsel til en bruker. <Brukernavn> <grunn> ',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.warnUser(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
            {
                commandName: 'botstatus',
                description: 'Sett botten sin status. Lovlige aktiviteter: watching, streaming, playing, listening og competing. Defaulter til playing',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.setBotStatus(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
            {
                commandName: 'stats',
                description: 'Hent enkle stats om botten',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.getBotStatistics(rawMessage, messageContent, args)
                },
                category: 'admin',
            },
            {
                commandName: 'run',
                description:
                    'Kjør admin funksjon. \ndbget - Hent ut verdier direkte fra databasen. dbget <prefix> for brukerobjekter. dbget <prefix> <folder> for verdier utenfor brukere\nlistprefix - List alle prefixer',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.runScript(rawMessage, messageContent, args)
                },
                isAdmin: true,
                hideFromListing: true,
                category: 'admin',
            },
            {
                commandName: 'downtime',
                description: 'Send melding om downtime. <klokkeslett den skal være tilbake (string)> <grunn>',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.botDownTime(rawMessage, messageContent, args)
                },
                isAdmin: true,
                hideFromListing: true,
                category: 'admin',
            },
            {
                commandName: 'stopprocess',
                description: 'Stopp PM2-prosessen som kjører botten. Den vil ikke restarte når den stoppes på denne måten',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.messageHelper.sendMessageToActionLog(rawMessage.channel as TextChannel, 'STANSET PM2-PROSESSEN')
                    pm2?.killDaemon()
                    pm2?.disconnect()
                },
                isSuperAdmin: true,
                hideFromListing: true,
                category: 'admin',
            },
        ]
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'send',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    if (Admin.isAuthorAdmin(rawInteraction.member)) this.buildSendModal(rawInteraction)
                    else rawInteraction.reply({ content: 'Du har ikke rettighetene til å gjøre dette', ephemeral: true })
                },
            },
        ]
    }

    static isAuthorAdmin(member: GuildMember | APIInteractionGuildMember | null | undefined) {
        const cache = (member as GuildMember).roles.cache
        if (!cache) return false
        else return cache.has('821709203470680117')
    }
    static isAuthorSuperAdmin(member: GuildMember | null | undefined) {
        if (member) return member.roles.cache.has('963017545647030272')
        return false
    }

    static adminSendModalID = 'adminSendModal'
}
