import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement, IOnTimedEvent } from '../interfaces/interactionInterface'

export abstract class AbstractCommands {
    /** Client reference */
    client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }
    /** Get all interaction commands */
    abstract getAllInteractions(): IInteractionElement

    /** This will run for ALL command classes when the bot is restarting. Override in sub-class if anything needs to be saved */
    // eslint-disable-next-line require-await
    async onSave(): Promise<boolean> {
        return true
    }
    // eslint-disable-next-line require-await
    async refresh(): Promise<boolean> {
        return true
    }
    // eslint-disable-next-line require-await
    async onTimedEvent(): Promise<IOnTimedEvent> {
        return { daily: [], weekly: [], hourly: [] }
    }

    /** gets messageHelper from client */
    get messageHelper() {
        return this.client.messageHelper
    }

    get database() {
        return this.client.database
    }
}
