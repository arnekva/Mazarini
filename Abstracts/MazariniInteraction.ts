import {
    AutocompleteInteraction,
    ButtonInteraction,
    CacheType,
    ChatInputCommandInteraction,
    GuildMember,
    Interaction,
    ModalSubmitInteraction,
    SelectMenuInteraction,
    StringSelectMenuInteraction,
    User,
} from 'discord.js'
import { MentionUtils } from '../utils/mentionUtils'

// Extend discord.js types with Mazarini specific helper functions and properties
declare module 'discord.js' {
    interface ChatInputCommandInteraction {
        userPrettyPrint(): string
        readonly authorName: string
    }
    interface User {
        /** Get the mention string for this user (based on current user id) */
        readonly mention: string
    }
    interface ButtonInteraction {
        userPrettyPrint(): string
        /** Get the name of the user (member display name > user display name > global name > username) */
        readonly properName: string
    }
}

ChatInputCommandInteraction.prototype.userPrettyPrint = function () {
    return `not implemented yet`
}

Object.defineProperty(ChatInputCommandInteraction.prototype, 'authorName', {
    get: function () {
        const u = this.user as User
        const m = this.member as GuildMember

        return m?.nickname || u.displayName || u.globalName || u.username
    },
    enumerable: false,
    configurable: true,
})
Object.defineProperty(User.prototype, 'mention', {
    get: function () {
        return `${MentionUtils.mentionUser(this.id)}`
    },
    enumerable: false,
    configurable: true,
})

// Define MazariniInteraction types
export type BaseInteraction = Interaction<CacheType>
export type ChatInteraction = ChatInputCommandInteraction<CacheType>
export type BtnInteraction = ButtonInteraction<CacheType>
export type ATCInteraction = AutocompleteInteraction<CacheType>
export type ModalInteraction = ModalSubmitInteraction<CacheType>
export type MenuSelectInteraction = SelectMenuInteraction<CacheType>
export type SelectStringInteraction = StringSelectMenuInteraction<CacheType>
