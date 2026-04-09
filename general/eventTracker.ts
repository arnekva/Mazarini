import { MazariniClient } from '../client/MazariniClient'
import { Difficulty, Mode } from '../commands/ccg/ccgInterface'
import { MazariniEventType } from '../interfaces/database/databaseInterface'
import { MentionUtils } from '../utils/mentionUtils'

interface IDeathrollEventPayload {
    winnerId: string
    loserId?: string
    initialTarget: number
    loserRoll: number
}

interface ICCGEventPayload {
    winnerId?: string
    opponentId?: string
    difficulty?: Difficulty
    mode?: Mode
    vsBot: boolean
}

export class EventTracker {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    async trackDiceRoll(userId: string) {
        return await this.client.mazariniEvents.completeFirstActiveEvent(MazariniEventType.DiceRoll, userId)
    }

    async trackTerningWin(payload: IDeathrollEventPayload) {
        if (!payload.winnerId || payload.initialTarget < 1 || payload.initialTarget > 50 || payload.loserRoll !== 1 || payload.winnerId === payload.loserId)
            return undefined
        return await this.client.mazariniEvents.completeFirstActiveEvent(MazariniEventType.DiceRoll, payload.winnerId)
    }

    async trackDeathrollWin(payload: IDeathrollEventPayload) {
        if (!payload.winnerId || payload.initialTarget <= 50 || payload.loserRoll !== 1 || payload.winnerId === payload.loserId) return undefined
        return await this.client.mazariniEvents.completeFirstActiveEvent(MazariniEventType.DeathrollWin, payload.winnerId)
    }

    async trackDeathrollPotWin(winnerId: string) {
        if (!winnerId) return undefined
        return await this.client.mazariniEvents.completeFirstActiveEvent(MazariniEventType.DeathrollPotWin, winnerId)
    }

    async trackCcgWin(payload: ICCGEventPayload) {
        const validDifficulty = payload.difficulty === Difficulty.Medium || payload.difficulty === Difficulty.Hard
        if (
            !payload.vsBot ||
            !payload.winnerId ||
            payload.winnerId === MentionUtils.User_IDs.BOT_HOIE ||
            payload.opponentId !== MentionUtils.User_IDs.BOT_HOIE ||
            !validDifficulty
        )
            return undefined
        return await this.client.mazariniEvents.completeFirstActiveEvent(MazariniEventType.CCGHoieWin, payload.winnerId)
    }

    async trackCcgPlayerWin(payload: ICCGEventPayload) {
        if (payload.vsBot || !payload.winnerId) return undefined
        return await this.client.mazariniEvents.completeFirstActiveEvent(MazariniEventType.CCGPlayerWin, payload.winnerId)
    }

    async trackGambleWin(userId: string, chipsWon: number) {
        if (!userId || chipsWon < 1000) return undefined
        return await this.client.mazariniEvents.completeFirstActiveEvent(MazariniEventType.VladivostokGambleWin, userId)
    }
}
