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

    get messageHelper() {
        return this.client.messageHelper
    }
}
