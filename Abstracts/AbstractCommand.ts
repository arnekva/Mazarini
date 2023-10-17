import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'

export abstract class AbstractCommands {
    /** Client reference */
    client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }
    /** Get all interaction commands */
    abstract getAllInteractions(): IInteractionElement

    /** gets messageHelper from client */
    get messageHelper() {
        return this.client.messageHelper
    }
}
