import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.8.1'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* WZ siste match skal nå forsøke å fetche siste match opp til 3 ganger hvis den feiler` +
        `\n* Krig med hvem som helst pinger nå deltakere når krigen er ferdig` +
        `\n* Hvis den som starter verdenskrigen reagerer med tommel opp skal han ikke lenger komme i printen dobbelt opp` +
        `\n* MiscUtils og TextUtils er nå namespaces` +
        `\n* Oppdatert eivindpride-algoritmen for å ta høyde for nye pride-emojier` +
        `\n* Superadminer kan nå stanse bot-prosessen ved å kjøre '!Mz stoppprocess'`
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
