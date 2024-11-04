import { exec } from 'child_process'
import { ActivityType, APIInteractionGuildMember, CacheType, ChatInputCommandInteraction, GuildMember, ModalSubmitInteraction, TextChannel } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { environment } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { ClientHelper } from '../../helpers/clientHelper'
import { dbPrefix, prefixList } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { DailyJobs } from '../../Jobs/dailyJobs'
import { WeeklyJobs } from '../../Jobs/weeklyJobs'
import { MazariniBot } from '../../main'
import { EmbedUtils } from '../../utils/embedUtils'
import { ChannelIds, MentionUtils } from '../../utils/mentionUtils'
import { UserUtils } from '../../utils/userUtils'
import { LootboxCommands } from '../store/lootboxCommands'

const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js')
// const { exec } = require('child_process')
// const { spawn } = require('node:child_process')
const pm2 = require('pm2')

export class Admin extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async setSpecificValue(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const user = interaction.options.get('bruker')?.user
        const property = interaction.options.get('property')?.value as string | number
        const value = interaction.options.get('verdi')?.value
        const secondaryProperty = interaction.options.get('secondary')?.value as string | number

        //TODO: REFACTOR
        if (property === 'daily') {
            const dj = new DailyJobs(this.messageHelper, this.client)
            dj.runJobs()
            this.messageHelper.sendLogMessage(`Daily Jobs was forced to run by ${interaction.user.username}`)
        } else if (property === 'weekly') {
            const wj = new WeeklyJobs(this.messageHelper, this.client)
            wj.runJobs()
        } else {
            let logMsg = ''
            let hasAck = false

            //Double check that all where supplied in the interaction
            if (user && property && value) {
                const dbUser = await this.client.database.getUntypedUser(user.id)
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
                                    { ephemeral: true }
                                )
                            }
                        } else if (typeof prop === 'number') dbUser[property] = Number(value)
                        else dbUser[property] = value

                        this.client.database.updateUser(dbUser)
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
                if (environment === 'prod') this.messageHelper.sendLogMessage(logMsg)
            } else {
                this.messageHelper.replyToInteraction(interaction, `Alle nødvendige parametere ble ikke funnet. `, { ephemeral: true })
            }
        }
    }

    private async replyToMsgAsBot(interaction: ChatInputCommandInteraction<CacheType>) {
        this.messageHelper.replyToInteraction(interaction, `Svarer på meldingen hvis jeg finner den`, { ephemeral: true })

        const allChannels = [...this.client.channels.cache.values()].filter((channel) => channel instanceof TextChannel) as TextChannel[]

        const id = interaction.options.get('melding-id')?.value as string
        const replyString = interaction.options.get('tekst')?.value as string
        let hasFoundMsgOrThrewError = false
        allChannels.forEach((channel: TextChannel) => {
            if (
                channel &&
                channel.permissionsFor(UserUtils.findMemberByUserID(MentionUtils.User_IDs.BOT_HOIE, channel.guild)).toArray().includes('ReadMessageHistory')
            ) {
                channel.messages
                    .fetch(id)
                    .then(async (message) => {
                        if (message && message.id == id) {
                            message.reply(replyString)
                            this.messageHelper.sendLogMessage(
                                `${interaction.user.username} brukte */reply*, på en melding fra ${
                                    message.author.username
                                } i kanalen ${MentionUtils.mentionChannel(message.channelId)}`
                            )
                        }
                    })
                    .catch((error) => {
                        if (!hasFoundMsgOrThrewError && error.rawError.message !== 'Missing Access' && error.rawError.message !== 'Unknown Message') {
                            this.messageHelper.sendLogMessage(`${interaction.user.username} brukte */reply*, men meldingen ble ikke funnet`)
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
        this.client.database.setBotData('status', status)
        this.client.database.setBotData('statusType', activity)
        this.messageHelper.sendLogMessage(`Bottens aktivitet er satt til '${activityName}' med teksten '${status}' av ${interaction.user.username}. `)
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

    private async getBotStatistics(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const start = MazariniBot.startTime
        const numMessages = MazariniBot.numMessages
        const numMessagesFromBot = MazariniBot.numMessagesFromBot
        const numErrorMessages = MazariniBot.numMessagesNumErrorMessages
        const numCommands = MazariniBot.numCommands
        const storage = await this.client.database.getStorage()
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
            `\nAntall logger: ${numErrorMessages}` +
            `\nAntall servere tilkoblet: ${this.client.guilds.cache.size}` +
            `\nForrige oppdatering av storage: <t:${storage?.updateTimer}:R>` +
            `\nKjørt siden: <t:${moment(start).unix()}:R>`
        this.messageHelper.replyToInteraction(interaction, statsReply, { hasBeenDefered: true })
    }

    private async buildSendModal(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            const modal = new ModalBuilder().setCustomId(Admin.adminSendModalID).setTitle('Send melding som Høie')
            const today = new Date()
            const channelID = new TextInputBuilder()
                .setCustomId('channelID')
                // The label is the prompt the user sees for this input
                .setLabel('ID-en til kanalen meldingen skal sendes til')
                .setPlaceholder(`${interaction.channelId}`)
                .setValue(`${interaction.channelId}`)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)
            const scheduledDate = new TextInputBuilder()
                .setCustomId('scheduledDate')
                // The label is the prompt the user sees for this input
                .setLabel('Planlegg til senere (DD:MM:YYYY HH:mm)')
                .setPlaceholder(`${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()} ${today.getHours()}:${today.getMinutes()}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)

            const message = new TextInputBuilder()
                .setCustomId('messageInput')
                .setLabel('Melding')
                // Paragraph means multiple lines of text.
                .setStyle(TextInputStyle.Paragraph)

            const firstActionRow = new ActionRowBuilder().addComponents(channelID)
            const secondActionRow = new ActionRowBuilder().addComponents(message)
            const thirdActionRow = new ActionRowBuilder().addComponents(scheduledDate)
            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow)
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
            locked = !this.client.lockHandler.getbotLocked()
            this.client.lockHandler.setBotLocked(!this.client.lockHandler.getbotLocked())
        } else if (isChannel) {
            if (this.client.lockHandler.getlockedThread().includes(interaction?.channelId)) {
                this.client.lockHandler.removeThread(interaction?.channelId)
            } else this.client.lockHandler.setLockedThread(interaction?.channelId)
            locked = this.client.lockHandler.getlockedThread().includes(interaction?.channelId)
        } else if (isUser) {
            if (this.client.lockHandler.getlockedUser().includes(user?.id)) {
                this.client.lockHandler.removeUserLock(user.id)
            } else this.client.lockHandler.setLockedUser(user.id)
            locked = this.client.lockHandler.getlockedUser().includes(user?.id)
        }
        this.messageHelper.replyToInteraction(interaction, `${locked ? 'Låst' : 'Åpnet'}`)
    }

    private async rewardUserWithChips(interaction: ChatInputCommandInteraction<CacheType>) {
        const reason = interaction.options.get('reason')?.value as string
        let chips = interaction.options.get('chips')?.value as number
        const user = interaction.options.get('user')?.user
        const dbUser = await this.client.database.getUser(user.id)
        chips = this.client.bank.giveMoney(dbUser, chips)
        this.client.database.updateUser(dbUser)
        const text = `${MentionUtils.mentionUser(user.id)} har mottatt en reward på ${chips} chips på grunn av *${reason}*`
        const embed = EmbedUtils.createSimpleEmbed('Reward', text)
        this.messageHelper.replyToInteraction(interaction, embed)
        this.messageHelper.sendLogMessage(
            `${user.username} har mottatt en reward på ${chips} chips på grunn av *${reason}*. Kanal: ${MentionUtils.mentionChannel(interaction.channelId)}. `
        )
    }

    private async rewardUserWithLootbox(interaction: ChatInputCommandInteraction<CacheType>) {
        const reason = interaction.options.get('reason')?.value as string
        let quality = interaction.options.get('quality')?.value as string
        const user = interaction.options.get('user')?.user
        const lootButton = LootboxCommands.getDailyLootboxRewardButton(user.id, quality)
        const text = `${MentionUtils.mentionUser(user.id)} har mottatt en reward på en ${quality} lootbox på grunn av *${reason}*`
        const embed = EmbedUtils.createSimpleEmbed('Reward', text)
        this.messageHelper.replyToInteraction(interaction, embed, undefined, [lootButton])
        this.messageHelper.sendLogMessage(
            `${user.username} har mottatt en reward på en ${quality} lootbox på grunn av *${reason}*. Kanal: ${MentionUtils.mentionChannel(
                interaction.channelId
            )}. `
        )
    }

    private async restartBot(interaction: ChatInputCommandInteraction<CacheType>) {
        await this.messageHelper.replyToInteraction(interaction, `Forsøker å restarte botten`)
        let restartMsg = `Restart trigget av ${interaction.user.username} i kanalen ${MentionUtils.mentionChannel(
            interaction.channelId
        )}. Henter data fra Git og restarter botten ...`
        const msg = await this.messageHelper.sendLogMessage(restartMsg)
        const commitId = await this.client.database.getBotData('commit-id')
        await this.client.onRestart()
        await exec(`git pull && pm2 restart mazarini -- --restartedForGit restartedForGit --${commitId}`, async (error, stdout, stderr) => {
            if (error) {
                restartMsg += `\nKlarte ikke restarte: \n${error}`
                msg.edit(restartMsg)
            }
            if (stdout) {
                restartMsg += `\n* Hentet data fra git`
                await msg.edit(restartMsg)
            }
        })
    }

    private async stopBot(interaction: ChatInputCommandInteraction<CacheType>) {
        const text = interaction.options.get('env')?.value as string
        if (text === 'prod') {
            await this.messageHelper.sendLogMessage('Stanser bot i prod')
            pm2?.killDaemon()
            pm2?.disconnect()
        } else {
            await this.messageHelper.replyToInteraction(interaction, `Stopper lokale bot-er`)
            if (interaction.channelId == ChannelIds.LOKAL_BOT_SPAM_DEV) process.exit()
            else await this.messageHelper.replyToInteraction(interaction, `Denne kommandoen kan ikke brukes her`, { ephemeral: true })
        }
    }

    private handleAdminSendModalDialog(modalInteraction: ModalSubmitInteraction) {
        const chatID = modalInteraction.fields.getTextInputValue('channelID')
        const text = modalInteraction.fields.getTextInputValue('messageInput')
        const schedule = modalInteraction.fields.getTextInputValue('scheduledDate')
        const date = moment(schedule, 'DD-MM-YYYY HH:mm')
        if (schedule) {
            this.messageHelper.scheduleMessage(text, chatID, date)
            this.messageHelper.replyToInteraction(
                modalInteraction,
                `Meldingen *${text}* vil sendes til ${MentionUtils.mentionChannel(chatID)} ${date.toString()}`,
                {
                    ephemeral: true,
                }
            )
            this.messageHelper.sendLogMessage(
                `${modalInteraction.user.username} planla en melding til ${MentionUtils.mentionChannel(
                    chatID
                )} med innholdet '*${text}*', som vil sendes ${date.toString()}`
            )
        } else {
            this.messageHelper.sendMessage(chatID, { text: text })
            this.messageHelper.replyToInteraction(modalInteraction, `Meldingen *${text}* ble sent til ${MentionUtils.mentionChannel(chatID)}`, {
                ephemeral: true,
            })
            this.messageHelper.sendLogMessage(
                `${modalInteraction.user.username} sendte en melding som botten til kanalen ${MentionUtils.mentionChannel(chatID)} med innholdet '*${text}*'`
            )
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'send',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.buildSendModal(rawInteraction)

                            this.messageHelper.sendLogMessage(
                                `${rawInteraction.user.username} trigget 'send' fra ${MentionUtils.mentionChannel(rawInteraction?.channelId)}.`
                            )
                        },
                    },
                    {
                        commandName: 'lock',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleLocking(rawInteraction)
                        },
                    },
                    {
                        commandName: 'botstatus',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.setBotStatus(rawInteraction)
                        },
                    },
                    {
                        commandName: 'set',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.setSpecificValue(rawInteraction)
                        },
                    },
                    {
                        commandName: 'reward',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            const subCommand = rawInteraction.options.getSubcommand()
                            if (subCommand === 'chips') this.rewardUserWithChips(rawInteraction)
                            else if (subCommand === 'lootbox') this.rewardUserWithLootbox(rawInteraction)
                        },
                    },
                    {
                        commandName: 'botstats',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.getBotStatistics(rawInteraction)
                        },
                    },
                    {
                        commandName: 'reply',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.replyToMsgAsBot(rawInteraction)
                        },
                    },

                    {
                        commandName: 'restart',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.restartBot(rawInteraction)
                        },
                    },
                    {
                        commandName: 'stopp',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.stopBot(rawInteraction)
                        },
                    },
                ],
                modalInteractionCommands: [
                    {
                        commandName: Admin.adminSendModalID,
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.handleAdminSendModalDialog(rawInteraction)
                        },
                    },
                ],
            },
        }
    }

    static isAuthorAdmin(member: GuildMember | APIInteractionGuildMember | null | undefined) {
        if (environment === 'dev') return true
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
