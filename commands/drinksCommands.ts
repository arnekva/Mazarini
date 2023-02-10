import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { RandomUtils } from '../utils/randomUtils'
import { CardCommands } from './cardCommands'

interface IUserObject {
    name: string
    id: number
    card: ICardObject
    mates: IUserObject[]
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
    private shouldChugOnLoop: boolean

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.activeGame = false
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(client, messageHelper)
        this.id = 0
        this.reactor = undefined
        this.turn = 0
        this.shouldChugOnLoop = true
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
        /** Mates who directly relate to the person who must drink */
        const matesWhoMustDrinkDirectly: IUserObject[] = []

        const search = (ind: number, val: any) => {
            if (this.cardsMatch(players[ind].card, val)) {
                if (mustDrink.includes(players[ind])) {
                    return false
                }
                mustDrink.push(players[ind])

                matesWhoMustDrinkDirectly.push(...players[ind].mates)
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
        const transformList = (mustDrink: IUserObject[], mates: IUserObject[]) => {
            let str = ''

            if (mustDrink.length === this.playerList.length && this.cardsMatch(mustDrink[0].card, mustDrink[mustDrink.length - 1].card)) {
                str = this.shouldChugOnLoop ? 'Den går infinite! Alle chugge' : 'Den går i sirkel! Alle drikke ' + (mustDrink.length - 1) + ' slurker!'
            } else if (mustDrink.length > 1) {
                str = `Følgende må drikke ${mustDrink.length} slurker: `
                mustDrink.forEach((u) => (str += `\n**${u.name} (${u.card.printString})**`))
            }
            if (mates.length > 1 && mustDrink.length > 1) {
                str += `\nDisse matene må også drikke: ${mates.map((m) => {
                    return `\n${m.name}`
                })}`
            }
            return str
        }

        const theseMatesMustDrink: IUserObject[] = []
        //This is initially called with all the mates who have been added directly (i.e. the mates of someone who drew a card)
        const findAllMates = (mates: IUserObject[]) => {
            //Go through all the mates
            mates.forEach((mate) => {
                //If not currently present in the Must Drink group, add them
                if (!theseMatesMustDrink.includes(mate)) {
                    theseMatesMustDrink.push(mate)
                    if (mate.mates) {
                        //If this mate has mates, call the function again with the mates of the current mate
                        findAllMates(mate.mates)
                    }
                }
            })
        }

        findOnSearchUp()
        findOnSearchDown()
        findAllMates(matesWhoMustDrinkDirectly)
        return transformList(mustDrink, theseMatesMustDrink)
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

    private drawCard(interaction: ChatInputCommandInteraction<CacheType>) {
        let card: string = this.deck.drawCard()
        if (!card) {
            this.messageHelper.replyToInteraction(interaction, "Kortstokken er tom. Dersom dere vil fortsette, bruk /electricity resett'")
        } else {
            const currentPlayer = this.getUserObjectById(this.turn)
            this.turn = (this.turn + 1) % this.playerList.length
            const cardObject = this.setCardOnUser(currentPlayer.name, card)
            const mustDrink = this.checkWhoMustDrink(currentPlayer.name, currentPlayer.id, currentPlayer.card)
            let gameState = '\n\n*På bordet*:'
            this.playerList.forEach((player) => {
                gameState += `\n${player.name} (${player.id}) - ${player.card.printString}`
            })
            this.messageHelper.replyToInteraction(interaction, currentPlayer.name + ' trakk ' + cardObject.printString + '\n' + mustDrink + gameState)
        }
    }

    private getPlayersString() {
        let players = 'Da starter vi en ny runde electricity med '
        for (let player of this.playerList) {
            players = players + player.name + '(id:' + player.id + '), '
        }
        return players.substring(0, players.length - 2)
    }

    private async startElectricity(interaction: ChatInputCommandInteraction<CacheType>) {
        if (this.activeGame) {
            this.messageHelper.replyToInteraction(interaction, 'Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "/electricity stopp"')
        } else {
            if (this.reactor) {
                this.reactor.stop()
            }
            const author = interaction.user.username
            const betString = `${author} ønsker å starte en runde med electricity: Reager med 👍 for å bli med. Spillet starter når noen reagerer med ✅`
            const startMessage = await this.messageHelper.sendMessage(interaction.channelId, betString)
            this.messageHelper.replyToInteraction(interaction, `Starter electricity`, true)
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
                                const user: IUserObject = { name: us.username, id: this.id, card: userCard, mates: [] }
                                this.playerList.push(user)
                                this.id++
                            }
                        })
                    } else if (reaction.emoji.name == '✅' && users.size > 0) {
                        if (this.playerList.length < 1) {
                            this.messageHelper.sendMessage(interaction.channelId, 'Det trengs minst 2 deltakere for å starte spillet.')
                        } else {
                            this.activeGame = true
                            this.messageHelper.sendMessage(interaction.channelId, this.getPlayersString())
                            this.reactor.stop()
                        }
                    }
                })
            }
        }
    }

    private stopElectricity(interaction: ChatInputCommandInteraction<CacheType>) {
        this.playerList = new Array<IUserObject>()
        const resetMsg = this.deck.resetDeck()
        this.messageHelper.replyToInteraction(interaction, resetMsg)
        this.id = 0
        this.activeGame = false
        this.reactor = undefined
        this.messageHelper.sendMessage(interaction.channelId, 'Spillet er stoppet')
    }

    private getMyCard(interaction: ChatInputCommandInteraction<CacheType>) {
        const author = interaction.user.username
        const user = this.getUserObject(author)
        if (!user.card.number) {
            this.messageHelper.replyToInteraction(interaction, author + ' har ikke trukket et kort enda')
        } else {
            this.messageHelper.replyToInteraction(interaction, author + ' sitt gjeldende kort: ' + user.card.printString)
        }
    }

    private elSwitch(interaction: ChatInputCommandInteraction<CacheType>) {
        const action = interaction.options.getSubcommand()
        const author = interaction.user.username
        let activePlayer = false
        for (let player of this.playerList) {
            if (player.name === author) {
                activePlayer = true
            }
        }
        if (!activePlayer && this.activeGame) {
            this.messageHelper.replyToInteraction(interaction, 'Bro du skulle gitt en tommel opp før spillet begynte hvis du ville være med')
            // this.messageHelper.sendMessage(message.channelId, )
        } else {
            if (action) {
                switch (action.toLowerCase()) {
                    case 'start': {
                        this.startElectricity(interaction)
                        break
                    }
                    case 'trekk': {
                        if (!this.activeGame) {
                            this.messageHelper.replyToInteraction(interaction, `Du må starte et spill først`)
                        } else {
                            this.drawCard(interaction)
                        }
                        break
                    }
                    case 'stopp': {
                        if (!this.activeGame || !this.reactor) {
                            this.messageHelper.replyToInteraction(interaction, 'Det er ingenting å stoppe')
                        } else {
                            this.stopElectricity(interaction)
                        }
                        break
                    }
                    case 'mitt': {
                        if (!this.activeGame) {
                            this.messageHelper.replyToInteraction(interaction, 'Du må nesten ha et aktivt spill for å kunne ha et kort')
                        } else {
                            this.getMyCard(interaction)
                        }
                        break
                    }
                    case 'resett': {
                        const msg = this.deck.resetDeck()
                        this.messageHelper.replyToInteraction(interaction, msg)
                        break
                    }
                    case 'instillinger': {
                        const options = this.setElectricityOptions(interaction)
                        this.messageHelper.replyToInteraction(interaction, options)
                        break
                    }
                    default: {
                        this.messageHelper.replyToInteraction(interaction, "Tilgjengelige kommandoer er: 'start', 'trekk', 'mitt', 'resett' og 'stopp'")
                    }
                }
            } else {
                this.messageHelper.replyToInteraction(
                    interaction,
                    "Du må inkludere en av følgende etter 'el': 'start', 'trekk', 'mitt', 'resett' eller 'stopp'"
                )
            }
        }
    }

    private setElectricityOptions(interaction: ChatInputCommandInteraction<CacheType>): string {
        const mate = interaction.options.get('mate')?.user
        const chugOnLoop = interaction.options.get('chug-on-loop')?.value as boolean | undefined
        const addPlayer = interaction.options.get('add')?.user
        let reply = ``
        if (mate) {
            const currentUser = this.getUserObject(interaction.user.username)
            const mateUser = this.getUserObject(mate.username)
            if (currentUser && mateUser) {
                if (currentUser.mates.find((u) => u.name === mate.username)) {
                    ArrayUtils.removeItemOnce(
                        currentUser.mates,
                        currentUser.mates.find((u) => u.name === mate.username)
                    )
                    ArrayUtils.removeItemOnce(
                        mateUser.mates,
                        mateUser.mates.find((u) => u.name === currentUser.name)
                    )
                    reply += `Fjernet ${mateUser.name} fra listen til ${currentUser.name}`
                } else {
                    if (mateUser.name !== currentUser.name) {
                        currentUser.mates.push(mateUser)
                        mateUser.mates.push(currentUser)
                        reply += `La til ${mateUser.name} i listen til ${currentUser.name} (og motsatt)`
                    } else {
                        reply += `Du kan ikkje ha deg sjøl some mate, då fucke du me rekursjonen`
                    }
                }
            }
        }
        if (chugOnLoop !== undefined) {
            this.shouldChugOnLoop = chugOnLoop
            reply += `\nChug on loop: ${this.shouldChugOnLoop}`
        }
        if (addPlayer) {
            const mockCard: ICardObject = { number: '', suite: '', printString: '' }
            const user: IUserObject = { name: addPlayer.username, id: this.id++, card: mockCard, mates: [] as IUserObject[] }
            this.playerList.push(user)
        }
        return reply
    }

    private drinkBitch(interaction: ChatInputCommandInteraction<CacheType>) {
        let antallSlurks = interaction.options.get('antall')?.value as number
        if (!antallSlurks) {
            if (RandomUtils.getRndBetween0and100() === 69) {
                return this.messageHelper.replyToInteraction(interaction, 'Damn bro, du skulle ikke ha latt meg bestemme. Chug sjæl!')
            }
            antallSlurks = Math.ceil(RandomUtils.getRndBetween0and100() / 10)
        }
        let roll = RandomUtils.getRndBetween0and100()
        if (antallSlurks > 10) {
            this.messageHelper.replyToInteraction(interaction, 'Nå roer vi oss ned 2 hakk her')
            antallSlurks = Math.ceil(RandomUtils.getRndBetween0and100() / 10)
            roll = 1
        }

        if (roll === 69) {
            return this.messageHelper.replyToInteraction(interaction, 'Cracking open a cold one with the boys? Men da utbringer eg en skål, og alle kan chugge')
        } else if (roll <= 33) {
            return this.messageHelper.replyToInteraction(interaction, 'Drikk selv ' + antallSlurks + ' slurker')
        } else if (roll <= 66) {
            return this.messageHelper.replyToInteraction(interaction, 'Ta selv, og gi vekk ' + antallSlurks + ' slurker')
        } else {
            return this.messageHelper.replyToInteraction(interaction, 'Gi vekk ' + antallSlurks + ' slurker')
        }
    }

    public getAllCommands(): ICommandElement[] {
        return []
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'drikk',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.drinkBitch(interaction)
                },
                category: 'annet',
            },
            {
                commandName: 'electricity',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.elSwitch(interaction)
                },
                category: 'annet',
            },
        ]
    }
}
