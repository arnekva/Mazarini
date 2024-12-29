import moment from 'moment'
import { DRGame } from '../commands/games/deathroll'
import {
    botDataPrefix,
    ChipsStats,
    ICollectableSeries,
    ILootbox,
    MazariniStorage,
    MazariniUser,
    Meme,
    RulettStats,
} from '../interfaces/database/databaseInterface'
import { ObjectUtils } from '../utils/objectUtils'
import { FirebaseHelper } from './firebaseHelper'

export interface DeathRollStats {
    userId: string
    didGetNewBiggestLoss: number
    isOnATHLossStreak: number
    currentLossStreak?: number
}
export class DatabaseHelper {
    private db: FirebaseHelper

    constructor(firebaseHelper: FirebaseHelper) {
        this.db = firebaseHelper
    }

    /**
     * Get a user object by ID.
     * @param userID ID of the user as a string
     * @returns
     */
    public async getUser(userID: string): Promise<MazariniUser> {
        const user = await this.db.getUser(userID)
        if (user) return user
        return await this.addUser(DatabaseHelper.defaultUser(userID))
    }

    public async addUser(user: MazariniUser): Promise<MazariniUser> {
        await this.db.saveUser(user)
        return user
    }

    /** Get an untyped user object. Do not use unless you know what you are doing */
    public async getUntypedUser(userID: string): Promise<any> {
        try {
            return (await this.db.getUser(userID)) as MazariniUser as any
        } catch (error: any) {
            return undefined
        }
    }

    /** Update the user object in DB
     *  @param User - The user object to update
     *  @param logDiff - Set to true to log the difference between updated and current user. Note that this can cause a delay when updating the user, as it first needs to await a fetch for current
     */
    public async updateUser(user: MazariniUser, logDiff?: boolean) {
        const updatedUser = user
        if (logDiff) {
            const oldUser = await this.db.getUser(user.id)
            const diff = ObjectUtils.getDiff<MazariniUser>(oldUser, updatedUser, ['christmasCalendar'])
            this.db.msgHelper.sendLogMessage(
                `User ${user.id} oppdater i Database, diff fra gammel bruker. Oppdaterte keys: ${diff.keys}.\nTotal diff:\n ${diff.diff}`
            )
        }
        this.db.updateUser(updatedUser)
    }

    public updateData(updates: object) {
        this.db.updateData(updates)
    }

    /** Get the cache. Will create and return an empty object if it doesnt exist */
    public async getStorage(): Promise<MazariniStorage> {
        return await this.db.getMazariniStorage()
    }

    /** Directly uppdates the storage with the given props.
     * Note that this will overwrite existing cache. Any data you want to keep must be added to the partial. Use getStorage() to get the current cache value */
    public updateStorage(props: Partial<Omit<MazariniStorage, 'updateTimer'>>) {
        const updates = {}
        for (const prop in props) {
            updates[`/other/${prop}`] = props[prop]
        }
        updates['/other/updateTimer'] = moment(new Date()).unix()
        this.db.updateData(updates)
    }

    /** Update the chips stats property of a user stat object. Will set value of property to 1 if not created yet.
     *  Remember that you will still need to call DatabaseHelper.updateUser() to save the information */
    static incrementChipsStats(userObject: MazariniUser, property: keyof ChipsStats) {
        if (userObject.userStats?.chipsStats) {
            userObject.userStats.chipsStats[property] = ++userObject.userStats.chipsStats[property] || 1
        } else {
            if (userObject.userStats) {
                userObject.userStats.chipsStats = {
                    [property]: 1,
                }
            } else {
                userObject.userStats = {
                    chipsStats: {
                        [property]: 1,
                    },
                }
            }
        }
    }

    static incrementMoneyStats(user: MazariniUser, val: number, status: 'won' | 'lost') {
        if (!user.userStats) user.userStats = { moneyStats: { totalLost: 0, totalWon: 0 } }
        if (!user.userStats.moneyStats) user.userStats.moneyStats = { totalLost: 0, totalWon: 0 }
        if (status === 'won') {
            user.userStats.moneyStats.totalWon += val
        } else {
            user.userStats.moneyStats.totalLost += val
        }
        return user
    }
    /** Update the rulett stats property of a user stat object. Will set value of property to 1 if not created yet.
     *  Remember that you will still need to call DatabaseHelper.updateUser() to save the information */
    static incrementRulettStats(userObject: MazariniUser, property: keyof RulettStats) {
        if (userObject.userStats?.rulettStats) {
            userObject.userStats.rulettStats[property] = ++userObject.userStats.rulettStats[property] || 1
        } else {
            if (userObject.userStats) {
                userObject.userStats.rulettStats = {
                    [property]: 1,
                }
            } else {
                userObject.userStats = {
                    rulettStats: {
                        [property]: 1,
                    },
                }
            }
        }
    }

    public async getBotData(prefix: botDataPrefix) {
        return await this.db.getBotData(prefix)
    }

    public setBotData(prefix: botDataPrefix, value: any) {
        const updates = {}
        updates[`/bot/${prefix}`] = value
        this.db.updateData(updates)
    }

    public setTextCommandValue(commandName: string, value: any) {
        this.db.addTextCommands(commandName, value)
    }
    public nukeTextCommand(commandName: string, index: number) {
        this.db.deleteData(`textCommand/${commandName}/${index}`)
    }
    public async getTextCommandValueArray(commandName: string) {
        return await this.db.getTextCommands(commandName)
    }

    /** Get a list of all database users */
    public async getAllUsers(): Promise<MazariniUser[]> {
        return await this.db.getAllUsers()
    }

    //TODO: Refactor
    public async deleteSpecificPrefixValues(prefix: keyof MazariniUser) {
        const users = await this.getAllUsers()
        users.forEach((user) => {
            if (prefix === 'status' && !!user.status) {
                delete user.status
            }
            this.updateUser(user)
        })
    }

    public async getMemes(): Promise<Meme[]> {
        return await this.db.getMemes()
    }

    static getProperty(o: MazariniUser, name: keyof MazariniUser) {
        return o[name]
    }

    getUserPathToUpdate(userid: string, prop: keyof MazariniUser) {
        return `/users/${userid}/${prop}` // as `/users/${string}/${keyof MazariniUser}`
    }

    /** The generic is a keyof MazarinUser. Will cast error with "never" not being assignable if generic type is missing  */
    getUpdatesObject<T extends keyof MazariniUser = never>(): { [path: string]: MazariniUser[T] } {
        const updates: { [path: string]: MazariniUser[T] } = {}
        return updates
    }

    // getUpdatesObjectFromKey(k: keyof MazariniUser){

    //     return this.getUpdatesObject<k in Maza>()
    // }

    public async registerEmojiStats(emojiName: string, animated: boolean) {
        let emoji = await this.db.getEmojiStats(emojiName)
        const updates = {}
        if (emoji) emoji.added.push(new Date())
        else {
            emoji = { name: emojiName, timesUsedInMessages: 0, timesUsedInReactions: 0, added: [new Date()], removed: [], animated: animated }
        }
        updates[`/stats/emojis/${emojiName}`] = emoji
        this.db.updateData(updates)
    }

    public async registerEmojiRemoved(emojiName: string) {
        const emoji = await this.db.getEmojiStats(emojiName)
        const updates = {}
        if (emoji) {
            emoji.removed ? emoji.removed.push(new Date()) : (emoji.removed = Array(1).fill(new Date()))
            updates[`/stats/emojis/${emojiName}`] = emoji
            this.db.updateData(updates)
        }
    }

    public async registerEmojiUpdated(oldEmojiName: string, newEmojiName: string) {
        if (oldEmojiName != newEmojiName) {
            const emoji = await this.db.getEmojiStats(oldEmojiName)
            emoji.name = newEmojiName
            const updates = {}
            if (emoji) {
                updates[`/stats/emojis/${oldEmojiName}`] = null
                updates[`/stats/emojis/${newEmojiName}`] = emoji
                this.db.updateData(updates)
            }
        }
    }

    public updateEmojiMessageCounters(emojis: string[]) {
        const paths = []
        emojis.forEach((emoji) => paths.push(`/stats/emojis/${emoji}/timesUsedInMessages`))
        this.db.incrementData(paths)
    }

    public updateEmojiReactionCounter(emoji: string, decrement: boolean = false) {
        const path = []
        path.push(`/stats/emojis/${emoji}/timesUsedInReactions`)
        this.db.incrementData(path, decrement)
    }

    public async getEmojiStats(): Promise<object> {
        return (await this.db.getData('stats/emojis')) as object
    }

    public async registerDeathrollStats(game: DRGame): Promise<DeathRollStats> {
        let loserStats: DeathRollStats = { didGetNewBiggestLoss: 0, isOnATHLossStreak: 0, userId: '' }
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i]

            const user = await this.getUser(player.userID)

            if (user) {
                const defaultStats = {
                    //avoid null-references
                    totalGames: user.userStats?.deathrollStats?.totalGames ?? 0,
                    totalLosses: user.userStats?.deathrollStats?.totalLosses ?? 0,
                    weeklyGames: user.userStats?.deathrollStats?.weeklyGames ?? 0,
                    weeklyLosses: user.userStats?.deathrollStats?.weeklyLosses ?? 0,
                    weeklyLossSum: user.userStats?.deathrollStats?.weeklyLossSum ?? 0,
                    currentLossStreak: user.userStats?.deathrollStats?.currentLossStreak ?? 0,
                    longestLossStreak: user.userStats?.deathrollStats?.longestLossStreak ?? 0,
                    biggestLoss: user.userStats?.deathrollStats?.biggestLoss ?? [],
                }
                if (!user.userStats)
                    user.userStats = {
                        deathrollStats: defaultStats,
                    }
                else user.userStats.deathrollStats = defaultStats

                user.userStats.deathrollStats.totalGames++
                user.userStats.deathrollStats.weeklyGames++

                if (game.loserID === user.id) {
                    const currStat: DeathRollStats = {
                        didGetNewBiggestLoss: 0,
                        isOnATHLossStreak: 0,
                        userId: player.userID,
                    }
                    if (!user.userStats.deathrollStats.biggestLoss) {
                        user.userStats.deathrollStats.biggestLoss = [game.lastRoll]
                    } else {
                        //Make sure array is sorted
                        const largestLosses = user.userStats.deathrollStats.biggestLoss.sort((a, b) => a - b)
                        //If the array is less than 10, or the last roll is larger than the smallest value in the array
                        //We need the second check here, such that [10,7,6,5,2,2,2,2,2,2] will trigger true in the next check when we add a new 2.
                        if (largestLosses.length < 10 || game.lastRoll > largestLosses[0]) {
                            largestLosses.push(game.lastRoll)
                            largestLosses.sort((a, b) => a - b)
                            if (largestLosses.length > 10) {
                                largestLosses.shift()
                            }
                            if (largestLosses.includes(game.lastRoll)) {
                                currStat.didGetNewBiggestLoss = game.lastRoll
                            }
                        }
                    }
                    user.userStats.deathrollStats.totalLosses++
                    user.userStats.deathrollStats.weeklyLosses++
                    user.userStats.deathrollStats.weeklyLossSum += game.lastRoll
                    user.userStats.deathrollStats.currentLossStreak++
                    if (user.userStats.deathrollStats.currentLossStreak > user.userStats.deathrollStats.longestLossStreak) {
                        currStat.isOnATHLossStreak = user.userStats.deathrollStats.currentLossStreak
                        user.userStats.deathrollStats.longestLossStreak = user.userStats.deathrollStats.currentLossStreak
                    }
                    currStat.currentLossStreak = user.userStats.deathrollStats.currentLossStreak
                    loserStats = currStat
                } else {
                    user.userStats.deathrollStats.currentLossStreak = 0
                }
                this.updateUser(user)
            }
        }
        return loserStats
    }

    public async findAndRewardWeeklyDeathrollWinner() {
        const users = await this.getAllUsers()
        const sorted = users
            .filter((user) => (user.userStats?.deathrollStats?.weeklyGames ?? 0) > 9)
            .sort((a, b) => this.getUserLossRatio(a) - this.getUserLossRatio(b))
        const winners = sorted
            .filter((user) => this.getUserLossRatio(user) == this.getUserLossRatio(sorted[0]))
            .sort((a, b) => b.userStats.deathrollStats.weeklyGames - a.userStats.deathrollStats.weeklyGames)
        if (winners.length > 1 && winners[1].userStats.deathrollStats.weeklyGames == winners[0].userStats.deathrollStats.weeklyGames) return undefined
        const winner = winners[0]
        if (winner) {
            winner.chips += 100 * winner.userStats.deathrollStats.weeklyGames
            this.updateUser(winner)
        }
        return winner
    }

    private getUserLossRatio(user: MazariniUser) {
        return (user.userStats?.deathrollStats?.weeklyLosses ?? 0) / (user.userStats?.deathrollStats?.weeklyGames ?? 1)
    }

    public async getDeathrollPot() {
        return (await this.db.getData('other/deathrollPot')) as number
    }

    public saveDeathrollPot(amount: number) {
        const updates = {}
        updates[`/other/deathrollPot`] = amount
        this.db.updateData(updates)
    }
    public saveDeathrollGames(games: DRGame[]) {
        const updates = {}
        updates[`/other/deathrollGames`] = games
        this.db.updateData(updates)
    }

    public async getDeathrollGames() {
        return (await this.db.getData('/other/deathrollGames')) as DRGame[]
    }

    public async resetWeeklyDeathrollStats() {
        const users = await this.getAllUsers()
        users
            .filter((user) => (user.userStats?.deathrollStats?.weeklyGames ?? 0) > 0)
            .forEach((user) => {
                user.userStats.deathrollStats.weeklyGames = 0
                user.userStats.deathrollStats.weeklyLosses = 0
                user.userStats.deathrollStats.weeklyLossSum = 0
                this.updateUser(user)
            })
    }

    public setLootboxes(boxes: ILootbox[]) {
        const updates = {}
        updates[`/other/loot/boxes`] = boxes
        this.db.updateData(updates)
    }

    public async getLootboxes() {
        return (await this.db.getData('/other/loot/boxes')) as ILootbox[]
    }

    public async addLootboxSeries(series: ICollectableSeries) {
        const updates = {}
        const currentSeries = (await this.getLootboxSeries()) ?? []
        updates[`/other/loot/series`] = [...currentSeries, series]
        this.db.updateData(updates)
    }

    public async getLootboxSeries() {
        return (await this.db.getData('/other/loot/series')) as ICollectableSeries[]
    }

    public async getFromStorage(path: string): Promise<ArrayBuffer> {
        const ref = this.db.getStorageRef(path)
        return this.db.getStorageData(ref)
    }

    public uploadLootGif(path: string, gif: Buffer) {
        const ref = this.db.getStorageRef(path)
        this.db.uploadToStorage(ref, gif)
    }

    static defaultUser(id: string): MazariniUser {
        return {
            bonkCounter: 0,
            chips: 5000,
            id: id,
            warningCounter: 0,
            activisionUserString: '',
            birthday: '',
            daily: {
                streak: 0,
                claimedToday: false,
                dailyFreezeCounter: 0,
                prestige: 0,
            },
            lastFMUsername: '',
            rocketLeagueUserString: '',
            status: '',
        }
    }

    static defaultCache(): Partial<MazariniStorage> {
        return {
            updateTimer: moment().unix(),
            polls: [],
        }
    }
}
