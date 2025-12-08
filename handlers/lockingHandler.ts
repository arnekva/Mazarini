import { BaseInteraction, Message } from 'discord.js'
import { Admin } from '../commands/admin/admin'
import { UserUtils } from '../utils/userUtils'

export class LockingHandler {
    private botLocked: boolean = false
    /** Array of user IDs */
    private lockedUser: string[] = []
    private lockedThread: string[] = []

    constructor() {}

    setBotLocked(l: boolean) {
        this.botLocked = l
    }

    setLockedUser(userId: string) {
        this.lockedUser.push(userId)
    }

    setLockedThread(channelId: string) {
        this.lockedThread.push(channelId)
    }

    removeThread(ci: string) {
        this.lockedThread = this.lockedThread.filter((t) => t !== ci)
    }
    removeUserLock(ci: string) {
        this.lockedUser = this.lockedUser.filter((t) => t !== ci)
    }

    getbotLocked() {
        return this.botLocked
    }

    getlockedUser() {
        return this.lockedUser
    }
    getlockedThread() {
        return this.lockedThread
    }

    checkIfLockedPath(interaction: BaseInteraction | Message) {
        let uId = '0'
        let channelId = '0'
        if (interaction instanceof Message) {
            uId = interaction.author.id
        } else {
            uId = interaction.user.id
        }
        channelId = interaction?.channelId
        if (Admin.isAuthorAdmin(UserUtils.findMemberByUserID(uId, interaction)) || interaction.guildId === '1106124769797091338') {
            //Always allow admins to carry out interactions - this includes unlocking
            return false
        } else {
            if (this.getbotLocked()) return true
            if (this.getlockedThread().includes(channelId)) return true
            if (this.getlockedUser().includes(uId)) return true
            return false
        }
    }
}
