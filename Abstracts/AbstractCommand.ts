import { Client } from 'discord.js'
import { ICommandElement, IInteractionElement } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'

export abstract class AbstractCommands {
    /** Client reference */
    client: Client
    /** Used to send and reply to message. These functions also does error handling etc. */
    messageHelper: MessageHelper
    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
    }

    /** Get all text commands */
    abstract getAllCommands(): ICommandElement[]
    /** Get all interaction commands */
    abstract getAllInteractions(): IInteractionElement[]
}
