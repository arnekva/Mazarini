import { randomUUID } from 'crypto'
import { DondItems } from '../../commands/games/content/dondItems'
import { IEffectItem } from '../../commands/store/lootboxCommands'
import {
    IMazariniEventEntry,
    IMazariniEventReward,
    IMazariniEventState,
    MazariniEventRewardTier,
    MazariniEventType,
    MazariniUser,
} from '../../interfaces/database/databaseInterface'
import { ChannelIds, MentionUtils, ThreadIds } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { UserUtils } from '../../utils/userUtils'
import { MazariniClient } from '../MazariniClient'

export class MazariniEvents {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    generateDailyEvents(date = new Date()) {
        const state = this.createDailyState(date)
        this.saveState(state)
        this.client.messageHelper.sendLogMessage(
            `Dagens events ble generert (${state.scheduled.length} stk): ${state.scheduled
                .map((event) => `${event.type}@${this.formatTime(event.triggerHour, event.triggerMinute)}`)
                .join(', ')}`
        )
        return state
    }

    async ensureTodayState(date = new Date()) {
        const storage = await this.client.database.getStorage()
        const current = this.normalizeState(storage?.events, date)
        const todayKey = this.getDayKey(date)
        if (current?.dayKey === todayKey) {
            this.saveState(current)
            return current
        }
        return this.generateDailyEvents(date)
    }

    async activateSpecificEvent(type: MazariniEventType, date = new Date()) {
        const state = await this.ensureTodayState(date)
        const activeEvent = {
            ...this.createEntry(type, date.getHours(), date.getMinutes()),
            activatedAt: this.toUnix(date),
        }
        state.active.push(activeEvent)
        this.saveState(state)

        await this.client.messageHelper.sendMessage(
            activeEvent.channelId,
            {
                text: this.getAnnouncementText(activeEvent),
            },
            { sendAsSilent: true }
        )
        this.client.messageHelper.sendLogMessage(`Event trigget manuelt: ${activeEvent.type} i ${MentionUtils.mentionChannel(activeEvent.channelId)}`)
        return activeEvent
    }

    async getPrintableSchedule(date = new Date()) {
        const state = await this.ensureTodayState(date)
        const formatEntries = (entries: IMazariniEventEntry[] = [], includeStatus = false) => {
            if (entries.length === 0) return 'Ingen'
            return entries
                .map((event) => {
                    const suffix = includeStatus && event.winnerId ? ` - vinner: ${MentionUtils.mentionUser(event.winnerId)}` : ''
                    return `${this.formatTime(event.triggerHour, event.triggerMinute)} - ${event.title}${suffix}`
                })
                .join('\n')
        }

        return {
            title: `Eventplan for ${state.dayKey}`,
            scheduled: formatEntries(state.scheduled),
            active: formatEntries(state.active),
            completed: formatEntries(state.completed, true),
        }
    }

    async activateDueEvents(date = new Date()) {
        const state = await this.ensureTodayState(date)
        const dueEventIndex = state.scheduled.findIndex((event) => event.triggerHour === date.getHours() && event.triggerMinute === date.getMinutes())
        if (dueEventIndex < 0) return undefined

        const dueEvent = { ...state.scheduled[dueEventIndex], activatedAt: this.toUnix(date) }
        state.scheduled.splice(dueEventIndex, 1)
        state.active.push(dueEvent)
        this.saveState(state)

        await this.client.messageHelper.sendMessage(
            dueEvent.channelId,
            {
                text: this.getAnnouncementText(dueEvent),
            },
            { sendAsSilent: true }
        )
        this.client.messageHelper.sendLogMessage(`Event trigget: ${dueEvent.type} i ${MentionUtils.mentionChannel(dueEvent.channelId)}`)
        return dueEvent
    }

    async completeFirstActiveEvent(type: MazariniEventType, winnerId: string, channelId?: string) {
        const state = await this.ensureTodayState()
        const eventIndex = state.active.findIndex((event) => event.type === type)
        if (eventIndex < 0) return undefined

        const completedEvent = {
            ...state.active[eventIndex],
            winnerId: winnerId,
            completedAt: this.toUnix(new Date()),
        }
        state.active.splice(eventIndex, 1)
        state.completed.push(completedEvent)
        this.saveState(state)

        const user = await this.client.database.getUser(winnerId)
        const targetChannelId = channelId ?? completedEvent.channelId
        const rewardSummary = await this.applyReward(user, completedEvent, targetChannelId)
        const winnerName = this.getPrettyUserName(winnerId)
        await this.client.messageHelper.sendMessage(
            targetChannelId,
            {
                text: `${MentionUtils.mentionUser(winnerId)} fullførte eventet "${completedEvent.title}" og får ${rewardSummary}.`,
            },
            { sendAsSilent: true }
        )
        this.client.messageHelper.sendLogMessage(`Event fullført: ${completedEvent.type} av ${winnerName} (${rewardSummary})`)
        return { event: completedEvent, rewardSummary }
    }

    getActiveEventsOfType(state: IMazariniEventState, type: MazariniEventType) {
        return state.active.filter((event) => event.type === type)
    }

    private getPrettyUserName(userId: string) {
        const guild = this.client.guilds.cache.find((candidate) => candidate.members.cache.has(userId))
        const member = guild ? UserUtils.findMemberByUserID(userId, guild) : undefined
        if (member) return UserUtils.getPrettyName(member)

        const user = UserUtils.findUserById(userId, this.client)
        return user?.displayName || user?.globalName || user?.username || userId
    }

    private createDailyState(date: Date): IMazariniEventState {
        const triggerCount = this.getTriggerCount()
        const times = this.getTriggerTimes(triggerCount)
        const scheduled = times.map(({ hour, minute }) => this.createEntry(this.getRandomEventType(), hour, minute))
        return {
            dayKey: this.getDayKey(date),
            scheduled: scheduled.sort((a, b) => a.triggerHour - b.triggerHour || a.triggerMinute - b.triggerMinute),
            active: [],
            completed: [],
        }
    }

    private normalizeState(state: Partial<IMazariniEventState> | undefined, date = new Date()): IMazariniEventState {
        return {
            dayKey: state?.dayKey ?? this.getDayKey(date),
            scheduled: this.normalizeEntries(state?.scheduled ?? []),
            active: this.normalizeEntries(state?.active ?? []),
            completed: this.normalizeEntries(state?.completed ?? []),
        }
    }

    private normalizeEntries(entries: Partial<IMazariniEventEntry>[]) {
        return entries.map((entry) => {
            const template = this.getTemplate(entry.type as MazariniEventType)
            return {
                id: entry.id ?? randomUUID(),
                type: entry.type,
                triggerHour: entry.triggerHour ?? 0,
                triggerMinute: entry.triggerMinute ?? 0,
                channelId: entry.channelId ?? template.channelId,
                title: entry.title ?? template.title,
                description: entry.description ?? template.description,
                reward: entry.reward ?? template.reward,
                activatedAt: entry.activatedAt,
                completedAt: entry.completedAt,
                winnerId: entry.winnerId,
            } as IMazariniEventEntry
        })
    }

    private createEntry(type: MazariniEventType, triggerHour: number, triggerMinute: number): IMazariniEventEntry {
        const template = this.getTemplate(type)
        return {
            id: randomUUID(),
            type,
            triggerHour,
            triggerMinute,
            channelId: template.channelId,
            title: template.title,
            description: template.description,
            reward: template.reward,
        }
    }

    private getTemplate(type: MazariniEventType): { title: string; description: string; channelId: string; reward: IMazariniEventReward } {
        switch (type) {
            case MazariniEventType.DiceRoll:
                return {
                    title: 'Terning',
                    description: 'Førstemann til å vinne et game hvor taperen triller 1 (1 - 50). Veldig lav kvalitet reward.',
                    channelId: ThreadIds.GENERAL_TERNING,
                    reward: { tier: MazariniEventRewardTier.VeryLow },
                }
            case MazariniEventType.DeathrollWin:
                return {
                    title: 'Deathroll',
                    description: 'Førstemann til å vinne et game hvor taperen triller 1 (51+). Middels kvalitet reward.',
                    channelId: ThreadIds.GENERAL_TERNING,
                    reward: { tier: MazariniEventRewardTier.Medium },
                }
            case MazariniEventType.DeathrollPotWin:
                return {
                    title: 'Deathroll Pot',
                    description: 'Førstemann til å vinne deathroll-potten får en høy kvalitet reward.',
                    channelId: ThreadIds.GENERAL_TERNING,
                    reward: { tier: MazariniEventRewardTier.High },
                }
            case MazariniEventType.CCGHoieWin:
                return {
                    title: 'CCG',
                    description: 'CCG: Førstemann til å vinne et game mot minst middels Høie får en høy kvalitet reward. Training teller.',
                    channelId: ChannelIds.CCG,
                    reward: { tier: MazariniEventRewardTier.High },
                }
            case MazariniEventType.CCGPlayerWin:
                return {
                    title: 'CCG PVP',
                    description: 'CCG: Førstemann til å vinne et spill mot en annen spiller får en middels kvalitet reward.',
                    channelId: ChannelIds.CCG,
                    reward: { tier: MazariniEventRewardTier.Medium },
                }
            case MazariniEventType.VladivostokGambleWin:
                return {
                    title: 'Vladivostok-event',
                    description: 'Førstemann til å vinne minst 1000 chips på ein /gamble får ein låg kvalitet reward.',
                    channelId: ChannelIds.LOOT,
                    reward: { tier: MazariniEventRewardTier.Low },
                }
        }
    }

    getEventLabel(type: MazariniEventType) {
        return this.getTemplate(type).title
    }

    private getAnnouncementText(event: IMazariniEventEntry) {
        return `# Event: ${event.title}\n${event.description}`
    }

    private async applyReward(user: MazariniUser, event: IMazariniEventEntry, channelId: string) {
        const rewardItem = RandomUtils.getRandomItemFromList(DondItems.getRewardsForQuality(event.reward.tier)) as IEffectItem
        const effectResult = rewardItem.effect(user, this.client.database)
        await this.client.database.updateUser(user)

        if (rewardItem.lootReward) {
            this.client.bank.rewardLoot(
                channelId,
                user.id,
                rewardItem.lootReward.type,
                rewardItem.lootReward.quality,
                `${MentionUtils.mentionUser(user.id)} du får ${rewardItem.label} for eventet!`
            )
        }

        if (Array.isArray(effectResult) && effectResult.length > 0) {
            await this.client.messageHelper.sendMessage(channelId, { components: effectResult })
        }

        return rewardItem.label
    }

    private getTriggerCount() {
        return RandomUtils.chooseWeightedItem([
            { value: 1, weight: 1 },
            { value: 2, weight: 4 },
            { value: 3, weight: 4 },
            { value: 4, weight: 2 },
            { value: 5, weight: 1 },
        ])
    }

    private getTriggerTimes(triggerCount: number) {
        const allHours = this.range(7, 21)
        const earlyHours = this.range(7, 14)
        const selectedHours = [RandomUtils.getRandomItemFromList(earlyHours)]

        while (selectedHours.length < triggerCount) {
            const available = allHours.filter((hour) => !selectedHours.includes(hour))
            selectedHours.push(RandomUtils.getRandomItemFromList(available))
        }

        return selectedHours.sort((a, b) => a - b).map((hour) => ({ hour, minute: RandomUtils.getRandomInteger(0, 59) }))
    }

    private formatTime(hour: number, minute: number) {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    }

    private getRandomEventType() {
        return RandomUtils.getRandomItemFromList([
            MazariniEventType.DiceRoll,
            MazariniEventType.DeathrollWin,
            MazariniEventType.DeathrollPotWin,
            MazariniEventType.CCGHoieWin,
            MazariniEventType.CCGPlayerWin,
            MazariniEventType.VladivostokGambleWin,
        ])
    }

    private range(start: number, end: number) {
        return Array.from({ length: end - start + 1 }, (_, index) => start + index)
    }

    private getDayKey(date = new Date()) {
        const year = date.getFullYear()
        const month = `${date.getMonth() + 1}`.padStart(2, '0')
        const day = `${date.getDate()}`.padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    private toUnix(date: Date) {
        return Math.floor(date.getTime() / 1000)
    }

    private saveState(state: IMazariniEventState) {
        this.client.database.updateStorage({ events: this.serializeState(state) })
    }

    private serializeState(state: IMazariniEventState): IMazariniEventState {
        return {
            dayKey: state.dayKey,
            scheduled: state.scheduled.map((event) => this.serializeEntry(event)),
            active: state.active.map((event) => this.serializeEntry(event)),
            completed: state.completed.map((event) => this.serializeEntry(event)),
        }
    }

    private serializeEntry(event: IMazariniEventEntry): IMazariniEventEntry {
        const serialized = {
            id: event.id,
            type: event.type,
            triggerHour: event.triggerHour,
            triggerMinute: event.triggerMinute,
            channelId: event.channelId,
            title: event.title,
            description: event.description,
            reward: event.reward,
        } as IMazariniEventEntry

        if (event.activatedAt !== undefined) serialized.activatedAt = event.activatedAt
        if (event.completedAt !== undefined) serialized.completedAt = event.completedAt
        if (event.winnerId !== undefined) serialized.winnerId = event.winnerId

        return serialized
    }
}
