import { Client } from 'discord.js'
import { ICommandElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'

export abstract class AbstractCommands {
    client: Client
    messageHelper: MessageHelper
    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
    }

    abstract getAllCommands(): ICommandElement[]
}
