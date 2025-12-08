import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'

import { EmojiHelper } from '../../helpers/emojiHelper'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { RandomUtils } from '../../utils/randomUtils'
const deckOfCards = require('deckofcards')

export interface ICardObject {
    number: number
    suit: string
    rank?: string
    emoji: string
    image: string
}

export class CardCommands extends AbstractCommands {
    private deck: any[]
    private aceValue: 1 | 14 = 14
    private numberOfDecks: number

    constructor(client: MazariniClient, numberOfDecks: number = 1) {
        super(client)
        this.deck = [new deckOfCards.Deck()]
        for (let i = 1; i < numberOfDecks; i++) {
            this.deck.push(new deckOfCards.Deck()) //Todo: fix
        }
        this.numberOfDecks = numberOfDecks
    }

    static numberTranslations = (customAceValue?: number): Map<string, number> => {
        return new Map<string, number>([
            ['2', 2],
            ['3', 3],
            ['4', 4],
            ['5', 5],
            ['6', 6],
            ['7', 7],
            ['8', 8],
            ['9', 9],
            ['T', 10],
            ['J', 11],
            ['Q', 12],
            ['K', 13],
            ['A', customAceValue ? customAceValue : 14],
        ])
    }
    static reverseNumberTranslations = (customAceValue?: number): Map<number, string> => {
        return new Map<number, string>([
            [2, '2'],
            [3, '3'],
            [4, '4'],
            [5, '5'],
            [6, '6'],
            [7, '7'],
            [8, '8'],
            [9, '9'],
            [10, 'T'],
            [11, 'J'],
            [12, 'Q'],
            [13, 'K'],
            [customAceValue ? customAceValue : 14, 'A'],
        ])
    }

    static cardTranslations: Map<string, string> = new Map<string, string>([
        ['2', '2'],
        ['3', '3'],
        ['4', '4'],
        ['5', '5'],
        ['6', '6'],
        ['7', '7'],
        ['8', '8'],
        ['9', '9'],
        ['T', '10'],
        ['J', 'J'],
        ['Q', 'Q'],
        ['K', 'K'],
        ['A', 'A'],
        ['S', ' ♤ '],
        ['C', ' ♧ '],
        ['H', ' ♡ '],
        ['D', ' ♢ '],
    ])

    public static stringToNumber(number: string) {
        return CardCommands.numberTranslations().get(number)
    }

    public static numberToString(number: number) {
        return CardCommands.reverseNumberTranslations().get(number)
    }

    public getTranslation(param: string) {
        let value = CardCommands.cardTranslations.get(param)
        return value ? value : ''
    }

    public getStringPrint(card: ICardObject) {
        const suit = this.getTranslation(card.suit)
        const num = this.getTranslation(CardCommands.numberToString(card.number))
        return `${suit} ${num} ${suit}`
    }

    public async createCardObject(card: string) {
        const number = CardCommands.numberTranslations(this.aceValue).get(card.substring(0, 1))
        const rank = card.substring(0, 1)
        const suit = card.substring(1, 2)
        const emoji = await EmojiHelper.getEmoji(card, this.client)
        const image = `https://cdn.discordapp.com/emojis/${emoji.urlId}.webp?size=96&quality=lossless`
        return { number: number, suit: suit, rank: rank, emoji: emoji.id, image: image }
    }

    public async drawCard(): Promise<ICardObject> {
        const deck = RandomUtils.getRandomInteger(1, this.deck.length)
        const card = this.deck[deck - 1].draw()

        if (card === undefined) {
            if (this.deck.length > 1) {
                this.deck.splice(deck - 1, 1)
                return await this.drawCard()
            } else {
                return undefined
            }
        }
        return await this.createCardObject(card.toString())
    }

    public resetDeck(): string {
        this.deck = [new deckOfCards.Deck()]
        for (let i = 1; i < this.numberOfDecks; i++) {
            this.deck.push(new deckOfCards.Deck()) //Todo: fix
        }
        return 'Kortstokken er nullstilt og stokket'
    }

    public shuffleDeck() {
        this.deck.forEach((deck) => deck.shuffle())
        return 'Kortstokken er stokket'
    }

    public remainingCards() {
        const remaining = this.getRemainingCards()
        return remaining > 0 ? 'Det er ' + remaining + ' kort igjen i kortstokken' : 'Kortstokken er tom for kort'
    }

    public getRemainingCards() {
        let totalCards = 0
        this.deck.forEach((deck) => {
            let cards = deck.toString()
            const regex = new RegExp('C|D|S|H')
            if (regex.test(cards)) {
                let cardArray: string[] = cards.split(',')
                totalCards += cardArray.length
            }
        })
        return totalCards
    }

    private async cardSwitch(interaction: ChatInteraction) {
        const isTrekk = interaction.options.getSubcommand() === 'trekk'
        const isReset = interaction.options.getSubcommand() === 'resett'
        const isShufle = interaction.options.getSubcommand() === 'stokk'
        const isCheckRemaining = interaction.options.getSubcommand() === 'mengde'

        if (isTrekk) {
            let amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('antall')?.value)
            if (!amount) amount = 1
            let remaining = this.getRemainingCards()
            if (remaining == 0) {
                this.messageHelper.replyToInteraction(interaction, 'Kortstokken er tom for kort')
            } else {
                if (amount > 0) {
                    let drawPile = ''
                    if (amount > remaining) {
                        drawPile = 'Du har valgt å trekke mer enn det er kort igjen i kortstokken, så du trekker alt\n'
                        amount = remaining
                    }
                    for (let i = 0; i < amount; i++) {
                        const card = await this.drawCard()
                        drawPile += `${card.emoji}\n`
                    }
                    this.messageHelper.replyToInteraction(interaction, drawPile)
                } else {
                    this.messageHelper.replyToInteraction(interaction, 'Du har ikke gitt et gyldig tall, og det ignoreres derfor', { ephemeral: true })
                }
            }
        } else if (isReset) {
            const msg = this.resetDeck()
            this.messageHelper.replyToInteraction(interaction, msg)
        } else if (isShufle) {
            const msg = this.shuffleDeck()
            this.messageHelper.replyToInteraction(interaction, msg)
        } else if (isCheckRemaining) {
            const msg = this.remainingCards()
            this.messageHelper.replyToInteraction(interaction, msg)
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Ukjent kommando', { ephemeral: true })
        }
    }
    public get valueOfAce() {
        return this.aceValue
    }
    public set valueOfAce(v: 1 | 14) {
        this.aceValue = v
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'kort',
                        command: (rawInteraction: ChatInteraction) => {
                            this.cardSwitch(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
