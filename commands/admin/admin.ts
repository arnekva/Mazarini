import { exec } from 'child_process'
import { randomUUID } from 'crypto'
import {
    ActionRowBuilder,
    ActivityType,
    APIInteractionGuildMember,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    GuildMember,
    ModalSubmitInteraction,
    TextChannel,
    User,
} from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { environment } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { ClientHelper } from '../../helpers/clientHelper'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import { dbPrefix, prefixList } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { DailyJobs } from '../../Jobs/dailyJobs'
import { WeeklyJobs } from '../../Jobs/weeklyJobs'
import { MazariniBot } from '../../main'
import { EmbedUtils } from '../../utils/embedUtils'
import { ChannelIds, MentionUtils } from '../../utils/mentionUtils'
import { TextUtils } from '../../utils/textUtils'
import { UserUtils } from '../../utils/userUtils'
import { DealOrNoDeal, DonDQuality } from '../games/dealOrNoDeal'
import { LootboxCommands } from '../store/lootboxCommands'

const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js')
// const { exec } = require('child_process')
// const { spawn } = require('node:child_process')
const pm2 = require('pm2')

interface IReward {
    type: RewardType
    chipsAmount?: number
    quality?: string
    reason: string
    hasClaimed: string[]
}

type RewardType = 'chest' | 'chips' | 'lootbox' | 'dealornodeal'

export class Admin extends AbstractCommands {
    private pendingRewards: Map<string, IReward>

    constructor(client: MazariniClient) {
        super(client)
        this.pendingRewards = new Map<string, IReward>()
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

    private replyToMsgAsBot(interaction: ChatInputCommandInteraction<CacheType>) {
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
                    .then((message) => {
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

    private translateActivityType(type: string): Exclude<ActivityType, ActivityType.Custom> {
        switch (type.toUpperCase()) {
            case 'COMPETING':
            case 'COM':
                return ActivityType.Competing
            case 'LIS':
            case 'LISTENING':
                return ActivityType.Listening
            case 'PLA':
            case 'PLAYING':
                return ActivityType.Playing
            case 'STR':
            case 'STREAMING':
                return ActivityType.Streaming
            case 'WAT':
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
    private handleLocking(interaction: ChatInputCommandInteraction<CacheType>) {
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

    private reward(interaction: ChatInputCommandInteraction<CacheType>) {
        const rewardType = interaction.options.getSubcommand() as RewardType
        const rewardId = randomUUID()
        const reason = interaction.options.get('reason')?.value as string
        const chips = interaction.options.get('chips')?.value as number
        const quality = interaction.options.get('quality')?.value as string
        const pendingReward: IReward = { type: rewardType, reason: reason, chipsAmount: chips, quality: quality, hasClaimed: new Array<string>() }
        const user = interaction.options.get('user')?.user
        if (user) return this.rewardUser(interaction, pendingReward, user)
        this.pendingRewards.set(rewardId, pendingReward)
        const reward = claimRewardBtn(rewardId, rewardType)
        const container = new SimpleContainer()
        const text = ComponentsHelper.createTextComponent()
        text.setContent('# Felles reward' + `\n### ${reason}`)
        container.addComponent(text, 'text')
        container.addComponent(reward, 'btn')
        this.messageHelper.replyToInteraction(interaction, '', undefined, [container.container])
    }

    private claimReward(interaction: ButtonInteraction<CacheType>) {
        const customId = interaction.customId.split(';')
        const userId = interaction.user.id
        if (!this.pendingRewards.has(customId[1])) {
            return this.messageHelper.replyToInteraction(interaction, 'Denne premien er ikke lenger gyldig.')
        }
        const pendingReward = this.pendingRewards.get(customId[1])
        if (pendingReward.hasClaimed?.includes(userId)) {
            return this.messageHelper.replyToInteraction(interaction, 'Du har allerede claimet denne premien', { ephemeral: true })
        }
        pendingReward.hasClaimed.push(userId)
        this.pendingRewards.set(customId[1], pendingReward)
        this.rewardUser(interaction, pendingReward, interaction.user)
    }

    private rewardUser(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, reward: IReward, user: User) {
        if (reward.type === 'chips') {
            this.rewardUserWithChips(interaction, reward, user)
        } else if (reward.type === 'dealornodeal') {
            this.rewardUserWithDealOrNoDeal(interaction, reward, user)
        } else if (['lootbox', 'chest'].includes(reward.type)) {
            this.rewardUserWithLootbox(interaction, reward, user)
        }
    }

    private async rewardUserWithChips(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, pendingReward: IReward, user: User) {
        const dbUser = await this.client.database.getUser(user.id)
        const awarded = this.client.bank.giveMoney(dbUser, pendingReward.chipsAmount)
        this.client.database.updateUser(dbUser)
        const text = `${MentionUtils.mentionUser(user.id)} har mottatt en reward på ${awarded} chips på grunn av *${pendingReward.reason}*`
        const embed = EmbedUtils.createSimpleEmbed('Reward', text)
        this.messageHelper.replyToInteraction(interaction, embed)
        this.messageHelper.sendLogMessage(
            `${user.username} har mottatt en reward på ${awarded} chips på grunn av *${pendingReward.reason}*. Kanal: ${MentionUtils.mentionChannel(
                interaction.channelId
            )}. `
        )
    }

    private rewardUserWithLootbox(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, pendingReward: IReward, user: User) {
        const isChest = pendingReward.type === 'chest'
        const lootButton = LootboxCommands.getLootRewardButton(user.id, pendingReward.quality, isChest)
        const text = `${MentionUtils.mentionUser(user.id)} har mottatt en reward på en ${pendingReward.quality} loot${
            isChest ? ' chest' : 'box'
        } på grunn av *${pendingReward.reason}*`
        const embed = EmbedUtils.createSimpleEmbed('Reward', text)
        this.messageHelper.replyToInteraction(interaction, embed, undefined, [lootButton])
        this.messageHelper.sendLogMessage(
            `${user.username} har mottatt en reward på en ${pendingReward.quality} loot${isChest ? ' chest' : 'box'} på grunn av *${
                pendingReward.reason
            }*. Kanal: ${MentionUtils.mentionChannel(interaction.channelId)}. `
        )
    }

    private async lootAutocomplete(interaction: AutocompleteInteraction<CacheType>, isChest: boolean = false) {
        const boxes = await this.client.database.getLootboxes()
        interaction.respond(
            boxes
                .filter((box) => LootboxCommands.lootboxIsValid(box))
                .map((box) => ({ name: `${TextUtils.capitalizeFirstLetter(box.name)} ${(isChest ? 2 : 1) * (box.price / 1000)}K`, value: box.name }))
        )
    }

    private dondAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
        interaction.respond([
            { name: 'Basic 10K', value: '10' },
            { name: 'Premium 20K', value: '20' },
            { name: 'Elite 50K', value: '50' },
        ])
    }

    private rewardUserWithDealOrNoDeal(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>, pendingReward: IReward, user: User) {
        const buttons = new ActionRowBuilder<ButtonBuilder>()
        const dondQuality = Number(pendingReward.quality) as DonDQuality
        const dond = DealOrNoDeal.getDealOrNoDealButton(user.id, dondQuality)
        buttons.addComponents(dond)
        const text = `${MentionUtils.mentionUser(user.id)} har mottatt en reward på en runde deal or no deal på grunn av *${pendingReward.reason}*`
        const embed = EmbedUtils.createSimpleEmbed('Reward', text)
        this.messageHelper.replyToInteraction(interaction, embed, undefined, [buttons])
        this.messageHelper.sendLogMessage(
            `${user.username} har mottatt en reward på en runde deal or no deal på grunn av *${pendingReward.reason}*. Kanal: ${MentionUtils.mentionChannel(
                interaction.channelId
            )}. `
        )
    }

    private async attemptRestart(interaction: ChatInputCommandInteraction<CacheType>) {
        this.client.cache.restartImpediments = []
        await this.client.onRestart()
        if ((this.client.cache.restartImpediments?.length ?? 0) > 0) {
            const msg = this.client.cache.restartImpediments.reduce((prev, item) => prev + item + '\n', '')
            await this.messageHelper.replyToInteraction(interaction, msg, {}, [forceRestartBtn])
        } else {
            this.restartBot(interaction)
        }
    }

    private async restartBot(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction instanceof ButtonInteraction) {
            interaction.message.edit({ components: [] })
            await this.client.onRestart() //has just been run in attemptRestart() if interaction is ChatInputCommandInteraction
        }
        ClientHelper.setDisplayNameMode(this.client, 'offline')
        await this.messageHelper.replyToInteraction(interaction, `Forsøker å restarte botten`)
        let restartMsg = `Restart trigget av ${interaction.user.username} i kanalen ${MentionUtils.mentionChannel(
            interaction.channelId
        )}. Henter data fra Git og restarter botten ...`
        const msg = await this.messageHelper.sendLogMessage(restartMsg)
        const commitId = await this.client.database.getBotData('commit-id')
        await exec(`git pull && pm2 restart mazarini -- --restartedForGit restartedForGit --${commitId}`, async (error, stdout) => {
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
    //TODO: Make a command that triggers this
    private async refreshBot() {
        await this.client.onRefresh()
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

    private delegateAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
        const cmd = interaction.options.getSubcommand()
        if (['lootbox', 'chest'].includes(cmd)) this.lootAutocomplete(interaction, cmd === 'chest')
        else if (cmd === 'dealornodeal') this.dondAutocomplete(interaction)
    }

    private updateBotSettings(interaction: ChatInputCommandInteraction<CacheType>) {
        this.buildSettingsModal(interaction)

        // this.messageHelper.replyToInteraction(interaction, embed)
    }
    static botSettingsId = 'botSettingsModal'
    private async buildSettingsModal(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            const modal = new ModalBuilder().setCustomId(Admin.botSettingsId).setTitle('Bot Innstillinger')

            const potValue = new TextInputBuilder()
                .setCustomId('potValue')
                // The label is the prompt the user sees for this input
                .setLabel('Deathroll Pot')
                .setPlaceholder(`Ja/Nei`)
                .setValue(`${this.client.cache.deathrollPot ?? 0}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)
            const firstActionRow = new ActionRowBuilder().addComponents(potValue)

            const oldStatus = await this.client.database.getBotData('status')
            const oldStatusType = await this.client.database.getBotData('statusType')

            const status = new TextInputBuilder()
                .setCustomId('status')
                // The label is the prompt the user sees for this input
                .setLabel('Status')
                .setPlaceholder(`statustekst`)
                .setValue(`${oldStatus}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)
            const secondActionRow = new ActionRowBuilder().addComponents(status)
            const statusType = new TextInputBuilder()
                .setCustomId('statusType')
                // The label is the prompt the user sees for this input
                .setLabel('WAT,LIS,PLA,STR,COM')
                .setPlaceholder(`WATCHING`)
                .setValue(`${oldStatusType}`)
                .setRequired(false)
                // Short means only a single line of text
                .setStyle(TextInputStyle.Short)

            const thirdActionRow = new ActionRowBuilder().addComponents(statusType)
            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow)
            await interaction.showModal(modal)
        }
    }

    private async handleBotSettingsModalDialog(modalInteraction: ModalSubmitInteraction) {
        const potValue = modalInteraction.fields.getTextInputValue('potValue')
        const status = modalInteraction.fields.getTextInputValue('status')
        const statusType = modalInteraction.fields.getTextInputValue('statusType')
        const actualStatusType: Exclude<ActivityType, ActivityType.Custom> = this.translateActivityType(statusType)
        if (potValue) {
            const potNum = Number(potValue)
            if (potNum && !isNaN(potNum) && potNum !== this.client.cache.deathrollPot) {
                this.client.database.saveDeathrollPot(potNum)
                this.client.cache.deathrollPot = potNum
                this.messageHelper.sendLogMessage(`Pot ble oppdatert av ${modalInteraction.user.username} til '${potNum}'`)
            }
        }
        if (status) {
            this.client.database.setBotData('status', status)
        }

        if (statusType) {
            const actualStatusType = this.translateActivityType(statusType)
            this.client.database.setBotData('statusType', actualStatusType)
        }
        const statusToUse = status || ((await this.client.database.getBotData('status')) as string)
        const statusTypeToUse = statusType
            ? actualStatusType
            : ((await this.client.database.getBotData('statusType')) as Exclude<ActivityType, ActivityType.Custom>)
        if (status || statusType) {
            ClientHelper.updatePresence(this.client, statusTypeToUse, statusToUse)
            this.messageHelper.sendLogMessage(
                `Bot status ble oppdatert av ${modalInteraction.user.username} til '${statusTypeToUse}' med teksten '${statusToUse}'`
            )
        }

        this.messageHelper.replyToInteraction(modalInteraction, 'Dine innstillinger er nå oppdatert', { ephemeral: true })
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
                        commandName: 'botinnstillinger',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.updateBotSettings(interaction)
                        },
                    },
                    {
                        commandName: 'lock',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleLocking(rawInteraction)
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
                            this.reward(rawInteraction)
                        },
                        autoCompleteCallback: (interaction: AutocompleteInteraction<CacheType>) => {
                            this.delegateAutocomplete(interaction)
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
                            this.attemptRestart(rawInteraction)
                        },
                    },
                    {
                        commandName: 'stopp',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.stopBot(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'ADMIN_FORCE_RESTART',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.restartBot(rawInteraction)
                        },
                    },
                    {
                        commandName: 'ADMIN_CLAIM_REWARD',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.claimReward(rawInteraction)
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
                    {
                        commandName: Admin.botSettingsId,
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.handleBotSettingsModalDialog(rawInteraction)
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

const forceRestartBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `ADMIN_FORCE_RESTART`,
        style: ButtonStyle.Primary,
        label: `Restart likevel`,
        disabled: false,
        type: 2,
    })
)

const claimRewardBtn = (rewardId: string, type: string) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: `ADMIN_CLAIM_REWARD;${rewardId};${type}`,
            style: ButtonStyle.Success,
            label: `Claim reward`,
            disabled: false,
            type: 2,
        })
    )
