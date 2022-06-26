import { Client, Message } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { RandomUtils } from '../utils/randomUtils'
import { CardCommands } from './cardCommands'

interface IUserObject {
    name: string
    id: number
    card: ICardObject
}

interface ICardObject {
    number: string
    suite: string
    printString: string
}

export class DrinksCommands extends AbstractCommands {
    private playerList: IUserObject[]
    private activeGame: boolean
    private deck: CardCommands
    private id: number
    private reactor: any
    private turn: number

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.activeGame = false
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(client, messageHelper)
        this.id = 0
        this.reactor = undefined
        this.turn = 0
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
        return this.playerList
            .map(function (e) {
                return e.name
            })
            .indexOf(username)
    }

    private getUserObjectById(id2: number) {
        const index = this.playerList.map((e) => e.id).indexOf(id2)
        return this.playerList[index]
    }

    private cardsMatch(card1: ICardObject, card2: ICardObject) {
        return card1?.number === card2?.number || card1.suite === card2.suite ? true : false
    }

    private checkWhoMustDrink(author: string, currentPlayerIndex: number, firstPlayerValue: ICardObject) {
        const players = this.playerList
        const mustDrink: IUserObject[] = []

        const search = (ind: number, val: any) => {
            if (this.cardsMatch(players[ind].card, val)) {
                if (mustDrink.includes(players[ind])) {
                    return false
                }
                mustDrink.push(players[ind])
                return players[ind].card
            }
            return false
        }

        const findOnSearchUp = () => {
            let currentCard = firstPlayerValue
            for (let i = currentPlayerIndex; i < players.length; i++) {
                const result = search(i, currentCard)
                if (!result) return
                if (i === players.length - 1) i = -1
                currentCard = result
            }
        }
        const findOnSearchDown = () => {
            let currentCard = firstPlayerValue
            for (let i = currentPlayerIndex - 1; i > -2; i--) {
                if (i < 0) i = players.length - 1
                const result = search(i, currentCard)
                if (!result) return
                currentCard = result
            }
        }
        const transformList = (mustDrink: IUserObject[]) => {
            let str = ''

            if (mustDrink.length === this.playerList.length && this.cardsMatch(mustDrink[0].card, mustDrink[mustDrink.length - 1].card)) {
                str = 'Den går infinite! Alle chugge'
            } else if (mustDrink.length > 1) {
                str = 'Følgende må drikke: '
                mustDrink.forEach((u) => (str += `${u.name} (${u.card.printString}),  `))
            }
            return str
        }

        findOnSearchUp()
        findOnSearchDown()
        return transformList(mustDrink)
    }

    private createCardObject(card: string) {
        let number = card.substring(0, 1)
        let suite = card.substring(1, 2)
        let printNumber = this.deck.getTranslation(number)
        let printSuite = this.deck.getTranslation(suite)
        let printString = printSuite + printNumber + printSuite
        const cardObject: ICardObject = { number: number, suite: suite, printString: printString }
        return cardObject
    }

    private drawCard(message: Message) {
        let card: string = this.deck.drawCard(message, false)
        if (!card) {
            this.messageHelper.sendMessage(message.channelId, "Kortstokken er tom. Dersom dere vil fortsette, bruk '!mz el resett'")
        } else {
            const currentPlayer = this.getUserObjectById(this.turn)
            this.turn = (this.turn + 1) % this.playerList.length
            const cardObject = this.setCardOnUser(currentPlayer.name, card)
            const mustDrink = this.checkWhoMustDrink(currentPlayer.name, currentPlayer.id, currentPlayer.card)
            let gameState = '\n'
            this.playerList.forEach((player) => {
                gameState += `\n${player.name} (${player.id}) - ${player.card.printString}`
            })
            this.messageHelper.sendMessage(message.channelId, currentPlayer.name + ' trakk ' + cardObject.printString + '\n' + mustDrink + gameState)
        }
    }

    private getPlayersString() {
        let players = 'Da starter vi en ny runde electricity med '
        for (let player of this.playerList) {
            players = players + player.name + '(id:' + player.id + '), '
        }
        return players.substring(0, players.length - 2)
    }

    private async startElectricity(message: Message) {
        if (this.activeGame) {
            message.reply('Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "!mz electricity stopp"')
        } else {
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
                            if (!this.getUserObject(us.username)) {
                                const userCard: ICardObject = { number: '', suite: '', printString: '' }
                                const user: IUserObject = { name: us.username, id: this.id, card: userCard }
                                this.playerList.push(user)
                                this.id++
                            }
                        })
                    } else if (reaction.emoji.name == '✅' && users.size > 0) {
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
    }

    private stopElectricity(message: Message) {
        this.playerList = new Array<IUserObject>()
        this.deck.resetDeck(message, false)
        this.id = 0
        this.activeGame = false
        this.reactor = undefined
        this.messageHelper.sendMessage(message.channelId, 'Spillet er stoppet')
    }

    private getMyCard(message: Message) {
        const author = message.author.username
        const user = this.getUserObject(author)
        if (!user.card.number) {
            this.messageHelper.sendMessage(message.channelId, author + ' har ikke trukket et kort enda')
        } else {
            this.messageHelper.sendMessage(message.channelId, author + ' sitt gjeldende kort: ' + user.card.printString)
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
            this.messageHelper.sendMessage(message.channelId, 'Bro du skulle gitt en tommel opp før spillet begynte hvis du ville være med')
        } else {
            if (args[0]) {
                switch (args[0].toLowerCase()) {
                    case 'start': {
                        this.startElectricity(message)
                        break
                    }
                    case 'trekk': {
                        if (!this.activeGame) {
                            this.messageHelper.sendMessage(message.channelId, 'Du må starte et spill først')
                        } else {
                            this.drawCard(message)
                        }
                        break
                    }
                    case 'stopp': {
                        if (!this.activeGame || !this.reactor) {
                            this.messageHelper.sendMessage(message.channelId, 'Det er ingenting å stoppe')
                        } else {
                            this.stopElectricity(message)
                        }
                        break
                    }
                    case 'mitt': {
                        if (!this.activeGame) {
                            this.messageHelper.sendMessage(message.channelId, 'Du må nesten ha et aktivt spill for å kunne ha et kort')
                        } else {
                            this.getMyCard(message)
                        }
                        break
                    }
                    case 'resett': {
                        this.deck.resetDeck(message, true)
                        break
                    }
                    default: {
                        this.messageHelper.sendMessage(message.channelId, "Tilgjengelige kommandoer er: 'start', 'trekk', 'mitt', 'resett' og 'stopp'")
                    }
                }
            } else {
                this.messageHelper.sendMessage(message.channelId, "Du må inkludere en av følgende etter 'el': 'start', 'trekk', 'mitt', 'resett' eller 'stopp'")
            }
        }
    }

    private drinkBitch(message: Message, messageContent: string, args: string[]) {
        let antallSlurks = Number(args[0])

        if (!antallSlurks) {
            if (RandomUtils.getRndBetween0and100() === 69) {
                return this.messageHelper.sendMessage(message.channelId, 'Damn bro, du skulle ikke ha latt meg bestemme. Chug sjæl!')
            }
            antallSlurks = Math.ceil(RandomUtils.getRndBetween0and100() / 10)
        }
        let roll = RandomUtils.getRndBetween0and100()
        if (antallSlurks > 10) {
            this.messageHelper.sendMessage(message.channelId, 'Nå roer vi oss ned 2 hakk her')
            antallSlurks = Math.ceil(RandomUtils.getRndBetween0and100() / 10)
            roll = 1
        }

        if (roll === 69) {
            return this.messageHelper.sendMessage(message.channelId, 'Cracking open a cold one with the boys? Men da utbringer eg en skål, og alle kan chugge')
        } else if (roll <= 33) {
            return this.messageHelper.sendMessage(message.channelId, 'Drikk selv ' + antallSlurks + ' slurker')
        } else if (roll <= 66) {
            return this.messageHelper.sendMessage(message.channelId, 'Ta selv, og gi vekk ' + antallSlurks + ' slurker')
        } else {
            return this.messageHelper.sendMessage(message.channelId, 'Gi vekk ' + antallSlurks + ' slurker')
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: ['el', 'electricity', 'elektrisitet'],
                description: 'Start drikkeleken electricity. Nu ska d drekkjast',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.elSwitch(rawMessage, messageContent, args)
                },

                category: 'drink',
            },
            {
                commandName: ['drikk', 'drink'],
                description: 'Drikkelek: Drikking + Gambling, name a more iconic duo',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.drinkBitch(rawMessage, messageContent, args)
                },

                category: 'drink',
            },
        ]
    }
}
