import { Client, Collector, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { CardCommands } from './cardCommands'
import { globals } from '../globals'

export class DrinksCommands extends AbstractCommands {
    private playerMap: Map<string, number>
    private playerMapReversed: Map<number, string>
    private playerCard: Map<number, string>
    private activeGame: boolean
    private deck: CardCommands
    private numberOfSips: number
    private id: number

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.activeGame = false
        this.playerMap = new Map<string, number>()
        this.playerMapReversed = new Map<number, string>()
        this.playerCard = new Map<number, string>()
        this.deck = new CardCommands(client, messageHelper)
        this.numberOfSips = 0
        this.id = 0
    }



    private checkWhoMustDrink(author: string, card: string) {
        let drinkString: string = ""
        let drinkList: string[] = [author]
        let done = false
        let all = false
        let currentId = this.playerMap.get(author)
        if (!currentId) {
            return
        }
        let currentCard = card
        while (!done && !all) {
            const leftNeighbor: number = (currentId - 1) % this.playerMap.size
            let neighborCard = this.playerCard.get(leftNeighbor)
            if (!neighborCard) {
                done = true
            } else {
                if ((currentCard.substring(0,1) === neighborCard.substring(0,1)) || (currentCard.substring(1,2) === neighborCard.substring(1,2))) {
                    const name = this.playerMapReversed.get(leftNeighbor)
                    if (!name) {
                        return
                    }
                    drinkList[drinkList.length] = name
                    currentId = leftNeighbor
                    currentCard = neighborCard
                    if (drinkList.length === this.playerMap.size) {
                        all = true
                    }
                } else {
                    done = true
                }
            }
        }
        done = false
        currentId = this.playerMap.get(author)
        if (!currentId) {
            return
        }
        currentCard = card
        while (!done && !all) {
            const rightNeighbor: number = (currentId + 1) % this.playerMap.size
            let neighborCard = this.playerCard.get(rightNeighbor)
            if (!neighborCard) {
                done = true
            } else {
                if ((currentCard.substring(0,1) === neighborCard.substring(0,1)) || (currentCard.substring(1,2) === neighborCard.substring(1,2))) {
                    const name = this.playerMapReversed.get(rightNeighbor)
                    if (!name) {
                        return
                    }
                    drinkList[drinkList.length] = name
                    currentId = rightNeighbor
                    currentCard = neighborCard
                } else {
                    done = true
                }
            }
        }
        if (drinkList.length < 2) {
            this.numberOfSips = 0
            return "Ingen"
        } else {
            this.numberOfSips = drinkList.length
            for (let i = 0; i < drinkList.length; i++) {
                drinkString = drinkString + drinkList[i] + ", "
            }
            return drinkString.substring(0, (drinkString.length - 2))
        }
    }

    private getCardString(card: string) {
        let number = this.deck.getTranslation(card.substring(0,1))
        let suite = this.deck.getTranslation(card.substring(1,2))
        return suite + number + suite
    }

    private drawCard(message: Message) {
        let card: string = this.deck.drawCard(message, false)
        if (card === undefined) {
            this.messageHelper.sendMessage(message.channelId, "Kortstokken er tom. Dersom dere vil fortsette, bruk '!mz el resett'")
            return
        }
        const author = message.author.username
        const id = this.playerMap.get(author)
        if (!id) {
            return
        }
        this.playerCard.set(id, card)
        const mustDrink = this.checkWhoMustDrink(author, card)
        let sips = this.numberOfSips === 0 ? "" : this.numberOfSips + " slurker hver"
        this.messageHelper.sendMessage(message.channelId, author + " trakk " + this.getCardString(card) 
        + "\n" + mustDrink + " må drikke " + sips)
    }

    private getPlayersString(seperator: string) {
        let players = "Da starter vi en ny runde electricity med "
        for (let key of this.playerMap.keys()) {
            players = players + key + seperator
        }
        return players.substring(0, players.length-2)
    }

    private async startElectricity(message: Message) {
        if (this.activeGame) {
            message.reply('Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "!mz electricity stopp"')
            return
        }
        const author = message.author.username
        const betString = `${author} har startet en runde med electricity: Reager med 👍 for å bli med. Spillet starter når noen reagerer med ✅`
        const startMessage = await this.messageHelper.sendMessage(message.channelId, betString)
        if (startMessage) {
            this.messageHelper.reactWithThumbs(startMessage, 'up')
            startMessage.react('✅')
            const _msg = this.messageHelper
            const reactor = startMessage.createReactionCollector().on('collect', async (reaction) => {
                const users = reaction.users.cache.filter((u) => u.id !== '802945796457758760')
                if (reaction.emoji.name == '👍') {
                    users.forEach((us, ind) => {
                        if (!(us.id === '802945796457758760')) {
                            const idCopy = this.id
                            this.id = this.id + 1
                            this.playerMap.set(us.username, idCopy)
                            this.playerMapReversed.set(idCopy, us.username)
                        }
                    })
                } else if (reaction.emoji.name == '✅' && (users.size > 0)) {
                    reactor.stop()
                    if (this.playerMap.size < 2) {
                        message.reply('Ingen som vil drikke eller?')
                        return
                    }
                    this.activeGame = true
                    this.messageHelper.sendMessage(message.channelId, this.getPlayersString(", "))
                }
            })
        }
    }

    private stopElectricity(message: Message) {
        this.playerMap = new Map<string, number>()
        this.playerMapReversed = new Map<number, string>()
        this.playerCard = new Map<number, string>()
        this.deck.resetDeck(message, false)
        this.numberOfSips = 0
        this.id = 0
        this.activeGame = false
        this.messageHelper.sendMessage(message.channelId, 
            "Spillet er stoppet")
    }

    private getMyCard(message: Message) {
        const author = message.author.username
        const id = this.playerMap.get(author)
        if (!id) {
            return
        }
        const card = this.playerCard.get(id)
        if (!card) {
            return
        }
        if (card === "") {
            this.messageHelper.sendMessage(message.channelId, 
                author + " har ikke trukket et kort enda")
        } else {
            this.messageHelper.sendMessage(message.channelId, 
                author + ", med id {" + id + "} sitt gjeldende kort: " + this.getCardString(card))
        } 
    }

    private elSwitch(message: Message, messageContent: string, args: string[]) {
        const author = message.author.username
        let activePlayer = false
        for (let key of this.playerMap.keys()) {
            if (key === author) {
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
                    if (!this.activeGame) {
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
                commandName: 'el',
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
