import { MazariniClient } from "../client/MazariniClient"
import { MazariniUser } from "../interfaces/database/databaseInterface"

export class MoneyHelper {

    private client: MazariniClient
    private jail_multiplier: number = 0.25

    constructor(client: MazariniClient) {
        this.client = client
    }
    
    giveMoney(user: MazariniUser, amount: number) {
        const amountGiven = this.applyRestrictions(user, amount)
        user.chips = user.chips ? (user.chips + amountGiven) : amountGiven
        this.client.database.updateUser(user)
        return amountGiven
    }

    giveUnrestrictedMoney(user: MazariniUser, amount: number) {
        user.chips = user.chips ? (user.chips + amount) : amount
        this.client.database.updateUser(user)
    }

    // checks if user can afford. returns true if money was taken
    takeMoney(user: MazariniUser, amount: number): boolean {
        const canAfford = this.userCanAfford(user, amount)
        if (canAfford) {
            user.chips -= amount
            this.client.database.updateUser(user)
            return true
        }
        return false
    }

    userCanAfford(user: MazariniUser, amount: number) {
        return user.chips && user.chips >= amount
    }

    applyRestrictions(user: MazariniUser, money: number) {
        if ((user.jail?.daysInJail ?? 0) > 0) {
            return Math.floor(money * this.jail_multiplier)
        }
        return money
    }

}