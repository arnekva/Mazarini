import {
    AuditLogEvent,
    CacheType,
    Client,
    DMChannel,
    GatewayIntentBits,
    Guild,
    GuildBan,
    GuildMember,
    Interaction,
    Message,
    MessageType,
    NonThreadGuildBasedChannel,
    PartialGuildMember,
    PartialMessage,
    PartialUser,
    Role,
    User,
} from 'discord.js'
import moment from 'moment'
import { discordSecret, environment } from './client-env'
import { CommandRunner } from './general/commandRunner'
import { ErrorHandler } from './handlers/errorHandler'
import { ClientHelper } from './helpers/clientHelper'
import { MessageHelper } from './helpers/messageHelper'
import { JobScheduler } from './Jobs/jobScheduler'
import { ArrayUtils } from './utils/arrayUtils'
import { MentionUtils } from './utils/mentionUtils'
import { textArrays } from './utils/textArrays'
import { UserUtils } from './utils/userUtils'
const { Util } = require('discord.js')

const Discord = require('discord.js')
const axon = require('pm2-axon')
const sub = axon.socket('sub-emitter')
const pm2 = require('pm2')

export class MazariniClient {
    private client: Client
    private commandRunner: CommandRunner
    private messageHelper: MessageHelper
    private jobScheduler: JobScheduler
    private errorHandler: ErrorHandler
    static numMessages: number = 0
    static numMessagesFromBot: number = 0
    static numMessagesNumErrorMessages: number = 0
    static numCommands: number = 0
    private isTest: boolean
    static startTime: Date
    mazarini: any

    constructor() {
        //Specifies intents needed to perform certain actions, i.e. what permissions the bot must have
        this.client = new Discord.Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildBans,
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildMessageTyping,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildWebhooks,
                GatewayIntentBits.GuildIntegrations,
                GatewayIntentBits.DirectMessageTyping,
                GatewayIntentBits.GuildVoiceStates,
            ],
        })
        this.messageHelper = new MessageHelper(this.client)
        this.commandRunner = new CommandRunner(this.client, this.messageHelper)
        MazariniClient.startTime = new Date()
        MazariniClient.numMessages = 0
        this.isTest = environment === 'dev'
        this.jobScheduler = new JobScheduler(this.messageHelper)
        this.errorHandler = new ErrorHandler(this.messageHelper)
    }

    async initClient() {
        /** Login client */
        console.log('Initializing client, logging in')

        await this.client.login(discordSecret)
        console.log('Logged in, starting setup')

        this.setupClient(this.client)
    }

    setupClient(client: Client) {
        const _mzClient = this
        const _msgHelper = this.messageHelper
        moment.updateLocale('nb', {})
        client.on('ready', async () => {
            console.log(
                `Setup ready, bot is running as ${_mzClient.client.user?.tag} at ${new Date().toLocaleDateString('nb', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })} ${new Date().toLocaleTimeString('nb')} !`
            )

            let msg = 'Boten er nå live i production mode. '

            if (process.env['--restartedForGit'] || process.argv.includes('--restartedForGit')) {
                msg += 'Prosjektet er oppdatert fra Git, trigget av en /restart.'
            }
            if (environment == 'prod') _msgHelper.sendLogMessage(msg)

            ClientHelper.setStatusFromStorage(client)

            this.errorHandler.launchBusListeners()
        })

        /** For all sent messages */
        client.on('messageCreate', async (message: Message) => {
            MazariniClient.numMessages++
            //Do not reply to own messages. Do not trigger on pinned messages
            if (message?.author?.username == client?.user?.username || message?.type === MessageType.ChannelPinnedMessage) {
                MazariniClient.numMessagesFromBot++
            } else {
                _mzClient.commandRunner.runCommands(message)

                if (message.mentions.users.find((u) => u.id === MentionUtils.User_IDs.BOT_HOIE) && environment === 'prod') {
                    message.reply(ArrayUtils.randomChoiceFromArray(textArrays.bentHoieLines))
                }
            }
        })

        client.on('messageDelete', async (message: Message<boolean> | PartialMessage) => {
            if (!message.guild) return
            const fetchedLogs = await message?.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageDelete,
            })
            const actionLogId = '810832760364859432'

            const deletionLog = fetchedLogs.entries.first()

            if (!deletionLog) {
                return
            }
            const { executor, target } = deletionLog
            const createdAt = { hours: new Date(deletionLog.createdAt).getHours(), min: new Date(deletionLog.createdAt).getMinutes() }
            const now = { hours: new Date().getHours(), min: new Date().getMinutes() }
            const timeMatches = (): boolean => {
                return createdAt.hours === now.hours && createdAt.min === now.min
            }
            if (
                target?.id === message?.author?.id &&
                message.channelId !== MentionUtils.CHANNEL_IDs.ACTION_LOG &&
                message.channelId !== MentionUtils.CHANNEL_IDs.LOKAL_BOT_SPAM &&
                !message?.content?.includes('Laster data') &&
                !message?.content?.includes('Henter data') &&
                environment === 'prod' &&
                timeMatches()
            ) {
                _msgHelper.sendMessage(
                    actionLogId,
                    `**En melding fra ** *${message?.author?.username}* **ble slettet av** *${executor?.username}*. **Innhold**: '*${message?.content}*'`,
                    true
                )
            }
        })

        /** For interactions (slash-commands and user-commands) */
        client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
            MazariniClient.numCommands++
            _mzClient.commandRunner.checkForCommandInInteraction(interaction)
        })

        client.on('channelDelete', (channel: DMChannel | NonThreadGuildBasedChannel) => {
            const id = '810832760364859432'
            _msgHelper.sendMessage(id, `Channel med ID ${channel.id} ble slettet`)
        })

        client.on('guildBanAdd', (ban: GuildBan) => {
            const id = '810832760364859432'
            _msgHelper.sendMessage(id, `${ban.user.username} ble bannet pga ${ban?.reason}`)
        })

        client.on('guildCreate', (guild: Guild) => {
            _msgHelper.sendLogMessage('Ukjent: on guildCreate. Wat dis do?')
        })

        client.on('guildMemberAdd', async (member: GuildMember) => {
            UserUtils.onAddedMember(member, _msgHelper)
        })
        client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => {
            UserUtils.onMemberLeave(member, _msgHelper)
        })

        client.on('userUpdate', function (oldUser: User | PartialUser, newUser: User) {
            UserUtils.onUserUpdate(oldUser, newUser, _msgHelper)
        })

        //Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
        client.on('guildMemberUpdate', function (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
            UserUtils.onMemberUpdate(oldMember, newMember, _msgHelper)
        })

        client.on('roleCreate', function (role: Role) {
            _msgHelper.sendLogMessage('En ny rolle er opprettet: ' + role.name)
        })
        client.on('roleDelete', function (role: Role) {
            _msgHelper.sendLogMessage('En rolle er slettet: ' + role.name)
        })

        client.on('messageUpdate', function (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
            if (!newMessage.pinned && !oldMessage.pinned && !!newMessage.author) {
                _mzClient.commandRunner.checkMessageForJokes(newMessage as Message)
                if (newMessage.content && newMessage.content.startsWith('/') && !newMessage.content.startsWith('//')) {
                    //Dont trigger on TODO's
                    newMessage.reply(
                        'Du kan ikkje gjør ein slash-command når du redigere ein melding. Du må senda ein ny melding for å trigga commanden. Skyld på Discord for dårlig UX her, ikkje meg'
                    )
                }
            }
        })

        client.on('error', function (error: Error) {
            _msgHelper.sendLogMessage('En feilmelding ble fanget opp. Error: \n ' + error)
        })
    }

    testContext() {
        return {
            client: this.client,
        }
    }
}
