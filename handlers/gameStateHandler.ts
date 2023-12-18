
export class GameStateHandler<Player> {
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

}