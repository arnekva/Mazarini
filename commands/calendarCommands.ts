import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import moment from "moment"
import { AbstractCommands } from "../Abstracts/AbstractCommand"
import { MazariniClient } from "../client/MazariniClient"
import { IUserEffects, LootboxQuality, MazariniUser, UserCalendarGift } from "../interfaces/database/databaseInterface"
import { IInteractionElement } from "../interfaces/interactionInterface"
import { ArrayUtils } from "../utils/arrayUtils"
import { DateUtils } from "../utils/dateUtils"
import { LootboxCommands } from "./store/lootboxCommands"


export class CalendarCommands extends AbstractCommands {
    
    constructor(client: MazariniClient) {
        super(client)
    }

    private async claimCalendarGift(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const isValidTimeFrame = DateUtils.currentDateIsBetween(
            moment(`01-12-${new Date().getFullYear()} 05:00`, 'DD-MM-YYYY HH:mm'),
            moment(`31-12-${new Date().getFullYear()} 23:59`, 'DD-MM-YYYY HH:mm')
        )
        if (!isValidTimeFrame) {
            return this.messageHelper.replyToInteraction(
                interaction,
                `Julekalenderen er ikkje ferdiginnpakket før 01 Desember kl 05:00`
            )
        }
        
        const embed = new EmbedBuilder()
        embed.setTitle(`:santa: Julekalender :santa:`)

        const user = await this.client.database.getUser(interaction.user.id)
        const gift = this.getEarliestClaimableGift(user)
        if (gift) {
            gift.opened = true
            const calendarGift = christmasCalendarGifts.find(calendarGift => calendarGift.id === gift.calendarGiftId)
            
            const button = calendarGift.effect(user)
            embed.setDescription(`Din kalendergave for ${DateUtils.formatDate(new Date(gift.date))} er ${calendarGift.message}`)
            embed.setThumbnail('https://freepngimg.com/thumb/gift/8-2-gift-png-image.png')
            this.client.database.updateUser(user)
            this.messageHelper.replyToInteraction(interaction, embed, undefined, button)
        } else {
            embed.setDescription('Du har allerede åpnet dagens kalendergave. Vent te imårå klokkå 05:00')
            this.messageHelper.replyToInteraction(interaction, embed)
        }
    }

    private getEarliestClaimableGift(user: MazariniUser) {
        if (!user.christmasCalendar) this.generateCalendarForUser(user)
        const ecg = user.christmasCalendar.filter(gift => !(gift.opened)).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]        
        return new Date(ecg.date) <= new Date() ? ecg : undefined
    }

    public generateCalendarForUser(user: MazariniUser) {
        if (user.christmasCalendar) return
        const calendarCopy = christmasCalendarGifts.slice(0,23)
        const calendar = ArrayUtils.shuffleArray(calendarCopy)
        calendar.push(christmasCalendarGifts[23])
        const userCalendar: Array<UserCalendarGift> = calendar.map((gift, index) => {
            const date = new Date(`${new Date().getFullYear()}-12-${DateUtils.addZero(index+1)}T05:00:00`)
            return {date: date, calendarGiftId: gift.id, opened: false}
        })
        user.christmasCalendar = userCalendar
        this.client.database.updateUser(user)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'julekalender',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.claimCalendarGift(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
    
}

export interface ICalendarGift {
    id: number
    message: string //følger formatet "Din kalendergave for {dato} er {message}"
    effect(user: MazariniUser): undefined | ActionRowBuilder<ButtonBuilder>[]
}

const christmasCalendarGifts: Array<ICalendarGift> = [
    { 
        id: 1, 
        message: '2500 chips!', 
        effect: (user: MazariniUser) => {
            user.chips += 2500
            return undefined
        }
    },
    { 
        id: 2,
        message: '10 ekstra /spin rewards!', 
        effect: (user: MazariniUser) => {
            user.dailySpinRewards -= 10
            return undefined
        }
    },
    { 
        id: 3,
        message: 'en basic lootbox!', 
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getDailyLootboxRewardButton(user.id, LootboxQuality.Basic)]
        }
    },
    { 
        id: 4,
        message: 'et get out of jail free kort! Dette vil automatisk hindre deg fra å bli fengslet neste gang.', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.jailPass = user.effects.positive.jailPass ? user.effects.positive.jailPass + 1 : 1
            return undefined
        }
    },
    { 
        id: 5,
        message: '5 gratis /roll!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.freeRolls = user.effects.positive.freeRolls ? user.effects.positive.freeRolls + 5 : 5
            return undefined
        }
    },
    { 
        id: 6,
        message: '3000 chips!', 
        effect: (user: MazariniUser) => {
            user.chips += 3000
            return undefined
        }
    },
    { 
        id: 7,
        message: 'en basic lootbox!', 
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getDailyLootboxRewardButton(user.id, LootboxQuality.Basic)]
        }
    },
    { 
        id: 8,
        message: 'en premium lootbox!', 
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getDailyLootboxRewardButton(user.id, LootboxQuality.Premium)]
        }
    },
    { 
        id: 9,
        message: '3000 chips!', 
        effect: (user: MazariniUser) => {
            user.chips += 3000
            return undefined
        }
    },
    { 
        id: 10,
        message: '2500 chips!', 
        effect: (user: MazariniUser) => {
            user.chips += 2500
            return undefined
        }
    },
    { 
        id: 11,
        message: '10 ekstra /spin rewards!', 
        effect: (user: MazariniUser) => {
            user.dailySpinRewards -= 10
            return undefined
        }
    },
    { 
        id: 12,
        message: 'at dine to neste hasjwins dobles!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotWins = 2
            return undefined
        }
    },
    { 
        id: 13,
        message: '10 ekstra /spin rewards!', 
        effect: (user: MazariniUser) => {
            user.dailySpinRewards -= 10
            return undefined
        }
    },
    { 
        id: 14,
        message: 'at dine to neste hasjwins dobles!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotWins = 2
            return undefined
        }
    },
    { 
        id: 15,
        message: '5 gratis /roll!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.freeRolls = user.effects.positive.freeRolls ? user.effects.positive.freeRolls + 5 : 5
            return undefined
        }
    },
    { 
        id: 16,
        message: 'loot-farge-sannsynlighetene snus på hodet! Du har nå større sannsynlighet for å få diamond enn silver ut dagen!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.lootColorsFlipped = true
            return undefined
        }
    },
    { 
        id: 17,
        message: 'loot-farge-sannsynlighetene snus på hodet! Du har nå større sannsynlighet for å få diamond enn silver ut dagen!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.lootColorsFlipped = true
            return undefined
        }
    },
    { 
        id: 18,
        message: '2500 chips!', 
        effect: (user: MazariniUser) => {
            user.chips += 2500
            return undefined
        }
    },
    { 
        id: 19,
        message: '3000 chips!', 
        effect: (user: MazariniUser) => {
            user.chips += 3000
            return undefined
        }
    },
    { 
        id: 20,
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = 5
            return undefined
        }
    },
    { 
        id: 21,
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = 5
            return undefined
        }
    },
    { 
        id: 22,
        message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.doublePotDeposit = 5
            return undefined
        }
    },
    { 
        id: 23,
        message: 'dobbel sannsynlighet for farge på alle lootboxene dine ut dagen!', 
        effect: (user: MazariniUser) => {
            user.effects = user.effects ?? defaultEffects
            user.effects.positive.lootColorChanceMultiplier = 2
            return undefined
        }
    },
    { 
        id: 24, 
        message: 'en elite lootbox! God jul :christmas_tree:', 
        effect: (user: MazariniUser) => {
            return [LootboxCommands.getDailyLootboxRewardButton(user.id, LootboxQuality.Elite)]
        }
    },
]

const defaultEffects: IUserEffects = {
    positive: {},
    negative: {}
}