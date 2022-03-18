import { Client, Message, ReactionCollector } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { CardCommands } from './cardCommands'
import { globals } from '../globals'

interface IUserObject {
    name: string;
    id: number;
    card: ICardObject;
}

interface ICardObject {
    number: string;
    suite: string;
    printString: string;
}

export class DrinksCommands extends AbstractCommands {
    private playerList: IUserObject[]
    private activeGame: boolean
    private deck: CardCommands
    private id: number
    private reactor: any

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.activeGame = false
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(client, messageHelper)
        this.id = 0
        this.reactor = undefined
    }

    private setCardOnUser(username: string, card: string) {
        let userObject = this.getUserObject(username)
        let cardObject = this.createCardObject(card)
        userObject.card = cardObject
        this.playerList[this.getUserIndex(username)] = userObject
        return cardObject
    }

    private getUserObject(username: string) {
        return this.playerList[this.getUserIndex(username)]
    }

    private getUserIndex(username: string) {
        return this.playerList.map(function(e) { return e.name; }).indexOf(username);
    }

    private getUserObjectById(id: number) {
        const index = this.playerList.map(function(e) { return e.id; }).indexOf(id);
        return this.playerList[index]
    }

    private cardsMatch(card1: ICardObject, card2: ICardObject) {
        return (card1.number === card2.number || card1.suite === card2.suite) ? true : false
    }

    private checkWhoMustDrink(author: string, card: string) {
        let drinkList: string[] = [author]
        let done = false
        let all = false
        let authorPlayerObject = this.getUserObject(author)
        let currentPlayer = authorPlayerObject
        while (!done && !all) {
            let leftNeighborId: number = (currentPlayer.id - 1) % this.playerList.length
            let leftNeighbor = this.getUserObjectById(leftNeighborId)
            if (this.cardsMatch(currentPlayer.card, leftNeighbor.card)) {
                drinkList.push(leftNeighbor.name)
                currentPlayer = leftNeighbor
                if (drinkList.length === this.playerList.length) {
                    all = true
                }
            } else {
                done = true
            }
        }
        done = false
        currentPlayer = authorPlayerObject
        while (!done && !all) {
            let rightNeighborId: number = (currentPlayer.id + 1) % this.playerList.length
            let rightNeighbor = this.getUserObjectById(rightNeighborId)
            if (this.cardsMatch(currentPlayer.card, rightNeighbor.card)) {
                drinkList.push(rightNeighbor.name)
                currentPlayer = rightNeighbor
            } else {
                done = true
            }
        }
        if (drinkList.length < 2) {
            return "Ingen må drikke"
        } else {
            let drinkString: string = ""
            for (let i = 0; i < drinkList.length; i++) {
                drinkString = drinkString + drinkList[i] + ", "
            }
            return drinkString.substring(0, (drinkString.length - 2)) 
            + " må drikke " + drinkList.length
        }
    }

    private createCardObject(card: string) {
        let number = card.substring(0,1)
        let suite = card.substring(1,2)
        let printNumber = this.deck.getTranslation(number)
        let printSuite = this.deck.getTranslation(suite)
        let printString = suite + number + suite
        const cardObject: ICardObject = { number: number, suite: suite, printString: printString}
        return cardObject
    }

    private drawCard(message: Message) {
        let card: string = this.deck.drawCard(message, false)
        if (card === undefined) {
            this.messageHelper.sendMessage(message.channelId, "Kortstokken er tom. Dersom dere vil fortsette, bruk '!mz el resett'")
            return
        }
        const author = message.author.username
        const cardObject = this.setCardOnUser(author, card)
        const mustDrink = this.checkWhoMustDrink(author, card)
        this.messageHelper.sendMessage(message.channelId, author + " trakk " + cardObject.printString 
        + "\n" + mustDrink)
    }

    private getPlayersString() {
        let players = "Da starter vi en ny runde electricity med "
        for (let player of this.playerList) {
            players = players + player.name + ", "
        }
        return players.substring(0, players.length-2)
    }

    private async startElectricity(message: Message) {
        if (this.activeGame) {
            message.reply('Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "!mz electricity stopp"')
            return
        }
        if (this.reactor) {
            this.reactor.stop()
        }
        const author = message.author.username
        const betString = `${author} ønsker å starte en runde med electricity: Reager med 👍 for å bli med. Spillet starter når noen reagerer med ✅`
        const startMessage = await this.messageHelper.sendMessage(message.channelId, betString)
        if (startMessage) {
            this.messageHelper.reactWithThumbs(startMessage, 'up')
            startMessage.react('✅')
            const _msg = this.messageHelper
            this.reactor = startMessage.createReactionCollector().on('collect', async (reaction) => {
                const users = reaction.users.cache.filter((u) => u.id !== '802945796457758760')
                if (reaction.emoji.name == '👍') {
                    users.forEach((us, ind) => {
                        if (!(this.getUserObject(us.username))) {
                            const userCard: ICardObject = { number: "", suite: "", printString: ""}
                            const user: IUserObject = { name: us.username, id: this.id, card: userCard}
                            this.playerList.push(user)
                            this.id++
                        }
                    })
                } else if (reaction.emoji.name == '✅' && (users.size > 0)) {
                    if (this.playerList.length < 2) {
                        message.reply('Det trengs minst 2 deltakere for å starte spillet.')
                    } else {
                        this.activeGame = true
                        this.messageHelper.sendMessage(message.channelId, this.getPlayersString())
                        this.reactor.stop()
                    }
                    
                }
            })
        }
    }

    private stopElectricity(message: Message) {
        this.playerList = new Array<IUserObject>()
        this.deck.resetDeck(message, false)
        this.id = 0
        this.activeGame = false
        this.reactor = undefined
        this.messageHelper.sendMessage(message.channelId, 
            "Spillet er stoppet")
    }

    private getMyCard(message: Message) {
        const author = message.author.username
        const user = this.getUserObject(author)
        if (!user.card.number) {
            this.messageHelper.sendMessage(message.channelId, 
                author + " har ikke trukket et kort enda")
        } else {
            this.messageHelper.sendMessage(message.channelId, 
                author + " sitt gjeldende kort: " + user.card.printString)
        } 
    }

    private elSwitch(message: Message, messageContent: string, args: string[]) {
        const author = message.author.username
        let activePlayer = false
        for (let player of this.playerList) {
            if (player.name === author) {
                activePlayer = true
            }
        }
        if (!activePlayer && this.activeGame) {
            this.messageHelper.sendMessage(message.channelId, 
                "Bro du skulle gitt en tommel opp før spillet begynte hvis du ville være med")
            return
        }
        if (args[0]) {
            switch(args[0].toLowerCase()) {
                case "start": {
                    this.startElectricity(message)
                    break
                }
                case "trekk": {
                    if (!this.activeGame) {
                        this.messageHelper.sendMessage(message.channelId, 
                            "Du må starte et spill først")
                    } else {
                        this.drawCard(message)
                    }
                    break
                }
                case "stopp": {
                    if (!this.activeGame || !this.reactor) {
                        this.messageHelper.sendMessage(message.channelId, 
                            "Det er ingenting å stoppe")
                    } else {
                        this.stopElectricity(message)
                    }
                    break
                }
                case "mitt": {
                    if (!this.activeGame) {
                        this.messageHelper.sendMessage(message.channelId, 
                            "Du må nesten ha et aktivt spill for å kunne ha et kort")
                    } else {
                        this.getMyCard(message)
                    }
                    break
                }
                case "resett": {
                    this.deck.resetDeck(message, true)
                    break
                }
                default: {
                    this.messageHelper.sendMessage(message.channelId, 
                        "Tilgjengelige kommandoer er: 'start', 'trekk', 'mitt', 'resett' og 'stopp'")
                }
            }
        } else {
            this.messageHelper.sendMessage(message.channelId, 
                "Du må inkludere en av følgende etter 'el': 'start', 'trekk', 'mitt', 'resett' eller 'stopp'")
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: ['el', 'electricity'],
                description:
                    "Nu ska d drekkjast",
                hideFromListing: false,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.elSwitch(rawMessage, messageContent, args)
                },

                category: 'annet',
            },
        ]
    }
}
