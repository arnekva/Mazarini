import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '9.9.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* /brukerinfo kan nå vise informasjonen om deg som er lagret i databasen (gamle getvalue). Showcaser hvordan select menu kan brukes` +
        `\n* Opprettet diverse handlere og hjelpeklasser for SelectMenus` +
        `\n* Superadmin er fjernet. for alt utenom !lock. De resterende funksjonene er nå tilgjengelig for adminer`

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
                description: 'Vis patch notes for ' + PatchNotes.currentVersion,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(rawMessage.channelId, pn)
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                description: 'Publiser nyeste patch notes til Bot-utvikling',
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
    getAllInteractions(): IInteractionElement[] {
        return []
    }
}
