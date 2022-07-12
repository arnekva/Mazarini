import { Client } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from '../General/commands'
import { MessageHelper } from '../helpers/messageHelper'

export class SoundCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return []
    }
}
