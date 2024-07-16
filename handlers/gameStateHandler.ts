import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

export interface GamePlayer {
    id: string
}

export class GameStateHandler<Player extends GamePlayer> {
    private players: Player[]
    private currentPlayer: Player

    constructor(players?: Player[]) {
        this.players = players ? players : new Array<Player>()
        this.currentPlayer = players ? players[0] : undefined
    }

    public isPlayersTurn(player: Player) {
        return this.currentPlayer ? this.currentPlayer == player : false
    }

    public addPlayer(player: Player) {
        this.players.push(player)
        if (!this.currentPlayer) this.currentPlayer = player
    }

    public addUniquePlayer(player: Player) {
        if (!this.players.includes(player)) this.players.push(player)
        if (!this.currentPlayer) this.currentPlayer = player
    }

    public nextPlayer() {
        const nextPlayerIndex = (this.players.indexOf(this.currentPlayer) + 1) % this.players.length
        this.currentPlayer = this.players[nextPlayerIndex]
        return this.currentPlayer
    }

    public getCurrentPlayer() {
        return this.currentPlayer
    }

    public hasPlayerJoined(id: string) {
        return this.players.some(player => player.id === id)
    }

    public getPlayer(id: string) {
        return this.players.find(player => player.id === id)
    }

    get allPlayers() {
        return this.players
    }

    public getStartComponents(gameId: string) {
        const gameSetupButtonRow = new ActionRowBuilder<ButtonBuilder>()
        gameSetupButtonRow.addComponents(
            new ButtonBuilder({
                custom_id: `${gameId}_JOIN`,
                style: ButtonStyle.Primary,
                label: `Bli med!`,
                disabled: false,
                type: 2,
            }),
            new ButtonBuilder({
                custom_id: `${gameId}_START`,
                style: ButtonStyle.Success,
                label: `🍷 Start 🍷`,
                disabled: false,
                type: 2,
            })
        )
        return gameSetupButtonRow
    }
}
