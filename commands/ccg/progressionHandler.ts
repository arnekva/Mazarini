import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/values'
import { CCGMatchSummary } from '../../templates/containerTemplates'
import { CCGCardStats, CCGGame, CCGPlayer, CCGPlayerStats, CCGStatusStats, Mode } from './ccgInterface'

export class ProgressionHandler {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    public async registerStats(game: CCGGame) {
        await this.registerPlayerStats(game, game.player1)
        await this.registerPlayerStats(game, game.player2)
    }

    private async registerPlayerStats(game: CCGGame, player: CCGPlayer) {
        const user = await this.client.database.getUser(player.id)
        player.stats.opponentId = player.opponentId
        player.stats.difficulty = game.botDifficulty ?? null
        const playerWon = game.state.winnerId === player.id
        if (playerWon) {
            player.stats.won += 1
            player.stats.chipsWon = game.wager ?? 0
        } else {
            player.stats.lost += 1
            player.stats.chipsWon = -game.wager ?? 0
        }

        const previousStats = user.userStats?.ccgStats?.findIndex(
            (stats) => stats.opponentId === player.opponentId && (!game.botDifficulty || stats.difficulty === game.botDifficulty)
        )
        if (previousStats >= 0) {
            const mergedStats = this.mergePlayerStats(player.stats, user.userStats.ccgStats[previousStats])
            user.userStats.ccgStats[previousStats] = mergedStats
        } else {
            const stats = [...(user?.userStats?.ccgStats ?? []), player.stats]
            user.userStats = { ...user.userStats, ccgStats: stats }
        }
        await this.client.database.updateUser(user)
    }

    private mergePlayerStats(gameStats: CCGPlayerStats, userStats: CCGPlayerStats): CCGPlayerStats {
        return {
            opponentId: gameStats.opponentId,
            chipsWon: gameStats.chipsWon + (userStats.chipsWon ?? 0),
            won: (gameStats.won += userStats.won),
            lost: (gameStats.lost += userStats.lost),
            difficulty: gameStats.difficulty,
            gamesPlayed: gameStats.gamesPlayed + (userStats?.gamesPlayed ?? 0),
            cardsPlayed: this.mergeCardsPlayed(userStats?.cardsPlayed, gameStats?.cardsPlayed),
            damageDealt: gameStats.damageDealt + (userStats?.damageDealt ?? 0),
            damageTaken: gameStats.damageTaken + (userStats?.damageTaken ?? 0),
            statused: this.mergeStatusStats(userStats?.statused, gameStats.statused),
            hits: gameStats.hits + (userStats?.hits ?? 0),
            misses: gameStats.misses + (userStats?.misses ?? 0),
        }
    }

    private mergeCardsPlayed(a: CCGCardStats[], b: CCGCardStats[]): CCGCardStats[] {
        const merged = a && a.length > 0 ? [...a] : new Array<CCGCardStats>()
        for (const stat of b) {
            const index = merged.findIndex((mergedStat) => mergedStat.cardId === stat.cardId)
            if (index >= 0) merged[index].timesPlayed += stat.timesPlayed
            else merged.push({ cardId: stat.cardId, timesPlayed: stat.timesPlayed })
        }
        return merged
    }

    private mergeStatusStats(a: CCGStatusStats[], b: CCGStatusStats[]): CCGStatusStats[] {
        const merged = a && a.length > 0 ? [...a] : new Array<CCGStatusStats>()
        for (const stat of b) {
            const index = merged.findIndex((mergedStat) => mergedStat.statusName === stat.statusName)
            if (index >= 0) merged[index].amount += stat.amount
            else merged.push({ statusName: stat.statusName, amount: stat.amount })
        }
        return merged
    }

    public async getMatchSummary(game: CCGGame) {
        const container = CCGMatchSummary(game)
        const player1Reward = game.vsBot ? await this.rewardShards(game, game.player1) : await this.settleWager(game, game.player1)
        const player2Reward = game.vsBot ? '' : await this.settleWager(game, game.player2)
        container.updateTextComponent('rewards', player1Reward + '\n' + player2Reward)
        return container
    }

    private async rewardShards(game: CCGGame, player: CCGPlayer) {
        if (game.mode && game.mode === Mode.Practice) return 'No rewards are earned in practice mode'
        const playerWon = game.state.winnerId === player.id
        const rewards = GameValues.ccg.rewards
        const user = await this.client.database.getUser(player.id)
        const limitReached = (user.ccg?.weeklyShardsEarned ?? 0) >= rewards.weeklyLimit
        if (limitReached) return `${player.name} has reached their weekly shard-limit!\nDon't worry - you didn't lose any chips`
        const dailyBonus = user.ccg?.dailyShardBonusClaimed ? 0 : rewards.dailyBonus
        const gameReward = playerWon ? rewards.win : rewards.loss
        const multiplier = game.vsBot && playerWon ? rewards.difficultyMultiplier[game.botDifficulty] : 1
        const reward = Math.min(rewards.weeklyLimit - (user.ccg?.weeklyShardsEarned ?? 0), gameReward * multiplier + dailyBonus)
        user.ccg = {
            ...user.ccg,
            dailyShardBonusClaimed: true,
            shards: (user.ccg?.shards ?? 0) + reward,
            weeklyShardsEarned: (user.ccg?.weeklyShardsEarned ?? 0) + reward,
        }
        this.client.database.updateUser(user)
        return `${player.name} earns ${reward} shards`
    }

    private async settleWager(game: CCGGame, player: CCGPlayer) {
        if (game.wager && game.wager > 0) {
            const playerWon = player.id === game.state.winnerId
            if (playerWon) {
                const user = await this.client.database.getUser(player.id)
                this.client.bank.giveUnrestrictedMoney(user, game.wager * 2)
                return `${player.name} wins ${game.wager} chips!`
            }
            return ''
        } else {
            return player.id === game.player1.id ? 'No bets were made' : ''
        }
    }
}
