import moment from 'moment'
import fetch from 'node-fetch'
import { rapidApiKey, rapidApiKey2 } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { Deathroll } from '../commands/games/deathroll'
import { MoreOrLess } from '../commands/games/moreOrLess'
import { RocketLeagueCommands } from '../commands/gaming/rocketleagueCommands'
import { LootboxCommands } from '../commands/store/lootboxCommands'
import { EmojiHelper, JobStatus } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MazariniUser, RocketLeagueTournament } from '../interfaces/database/databaseInterface'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds, MentionUtils, ThreadIds } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'
export class DailyJobs {
    private messageHelper: MessageHelper
    private client: MazariniClient

    constructor(messageHelper: MessageHelper, client: MazariniClient) {
        this.messageHelper = messageHelper
        this.client = client
    }

    async runJobs(onlyRl?: boolean) {
        if (onlyRl) {
            this.updateRLTournaments(rapidApiKey)
        } else {
            //TODO: This could be refactored
            const users = await this.client.database.getAllUsers()
            const embed = EmbedUtils.createSimpleEmbed(`Daily Jobs`, `Kjører 8 jobber`)

            const claim = this.validateAndResetDailyClaims(users)
            embed.addFields({ name: 'Daily claim', value: EmojiHelper.getStatusEmoji(claim) })
            const dailySpin = this.resetDailySpinReward(users)
            embed.addFields({ name: 'Daily spin', value: EmojiHelper.getStatusEmoji(dailySpin) })
            const userEffects = this.resetUserEffects(users)
            embed.addFields({ name: 'User effects', value: EmojiHelper.getStatusEmoji(userEffects) })
            const jail = await this.updateJailAndJailbreakCounters(users)
            embed.addFields({ name: 'Jail status', value: EmojiHelper.getStatusEmoji(jail) })
            const bd = this.checkForUserBirthdays(users)
            embed.addFields({ name: 'Bursdager', value: EmojiHelper.getStatusEmoji(bd) })
            const rl = await this.updateRLTournaments(rapidApiKey)
            embed.addFields({ name: 'Rocket League turnering', value: EmojiHelper.getStatusEmoji(rl) })
            const drWinNum = this.reRollWinningNumbers()
            embed.addFields({ name: 'Tilfeldige deathroll vinnertall', value: EmojiHelper.getStatusEmoji(drWinNum) })
            const moreOrLess = await this.awardAndResetMoreOrLess(users)
            embed.addFields({ name: 'More or less', value: EmojiHelper.getStatusEmoji(moreOrLess) })
            const todaysTime = new Date().toLocaleTimeString()
            embed.setFooter({ text: todaysTime })
            this.messageHelper.sendMessage(ChannelIds.ACTION_LOG, { embed: embed })
        }
    }

    public async updateRLTournaments(apiKey: string): Promise<JobStatus> {
        let status: JobStatus = 'success'
        const retryFetch = () => {
            if (apiKey === rapidApiKey) this.updateRLTournaments(rapidApiKey2)
            else {
                status = 'failed'
                this.client.database.updateStorage({
                    rocketLeagueTournaments: {
                        mainMessageId: '',
                        tournaments: [],
                    },
                })
            }
        }
        await fetch('https://rocket-league1.p.rapidapi.com/tournaments/europe', {
            headers: {
                'User-Agent': 'RapidAPI Playground',
                'Accept-Encoding': 'identity',
                '_X-RapidAPI-Key': apiKey,
                get 'X-RapidAPI-Key'() {
                    return this['_X-RapidAPI-Key']
                },
                set 'X-RapidAPI-Key'(value) {
                    this['_X-RapidAPI-Key'] = value
                },
                'X-RapidAPI-Host': 'rocket-league1.p.rapidapi.com',
            },
        })
            .then(async (res) => {
                const data = await res.json()

                const tournaments = data.tournaments as RocketLeagueTournament[]
                if (!tournaments) {
                    this.messageHelper.sendLogMessage(
                        `Klarte ikke hente Rocket League turneringer. Det var ingen turneringer i objektet fra fetchen. ${
                            apiKey === rapidApiKey ? 'Forsøker å hente på ny' : 'Fetch 2 feilet også'
                        }. JSON Resultat: \n${JSON.stringify(data, undefined, 4)}`
                    )
                    status = 'failed'
                    retryFetch()
                } else {
                    tournaments.forEach((t, idx) => {
                        t.id = idx
                    })

                    const embed = RocketLeagueCommands.getEmbed()
                    const activeGameButtonRow = RocketLeagueCommands.getButtonRow(tournaments)
                    const msg = await this.messageHelper.sendMessage(
                        ChannelIds.ROCKET_LEAGUE,
                        { embed: embed, components: [activeGameButtonRow] },
                        { sendAsSilent: true }
                    )
                    this.client.database.updateStorage({
                        rocketLeagueTournaments: {
                            mainMessageId: msg.id,
                            tournaments: tournaments,
                        },
                    })
                    status = 'success'
                }
            })
            .catch((err) => {
                this.messageHelper.sendLogMessage(`Klarte ikke hente Rocket League Tournaments. Error: \n${err}`)
                retryFetch()
            })

        return status
    }

    private reRollWinningNumbers() {
        const status: JobStatus = 'success'

        this.messageHelper.sendLogMessage(`De forrige skjulte tallene var:` + this.client.cache.deathrollWinningNumbers?.join(', '))
        this.client.cache.deathrollWinningNumbers = Deathroll.getRollWinningNumbers()
        return status
    }

    private validateAndResetDailyClaims(users: MazariniUser[]): JobStatus {
        const updates = this.client.database.getUpdatesObject<'daily'>()
        const status: JobStatus = 'success' //No good way to verify yet?
        users.forEach((user) => {
            const daily = user?.daily
            if (!daily?.streak) return //Verify that the user as a streak/claim, otherwise skip
            if (!daily.claimedToday) daily.streak = 0 //If not claimed today, also reset the streak
            daily.claimedToday = false //Reset check for daily claim
            const updatePath = this.client.database.getUserPathToUpdate(user.id, 'daily')
            updates[updatePath] = daily
        })
        this.client.database.updateData(updates)
        return status
    }

    private checkForUserBirthdays(users: MazariniUser[]): JobStatus {
        let status: JobStatus = 'not sendt'
        users.forEach((user) => {
            const birthday = user?.birthday
            if (birthday) {
                const date = moment.utc(`${birthday} 12:00`, 'DD-MM-YYYY HH:mm:ss') // new Date(bdTab[2], bdTab[1], bdTab[0])
                const isBirthdayToday = DateUtils.isToday(date.toDate(), true)
                if (isBirthdayToday) {
                    this.messageHelper.sendMessage(ChannelIds.GENERAL, {
                        text: `Gratulerer med dagen ${UserUtils.findUserById(user.id, this.client)}!`,
                    })
                    status = 'success'
                }
            }
        })
        return status
    }

    private updateJailAndJailbreakCounters(users: MazariniUser[]): JobStatus {
        const updates = this.client.database.getUpdatesObject<'jail'>()
        let status: JobStatus = 'not sendt'
        users.forEach((user) => {
            const daysLeftInJail = user.jail?.daysInJail
            if (user.jail) {
                if (daysLeftInJail && !isNaN(daysLeftInJail) && daysLeftInJail > 0) {
                    user.jail.daysInJail = user.jail.daysInJail ? --user.jail.daysInJail : 0
                }
                if (!user.jail?.daysInJail) {
                    user.jail.jailState = 'none'
                }
                user.jail.attemptedJailbreaks = 0
                user.jail.timesJailedToday = 0
                user.jail.attemptedFrameJobs = 0
                const updatePath = this.client.database.getUserPathToUpdate(user.id, 'jail')
                updates[updatePath] = user.jail
                status = 'success'
            }
        })
        this.client.database.updateData(updates)
        return status
    }

    private resetDailySpinReward(users: MazariniUser[]): JobStatus {
        const updates = this.client.database.getUpdatesObject<'dailySpinRewards'>()
        users.forEach((user) => {
            user.dailySpinRewards = 0
            const updatePath = this.client.database.getUserPathToUpdate(user.id, 'dailySpinRewards')
            updates[updatePath] = user.dailySpinRewards
        })
        this.client.database.updateData(updates)
        return 'success'
    }

    private resetUserEffects(users: MazariniUser[]): JobStatus {
        const updates = this.client.database.getUpdatesObject<'effects'>()
        users.forEach((user) => {
            const buffs = user.effects?.positive
            if (buffs) {
                buffs.lootColorChanceMultiplier = 1
                buffs.lootColorsFlipped = false
                buffs.deahtrollLootboxChanceMultiplier = 1
                const updatePath = this.client.database.getUserPathToUpdate(user.id, 'effects')
                updates[updatePath] = user.effects
            }
        })
        this.client.database.updateData(updates)
        return 'success'
    }

    private async awardAndResetMoreOrLess(users: MazariniUser[]): Promise<JobStatus> {
        const usersWithStats = users.filter(user => user.dailyGameStats?.moreOrLess?.attempted)
        const attempted = (usersWithStats?.length ?? 0) > 0
        let dailyWinner = undefined
        let tied = false
        let tieBreak = false
        if (attempted) {
            const sortedUsers = usersWithStats?.sort((a,b) => b.dailyGameStats.moreOrLess.firstAttempt - a.dailyGameStats.moreOrLess.firstAttempt)
            dailyWinner = sortedUsers[0]
            const filteredUsers = sortedUsers.filter(user => user.dailyGameStats.moreOrLess.firstAttempt === sortedUsers[0].dailyGameStats.moreOrLess.firstAttempt)
            if (filteredUsers.length > 1) {
                const sortedWinners = filteredUsers.sort((a,b) => b.dailyGameStats.moreOrLess.bestAttempt - a.dailyGameStats.moreOrLess.bestAttempt)
                if (sortedWinners[0].dailyGameStats.moreOrLess.bestAttempt === sortedWinners[1].dailyGameStats.moreOrLess.bestAttempt) {
                    dailyWinner = undefined
                    tied = true
                } else {
                    dailyWinner = sortedWinners[0]
                    tieBreak = true
                }
            }
            const updates = this.client.database.getUpdatesObject<'dailyGameStats'>()
            usersWithStats.forEach((user) => {
                user.dailyGameStats = {...user.dailyGameStats, moreOrLess: { attempted: false, firstAttempt: 0, bestAttempt: 0}}
                const updatePath = this.client.database.getUserPathToUpdate(user.id, 'dailyGameStats')
                updates[updatePath] = user.dailyGameStats
            })
            this.client.database.updateData(updates)
        }
        const storage = await this.client.database.getStorage()
        const game = await MoreOrLess.getNewMoreOrLessGame()
        const description = this.getMoreOrLessDesc(attempted, dailyWinner, tied, tieBreak, storage.moreOrLess.title)
      
        const embed = EmbedUtils.createSimpleEmbed('More or Less', description + `\n\nDagens tema er **${game.title}**`)
        const lootBtn = dailyWinner ? LootboxCommands.getLootRewardButton(dailyWinner.id, 'basic', true) : undefined
        this.messageHelper.sendMessage(ThreadIds.MORE_OR_LESS, {embed: embed, components: dailyWinner ? [lootBtn] : []})
        this.client.database.updateStorage({ moreOrLess: game })
        return 'success' 
    }

    private getMoreOrLessDesc(attempted: boolean, winner: MazariniUser, tied: boolean, tiebreak: boolean, yesterdayTheme: string) {
        if (!attempted) return `Ingen forsøk ble gjort på gårsdagens tema *${yesterdayTheme}*`
        else if (tied) return `Det var ingen som klarte å være best i gårsdagens tema *${yesterdayTheme}*, så da blir det ingen ekstra premie`
        else {
            return `Gratulerer til gårsdagens vinner ${MentionUtils.mentionUser(winner.id)}`
                 + (tiebreak 
                 ? ` som vinner på tiebreak med beste totalforsøk på *${yesterdayTheme}*!`
                 : ` som vinner på beste første forsøk på *${yesterdayTheme}*!`)
                 + `\nDu får en basic loot chest!`
        } 
    }

    private logEvent() {
        const todaysTime = new Date().toLocaleTimeString()
        console.log(`Daily jobs ran at ${todaysTime}`)
    }
}
