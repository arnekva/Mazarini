import {
    ActionRowBuilder,
    APIButtonComponent,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    GuildEmoji,
    InteractionResponse,
    Message,
    ModalSubmitInteraction,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { EmbedUtils } from '../../utils/embedUtils'
import { RandomUtils } from '../../utils/randomUtils'
import { UserUtils } from '../../utils/userUtils'

const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js')

interface IDonDCase {
    value: number
    opened: boolean
}

interface IDonDGame {
    cases: Map<number, IDonDCase>
    casesOpened: number
    player: IDonDPlayer
    round: number
    state: DonDState
    latestOffer?: number
    embedMessage?: InteractionResponse<boolean> | Message<boolean>
    buttonRows?: Message<boolean>[]
    quality?: DonDQuality
}

enum DonDState {
    Opening = 'opening',
    BankOffer = 'bankOffer',
    KeepOrSwitch = 'keepOrSwitch',
    Accepted = 'accepted',
    Switched = 'switched',
    Kept = 'kept',
}

interface IDonDPlayer {
    id: string
    emoji: GuildEmoji
    caseNr?: number
}

export enum DonDQuality {
    Basic = 10,
    Premium = 20,
    Elite = 50,
}

export class DealOrNoDeal extends AbstractCommands {
    private games: IDonDGame[]

    constructor(client: MazariniClient) {
        super(client)
        this.games = new Array<IDonDGame>()
    }

    private async sendModal(interaction: ButtonInteraction<CacheType>) {
        const btnCustomId = interaction.customId.split(';')
        if (!(interaction.user.id === btnCustomId[1])) {
            return interaction.deferUpdate()
        }
        const quality = Number(btnCustomId[2]) as DonDQuality
        const customId = `DEAL_OR_NO_DEAL_MODAL;${interaction.user.id};${quality};${interaction.message.id}`
        const modal = new ModalBuilder().setCustomId(customId).setTitle('Send melding som Høie')
        const caseSelection = new TextInputBuilder()
            .setCustomId('koffert')
            .setLabel('Velg en koffert')
            .setPlaceholder('Skriv et tall mellom 1 og 26')
            // Paragraph means multiple lines of text.
            .setStyle(TextInputStyle.Short)

        const firstActionRow = new ActionRowBuilder().addComponents(caseSelection)
        modal.addComponents(firstActionRow)
        await interaction.showModal(modal)
    }

    private async handleDondModal(interaction: ModalSubmitInteraction) {
        const playerCase = Number(interaction.fields.getTextInputValue('koffert'))
        if (!(playerCase && playerCase > 0 && playerCase < 27)) {
            return this.messageHelper.replyToInteraction(interaction, 'Du må velge en koffert mellom 1 og 26')
        }
        const customId = interaction.customId.split(';')
        const btnMessageId = customId[3]
        const btnMessage = await this.messageHelper.fetchMessage(interaction.channelId, btnMessageId)
        const row = interaction.message.components[0]
        ;(row.components as any) = row.components.map((button) => ButtonBuilder.from(button as APIButtonComponent).setDisabled(true))
        await btnMessage.edit({ components: [row] })

        if (this.games.some((game) => game.player.id === interaction.user.id)) {
            return this.messageHelper.replyToInteraction(interaction, 'Du har allerede et aktivt game')
        }
        const quality = Number(customId[2]) as DonDQuality
        this.setupGame(interaction, playerCase, quality)
    }

    private async setupGame(interaction: ModalSubmitInteraction<CacheType>, playerCase: number, quality: DonDQuality) {
        const cases = this.getRandomizedCases(quality)
        const emoji = await EmojiHelper.getGuildEmoji(interaction.user.username, this.client)
        const game: IDonDGame = {
            player: { id: interaction.user.id, emoji: emoji, caseNr: playerCase },
            cases: cases,
            casesOpened: 0,
            round: 1,
            state: DonDState.Opening,
            buttonRows: new Array<Message>(),
            quality: quality,
        }
        this.games.push(game)
        this.printGame(interaction, game)
    }

    private getRandomizedCases(quality: DonDQuality) {
        const values = RandomUtils.shuffleList(allCases.get(quality))
        const caseMap = new Map<number, IDonDCase>()
        for (let i = 1; i <= values.length; i++) {
            caseMap.set(i, { value: values[i - 1], opened: false })
        }
        return caseMap
    }

    private getGameMessage(game: IDonDGame) {
        if (game.state === DonDState.Opening) {
            const casesToOpen = this.getCasesOpenedThisRound(game)
            return `Åpne ${casesToOpen} koffert${casesToOpen > 1 ? 'er' : ''} denne runden!`
        } else if (game.state === DonDState.BankOffer) {
            const offer = this.getBankOffer(game)
            game.latestOffer = offer
            return `Bank Høie tilbyr deg ${offer} chips for kofferten din!\nGodtar du bankens tilbud?`
        } else if (game.state === DonDState.Accepted) {
            const playerCaseValue = game.cases.get(game.player.caseNr).value
            return `Du har akseptert Bank Høies tilbud på ${game.latestOffer} chips!\n\nHadde du stått løpet ut, hadde du fått ${playerCaseValue} chips!`
        } else if (game.state === DonDState.KeepOrSwitch) {
            const remainingCase = Array.from(game.cases.entries()).filter((val) => !val[1].opened && val[0] != game.player.caseNr)
            return (
                `Da er det bare to kofferter igjen - din nr ${game.player.caseNr}, og nr ${remainingCase[0][0]}` +
                `\n\nØnsker du å beholde kofferten din, eller vil du bytte?`
            )
        } else {
            const playerCase = game.cases.get(game.player.caseNr)
            return (
                `${game.state === DonDState.Switched ? 'Du valgte å bytte koffert!' : 'Du valgte å stå ved kofferten du har hatt gjennom hele spillet...'}` +
                `\n\nGratulerer så mye med ${playerCase.value} chips!`
            )
        }
    }

    private getCasesOpenedThisRound(game: IDonDGame) {
        let casesToBeOpened = 0
        for (let i = 0; i < game.round; i++) {
            const roundOpenings = Math.max(1, 6 - i)
            casesToBeOpened += roundOpenings
        }
        return casesToBeOpened - game.casesOpened
    }

    private getBankOffer(game: IDonDGame) {
        const unOpenedCases = Array.from(game.cases.values()).filter((val) => !val.opened)
        if (unOpenedCases.length === 0) return 0

        // Calculate expected value (EV)
        const totalSum = unOpenedCases.reduce((sum, value) => sum + value.value, 0)
        const expectedValue = totalSum / unOpenedCases.length

        // Define percentage factor (p) based on game round
        const percentage = 0.5 + game.round * 0.05
        // Calculate the final offer
        const offer = expectedValue * percentage
        // Round to nearest whole number for realism
        return Math.round(offer)
    }

    private getCaseValueFields(game: IDonDGame, openedCaseValue?: number) {
        const cases = Array.from(game.cases.values()).sort((a, b) => a.value - b.value)
        let field1 = ''
        let field2 = ''
        let field3 = ''
        for (let i = 0; i < cases.length; i++) {
            const styling = cases[i].opened ? '~~' : '**'
            const caseMsg = styling + cases[i].value + styling + (cases[i].value === openedCaseValue ? '*' : '') + '\n'
            if (i < 9) field1 += caseMsg
            else if (i < 18) field2 += caseMsg
            else field3 += caseMsg
        }
        return [
            { name: ' ', value: field1, inline: true },
            { name: ' ', value: field2, inline: true },
            { name: ' ', value: field3, inline: true },
        ]
    }

    private getCaseButtons(game: IDonDGame) {
        const btnRows = new Array<ActionRowBuilder<ButtonBuilder>>()
        const playerBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
            dondBtn(game.player.id, game.player.caseNr, false, true).setEmoji({ name: game.player.emoji.name, id: game.player.emoji.id })
        )
        btnRows.push(playerBtn)
        const remainingCases = Array.from(game.cases.entries()).filter((val) => val[0] !== game.player.caseNr)
        for (let i = 0; i < 5; i++) {
            const buttons = new ActionRowBuilder<ButtonBuilder>()
            for (let j = 0; j < 5; j++) {
                const index = i * 5 + j
                const btnCase = remainingCases[index]
                const btn = dondBtn(game.player.id, btnCase[0], btnCase[1].opened || game.state === DonDState.BankOffer, false)
                buttons.addComponents(btn)
            }
            btnRows.push(buttons)
        }
        return btnRows
    }

    public async printGame(interaction: ModalSubmitInteraction<CacheType>, game: IDonDGame) {
        const embed = EmbedUtils.createSimpleEmbed('Deal Or No Deal', this.getGameMessage(game))
            .addFields(this.getCaseValueFields(game))
            .setThumbnail(
                'https://firebasestorage.googleapis.com/v0/b/mazarini-384411.appspot.com/o/sturla.png?alt=media&token=6377ff85-610d-4a0c-a7eb-deac1034cd30'
            )
        const buttons = this.getCaseButtons(game)
        const msg = await this.messageHelper.replyToInteraction(interaction, embed, {})
        game.embedMessage = msg
        for (const btnRow of buttons) {
            const btns = await this.messageHelper.sendMessage(interaction.channelId, { components: [btnRow] })
            game.buttonRows.push(btns)
        }
    }

    private updateGame(game: IDonDGame, openedCaseValue?: number) {
        const embed = EmbedUtils.createSimpleEmbed('Deal Or No Deal', this.getGameMessage(game))
            .addFields(this.getCaseValueFields(game, openedCaseValue))
            .setThumbnail(
                'https://firebasestorage.googleapis.com/v0/b/mazarini-384411.appspot.com/o/sturla.png?alt=media&token=6377ff85-610d-4a0c-a7eb-deac1034cd30'
            )
        if (game.state === DonDState.BankOffer) {
            embed.setThumbnail(
                'https://firebasestorage.googleapis.com/v0/b/mazarini-384411.appspot.com/o/bank_hoie.png?alt=media&token=e1bd0ac5-50be-41f5-92df-2dd42cc8ecdf'
            )
            const offerBtnRow = this.getBankOfferButtons(game)
            game.embedMessage.edit({ embeds: [embed], components: [offerBtnRow] })
        } else if (game.state === DonDState.KeepOrSwitch) {
            const switchBtnRow = this.getKeepOrSwitchButtons(game)
            game.embedMessage.edit({ embeds: [embed], components: [switchBtnRow] })
        } else {
            game.embedMessage.edit({ embeds: [embed], components: [] })
        }
    }

    private getBankOfferButtons(game: IDonDGame) {
        const buttons = new ActionRowBuilder<ButtonBuilder>()
        const yes = dondOffer(game.player.id, 'Ja')
        const no = dondOffer(game.player.id, 'Nei')
        buttons.addComponents([yes, no])
        return buttons
    }

    private getKeepOrSwitchButtons(game: IDonDGame) {
        const buttons = new ActionRowBuilder<ButtonBuilder>()
        const keepCase = dondSwitch(game.player.id, 'Behold')
        const switchCase = dondSwitch(game.player.id, 'Bytt')
        buttons.addComponents([keepCase, switchCase])
        return buttons
    }

    private gameController(interaction: ButtonInteraction<CacheType>, game: IDonDGame) {
        if (game.state === DonDState.Opening && !this.roundOpeningIsFinished(game)) return this.openCase(interaction, game)
    }

    private async openCase(interaction: ButtonInteraction<CacheType>, game: IDonDGame) {
        game.casesOpened++
        const caseId = Number(interaction.customId.split(';')[2])
        const openCase = game.cases.get(caseId)
        openCase.opened = true
        game.cases.set(caseId, openCase)
        const row = interaction.message.components[0]
        ;(row.components as any) = row.components.map((button) =>
            button.customId === interaction.customId ? ButtonBuilder.from(button as APIButtonComponent).setDisabled(true) : button
        )
        await interaction.message.edit({ components: [row] })
        if (this.roundOpeningIsFinished(game)) {
            game.state = DonDState.BankOffer
        }
        this.updateGame(game, openCase.value)
    }

    private roundOpeningIsFinished(game: IDonDGame) {
        const opened = game.casesOpened
        return (
            (game.round === 1 && opened === 6) ||
            (game.round === 2 && opened === 11) ||
            (game.round === 3 && opened === 15) ||
            (game.round === 4 && opened === 18) ||
            (game.round === 5 && opened === 20) ||
            (game.round >= 6 && opened === 20 + (game.round - 5))
        )
    }

    private async answerBankOffer(interaction: ButtonInteraction<CacheType>, game: IDonDGame) {
        const answer = (interaction.customId.split(';')[2] as string).toLowerCase()
        if (answer === 'nei') {
            game.round++
            if (game.round < 10) game.state = DonDState.Opening
            else game.state = DonDState.KeepOrSwitch
        } else {
            game.state = DonDState.Accepted
            const user = await this.database.getUser(interaction.user.id)
            this.updateUserStats(user, game.latestOffer, game.cases.get(game.player.caseNr).value, game.quality, true)
            this.client.bank.giveMoney(user, game.latestOffer)
            this.removeGame(game)
        }
        this.updateGame(game)
    }

    private async keepOrSwitch(interaction: ButtonInteraction<CacheType>, game: IDonDGame) {
        const answer = (interaction.customId.split(';')[2] as string).toLowerCase()
        const remainingCase = Array.from(game.cases.entries()).filter((val) => !val[1].opened && val[0] != game.player.caseNr)
        let oppositeCaseValue = remainingCase[0][1].value
        if (answer === 'bytt') {
            oppositeCaseValue = game.cases.get(game.player.caseNr).value
            game.player.caseNr = remainingCase[0][0]
            game.state = DonDState.Switched
        } else {
            game.state = DonDState.Kept
        }
        const playerReward = game.cases.get(game.player.caseNr).value
        const user = await this.database.getUser(interaction.user.id)

        this.updateUserStats(user, playerReward, game.cases.get(game.player.caseNr).value, game.quality, undefined, oppositeCaseValue)
        this.client.bank.giveMoney(user, playerReward)
        this.removeGame(game)
        this.updateGame(game)
    }

    /**
     *
     * @param user
     * @param valueWon - The value the user won
     * @param gameValue - The value of the highest case in the game
     * @param fromDeal If the money was won from a deal, set this to true
     */
    private updateUserStats(user: MazariniUser, valueWon: number, gameValue: number, quality: DonDQuality, fromDeal?: boolean, remainingCaseValue?: number) {
        if (!user.userStats?.dondStats) {
            if (!user.userStats) user.userStats = {}
            const emptyStats = {
                totalGames: 0,
                timesAcceptedDeal: 0,
                totalMissedMoney: 0,
                winningsFromKeepOrSwitch: 0,
                timesWonLessThan1000: 0,
                winningsFromAcceptDeal: 0,
                winsOfOne: 0,
                keepSwitchBalance: 0,
            }
            user.userStats.dondStats.fiftyKStats = emptyStats
            user.userStats.dondStats.twentyKStats = emptyStats
            user.userStats.dondStats.tenKStats = emptyStats
        }
        let gameToTrack = user.userStats.dondStats.tenKStats
        if (quality === DonDQuality.Premium) gameToTrack = user.userStats.dondStats.twentyKStats
        else if (quality === DonDQuality.Elite) gameToTrack = user.userStats.dondStats.fiftyKStats

        gameToTrack.totalGames++
        gameToTrack.totalMissedMoney += gameValue - valueWon
        if (valueWon < 1000) gameToTrack.timesWonLessThan1000++
        if (valueWon === 1) gameToTrack.winsOfOne++
        if (fromDeal) {
            gameToTrack.timesAcceptedDeal++
            gameToTrack.winningsFromAcceptDeal += valueWon
        } else {
            gameToTrack.winningsFromKeepOrSwitch += valueWon

            if (remainingCaseValue) {
                gameToTrack.keepSwitchBalance += valueWon - remainingCaseValue
            }
        }
    }

    private removeGame(deleteGame: IDonDGame) {
        for (const msg of deleteGame.buttonRows) {
            msg.delete()
        }
        const index = this.games.findIndex((game) => game.player.id === deleteGame.player.id)
        this.games.splice(index, 1)
    }

    private async verifyUserAndCallMethod(interaction: ButtonInteraction<CacheType>, callback: (game: IDonDGame) => void) {
        if (!(interaction.user.id === interaction.customId.split(';')[1]))
            return this.messageHelper.replyToInteraction(interaction, 'Dette er ikke ditt spill', { ephemeral: true })
        const game = this.games.find((game) => game.player.id == interaction.user.id)
        if (game) {
            if (await this.messageHelper.deferUpdate(interaction)) callback(game)
        } else this.messageHelper.replyToInteraction(interaction, 'Dette spillet er ikke lenger aktivt', { ephemeral: true })
    }

    override async onSave(): Promise<boolean> {
        this.games.forEach((game) => {
            this.client.cache.restartImpediments.push(`${UserUtils.findUserById(game.player.id, this.client).username} har et aktivt deal or no deal game`)
        })
        return true
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                buttonInteractionComands: [
                    {
                        commandName: 'DEAL_OR_NO_DEAL_GAME',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.sendModal(rawInteraction)
                        },
                    },
                    {
                        commandName: 'DEAL_OR_NO_DEAL_CASE',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(rawInteraction, (game) => this.gameController(rawInteraction, game))
                        },
                    },
                    {
                        commandName: 'DEAL_OR_NO_DEAL_OFFER',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(rawInteraction, (game) => this.answerBankOffer(rawInteraction, game))
                        },
                    },
                    {
                        commandName: 'DEAL_OR_NO_DEAL_SWITCH',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(rawInteraction, (game) => this.keepOrSwitch(rawInteraction, game))
                        },
                    },
                ],
                modalInteractionCommands: [
                    {
                        commandName: 'DEAL_OR_NO_DEAL_MODAL',
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.handleDondModal(rawInteraction)
                        },
                    },
                ],
            },
        }
    }

    static getDealOrNoDealButton(userId: string, quality?: DonDQuality): ButtonBuilder {
        let tier = quality
        if (!tier) {
            const roll = Math.random()
            if (roll < 1 / 6) tier = DonDQuality.Elite // 1/6 chance for elite
            else if (roll < 1 / 2) tier = DonDQuality.Premium // 2/6 chance for premium
            else tier = DonDQuality.Basic // 3/6 chance for basic
        }
        return dondGame(userId, tier)
    }
}

const basicCases = [1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 10000]

const premiumCases = [
    1, 5, 10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12500, 14000, 16000, 18000, 20000,
]

const eliteCases = [
    1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000, 12500, 15000, 17500, 20000, 22500, 25000, 30000, 35000, 40000, 45000, 50000,
]

const allCases = new Map<DonDQuality, number[]>([
    [DonDQuality.Basic, basicCases],
    [DonDQuality.Premium, premiumCases],
    [DonDQuality.Elite, eliteCases],
])

const dondBtn = (userId: string, id: number, opened: boolean, isPlayersCase: boolean) => {
    return new ButtonBuilder({
        custom_id: `DEAL_OR_NO_DEAL_CASE;${userId};${id}`,
        style: isPlayersCase ? ButtonStyle.Success : ButtonStyle.Primary,
        label: `${id}`,
        disabled: opened || isPlayersCase,
        type: 2,
    })
}

const dondOffer = (userId: string, choice: string) => {
    return new ButtonBuilder({
        custom_id: `DEAL_OR_NO_DEAL_OFFER;${userId};${choice}`,
        style: choice === 'Ja' ? ButtonStyle.Success : ButtonStyle.Danger,
        label: `${choice}`,
        disabled: false,
        type: 2,
    })
}

const dondSwitch = (userId: string, choice: string) => {
    return new ButtonBuilder({
        custom_id: `DEAL_OR_NO_DEAL_SWITCH;${userId};${choice}`,
        style: choice === 'Behold' ? ButtonStyle.Success : ButtonStyle.Primary,
        label: `${choice}`,
        disabled: false,
        type: 2,
    })
}

export const dondGame = (userId: string, quality: DonDQuality) => {
    return new ButtonBuilder({
        custom_id: `DEAL_OR_NO_DEAL_GAME;${userId};${quality}`,
        style: ButtonStyle.Primary,
        label: `Deal or no Deal (${quality}K)`,
        disabled: false,
        type: 2,
    })
}
