import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '9.2.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Oppgradert til DiscordJS v14 (fra v13)` +
        `\n* Krever nå Node v16.9.0 eller høyere for å kjøre botten` +
        `\n* 'send' (Sende melding som botten) er nå en slash-command. Den vil vise for alle, men du vil ikke kunne bruke den hvis du ikke er admin` +
        `\n* Rettet en feil som gjorde at /musikk kommandoen ikke fungerte i noen tilfeller` +
        `\n* Shop er fjernet fra kodebasen og slash-kommandoene er fjernet` +
        `\n* Du kan nå linke WZ-brukernavn og LastFM-brukernavn med /link-kommandoen`

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
