import {
    ActionRowBuilder,
    ActionRowData,
    APIActionRowComponent,
    APIAttachment,
    APIMessageActionRowComponent,
    Attachment,
    AttachmentBuilder,
    AttachmentPayload,
    BitFieldResolvable,
    BufferResolvable,
    ButtonBuilder,
    ButtonInteraction,
    CacheType,
    ChannelType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    InteractionEditReplyOptions,
    InteractionReplyOptions,
    JSONEncodable,
    Message,
    MessageActionRowComponentBuilder,
    MessageActionRowComponentData,
    MessageCreateOptions,
    MessageFlags,
    MessageFlagsString,
    ModalSubmitInteraction,
    RepliableInteraction,
    SelectMenuBuilder,
    SelectMenuInteraction,
    TextChannel,
    User,
} from 'discord.js'
import { Stream } from 'stream'
import { environment } from '../client-env'
import { MazariniBot } from '../main'
import { ArrayUtils } from '../utils/arrayUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { textArrays } from '../utils/textArrays'
import { UserUtils } from '../utils/userUtils'

export type typeOfError = 'unauthorized' | 'error' | 'warning'
export type thumbsReact = 'up' | 'down'

interface DMParams {
    userID?: string
    username?: string
}

interface IMessageOptions {
    /** Set this to true to be able to mention users without notifying them */
    noMentions?: boolean
    /** Settings this to true will send the message without users getting a sound notification. A new message icon (circle) will still appear */
    sendAsSilent?: boolean
    /** This will allow you to send links without an embed preview automatically showing. */
    supressEmbeds?: boolean
    /** This will make the message NOT count towards MazariniClient.numMessagesFromBot. Used when e.g. it's an error message being sent, as this increments numErrorMessages instead */
    dontIncrementMessageCounter?: boolean
}
interface IInteractionOptions {
    /** Make the reply only visible to the engager */
    ephemeral?: boolean
    /** If the interaction has been defered, this option MUST be set for the reply to work. This will edit the reply instead of attempting to send a new answer */
    hasBeenDefered?: boolean
}

type MessageCompontent = (
    | JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
    | ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>
    | APIActionRowComponent<APIMessageActionRowComponent>
)[]

type MessageFiles = (BufferResolvable | Stream | JSONEncodable<APIAttachment> | Attachment | AttachmentBuilder | AttachmentPayload)[]

export class MessageHelper {
    private client: Client
    botSupport = '863038817794392106'
    constructor(client: Client) {
        this.client = client
    }

    /**
     * The best way to reply to an interaction. If the wait time is longer than 3 seconds, it must be defered first with interaction.deferReply(). If defered, please add the the option param for it, otherwise it will throw an error
     * @param interaction The interaction to reply to.
     * @param messageContent The content to send. Can be a string or an embed
     * @param options Options for the message - if message has been defered, it must be set in this
     * @param components Components to send, i.e. action rows
     * @param files Any files to attach to the message. Use the AttachmentBuilder for this. I.e. ```new AttachmentBuilder("https://placeholder.com/square120x120.png", {name: "square.png"})```
     * @returns True if the message was sent succesfully, false if an error occured.
     */
    async replyToInteraction(
        interaction:
            | ChatInputCommandInteraction<CacheType>
            | ModalSubmitInteraction<CacheType>
            | SelectMenuInteraction<CacheType>
            | ButtonInteraction<CacheType>
            | RepliableInteraction<CacheType>,
        messageContent: string | EmbedBuilder,
        options?: IInteractionOptions,
        components?: MessageCompontent,
        files?: MessageFiles
    ): Promise<boolean> {
        const handleError = async (e: any) => {
            let msg: Message<boolean> | undefined
            if (options?.ephemeral) {
                this.sendDM(interaction.user, messageContent)
            } else {
                if (typeof messageContent === 'object') msg = await this.sendFormattedMessage(interaction?.channelId, messageContent)
                else msg = await this.sendMessage(interaction?.channelId, `${MentionUtils.mentionUser(interaction.user.id)} ${messageContent}`)
            }

            let msgInfo = msg
                ? `Sendte en ${options?.ephemeral ? 'DM' : 'separat melding'} i stedet for interaksjonssvar.`
                : `Klarte heller ikke sende separat melding som svar`
            if (options?.ephemeral) msgInfo += `\nMelding var ephemeral, men ble sendt public.`
            if (environment !== 'dev') {
                let commandName: string | undefined = undefined
                if (interaction.isChatInputCommand()) commandName = interaction.commandName
                else if (interaction.isButton()) commandName = interaction.customId
                else if (interaction.isAnySelectMenu()) commandName = interaction.customId
                else if (interaction.isModalSubmit()) commandName = interaction.customId
                this.sendLogMessage(
                    `${interaction.user.username} prøvde å bruke ${
                        commandName ? commandName : '<MANGLER CASE FOR DENNE TYPE COMMAND>'
                    } i kanalen ${MentionUtils.mentionChannel(interaction?.channelId)}, men den feilet. ${msgInfo}`
                )
            }
            return false
        }
        if (!interaction.replied) {
            const payload: InteractionEditReplyOptions = {}

            payload.components = components
            payload.files = files

            if (typeof messageContent === 'object') {
                payload.embeds = [messageContent]
            } else {
                payload.content = messageContent
            }
            if (options?.hasBeenDefered) {
                await interaction.editReply(payload).catch((e) => handleError(e))
            } else {
                const payloadAsReply = payload as InteractionReplyOptions
                payloadAsReply.ephemeral = !!options?.ephemeral
                await interaction.reply(payloadAsReply).catch((e) => handleError(e))
            }
            MazariniBot.numMessagesFromBot++
            return true
        }
        return false
    }
    /** @deprecated Use sendMessage */
    replyToInteractionWithSelectMenu(
        interaction: ChatInputCommandInteraction<CacheType> | ModalSubmitInteraction<CacheType>,
        content: ActionRowBuilder<SelectMenuBuilder>
    ) {
        interaction.reply({ content: 'Pong!', components: [content] })
    }

    /** Sends a message and returns the sent message (as a promise) */
    sendMessage(channelId: string, message: string, options?: IMessageOptions) {
        if (!this.checkForEmptyMessage(message)) {
            return this.sendLogMessageEmptyMessage('En melding som ble forsøkt sendt var tom', channelId)
        }

        const channel = this.findChannelById(channelId) as TextChannel
        let msg: Message | undefined
        if (channel && channel.permissionsFor(UserUtils.findMemberByUserID(MentionUtils.User_IDs.BOT_HOIE, channel.guild)).toArray().includes('SendMessages')) {
            if (message.length >= 2000) {
                const msgArr = message.match(/[\s\S]{1,1800}/g)
                msgArr.forEach((msg, ind) => {
                    if (!options?.dontIncrementMessageCounter) MazariniBot.numMessagesFromBot++
                    channel.send(msg)
                })
                return undefined
            } else {
                const messageOptions = { content: message } as MessageCreateOptions
                if (options?.noMentions) {
                    messageOptions.allowedMentions = {
                        roles: [],
                        users: [],
                        repliedUser: true,
                    }
                }
                const flags = [] as BitFieldResolvable<
                    Extract<MessageFlagsString, 'SuppressEmbeds' | 'SuppressNotifications'>,
                    MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications
                >[]

                if (options?.sendAsSilent) {
                    flags.push('SuppressNotifications')
                }
                if (options?.supressEmbeds) {
                    flags.push('SuppressEmbeds')
                }
                messageOptions.flags = flags
                if (!options?.dontIncrementMessageCounter) MazariniBot.numMessagesFromBot++
                return channel.send(messageOptions)
            }
        }
        return undefined
    }

    checkForEmptyMessage(s: string) {
        return !!s.trim()
    }

    sendDM(user: User, message: string | EmbedBuilder) {
        if (typeof message === 'object') {
            message.addFields({
                name: 'Usynlig',
                value: 'Du brukte en interaction, men botten klarte ikke svare på den. Siden svaret skulle vært usynlig får du en DM heller',
            })
            user.send({
                embeds: [message],
            })
        } else {
            message += `\n\nDu brukte en interaction, men botten klarte ikke svare på den. Siden svaret skulle vært usynlig får du en DM heller`
            user.send({
                content: message,
            })
        }
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
    replyToMessage(message: Message, content: string, options?: IMessageOptions) {
        const flags = [] as BitFieldResolvable<
            Extract<MessageFlagsString, 'SuppressEmbeds' | 'SuppressNotifications'>,
            MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications
        >[]
        const messageOptions = { content: content } as MessageCreateOptions
        if (options?.noMentions) {
            messageOptions.allowedMentions = {
                roles: [],
                users: [],
                repliedUser: true,
            }
        }
        if (options?.sendAsSilent) {
            flags.push('SuppressNotifications')
        }
        if (options?.supressEmbeds) {
            flags.push('SuppressEmbeds')
        }
        messageOptions.flags = flags
        message.reply(messageOptions)
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

    /** TODO: Merge this with sendMessage */
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
        if (textCh && components) return textCh.send({ components: components })
        return undefined
    }

    async sendMessageWithContentAndComponents(
        channelID: string,
        content: string | EmbedBuilder,
        components: (
            | APIActionRowComponent<APIMessageActionRowComponent>
            | JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
            | ActionRowData<any>
            | ActionRowBuilder<ButtonBuilder>
        )[]
    ) {
        const textCh = this.findChannelById(channelID) as TextChannel

        if (textCh) {
            if (content instanceof EmbedBuilder) {
                return textCh.send({ embeds: [content], components: components })
            } else {
                return textCh.send({ content: content, components: components })
            }
        }
        return undefined
    }
    /** @deprecated Use sendMessage */
    async sendMessageWithEmbedAndComponents(
        channelID: string,
        embed: EmbedBuilder,
        components: (
            | APIActionRowComponent<APIMessageActionRowComponent>
            | JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
            | ActionRowData<any>
            | ActionRowBuilder<ButtonBuilder>
            | ActionRowBuilder<SelectMenuBuilder>
        )[]
    ) {
        const textCh = this.findChannelById(channelID) as TextChannel
        if (textCh) return textCh.send({ embeds: [embed], components: components })
        return undefined
    }

    sendLogMessage(msg: string, options?: IMessageOptions) {
        MazariniBot.numMessagesNumErrorMessages++
        options ? (options.dontIncrementMessageCounter = true) : (options = { dontIncrementMessageCounter: true })
        return this.sendMessage(MentionUtils.CHANNEL_IDs.ACTION_LOG, msg, options)
    }
    sendGitLogMessage(msg: string, options?: IMessageOptions) {
        MazariniBot.numMessagesNumErrorMessages++
        options ? (options.dontIncrementMessageCounter = true) : (options = { dontIncrementMessageCounter: true })
        return this.sendMessage(MentionUtils.CHANNEL_IDs.GIT_LOG, msg, options)
    }

    /** @deprecated Log that an empty message was attempted sent by the bot */
    sendLogMessageEmptyMessage(errorMessageToSend: string, channelId: string) {
        const errorChannel = this.client.channels.cache.get(MentionUtils.CHANNEL_IDs.ACTION_LOG) as TextChannel
        const replyChannel = this.client.channels.cache.get(channelId)
        errorChannel.send(
            `En tom melding ble forsøkt sendt. Forsøkte å sende til channel-ID ${channelId}. Channel-object er: ${
                replyChannel ? replyChannel.toString() : 'ingen'
            }.`
        )
        MazariniBot.numMessagesNumErrorMessages++
        if (replyChannel && replyChannel.type === ChannelType.GuildText)
            return replyChannel.send(`${errorMessageToSend} ${MentionUtils.mentionRole(MentionUtils.ROLE_IDs.BOT_SUPPORT)}`)
        return undefined
    }

    sendMessageToBotUtvikling(channel: TextChannel, message: string) {
        const errorChannel = channel.client.channels.cache.get('802716150484041751') as TextChannel
        errorChannel.send(message)
    }

    /** Removes all embeds for a specific message */
    suppressEmbeds(message: Message) {
        message.suppressEmbeds(true)
    }

    //TODO: Refactor this
    get msgClient() {
        return this.client
    }
}
