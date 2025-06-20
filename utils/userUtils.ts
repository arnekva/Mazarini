import {
    AuditLogEvent,
    CacheType,
    ChatInputCommandInteraction,
    Guild,
    GuildMember,
    Interaction,
    Message,
    PartialGuildMember,
    PartialUser,
    Role,
    ThreadMember,
    User,
} from 'discord.js'
import { MazariniClient } from '../client/MazariniClient'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'

export namespace UserUtils {
    /**
     * Get a Member object by supplying a user id
     * @param userId User ID of Member
     * @param searchable needed to find the guild
     * @returns Member Object (undefined if none)
     */
    export const findMemberByUserID = (userId: string, searchable: Message | Interaction<CacheType> | Guild) => {
        return searchable instanceof Guild
            ? searchable?.members?.cache.find((m) => m.id === userId)
            : searchable.guild?.members?.cache.find((m) => m.id === userId)
    }

    /**
     * Get a user object by supplying a username
     * @param username Username of user
     * @param rawMessage needed to find the guild
     * @returns User object or undefined
     */
    export const findUserByUsername = (username: string, rawMessage: Message | ChatInputCommandInteraction) => {
        return rawMessage.client.users.cache.find((user) => user.username == username)
    }

    /**
     * Get a user object by supplying a user id
     * @param id User ID
     * @param rawMessage needed to find the guild
     * @returns User object or undefined
     */
    export const findUserById = (id: string, searchable: Message | Interaction<CacheType> | MazariniClient) => {
        return searchable instanceof MazariniClient
            ? searchable.users?.cache.find((m) => m.id === id)
            : searchable.guild?.client?.users?.cache.find((m) => m.id === id)
    }

    /**
     * Get a Member object from a username
     * @param username Username of user
     * @param rawMessage needed to find the guild
     * @returns Member object or undefined
     */
    export const findMemberByUsername = (username: string, rawMessage: Message | ChatInputCommandInteraction) => {
        const user = UserUtils.findUserByUsername(username, rawMessage)
        if (user) return UserUtils.findMemberByUserID(user.id, rawMessage)
        return undefined
    }

    export const findMembersByDisplayNames = (displayNames: string[], rawMessage: Message | ChatInputCommandInteraction) => {
        const allIds = rawMessage.client.users.cache.map((u) => u.id)
        const matches: GuildMember[] = []

        allIds.forEach((id) => {
            const member = UserUtils.findMemberByUserID(id, rawMessage)
            if (!member) return
            if (
                displayNames.includes(member.nickname ?? '') ||
                displayNames.includes(member.displayName ?? '') ||
                displayNames.includes(member.user.globalName ?? '') ||
                displayNames.includes(member.user.username ?? '')
            ) {
                matches.push(member)
            }
        })

        return matches
    }

    export const compareMember = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
        if (newMember.id === '802945796457758760') return '' //Ikke gjør noe når bot oppdateres
        if (oldMember.id === '802945796457758760') return ''

        const role = roleArraysEqual([...oldMember.roles.cache.values()], [...newMember.roles.cache.values()])
        if (role) {
            return 'role: ' + role.name
        }
        if (oldMember.nickname !== newMember.nickname)
            return 'nickname: ' + (oldMember.nickname ?? oldMember.displayName) + ' endret til ' + (newMember.nickname ?? newMember.displayName)
        if (oldMember.user.username !== newMember.user.username) return 'username'

        if (oldMember?.isCommunicationDisabled() !== newMember?.isCommunicationDisabled()) {
            const fetchedLogs = await oldMember?.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberUpdate,
            })

            const logs = fetchedLogs.entries.find((log) => log.target.id === newMember.id)
            let reason = ''
            let performedBy = ''
            if (logs) {
                reason = logs.reason
                performedBy = logs.executor.username
            }

            const date = newMember?.communicationDisabledUntil ?? new Date()
            return `Timeout ${
                newMember?.isCommunicationDisabled()
                    ? `${date.getDate()}.${date.getMonth()}.${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`
                    : 'er ferdig'
            } (satt av ${performedBy ?? 'ukjent'}, grunn: *${reason ?? 'ukjent'}*)`
        }
        if (oldMember.nickname !== newMember.nickname) return 'nickname'

        return ''
    }

    export const roleArraysEqual = (a: any[], b: any[]) => {
        if (a === b) return undefined
        if (a == null || b == null) return undefined

        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) {
                if (a.length > b.length) return a[i] as Role
                else return b[i] as Role
            }
        }
        return undefined
    }

    export const onAddedMember = async (member: GuildMember, msgHelper: MessageHelper, dbHelper: DatabaseHelper) => {
        await msgHelper.sendMessage('340626855990132747', {
            text: 'Welcome to the Gulag, ' + (member.nickname ?? member.displayName) + '. Bruk commanden "/role" for å gi deg selv roller for å komme i gang',
        })
        await dbHelper.getUser(member.id)
        msgHelper.sendLogMessage('En bruker ble med i Mazarini: ' + (member.nickname ?? member.displayName))
    }

    export const onMemberLeave = (member: GuildMember | PartialGuildMember, msgHelper: MessageHelper) => {
        msgHelper.sendMessage('340626855990132747', { text: 'Farvell, ' + (member.nickname ?? member.displayName) })
        msgHelper.sendLogMessage('En bruker forlot Mazarini: ' + (member.nickname ?? member.displayName))
    }

    export const onUserUpdate = (oldUser: User | PartialUser, newUser: User | PartialUser, msgHelper: MessageHelper) => {
        if (oldUser.id === '802945796457758760') return

        const keyDifference = Object.fromEntries(Object.entries(newUser).filter(([k, v]) => oldUser[k] !== v))
        const keyDifferenceOld = Object.fromEntries(Object.entries(oldUser).filter(([k, v]) => newUser[k] !== v))
        const vals = Object.entries(keyDifference)
            .map(([key, value]) => `\n**${key}:** ${JSON.stringify(value)} \nGammel verdi:\n ${JSON.stringify(keyDifferenceOld[key])}`)
            .join(' ')

        msgHelper.sendLogMessage(
            'Oppdatert bruker:   ' +
                newUser.username +
                `. Følgende keys er oppdatert: ${Object.keys(keyDifference).join(', ')}. \nVerdier som er endret blir forsøkt sendt her: ${vals}`
        )
    }

    export const onMemberUpdate = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, msgHelper: MessageHelper) => {
        if (newMember.id === '802945796457758760') return //Ikke gjør noe når bot oppdateres
        if (oldMember.id === '802945796457758760') return
        if (oldMember.user.username === 'MazariniBot') return

        if (oldMember.id === '802945796457758760') return

        const keyDifference = Object.fromEntries(Object.entries(newMember).filter(([k, v]) => oldMember[k] !== v))
        const keyDifferenceOld = Object.fromEntries(Object.entries(oldMember).filter(([k, v]) => newMember[k] !== v))
        const vals = Object.entries(keyDifference)
            .map(([key, value]) => `\n**${key}:** ${JSON.stringify(value)} \nGammel verdi:\n ${JSON.stringify(keyDifferenceOld[key])}`)
            .join(' ')

        msgHelper.sendLogMessage(
            'Oppdatert member:   ' +
                newMember.user.username +
                `. Følgende keys er oppdatert: ${Object.keys(keyDifference).join(', ')}. \nVerdier som er endret blir forsøkt sendt her: ${vals}`
        )
    }

    export const getPrettyName = (member: GuildMember | PartialGuildMember | ThreadMember) => {
        if (member instanceof ThreadMember) {
            return member.guildMember.nickname || member.guildMember.displayName || member.user.globalName || member.user.displayName || member.user.username
        } else return member.user.globalName || member.user.displayName || member.user.username
    }
}
