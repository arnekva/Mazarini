import {
    ActionRowBuilder,
    ActionRowData,
    APIActionRowComponent,
    APIEmbedField,
    APIMessageActionRowComponent,
    ButtonBuilder,
    ButtonInteraction,
    CacheType,
    ChannelType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    JSONEncodable,
    Message,
    ModalSubmitInteraction,
    RepliableInteraction,
    RestOrArray,
    SelectMenuBuilder,
    SelectMenuInteraction,
    TextChannel,
    User,
} from 'discord.js'
import { environment } from '../client-env'
import { MazariniClient } from '../main'
import { ArrayUtils } from '../utils/arrayUtils'
import { CollectorUtils } from '../utils/collectorUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { textArrays } from '../utils/textArrays'
import { UserUtils } from '../utils/userUtils'

export type typeOfError = 'unauthorized' | 'error' | 'warning'
export type thumbsReact = 'up' | 'down'

interface DMParams {
    userID?: string
    username?: string
}
export class MessageHelper {
    private client: Client
    botSupport = '863038817794392106'
    constructor(client: Client) {
        this.client = client
    }

    /**
     * Reply to an interaction. Will only reply if it haven't been answered already. If the reply throws an error it will send a message instead of a reply
     * @param interaction
     * @param content   The content to be sent. Can be a string or an embeded message
     * @param onlyVisibleToEngager Sets the message as ephemeral, i.e. only the engager can see it. This means that the message can be dismissed and is not saved on Discord servers
     * @param wasDefered Set to true if the interaction has been defered (i.e. paused while thinking). Defered interactions requires to be replied with editReply() instead of reply()
     * @returns True if reply is sent, false if not
     */
    async replyToInteraction(
        interaction:
            | ChatInputCommandInteraction<CacheType>
            | ModalSubmitInteraction<CacheType>
            | SelectMenuInteraction<CacheType>
            | ButtonInteraction<CacheType>
            | RepliableInteraction<CacheType>,
        content: string | EmbedBuilder,
        onlyVisibleToEngager?: boolean,
        wasDefered?: boolean,
        menu?: ActionRowBuilder<SelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
    ): Promise<boolean> {
        const handleError = async (e: any) => {
            let msg: Message<boolean> | undefined
            if (typeof content === 'object') msg = await this.sendFormattedMessage(interaction?.channelId, content)
            else msg = await this.sendMessage(interaction?.channelId, `${MentionUtils.mentionUser(interaction.user.id)} ${content}`)

            let msgInfo = msg ? `Sendte en separat melding i stedet for interaksjonssvar.` : `Klarte heller ikke sende separat melding som svar`
            if (environment !== 'dev') {
                this.sendMessageToActionLog(
                    `Klarte ikke svare på en interaction. ${interaction.user.username} prøvde å bruke ${
                        interaction.isChatInputCommand() ? interaction.commandName : '<ikke command>'
                    } i kanalen ${MentionUtils.mentionChannel(interaction?.channelId)}. \n${msgInfo}`
                )
            }
        }
        if (!interaction.replied) {
            if (typeof content === 'object') {
                if (wasDefered) await interaction.editReply({ embeds: [content], components: menu ? [menu] : undefined }).catch((e) => handleError(e))
                else
                    await interaction
                        .reply({ embeds: [content], ephemeral: onlyVisibleToEngager, components: menu ? [menu] : undefined })
                        .catch((e) => handleError(e))
            } else {
                if (wasDefered) await interaction.editReply(content).catch((e) => handleError(e))
                else
                    await interaction
                        .reply({ content: content, ephemeral: onlyVisibleToEngager, components: menu ? [menu] : undefined })
                        .catch((e) => handleError(e))
            }
            MazariniClient.numMessagesFromBot++
            return true
        }
        return false
    }

    replyToInteractionWithSelectMenu(
        interaction: ChatInputCommandInteraction<CacheType> | ModalSubmitInteraction<CacheType>,
        content: ActionRowBuilder<SelectMenuBuilder>
    ) {
        interaction.reply({ content: 'Pong!', components: [content] })
    }

    /** Sends a message and returns the sent message (as a promise) */
    sendMessage(channelId: string, message: string, noMentions?: boolean) {
        if (!this.checkForEmptyMessage(message)) {
            return this.logEmptyMessage('En melding som ble forsøkt sendt var tom', channelId)
        }

        const channel = this.findChannelById(channelId) as TextChannel
        let msg: Message | undefined
        if (channel && channel.permissionsFor(UserUtils.findMemberByUserID(MentionUtils.User_IDs.BOT_HOIE, channel.guild)).toArray().includes('SendMessages')) {
            if (message.length >= 2000) {
                const msgArr = message.match(/[\s\S]{1,1800}/g)
                msgArr.forEach((msg, ind) => {
                    channel.send(msg)
                })
                return undefined
            } else {
                if (noMentions) {
                    channel.send({
                        content: message,
                        options: {
                            allowedMentions: {
                                roles: [],
                                users: [],
                                repliedUser: true,
                            },
                        },
                    })
                }
                return channel.send({
                    content: message,
                })
            }
        }
        return undefined
    }

    checkForEmptyMessage(s: string) {
        return !!s.trim()
    }

    sendDM(user: User, message: string) {
        if (!this.checkForEmptyMessage(message)) {
            return undefined
        }
        user.send(message)
    }

    reactWithThumbs(message: Message, reaction: thumbsReact) {
        message.react(reaction === 'up' ? '👍' : '👎')
    }

    reactWithCheckmark(message: Message) {
        message.react('✅')
    }

    findChannelById(id: string) {
        return this.client.channels.cache.find((c) => c.id === id)
    }

    reactWithRandomEmoji(message: Message) {
        message.react(ArrayUtils.randomChoiceFromArray(textArrays.emojiesList))
    }

    /** Reply to a given message */
    replyToMessage(message: Message, content: string) {
        message.reply(content)
    }

    async findMessageById(id: string, onErr?: () => void): Promise<Message<boolean> | undefined> {
        const allChannels = [...this.client.channels.cache.values()].filter((channel) => channel instanceof TextChannel) as TextChannel[]
        let messageToReturn

        for (const channel of allChannels) {
            if (
                channel &&
                channel.permissionsFor(UserUtils.findMemberByUserID(MentionUtils.User_IDs.BOT_HOIE, channel.guild)).toArray().includes('SendMessages')
            ) {
                await channel.messages
                    .fetch(id)
                    .then(async (message) => {
                        messageToReturn = message
                    })
                    .catch((error) => {
                        if (onErr) onErr()
                    })
            }
        }
        return messageToReturn
    }

    /** Send an embed message */
    async sendFormattedMessage(channel: TextChannel | string, newMessage: EmbedBuilder) {
        if (typeof channel === 'string') {
            const textCh = this.findChannelById(channel) as TextChannel
            if (textCh) return textCh.send({ embeds: [newMessage] })
        } else return channel.send({ embeds: [newMessage] })
        return undefined
    }
    async sendMessageWithComponents(
        channelID: string,
        components: (
            | APIActionRowComponent<APIMessageActionRowComponent>
            | JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
            | ActionRowData<any>
            | ActionRowBuilder<ButtonBuilder>
        )[]
    ) {
        const textCh = this.findChannelById(channelID) as TextChannel
        if (textCh) return textCh.send({ components: components })
        return undefined
    }

    sendMessageToActionLog(msg: string) {
        const errorChannel = this.client.channels.cache.get('810832760364859432') as TextChannel
        MazariniClient.numMessagesNumErrorMessages++
        return errorChannel.send(msg)
    }
    sendFormattedMessageToActionLog(title: string, description: string, msg?: RestOrArray<APIEmbedField>) {
        const embed = new EmbedBuilder().setTitle(`${title}`).setDescription(`${description}`)
        if (msg) embed.addFields(...msg)
        const errorChannel = this.client.channels.cache.get('810832760364859432') as TextChannel
        this.sendFormattedMessage(errorChannel, embed)
        MazariniClient.numMessagesNumErrorMessages++
    }

    logEmptyMessage(errorMessageToSend: string, channelId: string) {
        const errorChannel = this.client.channels.cache.get('810832760364859432') as TextChannel
        const replyChannel = this.client.channels.cache.get(channelId)
        errorChannel.send(
            `En tom melding ble forsøkt sendt. Forsøkte å sende til channel-ID ${channelId}. Channel-object er: ${
                replyChannel ? replyChannel.toString() : 'ingen'
            }.`
        )
        MazariniClient.numMessagesNumErrorMessages++
        if (replyChannel && replyChannel.type === ChannelType.GuildText)
            return replyChannel.send(`${errorMessageToSend} ${MentionUtils.mentionRole(MentionUtils.ROLE_IDs.BOT_SUPPORT)}`)
        return undefined
    }

    async sendMessageToActionLogWithDefaultMessage(message: Message, error: any) {
        // if (!ignoreReply) message.reply(`En feil har oppstått. Feilkoden og meldingen din blir logget. <@&${this.botSupport}>`)
        const replyMsg = await message.reply(`En feil har oppstått. Feilkoden og meldingen din blir logget. (Reager med tommel opp for å tagge Bot-support)`)
        this.reactWithThumbs(replyMsg, 'up')
        const collector = replyMsg.createReactionCollector()
        collector.on('collect', (reaction) => {
            if (CollectorUtils.shouldStopCollector(reaction, message)) collector.stop()

            if (reaction.emoji.name === '👍' && reaction.users.cache.find((u) => u.username === message.author.username)) {
                replyMsg.edit(`En feil har oppstått. Feilkoden og meldingen din blir logget.  ${MentionUtils.mentionRole(MentionUtils.ROLE_IDs.BOT_SUPPORT)}`)
                collector.stop()
            }
        })
        const errorChannel = message.channel.client.channels.cache.get('810832760364859432') as TextChannel
        errorChannel.send(
            `En feil har oppstått i en melding fra ${message.author.username}. Meldingsinnhold: <${message.content}>. Channel: ${message.channel}. Feilmelding: <${error}>`
        )
        MazariniClient.numMessagesNumErrorMessages++
    }

    async sendMessageToActionLogWithCustomMessage(message: Message, error: any, reply: string, includeSupportTag?: boolean) {
        const replyMsg = await message.reply(`${reply} ${includeSupportTag ? '(Reager med tommel opp for å tagge Bot-support)' : ''}`)
        this.reactWithThumbs(replyMsg, 'up')
        const collector = replyMsg.createReactionCollector()
        collector.on('collect', (reaction) => {
            if (CollectorUtils.shouldStopCollector(reaction, message)) collector.stop()

            if (reaction.emoji.name === '👍' && reaction.users.cache.find((u) => u.username === message.author.username)) {
                replyMsg.edit(`${reply} ${includeSupportTag ? MentionUtils.mentionRole(MentionUtils.ROLE_IDs.BOT_SUPPORT) : ''}`)
                collector.stop()
            }
        })
        const errorChannel = message.channel.client.channels.cache.get('810832760364859432') as TextChannel
        errorChannel.send(
            `En feil har oppstått i en melding fra ${message.author.username}. Meldingsinnhold: <${message.content}>. Channel: ${message.channel}. Feilmelding: <${error}>`
        )
        MazariniClient.numMessagesNumErrorMessages++
    }

    sendMessageToActionLogWithInsufficientRightsMessage(message: Message, extra?: any, ignoreReply?: boolean) {
        message.reply(`Du har ikke de nødvendige rettighetene for å bruke denne funksjonen. ${MentionUtils.mentionRole(MentionUtils.ROLE_IDs.BOT_SUPPORT)}`)
        const errorChannel = message.channel.client.channels.cache.get('810832760364859432') as TextChannel
        errorChannel.send(
            `${message.author.username} forsøkte å bruke en funksjon uten rettigheter. Meldingsinnhold: <${message.content}>. Channel: ${message.channel}. ${extra}`
        )
        MazariniClient.numMessagesNumErrorMessages++
    }

    sendMessageToBotUtvikling(channel: TextChannel, message: string) {
        const errorChannel = channel.client.channels.cache.get('802716150484041751') as TextChannel
        errorChannel.send(message)
    }

    /** Removes all embeds for a specific message */
    suppressEmbeds(message: Message) {
        message.suppressEmbeds(true)
    }
}
