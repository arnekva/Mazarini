import { MazariniClient } from "../../client/MazariniClient"
import { ChallengeType, DeathrollChallenge } from "../../interfaces/database/databaseInterface"
import { DRGame } from "./deathroll"

export interface Challenge {
    type: ChallengeType
    callback: (game: DRGame, challenge: DeathrollChallenge) => void
}

export const consecutiveWins: Challenge = {
    type: ChallengeType.consecutiveWins,
    callback: (game: DRGame, challenge: DeathrollChallenge) => {
        game.players.forEach(player => {
            if (player.rolls[player.rolls.length-1] !== 1) {
                let tracker = challenge.progressTrackers.find(x => x.id == player.userID)
                if (tracker == undefined || tracker.completed) return
                tracker = {...tracker, counter: tracker.counter+1} ?? {id: player.userID, counter: 1, completed: false}
                if (tracker.counter >= challenge.variable) tracker.completed = true
            }
        })
        return challenge
    }
}

