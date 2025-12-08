import { BtnInteraction } from '../../../../Abstracts/MazariniInteraction'
import { EmojiHelper } from '../../../../helpers/emojiHelper'
import { RandomUtils } from '../../../../utils/randomUtils'
import { CardCommands } from '../../../games/cardCommands'
import { RedBlackCommands } from '../redBlackCommands'
import { IGameRules, IGiveTakeCard } from '../redBlackInterfaces'

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

    public async generateGiveTakeTable(interaction: BtnInteraction) {
        const levels = this.rules.gtLevelSips.length
        //If Ace has not been drawn before round 3, the value is randomly set now
        if (!RedBlackCommands.aceValue) {
            RedBlackCommands.aceValue = RandomUtils.getFiftyFifty() ? 1 : 14
        }

        let key = 0
        for (let i = 1; i < levels; i++) {
            for (let y = 1; y <= 3; y++) {
                this.gtTable.set(key++, {
                    card: await this.drawCard(),
                    give: y == 1 || y == 3,
                    take: y == 2 || y == 3,
                    sips: this.rules.gtLevelSips[i - 1],
                    revealed: false,
                })
            }
        }
        this.gtTable.set(key, { card: await this.drawCard(), give: false, take: true, sips: this.rules.gtLevelSips[levels - 1], revealed: false })
    }

    private async drawCard() {
        if (this.deck.getRemainingCards() > 0) {
            return await this.deck.drawCard()
        }
        this.deck.shuffleDeck()
        return await this.deck.drawCard()
    }

    public async printGiveTakeTable(interaction: BtnInteraction) {
        let tableString = ''
        const levels = this.rules.gtLevelSips.length
        let iterateId = this.gtTable.size - 1
        const chugCard = this.gtTable.get(iterateId--)
        const emptyCard = (await EmojiHelper.getEmoji('emptyCard', interaction)).id
        const faceCard = (await EmojiHelper.getEmoji('faceCard', interaction)).id
        tableString += `${emptyCard} ${chugCard.revealed ? chugCard.card.emoji : faceCard}`

        for (let i = levels - 1; i > 0; i--) {
            tableString += '\n\n'
            const gtCard = this.gtTable.get(iterateId--)
            const tCard = this.gtTable.get(iterateId--)
            const gCard = this.gtTable.get(iterateId--)
            const gtCardStr = gtCard.revealed ? `${gtCard.card.emoji} ` : `${faceCard} `
            const tCardStr = tCard.revealed ? `${tCard.card.emoji} ` : `${faceCard} `
            const gCardStr = gCard.revealed ? `${gCard.card.emoji} ` : `${faceCard} `
            tableString += gCardStr + tCardStr + gtCardStr
        }
        return tableString
    }

    public revealNextGTCard(interaction: BtnInteraction) {
        this.currentGtCard = this.gtTable.get(this.gtNextCardId++)
        this.currentGtCard.revealed = true
        return this.currentGtCard
    }
}
