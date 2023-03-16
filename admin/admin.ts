import { ActivityType, APIInteractionGuildMember, CacheType, ChatInputCommandInteraction, Client, GuildMember, Message, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { environment } from '../client-env'
import { ICommandElement, IInteractionElement } from '../general/commands'
import { LockingHandler } from '../handlers/lockingHandler'
import { ClientHelper } from '../helpers/clientHelper'
import { DatabaseHelper, dbPrefix, prefixList, ValuePair } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MazariniClient } from '../main'
import { MentionUtils } from '../utils/mentionUtils'
import { ObjectUtils } from '../utils/objectUtils'
import { TextUtils } from '../utils/textUtils'
import { UserUtils } from '../utils/userUtils'
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js')
const { exec } = require('child_process')
const pm2 = require('pm2')

export class Admin extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private setSpecificValue(interaction: ChatInputCommandInteraction<CacheType>): void {
        const user = interaction.options.get('bruker')?.user
        const property = interaction.options.get('property')?.value as string | number
        const value = interaction.options.get('verdi')?.value
        const secondaryProperty = interaction.options.get('secondary')?.value as string | number

        let logMsg = ''
        let hasAck = false
        //Double check that all where supplied in the interaction
        if (user && property && value) {
            const dbUser = DatabaseHelper.getUntypedUser(user.id)
            if (dbUser) {
                const prop = dbUser[property] //Check if property exists on DB user

                if (prefixList.includes(property as dbPrefix) || prop) {
                    let oldVal = dbUser[property] //Used for logging

                    if (typeof prop === 'object') {
                        //if prop is an object, we need to find the value that should actually be set
                        if (secondaryProperty && prop[secondaryProperty]) {
                            oldVal = dbUser[property][secondaryProperty]
                            //If the property within the object exists, we update it
                            dbUser[property][secondaryProperty] = value
                        } else {
                            hasAck = true
                            this.messageHelper.replyToInteraction(
                                interaction,
                                secondaryProperty
                                    ? `Det ser ut som du prøver å sette en verdi på et objekt. Du må legge til verdien som skal settes på dette objektet ved bruk av argumentet "secondary".`
                                    : `Du har prøvd å sette en verdi i objektet ${prop} og har brukt verdien ${secondaryProperty}. Denne finnes ikke på objektet, eller så mangler brukeren objektet.`,
                                true
                            )
                        }
                    } else if (typeof prop === 'number') dbUser[property] = Number(value)
                    else dbUser[property] = value

                    DatabaseHelper.updateUser(dbUser)
                    if (!hasAck)
                        this.messageHelper.replyToInteraction(
                            interaction,
                            `Oppdaterte ${property} for ${user.username}. Ny verdi er ${value}, gammel verdi var ${oldVal}`
                        )
                    logMsg = `Setvalue ble brukt av ${interaction.user.username} for å sette verdi for bruker ${user.username} sin ${property}. Gammel verdi var ${oldVal}, ny verdi er ${value}`
                } else {
                    logMsg = `Setvalue ble brukt av ${interaction.user.username} for å sette verdi for bruker ${user.username} men brukte feil prefix. Prefix forsøkt brukt var ${property}`
                }
            }
            if (environment === 'prod') this.messageHelper.sendMessageToActionLog(logMsg)
        } else {
            this.messageHelper.replyToInteraction(interaction, `Alle nødvendige parametere ble ikke funnet. `, true)
        }
    }

    private async replyToMsgAsBot(interaction: ChatInputCommandInteraction<CacheType>) {
        this.messageHelper.replyToInteraction(interaction, `Svarer på meldingen hvis jeg finner den`, true)
        const allChannels = [...this.client.channels.cache.values()].filter((channel) => channel instanceof TextChannel) as TextChannel[]
        const id = interaction.options.get('melding-id')?.value as string
        const replyString = interaction.options.get('tekst')?.value as string
        let hasFoundMsgOrThrewError = false
        allChannels.forEach((channel: TextChannel) => {
            if (
                channel &&
                channel.permissionsFor(UserUtils.findMemberByUserID(UserUtils.User_IDs.BOT_HOIE, channel.guild)).toArray().includes('ReadMessageHistory')
            ) {
                channel.messages
                    .fetch(id)
                    .then(async (message) => {
                        if (message && message.id == id) {
                            message.reply(replyString)
                        }
                    })
                    .catch((error) => {
                        if (!hasFoundMsgOrThrewError && error.rawError.message !== 'Missing Access' && error.rawError.message !== 'Unknown Message') {
                            this.messageHelper.sendMessageToActionLog(`${interaction.user.username} brukte */reply*, men meldingen ble ikke funnet`)
                            hasFoundMsgOrThrewError = true
                        }
                    })
            }
        })
    }

    private setBotStatus(interaction: ChatInputCommandInteraction<CacheType>) {
        const activity = this.translateActivityType(interaction.options.get('aktivitet')?.value as string)
        const status = interaction.options.get('statustekst')?.value as string
        const hasUrl = status.includes('www.')
        const activityName = ActivityType[activity]
        DatabaseHelper.setBotData('status', status)
        DatabaseHelper.setBotData('statusType', activity)
        this.messageHelper.sendMessageToActionLog(`Bottens aktivitet er satt til '${activityName}' med teksten '${status}' av ${interaction.user.username}. `)
        this.messageHelper.replyToInteraction(interaction, `Bottens aktivitet er satt til '${activityName}' med teksten '${status}'`)
        ClientHelper.updatePresence(this.client, activity, status, hasUrl ? status : undefined)
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
        }
    }

    private getBotStatistics(interaction: ChatInputCommandInteraction<CacheType>) {
        const start = MazariniClient.startTime
        const numMessages = MazariniClient.numMessages
        const numMessagesFromBot = MazariniClient.numMessagesFromBot
        const numErrorMessages = MazariniClient.numMessagesNumErrorMessages
        const numCommands = MazariniClient.numCommands
        const statsReply =
            `Statistikk (fra og med oppstart ${start.toLocaleDateString('nb', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })} ${start.toLocaleTimeString('nb')}):` +
            `\nAntall meldinger: ${numMessages}` +
            `\nAntall meldinger fra bot: ${numMessagesFromBot}` +
            `\nAntall kommandoer: ${numCommands}` +
            `\nAntall logger: ${numErrorMessages}`
        this.messageHelper.replyToInteraction(interaction, statsReply)
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

                if (p.split('/')[1] === 'incorrectCommand') {
                    values.sort(function (a, b) {
                        return Number(b.val) - Number(a.val)
                    })
                }
                let formatted = values.map((d: ValuePair) => `${d.key} - ${d.val}`).join('\n')
                if (formatted.length > 700) {
                    const totalLength = formatted.length
                    const slicedFormat = formatted.slice(0, 700)
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
                            return this.messageHelper.sendMessage(message.channelId, `Verdi er <${value}> (prop: ${prop}, bruker: ${user.username})`)
                        } else {
                            message.reply('Fant ingen verdi')
                        }
                    } else {
                        message.reply('Fant ikke egenskapen')
                    }
                } else {
                    message.reply('Fant ikke bruker')
                }
                return undefined
            }
        } else {
            return message.reply('Du må spesifisere path eller prefix')
        }
    }

    private deleteXLastMessagesByUserInChannel(message: Message, messageContent: string, args: string[]) {
        const userToDelete = TextUtils.splitUsername(args[0])
        const user = UserUtils.findUserByUsername(userToDelete, message)

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
    private async handleLocking(interaction: ChatInputCommandInteraction<CacheType>) {
        const isBot = interaction.options.getSubcommand() === 'bot'
        const isUser = interaction.options.getSubcommand() === 'user'
        const isChannel = interaction.options.getSubcommand() === 'channel'
        const user = interaction.options.get('bruker')?.user
        let locked = false
        if (isBot) {
            locked = !LockingHandler.getbotLocked()
            LockingHandler.setBotLocked(!LockingHandler.getbotLocked())
        } else if (isChannel) {
            if (LockingHandler.getlockedThread().includes(interaction.channelId)) {
                LockingHandler.removeThread(interaction.channelId)
            } else LockingHandler.setLockedThread(interaction.channelId)
            locked = LockingHandler.getlockedThread().includes(interaction.channelId)
        } else if (isUser) {
            if (LockingHandler.getlockedUser().includes(user?.id)) {
                LockingHandler.removeUserLock(user.id)
            } else LockingHandler.setLockedUser(user.id)
            locked = LockingHandler.getlockedUser().includes(user?.id)
        }
        this.messageHelper.replyToInteraction(interaction, `${locked ? 'Låst' : 'Åpnet'}`)
    }

    private async rewardUser(interaction: ChatInputCommandInteraction<CacheType>) {
        const type = interaction.options.getString('type')
        const reason = interaction.options.get('type')?.value as string
        const chips = interaction.options.get('chips')?.value as number
        const user = interaction.options.get('user')?.user
        const dbUser = DatabaseHelper.getUser(user.id)
        dbUser.chips += chips
        DatabaseHelper.updateUser(dbUser)
        this.messageHelper.replyToInteraction(interaction, `${user.username} har mottatt en ${type} reward på ${chips} på grunn av *${reason}*`)
    }

    private async restartBot(interaction: ChatInputCommandInteraction<CacheType>) {
        this.messageHelper.replyToInteraction(interaction, `Forsøker å restarte botten`, true)
        let restartMsg = 'Forsøker å restarte botten'
        const msg = await this.messageHelper.sendMessageToActionLog(restartMsg)
        exec('npm run restart', (error, stdout, stderr) => {
            if (error) {
                restartMsg += `\nKlarte ikke restarte: \n${error}`
                msg.edit(restartMsg)
            }
        })
    }

    public getAllCommands(): ICommandElement[] {
        return [
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
        ]
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'send',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    if (Admin.isAuthorAdmin(rawInteraction.member)) {
                        this.buildSendModal(rawInteraction)
                        this.messageHelper.sendMessageToActionLog(
                            `${rawInteraction.user.username} trigget 'send' fra ${MentionUtils.mentionChannel(rawInteraction.channelId)}.`
                        )
                    } else rawInteraction.reply({ content: 'Du har ikke rettighetene til å gjøre dette', ephemeral: true })
                },
            },
            {
                commandName: 'lock',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.handleLocking(rawInteraction)
                },
            },
            {
                commandName: 'botstatus',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.setBotStatus(rawInteraction)
                },
            },
            {
                commandName: 'set',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.setSpecificValue(rawInteraction)
                },
            },
            {
                commandName: 'reward',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.rewardUser(rawInteraction)
                },
            },
            {
                commandName: 'botstats',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.getBotStatistics(rawInteraction)
                },
            },
            {
                commandName: 'reply',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.replyToMsgAsBot(rawInteraction)
                },
            },
            {
                commandName: 'stopprocess',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.sendMessageToActionLog('STANSET PM2-PROSESSEN. Rip meg')
                    this.messageHelper.replyToInteraction(rawInteraction, `Forsøker å stoppe botten. Rip meg`)
                    pm2?.killDaemon()
                    pm2?.disconnect()
                },
            },
            {
                commandName: 'restart',
                category: 'admin',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.restartBot(rawInteraction)
                },
            },
        ]
    }

    static isAuthorAdmin(member: GuildMember | APIInteractionGuildMember | null | undefined) {
        if (!member || !member?.roles) return false
        const cache = (member as GuildMember).roles.cache
        if (!cache) return false
        else return cache.has('821709203470680117')
    }
    static isAuthorTrustedAdmin(member: GuildMember | null | undefined) {
        if (!member || !member.roles) return false
        if (member) return member.roles.cache.has('963017545647030272')
        return false
    }

    static adminSendModalID = 'adminSendModal'
}
