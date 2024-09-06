import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../interfaces/interactionInterface'

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

    /** gets messageHelper from client */
    get messageHelper() {
        return this.client.messageHelper
    }
}
