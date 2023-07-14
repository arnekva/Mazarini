import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonInteraction, CacheType } from "discord.js"
import { EmojiHelper } from "../../../../helpers/emojiHelper"
import { CardCommands, ICardObject } from "../../../cardCommands"
import { setupGameButtonRow } from "../redBlackButtonRows"
import { IGameRules, IGiveTakeCard } from "../redBlackInterfaces"

export class GiveTake {
    private deck: CardCommands
    private rules: IGameRules
    private gtTable: Map<number, IGiveTakeCard>
    private currentGtCard: IGiveTakeCard
    private gtNextCardId: number

    constructor(deck: CardCommands, defaultRules: IGameRules) {
        this.deck = deck
        this.rules = defaultRules
        this.gtTable = new Map<number, IGiveTakeCard>()
        this.currentGtCard = undefined
        this.gtNextCardId = 0
    }

    public async generateGiveTakeTable(interaction: ButtonInteraction<CacheType>) {
        const levels = this.rules.gtLevelSips.length
        let key = 0
        for (var i = 1; i < levels; i++) 
        {
            for (var y = 1; y <= 3; y++) 
            {
                this.gtTable.set(key++,
                    { card: await this.drawCard(interaction) 
                    , give: y == 1 || y == 3
                    , take: y == 2 || y == 3
                    , sips: this.rules.gtLevelSips[i-1]
                    , revealed: false
                    }
                )
            }
        }
        this.gtTable.set(key, 
                    { card: await this.drawCard(interaction) 
                    , give: false
                    , take: true
                    , sips: this.rules.gtLevelSips[levels-1]
                    , revealed: false
                    }
        )        
    }

    private async drawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.deck.getRemainingCards() > 0) {
            return await this.deck.drawCard(interaction)
        }
        this.deck.shuffleDeck()
        return await this.deck.drawCard(interaction)
    }

    public async printGiveTakeTable(interaction: ButtonInteraction<CacheType>) {                
        let tableString = ''
        const levels = this.rules.gtLevelSips.length
        let iterateId = this.gtTable.size - 1
        const chugCard = this.gtTable.get(iterateId--)
        const emptyCard = (await EmojiHelper.getEmoji('emptyCard', interaction)).id
        const faceCard = (await EmojiHelper.getEmoji('faceCard', interaction)).id
        tableString += `${emptyCard} ${chugCard.revealed ? chugCard.card.printString : faceCard}`
        
        for (var i = levels-1; i > 0; i--) 
        {
            tableString += '\n\n'
            const gtCard = this.gtTable.get(iterateId--)
            const tCard = this.gtTable.get(iterateId--)
            const gCard = this.gtTable.get(iterateId--)
            const gtCardStr = gtCard.revealed ? `${gtCard.card.printString} ` : `${faceCard} `
            const tCardStr = tCard.revealed ? `${tCard.card.printString} ` : `${faceCard} `
            const gCardStr = gCard.revealed ? `${gCard.card.printString} ` : `${faceCard} `
            tableString += (gCardStr + tCardStr + gtCardStr)
        }
        return tableString
    }

    public revealNextGTCard(interaction: ButtonInteraction<CacheType>) {
        this.currentGtCard = this.gtTable.get(this.gtNextCardId++)
        this.currentGtCard.revealed = true
        return this.currentGtCard
    }
}