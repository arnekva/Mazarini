import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.2.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Darri har endelig laga en PR \n* Du kan gambla med slurker med !mz drikk'` +
        `\n* Random-funksjoner ligger nå i RandomUtils` +
        `\n* @Bot-support skal ikke lenger tagges som default` +
        `\n* Daily og weekly jobs kjører nå 06:00 i stedet for 08:00. Det betyr at !daily kan kjøres fra 06 nå` +
        `\n* TextUtils.formatMoney() brukes nå for å formattere chips eller coins. Caller .toLocaleString("nb"), med optional parametere for max og min fraction digits` +
        `\n* Krig pinger nå begge deltakere når resultatet er klart`

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
