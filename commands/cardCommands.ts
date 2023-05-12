import { ButtonInteraction, CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { IInteractionElement } from '../general/commands'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { SlashCommandHelper } from '../helpers/slashCommandHelper'
const deckOfCards = require('deckofcards')

export interface ICardObject {
    number: string
    suite: string
    printString: string
    url: string
}

export class CardCommands extends AbstractCommands {
    private deck: any

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.deck = new deckOfCards.Deck()
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

    public getTranslation(param: string) {
        let value = CardCommands.cardTranslations.get(param)
        return value ? value : ''
    }

    public async createCardObject(card: string, interaction: ButtonInteraction<CacheType>) {
        let number = card.substring(0, 1)
        let suite = card.substring(1, 2)
        let emoji = await EmojiHelper.getEmoji(card, interaction)
        const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.urlId}.webp?size=96&quality=lossless`
        const cardObject: ICardObject = { number: number, suite: suite, printString: emoji.id, url: emojiUrl }
        return cardObject
    }

    public drawCard(): string {
        let card = this.deck.draw()
        if (card === undefined) {
            return 'Kortstokken er tom for kort'
        }

        return card.toString()
    }

    public resetDeck(): string {
        this.deck.reset()
        return 'Kortstokken er nullstilt og stokket'
    }

    public shuffleDeck() {
        this.deck.shuffle()
        return 'Kortstokken er stokket'
    }

    public remainingCards() {
        const remaining = this.getRemainingCards()
        return remaining > 0 ? 'Det er ' + remaining + ' kort igjen i kortstokken' : 'Kortstokken er tom for kort'
    }

    private getRemainingCards() {
        let cards = this.deck.toString()
        const regex = new RegExp('C|D|S|H')
        if (!regex.test(cards)) {
            return 0
        } else {
            let cardArray: string[] = cards.split(',')
            return cardArray.length
        }
    }

    private cardSwitch(interaction: ChatInputCommandInteraction<CacheType>) {
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
                        const card = this.drawCard()

                        let number = CardCommands.cardTranslations.get(card.toString().substring(0, 1))
                        let suite: string = this.getTranslation(card.toString().substring(1, 2))
                        drawPile += `${suite.trim()} ${number} ${suite.trim()}\n`
                    }
                    this.messageHelper.replyToInteraction(interaction, drawPile)
                } else {
                    this.messageHelper.replyToInteraction(interaction, 'Du har ikke gitt et gyldig tall, og det ignoreres derfor', true)
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
            this.messageHelper.replyToInteraction(interaction, 'Ukjent kommando', true)
        }
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'kort',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.cardSwitch(rawInteraction)
                },
            },
        ]
    }
}
