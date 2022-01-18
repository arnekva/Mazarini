import { Client } from 'discord.js'
import { ICommandElement } from '../commands/commands'

export abstract class AbstractCommands {
    client: Client
    constructor(client: Client) {
        this.client = client
    }

    abstract getAllCommands(): ICommandElement[]
}
