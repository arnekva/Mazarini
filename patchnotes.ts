import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.7.4'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Krig mot hvem som helst skal nå si riktig brukernavn når personen ikke har råd.` +
        `\n* Du kan nå stoppe en reaction collector med alle versjoner av tommel ned emojien (tidligere kun gul)`
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
                    this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
                },
                category: 'admin',
            },
        ]
    }
}
