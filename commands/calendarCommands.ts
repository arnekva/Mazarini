/* eslint-disable require-await */
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js'
import moment from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../Abstracts/MazariniInteraction'
import { MazariniClient } from '../client/MazariniClient'
import { IUserEffects, LootboxQuality, MazariniStorage, MazariniUser, UserCalendarGift } from '../interfaces/database/databaseInterface'
import { IInteractionElement, IOnTimedEvent } from '../interfaces/interactionInterface'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils } from '../utils/dateUtils'
import { LootboxCommands } from './store/lootboxCommands'

export class CalendarCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async claimCalendarGift(interaction: ChatInteraction | BtnInteraction) {
        const isValidTimeFrame = DateUtils.currentDateIsBetween(
            moment(`01-12-${new Date().getFullYear()} 05:00`, 'DD-MM-YYYY HH:mm'),
            moment(`31-12-${new Date().getFullYear()} 23:59`, 'DD-MM-YYYY HH:mm')
        )
        if (!isValidTimeFrame) {
            return this.messageHelper.replyToInteraction(interaction, `Julekalenderen er ikkje ferdiginnpakket før 01 Desember kl 05:00`)
        }

        const embed = new EmbedBuilder()
        embed.setTitle(`:santa: Julekalender :santa:`)

        const user = await this.client.database.getUser(interaction.user.id)
        const gift = this.getEarliestClaimableGift(user)
        if (gift) {
            gift.opened = true
            const calendarGift = christmasCalendarGifts.find((calendarGift) => calendarGift.id === gift.calendarGiftId)

            const button = calendarGift.effect(user)
            embed.setDescription(`Din kalendergave for ${DateUtils.formatDate(new Date(gift.date))} er ${calendarGift.message}`)
            embed.setThumbnail('https://freepngimg.com/thumb/gift/8-2-gift-png-image.png')
            this.client.database.updateUser(user, true)
            this.messageHelper.replyToInteraction(interaction, embed, undefined, button)
        } else {
            embed.setDescription('Du har allerede åpnet dagens kalendergave. Vent te imårå klokkå 05:00')
            this.messageHelper.replyToInteraction(interaction, embed)
        }
    }

    private getEarliestClaimableGift(user: MazariniUser) {
        if (!user.christmasCalendar) this.generateCalendarForUser(user)
        const ecg = user.christmasCalendar.filter((gift) => !gift.opened).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
        return new Date(ecg.date) <= new Date() ? ecg : undefined
    }

    public generateCalendarForUser(user: MazariniUser) {
        if (user.christmasCalendar) return
        const calendarCopy = christmasCalendarGifts.slice(0, 23)
        const calendar = ArrayUtils.shuffleArray(calendarCopy)
        calendar.push(christmasCalendarGifts[23])
        const userCalendar: Array<UserCalendarGift> = calendar.map((gift, index) => {
            const date = new Date(`${new Date().getFullYear()}-12-${DateUtils.addZero(index + 1)}T05:00:00`)

            return { date: date, calendarGiftId: gift.id, opened: false }
        })
        user.christmasCalendar = userCalendar
        this.client.database.updateUser(user)
    }

    private resetShuffleEffect() {
        // Reset shuffleIgnoresDigits for global storage if present
        this.client.database.getStorage?.().then((storage) => {
            if (storage?.effects?.positive?.shuffleIgnoresDigits) {
                storage.effects.positive.shuffleIgnoresDigits = true
                this.client.database.updateStorage?.(storage)
            }
        })
        return true
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'julekalender',
                        command: (rawInteraction: ChatInteraction) => {
                            this.claimCalendarGift(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
    async onTimedEvent(): Promise<IOnTimedEvent> {
        return {
            daily: [() => this.resetShuffleEffect()],
            weekly: [
                () => {
                    return true
                },
            ],
            hourly: [],
        }
    }
}

export interface ICalendarGift {
    id: number
    message: string //følger formatet "Din kalendergave for {dato} er {message}"
    effect(user: MazariniUser, storage?: MazariniStorage): undefined | ActionRowBuilder<ButtonBuilder>[]
}

const christmasCalendarGifts: Array<ICalendarGift> = [
    {
        id: 1,
        message: '2500 chips!',
        effect: (user: MazariniUser) => {
            user.chips += 2500

            return undefined
        },
    },
    {
        id: 2,
        message: '1 ekstra /spin!',
        effect: (user: MazariniUser) => {
            user.dailySpins += 1
            return undefined
        },
    },
    {
        id: 3,
        message: 'en basic lootchest!',
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getLootRewardButton(user.id, LootboxQuality.Basic, true)]
        },
    },
    {
        id: 4,
        message: 'et get out of jail free kort! Dette vil automatisk hindre deg fra å bli fengslet neste gang.',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.jailPass = (user.effects.positive.jailPass ?? 0) + 1
            return undefined
        },
    },
    {
        id: 5,
        message: '5 gratis /roll!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 5
            return undefined
        },
    },
    {
        id: 6,
        message: '3000 chips!',
        effect: (user: MazariniUser) => {
            user.chips += 3000
            return undefined
        },
    },
    {
        id: 7,
        message: 'en basic lootchest!',
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getLootRewardButton(user.id, LootboxQuality.Basic, true)]
        },
    },
    {
        id: 8,
        message: 'en premium lootchest!',
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getLootRewardButton(user.id, LootboxQuality.Premium, true)]
        },
    },
    {
        id: 9,
        message: '3000 chips!',
        effect: (user: MazariniUser) => {
            user.chips += 3000
            return undefined
        },
    },
    {
        id: 10,
        message: '2500 chips!',
        effect: (user: MazariniUser) => {
            user.chips += 2500
            return undefined
        },
    },
    {
        id: 11,
        message: '1 ekstra /spin !',
        effect: (user: MazariniUser) => {
            user.dailySpins += 1
            return undefined
        },
    },
    {
        id: 12,
        message: 'at dine tre neste hasjwins dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 3
            return undefined
        },
    },
    {
        id: 13,
        message: '1 ekstra /spin !',
        effect: (user: MazariniUser) => {
            user.dailySpins += 1
            return undefined
        },
    },
    {
        id: 14,
        message: 'at dine to neste hasjwins dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 2
            return undefined
        },
    },
    {
        id: 15,
        message: '5 gratis /roll!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 5
            return undefined
        },
    },
    {
        id: 16,
        message: '6 gratis /roll!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 6
            return undefined
        },
    },
    // {
    //     id: 16,
    //     message: 'at loot-farge-sannsynlighetene snus på hodet! Du har nå større sannsynlighet for å få diamond enn silver ut dagen!',
    //     effect: (user: MazariniUser) => {
    //         user.effects = user.effects ?? defaultEffects
    //         user.effects.positive.lootColorsFlipped = true
    //         return undefined
    //     },
    // },
    // {
    //     id: 17,
    //     message: 'at loot-farge-sannsynlighetene snus på hodet! Du har nå større sannsynlighet for å få diamond enn silver ut dagen!',
    //     effect: (user: MazariniUser) => {
    //         user.effects = user.effects ?? defaultEffects
    //         user.effects.positive.lootColorsFlipped = true
    //         return undefined
    //     },
    // },
    {
        id: 17,
        message: 'at du har 5x større sannsynlighet for å heller få en lootbox som reward ved hasjinnskudd - ut dagen!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.deahtrollLootboxChanceMultiplier = 5
            return undefined
        },
    },
    {
        id: 18,
        message: 'shuffle er ikke lenger siffer-begrenset for alle ut dagen!',
        effect: (user: MazariniUser, storage) => {
            if (storage) {
                if (!storage.effects) storage.effects = { positive: {} }
                if (!storage.effects.positive) storage.effects.positive = {}
                storage.effects.positive.shuffleIgnoresDigits = true
            }

            return undefined
        },
    },
    {
        id: 19,
        message: 'shuffle er ikke lenger siffer-begrenset for alle ut dagen!',
        effect: (user: MazariniUser, storage) => {
            if (storage) {
                if (!storage.effects) storage.effects = { positive: {} }
                if (!storage.effects.positive) storage.effects.positive = {}
                storage.effects.positive.shuffleIgnoresDigits = true
            }

            return undefined
        },
    },
    {
        id: 20,
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 5
            return undefined
        },
    },
    {
        id: 21,
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 5
            return undefined
        },
    },
    {
        id: 22,
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 5
            return undefined
        },
    },
    {
        id: 23,
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 5
            return undefined
        },
    },
    // {
    //     id: 23,
    //     message: 'garantert farge på dine neste tre rewards!',
    //     effect: (user: MazariniUser) => {
    //         user.effects = user.effects ?? defaultEffects
    //         user.effects.positive.guaranteedLootColor = (user.effects.positive.guaranteedLootColor ?? 0) + 3
    //         return undefined
    //     },
    // },
    {
        id: 24,
        message: 'en elite chest! God jul :christmas_tree:',
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getLootRewardButton(user.id, LootboxQuality.Elite, true)]
        },
    },
]

const defaultEffects: IUserEffects = {
    positive: {},
    negative: {},
}
