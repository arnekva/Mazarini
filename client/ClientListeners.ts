import { exec } from 'child_process'
import {
    CacheType,
    DMChannel,
    Guild,
    GuildBan,
    GuildEmoji,
    GuildMember,
    Interaction,
    Message,
    MessageReaction,
    NonThreadGuildBasedChannel,
    PartialGuildMember,
    PartialMessage,
    PartialUser,
    Role,
    User,
} from 'discord.js'
import { environment } from '../client-env'

import { CommandRunner } from '../general/commandRunner'
import { ErrorHandler } from '../handlers/errorHandler'
import { ClientHelper } from '../helpers/clientHelper'
import { MazariniBot } from '../main'
import { PatchNotes } from '../patchnotes'
import { ArrayUtils } from '../utils/arrayUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds, MentionUtils, ServerIds } from '../utils/mentionUtils'
import { MessageUtils } from '../utils/messageUtils'
import { textArrays } from '../utils/textArrays'
import { UserUtils } from '../utils/userUtils'
import { MazariniClient } from './MazariniClient'

/** NOT IN USE
 *  Testing sub-properties and functions
 */
export class ClientListener {
    client: MazariniClient
    commandRunner: CommandRunner
    /** Sets up listeners on pm2 process and will log any activity to the log channel */
    private errorHandler: ErrorHandler
    constructor(client: MazariniClient) {
        this.client = client
        this.commandRunner = new CommandRunner(this.client)
        this.errorHandler = new ErrorHandler(this.client.messageHelper)
    }

    setupListeners() {
        this.client.on('ready', async () => {
            console.log(
                `Setup ready, bot is running as ${this.client.user?.tag} at ${new Date().toLocaleDateString('nb', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })} ${new Date().toLocaleTimeString('nb')} !`
            )
            let msg = 'Boten er nå live i production mode. '

            //TODO: Work out this stuff
            if (
                process.env['--restartedForGit'] ||
                process.argv.includes('--restartedForGit') ||
                process.argv.includes('restartedForGit') ||
                process.env['restartedForGit']
            ) {
                msg += 'Boten ble restartet av en /restart, og prosjektet er oppdatert fra Git'

                //Uses ¶ to separate the params, so that we can easily split them later.
                //TODO: Should be refactored out of there
                await exec('git log --pretty=format:"%h¶%an¶%s"  -n 15', async (error, stdout) => {
                    if (error) {
                        this.client.messageHelper.sendLogMessage(`Git log failet. Klarte ikke liste siste commit messages`)
                    }
                    if (stdout) {
                        let allMessages = stdout.split('\n')
                        const latestMessage = allMessages[0]
                        if (latestMessage) {
                            const lastCommit = await this.client.database.getBotData('commit-id')
                            const indexOfLastID = allMessages.map((c) => c.slice(0, 8)).indexOf(lastCommit)
                            allMessages = allMessages.slice(0, indexOfLastID > 0 ? indexOfLastID : 1)

                            const formatCommitLine = (line: string) => {
                                const allWords = line.split('¶')
                                const commitId = allWords[0]
                                const commitAuthor = allWords[1].replace('arnekva-pf', 'Arne Kvaleberg')
                                const commitMessage = allWords[2]
                                return `*${commitAuthor}* *${commitId}* - ${commitMessage}`
                            }

                            this.client.messageHelper.sendMessage(
                                ChannelIds.GIT_LOG,
                                {
                                    text: `Følgende commits er lagt til i ${PatchNotes.currentVersion}:\n${allMessages
                                        .map((s) => formatCommitLine(s))
                                        .join('\n')}`,
                                },
                                {
                                    supressEmbeds: true,
                                    dontIncrementMessageCounter: true,
                                }
                            )

                            //Update current id (slice away author and message, only keep first part of hash)
                            this.client.database.setBotData('commit-id', latestMessage.slice(0, 8))
                        }
                    }
                })
            } else {
                msg += '\nIngen restartedForGit flagg ble funnet. Boten ble sannsynligvis ikke restartet av en /restart'
            }
            if (environment === 'prod') {
                this.client.messageHelper.sendLogMessage(msg)
            }
            ClientHelper.setDisplayNameMode(this.client, 'online')
            ClientHelper.setStatusFromStorage(this.client, this.client.database)
            PatchNotes.compareAndSendPatchNotes(this.client.messageHelper, this.client.database)

            this.errorHandler.launchBusListeners()
        })

        /** For all sent messages */
        this.client.on('messageCreate', (message: Message) => {
            MazariniBot.numMessages++
            //Do not reply to own messages. Do not trigger on pinned messages
            if (
                message?.author?.id == MentionUtils.User_IDs.BOT_HOIE ||
                message?.author?.id == MentionUtils.User_IDs.CLYDE ||
                message?.type === 6 || // MessageType.ChannelPinnedMessage ||
                !message?.author?.id
            ) {
                //Do not react
            } else {
                this.commandRunner.runCommands(message)

                if (
                    (message.mentions.users.find((u) => u.id === MentionUtils.User_IDs.BOT_HOIE) ||
                        message.content.includes(`<@!${MentionUtils.User_IDs.BOT_HOIE}>`)) &&
                    message.type !== 19 && // MessageType.Reply &&
                    environment === 'prod'
                ) {
                    const isQuestion = message.content.endsWith('?')

                    message.reply(ArrayUtils.randomChoiceFromArray(isQuestion ? textArrays.bentHoieLinesAnswers : textArrays.bentHoieLines))
                }
            }
        })

        this.client.on('messageDelete', async (message: Message<boolean> | PartialMessage) => {
            if (!message.guild) return
            const fetchedLogs = await message?.guild.fetchAuditLogs({
                limit: 1,
                type: 72, // AuditLogEvent.MessageDelete,
            })
            const actionLogId = ChannelIds.ACTION_LOG

            const deletionLog = fetchedLogs.entries.first()

            if (!deletionLog) {
                return
            }
            const { executor, target }: any = deletionLog
            const createdAt = { hours: new Date(deletionLog.createdAt).getHours(), min: new Date(deletionLog.createdAt).getMinutes() }
            const now = { hours: new Date().getHours(), min: new Date().getMinutes() }
            const timeMatches = (): boolean => {
                return createdAt.hours === now.hours && createdAt.min === now.min
            }
            if (
                target?.id === message?.author?.id &&
                message.channelId !== ChannelIds.ACTION_LOG &&
                message.channelId !== ChannelIds.LOKAL_BOT_SPAM_DEV &&
                !message?.content?.includes('Laster data') &&
                !message?.content?.includes('Henter data') &&
                environment === 'prod' &&
                timeMatches()
            ) {
                const hasEmbed = message.embeds[0]?.data

                this.client.messageHelper.sendMessage(
                    actionLogId,
                    {
                        text: `**En melding fra ** *${message?.author?.username}* **ble slettet av** *${executor?.username}*. **Innhold**: '*${
                            hasEmbed ? 'Embedded melding:' : message?.content
                        }*'`,
                    },
                    { noMentions: true }
                )
                if (hasEmbed) {
                    const embed = EmbedUtils.createSimpleEmbed(hasEmbed.title || 'Mangler tittel', hasEmbed.description || 'Mangler beskrivelse')
                    if (hasEmbed.fields) embed.addFields(hasEmbed.fields)
                    this.client.messageHelper.sendMessage(actionLogId, { embed: embed })
                }
            }
        })

        /** For interactions (slash-commands and user-commands) */
        this.client.on('interactionCreate', (interaction: Interaction<CacheType>) => {
            MazariniBot.numCommands++
            this.commandRunner.checkForCommandInInteraction(interaction)
        })

        this.client.on('channelDelete', (channel: DMChannel | NonThreadGuildBasedChannel) => {
            const id = ChannelIds.ACTION_LOG
            this.client.messageHelper.sendMessage(id, { text: `Channel med ID ${channel.id} ble slettet` })
        })

        this.client.on('emojiCreate', (emoji: GuildEmoji) => {
            if (emoji.guild.id == ServerIds.MAZARINI) {
                this.client.database.registerEmojiStats(emoji.name, emoji.animated)
            }
            const id = ChannelIds.ACTION_LOG
            this.client.messageHelper.sendMessage(id, { text: `Emoji med navn ${emoji.name} ble lagt til` })
        })

        this.client.on('emojiDelete', (emoji: GuildEmoji) => {
            if (emoji.guild.id == ServerIds.MAZARINI) {
                this.client.database.registerEmojiRemoved(emoji.name)
            }
            const id = ChannelIds.ACTION_LOG
            this.client.messageHelper.sendMessage(id, { text: `Emoji med navn ${emoji.name} ble slettet` })
        })

        this.client.on('emojiUpdate', (oldEmoji: GuildEmoji, newEmoji: GuildEmoji) => {
            if (newEmoji.guild.id == ServerIds.MAZARINI) {
                this.client.database.registerEmojiUpdated(oldEmoji.name, newEmoji.name)
            }
            const id = ChannelIds.ACTION_LOG
            this.client.messageHelper.sendMessage(id, { text: `Emoji med navn ${oldEmoji.name} ble oppdatert` })
        })

        this.client.on('guildBanAdd', (ban: GuildBan) => {
            const id = ChannelIds.ACTION_LOG
            this.client.messageHelper.sendMessage(id, { text: `${ban.user.username} ble bannet pga ${ban?.reason}` })
        })

        this.client.on('guildCreate', (guild: Guild) => {
            this.client.messageHelper.sendLogMessage('Ukjent: on guildCreate. Wat dis do?')
        })

        this.client.on('guildMemberAdd', async (member: GuildMember) => {
            UserUtils.onAddedMember(member, this.client.messageHelper, this.client.database)
        })

        this.client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => {
            UserUtils.onMemberLeave(member, this.client.messageHelper)
        })

        this.client.on('userUpdate', function (oldUser: User | PartialUser, newUser: User) {
            UserUtils.onUserUpdate(oldUser, newUser, this.messageHelper)
        })

        //Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
        this.client.on('guildMemberUpdate', function (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
            UserUtils.onMemberUpdate(oldMember, newMember, this.messageHelper)
        })

        this.client.on('roleCreate', function (role: Role) {
            this.messageHelper.sendLogMessage('En ny rolle er opprettet: ' + role.name)
        })

        this.client.on('roleDelete', function (role: Role) {
            this.messageHelper.sendLogMessage('En rolle er slettet: ' + role.name)
        })

        this.client.on('messageReactionAdd', (messageReaction: MessageReaction, user: User) => {
            if (messageReaction.emoji instanceof GuildEmoji && messageReaction.emoji.guild.id == ServerIds.MAZARINI) {
                this.client.database.updateEmojiReactionCounter(messageReaction.emoji.name)
            }
        })

        this.client.on('messageReactionRemove', (messageReaction: MessageReaction, user: User) => {
            if (messageReaction.emoji instanceof GuildEmoji && messageReaction.emoji.guild.id == ServerIds.MAZARINI) {
                this.client.database.updateEmojiReactionCounter(messageReaction.emoji.name, true)
            }
        })

        this.client.on('messageUpdate', (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
            if (!newMessage.pinned && !oldMessage.pinned && !!newMessage.author && MessageUtils.isLegalChannel(newMessage.channelId)) {
                this.commandRunner.messageChecker.checkMessageForJokes(newMessage as Message, true)
            }
        })

        this.client.on('error', function (error: Error) {
            if (environment === 'dev') {
                if (error.message.toLowerCase().includes('load database'))
                    console.warn('Database could not be loaded. Check for trailing characters and reload')
            } else this.messageHelper.sendLogMessage('En feilmelding ble fanget opp. Error: \n ' + error)
        })
    }
}
