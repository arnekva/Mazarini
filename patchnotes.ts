import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.3.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Kjører nå kun pm2 i prod` +
        `\n* Alle feilmeldinger burde nå logges til #action_log. Det skal inkludere feilmelding, stacktrace, callsite og context` +
        `\n* Botten skal nå være mye mer stabil, og restarte seg selv hvis den skulle kræsje` +
        `\n* Der nodemon før kræsjet skal pm2 powere through, så det burde resultere i mye færre kræsjer` +
        `\n* For devs: Må kjøre npm install på ny`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'patch',
                description: 'Vis nyligste patch notes',
                command: (rawMessage: Message, messageContent: string) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(rawMessage.channelId, pn)
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                description: 'Vis nyligste patch notes',
                hideFromListing: true,
                isAdmin: true,
                command: (rawMessage: Message, messageContent: string) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage('802716150484041751', pn)
                },
                category: 'admin',
            },
        ]
    }
}
