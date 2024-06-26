import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, Message } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'

import { IInteractionElement } from '../../interfaces/interactionInterface'
import { ArrayUtils } from '../../utils/arrayUtils'
import { MentionUtils } from '../../utils/mentionUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { CardCommands, ICardObject } from '../games/cardCommands'

interface IUserObject {
    name: string
    id: number
    userId: string
    card: ICardObject
    mates: IUserObject[]
}

const activeGameButtonRow = new ActionRowBuilder<ButtonBuilder>()
activeGameButtonRow.addComponents(
    new ButtonBuilder({
        custom_id: 'EL_DRAW',
        style: ButtonStyle.Success,
        label: `Trekk`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: 'EL_MOVE',
        style: ButtonStyle.Primary,
        label: `Flytt ned`,
        disabled: false,
        type: 2,
    })
)

const gameSetupButtonRow = new ActionRowBuilder<ButtonBuilder>()
gameSetupButtonRow.addComponents(
    new ButtonBuilder({
        custom_id: 'EL_JOIN',
        style: ButtonStyle.Primary,
        label: `Bli med!`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: 'EL_START',
        style: ButtonStyle.Success,
        label: `🍷 Start 🍷`,
        disabled: false,
        type: 2,
    })
)

const resetDeckButtonRow = new ActionRowBuilder<ButtonBuilder>()
resetDeckButtonRow.addComponents(
    new ButtonBuilder({
        custom_id: 'EL_RESET',
        style: ButtonStyle.Primary,
        label: `Resett kortstokk`,
        disabled: false,
        type: 2,
    })
)

// const testData = [
//     { name: 'PhedeSpelar', id: 0, card: { number: '', suite: '', printString: '' }, mates: [] },
//     { name: 'Eivind', id: 1, card: { number: '', suite: '', printString: '' }, mates: [] },
//     { name: 'Deadmaggi', id: 2, card: { number: '', suite: '', printString: '' }, mates: [] },
// ]

export class DrinksCommands extends AbstractCommands {
    private playerList: IUserObject[]
    private activeGame: boolean
    private initiated: boolean
    private deck: CardCommands
    private id: number
    private turn: number
    private shouldChugOnLoop: boolean
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>

    constructor(client: MazariniClient) {
        super(client)
        this.activeGame = false
        this.initiated = false
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(client)
        this.id = 0
        this.turn = 0
        this.shouldChugOnLoop = true
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = gameSetupButtonRow
    }

    private setCardOnUser(username: string, card: ICardObject) {
        const userObject = this.getUserObject(username)
        userObject.card = this.simplifyPrintString(card)
        this.playerList[this.getUserIndex(username)] = userObject
        return card
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
        return card1?.number === card2?.number || card1.suit === card2.suit ? true : false
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
        /* Kommenterer bare ut disse i tilfelle vi vil gå tilbake til de ved en senere anledning
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
        */

        findOnSearchUp()
        findOnSearchDown()
        //findAllMates(matesWhoMustDrinkDirectly)
        return mustDrink
    }

    private simplifyPrintString(card: ICardObject) {
        const printString = this.deck.getStringPrint(card)
        const cardObject: ICardObject = { ...card, emoji: printString }
        return cardObject
    }

    public async drawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.playerList.find((player) => player.name == interaction.user.username)) {
            const card: ICardObject = await this.deck.drawCard()            
            if (card == undefined) {
                this.messageHelper.replyToInteraction(interaction, 'Kortstokken er tom. Bruk knappen under dersom dere vil fortsette.')
                this.messageHelper.sendMessage(interaction?.channelId, { components: [resetDeckButtonRow] })
            } else {
                const currentPlayer = this.getUserObjectById(this.turn)
                this.turn = (this.turn + 1) % this.playerList.length
                this.setCardOnUser(currentPlayer.name, card)
                const mustDrink = this.checkWhoMustDrink(currentPlayer.name, currentPlayer.id, currentPlayer.card)
                this.updateActiveGameMessage(mustDrink, currentPlayer)
                this.replyToInteraction(interaction)
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må være med for å kunne trekke`, { ephemeral: true })
        }
    }

    private updateActiveGameMessage(mustDrink: Array<IUserObject>, currentPlayer: IUserObject) {
        const formattedMsg = new EmbedBuilder().setTitle('Electricity ⚡').setDescription('Kort på bordet:')

        let infinite = false
        if (mustDrink.length === this.playerList.length) {
            infinite = this.isInfinite()
        }
        const sips = infinite && this.shouldChugOnLoop ? '♾' : mustDrink.length
        this.playerList.forEach((player) => {
            let playerName = player.id == (currentPlayer?.id + 1)%this.playerList.length ? `🫵 ${player.name}` : player.name
            playerName += mustDrink.length > 1 && mustDrink.includes(player) ? ' 🍷x' + sips : ''
            formattedMsg.addFields({
                name: playerName,
                value: player.card.emoji + ' ',
                inline: false,
            })
        })
        this.embed = formattedMsg
    }

    private isInfinite() {
        for (let i = 0; i <= this.playerList.length; i++) {
            if (!this.cardsMatch(this.playerList[i % this.playerList.length].card, this.playerList[(i + 1) % this.playerList.length].card)) {
                return false
            }
        }
        return true
    }

    private async replyToInteraction(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) {
            this.embedMessage.edit({ embeds: [this.embed] })
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Nu skal det drekjast')
            this.embedMessage = await this.messageHelper.sendMessage(interaction?.channelId, { embed: this.embed })
            this.buttonsMessage = await this.messageHelper.sendMessage(interaction?.channelId, { components: [this.currentButtons] })
        }
    }

    public setupElectricity(interaction: ChatInputCommandInteraction<CacheType>) {
        if (this.activeGame || this.initiated) {
            this.messageHelper.replyToInteraction(interaction, 'Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "/electricity stopp"')
        } else {
            this.currentButtons = gameSetupButtonRow
            this.initiated = true
            this.updateStartMessage()
            this.replyToInteraction(interaction)
        }
    }

    public joinElectricity(interaction: ButtonInteraction<CacheType>) {
        const newUser = interaction.user
        if (!this.playerList.find((player) => player.name == newUser.username)) {
            const userCard: ICardObject = { number: 0, suit: '', emoji: '', image: '' }
            const user: IUserObject = { name: newUser.username, id: this.id, userId: newUser.id, card: userCard, mates: [] }
            this.playerList.push(user)
            this.id++
            this.updateStartMessage()
            this.replyToInteraction(interaction)
        } else {
            interaction.deferUpdate()
        }
    }

    public startElectricity(interaction: ButtonInteraction<CacheType>) {
        if (this.playerList.length < 1) {
            this.messageHelper.replyToInteraction(interaction, 'Det trengs minst 1 deltaker for å starte spillet (men det er litt trist å spille dette alene).')
        } else {
            this.activeGame = true
            this.currentButtons = activeGameButtonRow
            this.updateActiveGameMessage([], null)
            this.replyToInteraction(interaction)
            this.buttonsMessage.edit({ components: [this.currentButtons] })
        }
    }

    private updateStartMessage() {
        const formattedMsg = new EmbedBuilder().setTitle('Electricity ⚡').setDescription('Følgende spelare er klare for å drikke litt (masse):')
        this.playerList.forEach((player) => {
            formattedMsg.addFields({
                name: player.name,
                value: ' ',
                inline: false,
            })
        })
        this.embed = formattedMsg
    }

    public async resendMessages(interaction: ButtonInteraction<CacheType>) {
        this.deleteMessages()
        this.embedMessage = await this.messageHelper.sendMessage(interaction?.channelId, { embed: this.embed })
        this.buttonsMessage = await this.messageHelper.sendMessage(interaction?.channelId, { components: [this.currentButtons] })
    }

    private deleteMessages() {
        this.embedMessage.delete()
        this.buttonsMessage.delete()
        this.embedMessage = undefined
        this.buttonsMessage = undefined
    }

    public resetDeck(interaction: ButtonInteraction<CacheType>) {
        const msg = this.deck.resetDeck()
        this.messageHelper.replyToInteraction(interaction, msg)
    }

    private stopElectricity(interaction: ChatInputCommandInteraction<CacheType>) {
        this.playerList = new Array<IUserObject>()
        this.deck.resetDeck()
        this.id = 0
        this.activeGame = false
        this.initiated = false
        this.messageHelper.replyToInteraction(interaction, 'Spillet er stoppet og kortstokken nullstilt')
    }

    private elSwitch(interaction: ChatInputCommandInteraction<CacheType>) {
        const action = interaction.options.getSubcommand()
        if (action) {
            switch (action.toLowerCase()) {
                case 'start': {
                    this.setupElectricity(interaction)
                    break
                }
                case 'stopp': {
                    if (!this.activeGame && !this.initiated) {
                        this.messageHelper.replyToInteraction(interaction, 'Det er ingenting å stoppe')
                    } else {
                        this.stopElectricity(interaction)
                    }
                    break
                }
                case 'instillinger': {
                    const options = this.setElectricityOptions(interaction)
                    this.messageHelper.replyToInteraction(interaction, options)
                    break
                }
                default: {
                    this.messageHelper.replyToInteraction(interaction, "Tilgjengelige kommandoer er: 'start', 'stopp' og 'instillinger'")
                }
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, "Du må inkludere en av følgende etter '/electricity': 'start', 'stopp', eller 'instillinger'")
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
            const mockCard: ICardObject = { number: 0, suit: '', emoji: '', image: '' }
            const user: IUserObject = { name: addPlayer.username, id: this.id++, userId: addPlayer.id, card: mockCard, mates: [] as IUserObject[] }
            this.playerList.push(user)
            reply += `\nLa til ${user.name} i spillet på plass ${user.id}`
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

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'drikk',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.drinkBitch(interaction)
                        },
                    },
                    {
                        commandName: 'electricity',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.elSwitch(interaction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'EL_DRAW',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.drawCard(rawInteraction)
                        },
                    },
                    {
                        commandName: 'EL_MOVE',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.resendMessages(rawInteraction)
                        },
                    },
                    {
                        commandName: 'EL_JOIN',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.joinElectricity(rawInteraction)
                        },
                    },
                    {
                        commandName: 'EL_START',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.startElectricity(rawInteraction)
                        },
                    },
                    {
                        commandName: 'EL_RESET',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.resetDeck(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
