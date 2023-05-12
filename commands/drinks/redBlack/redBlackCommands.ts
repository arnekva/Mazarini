import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Message,
} from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { IInteractionElement } from '../../../general/commands'
import { ButtonHandler } from '../../../handlers/buttonHandler'
import { EmojiHelper } from '../../../helpers/emojiHelper'
import { MessageHelper } from '../../../helpers/messageHelper'
import { ArrayUtils } from '../../../utils/arrayUtils'
import { MentionUtils } from '../../../utils/mentionUtils'
import { RandomUtils } from '../../../utils/randomUtils'
import { CardCommands, ICardObject } from '../../cardCommands'
import { setupGameButtonRow, redBlackButtonRow, giveTakeButtonRow } from './redBlackButtonRows'
import { IGameRules, BusRide, IUserObject, IGiveTakeCard } from './redBlackInterfaces'



const defaultRules: IGameRules = {
    giveTakeLevelSips: [2, 4, 6, 8, Number.POSITIVE_INFINITY],
    busRide: BusRide.Canadian
}

const testData: IUserObject[] = [
    { name: 'PhedeSpelar', id: 0, cards: [{ number: '', suite: '', printString: '', url: '' }] },
    { name: 'Eivind', id: 1, cards: [{ number: '', suite: '', printString: '', url: '' }] },
    { name: 'Deadmaggi', id: 2, cards: [{ number: '', suite: '', printString: '', url: '' }] },
]

export class RedBlackCommands extends AbstractCommands {
    private playerList: IUserObject[]
    private activeGame: boolean
    private initiated: boolean
    private deck: CardCommands
    private rules: IGameRules
    private giveTakeTable: Map<string, IGiveTakeCard>
    private id: number
    private turn: number
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.activeGame = false
        this.initiated = false
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(client, messageHelper)
        this.rules = defaultRules
        this.giveTakeTable = new Map<string, IGiveTakeCard>()
        this.id = 0
        this.turn = 0
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = setupGameButtonRow
    }

    private generateGiveTakeTable() {
        const levels = this.rules.giveTakeLevelSips.length
        for (var i = 1; i < levels; i++) 
        {
            for (var y = 1; y <= 3; y++) 
            {
                this.giveTakeTable.set(String(i)+String(y),
                    { card: undefined//this.deck.drawCard() 
                    , give: y == 1 || y == 3
                    , take: y == 2 || y == 3
                    , sips: this.rules.giveTakeLevelSips[i-1]
                    , revealed: false
                    }
                )
            }
        }
        this.giveTakeTable.set(String(levels)+String(2), 
                    { card: undefined//this.deck.drawCard() 
                    , give: false
                    , take: true
                    , sips: this.rules.giveTakeLevelSips[levels-1]
                    , revealed: false
                    }
        )
    }

    private printGiveTakeTable(interaction: ButtonInteraction<CacheType>) {
        let tableString = ''
        const levels = this.rules.giveTakeLevelSips.length
        const chugCard = this.giveTakeTable.get(String(levels)+String(2))
        const cardEmoji = 
        tableString += ``
        
        for (var i = levels; i > 0; i--) 
        {
            for (var y = 1; y <= 3; y++) 
            {

            }
        }
    }

    private setCardOnUser(username: string, card: string) {
        let userObject = this.getUserObject(username)
        let cardObject = undefined//this.createCardObject(card)
        userObject.cards.push(cardObject)
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

    

    public drawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.playerList.find((player) => player.name == interaction.user.username)) {
            let card: string = this.deck.drawCard()
            if (card == 'Kortstokken er tom for kort') {
                this.messageHelper.replyToInteraction(interaction, 'Kortstokken er tom. Bruk knappen under dersom dere vil fortsette.')
                //this.messageHelper.sendMessageWithComponents(interaction?.channelId, [resetDeckButtonRow])
            } else {
                const currentPlayer = this.getUserObjectById(this.turn)
                this.turn = (this.turn + 1) % this.playerList.length
                this.setCardOnUser(currentPlayer.name, card)
                //const mustDrink = this.checkWhoMustDrink(currentPlayer.name, currentPlayer.id, currentPlayer.card)
                //this.updateActiveGameMessage(mustDrink, currentPlayer)
                this.replyToInteraction(interaction)
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må være med for å kunne trekke`, true)
        }
    }

    private updateActiveGameMessage(mustDrink: Array<IUserObject>, currentPlayer: IUserObject) {
        let formattedMsg = new EmbedBuilder().setTitle('Electricity ⚡').setDescription('Kort på bordet:')

        let sips = mustDrink.length
        this.playerList.forEach((player) => {
            let playerName = player.id == currentPlayer?.id ? MentionUtils.mentionUser(player.id.toString()) : player.name
            playerName += mustDrink.length > 1 && mustDrink.includes(player) ? ' 🍷x' + sips : ''
            formattedMsg.addFields({
                name: playerName,
                value: player.cards[0].printString + ' ',
                inline: false,
            })
        })
        this.embed = formattedMsg
    }

    private async replyToInteraction(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) {
            this.embedMessage.edit({ embeds: [this.embed], components: [this.currentButtons] })
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Nu skal det drekjast')
            this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
            this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
        }
    }

    public setupElectricity(interaction: ChatInputCommandInteraction<CacheType>) {
        if (this.activeGame || this.initiated) {
            this.messageHelper.replyToInteraction(interaction, 'Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "/electricity stopp"')
        } else {
            this.currentButtons = setupGameButtonRow
            this.initiated = true
            this.updateStartMessage()
            this.replyToInteraction(interaction)
        }
    }

    public async joinElectricity(interaction: ButtonInteraction<CacheType>) {
        const newUser = interaction.user
        if (!this.playerList.find((player) => player.name == newUser.username)) {
            const userCard: ICardObject = { number: '', suite: '', printString: '', url: '' }
            const user: IUserObject = { name: newUser.username, id: this.id, cards: [userCard] }
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
            this.messageHelper.replyToInteraction(
                interaction,
                'Det trengs minst 1 deltaker for å starte spillet (men det er litt trist å spille dette alene).',
                false
            )
        } else {
            this.activeGame = true
            //this.currentButtons = activeGameButtonRow
            this.updateActiveGameMessage([], null)
            this.replyToInteraction(interaction)
            this.buttonsMessage.edit({ components: [this.currentButtons] })
        }
    }

    private updateStartMessage() {
        let formattedMsg = new EmbedBuilder().setTitle('Electricity ⚡').setDescription('Følgende spelare er klare for å drikke litt (masse):')
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
        this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
        this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
    }

    private deleteMessages() {
        this.embedMessage.delete()
        this.buttonsMessage.delete()
        this.embedMessage = undefined
        this.buttonsMessage = undefined
    }

    public async resetDeck(interaction: ButtonInteraction<CacheType>) {
        const msg = this.deck.resetDeck()
        this.messageHelper.replyToInteraction(interaction, msg)
    }

    private stopElectricity(interaction: ChatInputCommandInteraction<CacheType>) {
        this.playerList = new Array<IUserObject>()
        this.deck.resetDeck()
        this.id = 0
        this.activeGame = false
        this.initiated = false
        this.messageHelper.replyToInteraction(interaction, 'Spillet er stoppet og kortstokken nullstilt', false)
    }

    public checkUserIsActivePlayer(username: string) {
        return this.playerList.some(user => user.name == username)
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
        if (addPlayer) {
            const mockCard: ICardObject = { number: '', suite: '', printString: '', url: '' }
            const user: IUserObject = { name: addPlayer.username, id: this.id++, cards: [mockCard] }
            this.playerList.push(user)
            reply += `\nLa til ${user.name} i spillet på plass ${user.id}`
        }
        return reply
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'electricity',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.elSwitch(interaction)
                },
            },
        ]
    }
}
