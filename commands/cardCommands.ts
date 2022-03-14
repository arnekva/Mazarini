import { Client, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'
const deckOfCards = require('deckofcards')

export class CardCommands extends AbstractCommands {
    private deck: any

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.deck = new deckOfCards.Deck()
    }

    static cardTranslations: Map<string, string> = new Map<string, string>([
        ["2","2"],
        ["3","3"],
        ["4","4"],
        ["5","5"],
        ["6","6"],
        ["7","7"],
        ["8","8"],
        ["9","9"],
        ["T","10"],
        ["J","J"],
        ["Q","Q"],
        ["K","K"],
        ["A","A"],
        ["S","spades"],
        ["C","clubs"],
        ["H","hearts"],
        ["D","diamonds"]
    ])

    private getTranslation(param: string) {
        let value = CardCommands.cardTranslations.get(param)
        return value ? value : ""
    }

    private drawCard(message: Message) {
        let card = this.deck.draw()
        if (card === undefined) {
            this.messageHelper.sendMessage(message.channelId, "Kortstokken er tom for kort")
            return false
        }
        let number = CardCommands.cardTranslations.get(card.toString().substring(0,1))
        let suite: string = this.getTranslation(card.toString().substring(1,2))
        this.messageHelper.sendMessage(message.channelId, ":" + suite + ":" + number + ":" + suite + ":")
        return true
    }

    private resetDeck(message: Message) {
        this.deck.reset();
        this.messageHelper.sendMessage(message.channelId, "Kortstokken er nullstilt og stokket")
    }

    private shuffleDeck(message: Message) {
        this.deck.shuffle();
        this.messageHelper.sendMessage(message.channelId, "Kortstokken er stokket")
    }

    private remainingCards(message: Message) {
        let remaining = this.getRemainingCards()
        if (remaining > 0) {
            this.messageHelper.sendMessage(message.channelId, "Det er " + remaining + " kort igjen i kortstokken")
        } else {
            this.messageHelper.sendMessage(message.channelId, "Kortstokken er tom for kort")
        }
    }

    private getRemainingCards() {
        let cards = this.deck.toString()
        const regex = new RegExp('C|D|S|H')
        if (!regex.test(cards)) {
            return 0
        } else {
            let cardArray: string[] = cards.split(",")
            return cardArray.length
        }
    }

    private cardSwitch(message: Message, messageContent: string, args: string[]) {
        if (args[0]) {
            switch(args[0].toLowerCase()) {
                case "trekk": {
                    if (args[1]) {
                        if (Number(args[1])) {
                            let amount = Math.floor(Number(args[1]))
                            let remaining = this.getRemainingCards()
                            if (remaining == 0) {
                                this.messageHelper.sendMessage(message.channelId, "Kortstokken er tom for kort")
                                return
                            }
                            if (amount > 0 && amount <= remaining) {
                                for (let i = 0; i < amount; i++) {
                                    this.drawCard(message)
                                }
                            } else if (amount < 0) {
                                this.messageHelper.sendMessage(message.channelId, 
                                    "Det er en fordel å komme med et positivt tall")
                            } else if (amount == 0) {
                                this.messageHelper.sendMessage(message.channelId, 
                                    "Desimaltall rundes ned")
                            } else {
                                this.messageHelper.sendMessage(message.channelId, 
                                    "Det er bare " + remaining + " kort igjen i kortstokken")
                            }
                        } else {
                            this.messageHelper.sendMessage(message.channelId, 
                                "Kom gjerne med et tall etter 'trekk'")
                        }
                    } else {
                        this.drawCard(message)
                    }
                    break
                }
                case "resett": {
                    this.resetDeck(message)
                    break
                }
                case "stokk": {
                    this.shuffleDeck(message)
                    break
                }
                case "gjenstår": {
                    this.remainingCards(message)
                    break
                }
                default: {
                    this.messageHelper.sendMessage(message.channelId, 
                        "Tilgjengelige kortkommandoer er: 'trekk [tall: optional]', 'stokk', 'resett' og 'gjenstår'")
                }
            }
        } else {
            this.messageHelper.sendMessage(message.channelId, 
                "Du må inkludere en av følgende etter 'kort': 'trekk [tall: optional]', 'stokk', 'resett' og 'gjenstår'")
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'kort',
                description:
                    "Diverse kortkommandoer",
                hideFromListing: false,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.cardSwitch(rawMessage, messageContent, args)
                },

                category: 'annet',
            },
        ]
    }
}
