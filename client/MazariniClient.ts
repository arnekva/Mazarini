import { exec } from 'child_process'
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
import { environment } from '../client-env'
import { PatchNotes } from '../commands/patchnotes/patchnotes'
import { CommandRunner } from '../general/commandRunner'
import { ErrorHandler } from '../handlers/errorHandler'
import { ClientHelper } from '../helpers/clientHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { JobScheduler } from '../Jobs/jobScheduler'
import { MazariniBot } from '../main'
import { ArrayUtils } from '../utils/arrayUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { textArrays } from '../utils/textArrays'
import { UserUtils } from '../utils/userUtils'
const Discord = require('discord.js')

export class MazariniClient extends Client {
    private msgHelper: MessageHelper
    private commandRunner: CommandRunner
    private jobScheduler: JobScheduler
    private errorHandler: ErrorHandler
    constructor() {
        super({
            //Specifies intents needed to perform certain actions, i.e. what permissions the bot must have
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
        this.msgHelper = new MessageHelper(this)
        this.commandRunner = new CommandRunner(this, this.msgHelper)
        this.jobScheduler = new JobScheduler(this.msgHelper)
        this.errorHandler = new ErrorHandler(this.msgHelper)
    }
    setupListeners() {
        this.on('ready', async () => {
            console.log(
                `Setup ready, bot is running as ${this.user?.tag} at ${new Date().toLocaleDateString('nb', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })} ${new Date().toLocaleTimeString('nb')} !`
            )

            let msg = 'Boten er nå live i production mode. '

            if (process.env['--restartedForGit'] || process.argv.includes('--restartedForGit')) {
                msg += 'Boten ble restartet av en /restart, og prosjektet er oppdatert fra Git'

                //TODO & FIXME: Move this out into gitUtils or something
                await exec('git log --oneline -n 15', async (error, stdout, stderr) => {
                    if (error) {
                        this.msgHelper.sendLogMessage(`Git log failet. Klarte ikke liste siste commit messages`)
                    }
                    if (stdout) {
                        let allMessages = stdout.split('\n')
                        const latestMessage = allMessages[0]
                        if (latestMessage) {
                            const lastCommit = DatabaseHelper.getBotData('commit-id')
                            const indexOfLastID = allMessages.indexOf(lastCommit)
                            allMessages = allMessages.slice(0, indexOfLastID > 0 ? indexOfLastID : 1) //Only send last one if nothing is saved in the DB
                            const formatCommitLine = (line: string) => {
                                const allWords = line.split(' ')
                                const firstWord = allWords[0]
                                const restOfSentence = allWords.slice(1).join(' ')

                                return `*${firstWord}* - ${restOfSentence}`
                            }

                            //Add commit messages to start-up message
                            this.msgHelper.sendGitLogMessage(
                                `Følgende commits er lagt til i ${PatchNotes.currentVersion}:\n${allMessages.map((s) => formatCommitLine(s)).join('\n')}`,
                                {
                                    supressEmbeds: true,
                                }
                            )
                            //Update current id
                            DatabaseHelper.setBotData('commit-id', latestMessage)
                        }
                    }
                })
            }

            if (environment == 'prod') this.msgHelper.sendLogMessage(msg)

            ClientHelper.setStatusFromStorage(this)
            PatchNotes.compareAndSendPatchNotes(this.msgHelper)

            if (environment === 'dev') {
                //Uncomment to run command creation
                // CommandBuilder.createCommands(client)
            }

            this.errorHandler.launchBusListeners()
        })

        /** For all sent messages */
        this.on('messageCreate', async (message: Message) => {
            MazariniBot.numMessages++
            //Do not reply to own messages. Do not trigger on pinned messages
            if (
                message?.author?.id == MentionUtils.User_IDs.BOT_HOIE ||
                message?.author?.id == MentionUtils.User_IDs.CLYDE ||
                message?.type === MessageType.ChannelPinnedMessage ||
                !message?.author?.id
            ) {
                //Do not react
            } else {
                this.commandRunner.runCommands(message)
                if (
                    (message.mentions.users.find((u) => u.id === MentionUtils.User_IDs.BOT_HOIE) ||
                        message.content.includes(`<@!${MentionUtils.User_IDs.BOT_HOIE}>`)) &&
                    message.type !== MessageType.Reply &&
                    environment === 'prod'
                ) {
                    message.reply(ArrayUtils.randomChoiceFromArray(textArrays.bentHoieLines))
                }
            }
        })

        this.on('messageDelete', async (message: Message<boolean> | PartialMessage) => {
            if (!message.guild) return
            const fetchedLogs = await message?.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageDelete,
            })
            const actionLogId = MentionUtils.CHANNEL_IDs.ACTION_LOG

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
                message.channelId !== MentionUtils.CHANNEL_IDs.LOKAL_BOT_SPAM_DEV &&
                !message?.content?.includes('Laster data') &&
                !message?.content?.includes('Henter data') &&
                environment === 'prod' &&
                timeMatches()
            ) {
                this.msgHelper.sendMessage(
                    actionLogId,
                    `**En melding fra ** *${message?.author?.username}* **ble slettet av** *${executor?.username}*. **Innhold**: '*${message?.content}*'`,
                    { noMentions: true }
                )
            }
        })

        /** For interactions (slash-commands and user-commands) */
        this.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
            MazariniBot.numCommands++
            this.commandRunner.checkForCommandInInteraction(interaction)
        })

        this.on('channelDelete', (channel: DMChannel | NonThreadGuildBasedChannel) => {
            const id = MentionUtils.CHANNEL_IDs.ACTION_LOG
            this.msgHelper.sendMessage(id, `Channel med ID ${channel.id} ble slettet`)
        })

        this.on('guildBanAdd', (ban: GuildBan) => {
            const id = MentionUtils.CHANNEL_IDs.ACTION_LOG
            this.msgHelper.sendMessage(id, `${ban.user.username} ble bannet pga ${ban?.reason}`)
        })

        this.on('guildCreate', (guild: Guild) => {
            this.msgHelper.sendLogMessage('Ukjent: on guildCreate. Wat dis do?')
        })

        this.on('guildMemberAdd', async (member: GuildMember) => {
            UserUtils.onAddedMember(member, this.msgHelper)
        })
        this.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => {
            UserUtils.onMemberLeave(member, this.msgHelper)
        })

        this.on('userUpdate', function (oldUser: User | PartialUser, newUser: User) {
            UserUtils.onUserUpdate(oldUser, newUser, this.messageHelper)
        })

        //Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
        this.on('guildMemberUpdate', function (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
            UserUtils.onMemberUpdate(oldMember, newMember, this.messageHelper)
        })

        this.on('roleCreate', function (role: Role) {
            this.messageHelper.sendLogMessage('En ny rolle er opprettet: ' + role.name)
        })
        this.on('roleDelete', function (role: Role) {
            this.messageHelper.sendLogMessage('En rolle er slettet: ' + role.name)
        })

        this.on('messageUpdate', (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
            if (!newMessage.pinned && !oldMessage.pinned && !!newMessage.author) {
                this.commandRunner.checkMessageForJokes(newMessage as Message)
                if (newMessage.content && newMessage.content.startsWith('/') && !newMessage.content.startsWith('//')) {
                    //Dont trigger on TODO's
                    newMessage.reply(
                        'Du kan ikkje gjør ein slash-command når du redigere ein melding. Du må senda ein ny melding for å trigga commanden. Skyld på Discord for dårlig UX her, ikkje meg'
                    )
                }
            }
        })

        this.on('error', function (error: Error) {
            this.messageHelper.sendLogMessage('En feilmelding ble fanget opp. Error: \n ' + error)
        })
    }

    get messageHelper() {
        return this.msgHelper
    }
}
