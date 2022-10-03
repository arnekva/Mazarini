export class LockingManager {
    private static botLocked: boolean = false
    /** Array of user IDs */
    private static lockedUser: string[] = []
    private static lockedThread: string[] = []

    static setBotLocked(l: boolean) {
        this.botLocked = l
    }

    static setLockedUser(userId: string) {
        this.lockedUser.push(userId)
    }

    static setLockedThread(channelId: string) {
        this.lockedThread.push(channelId)
    }

    static removeThread(ci: string) {
        this.lockedThread = this.lockedThread.filter((t) => t !== ci)
    }
    static removeUserLock(ci: string) {
        this.lockedUser = this.lockedUser.filter((t) => t !== ci)
    }

    static getbotLocked() {
        return this.botLocked
    }

    static getlockedUser() {
        return this.lockedUser
    }
    static getlockedThread() {
        return this.lockedThread
    }
}
