import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.6.1'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Ny adminfunksjon: '!mz run'` +
        `\n*    - 'dbget' som vil hente verdier fra databasen basert på prefix eller mappe. Du kan spesifisere path også` +
        `\n*    - 'listprefix' som lister alle prefixer for brukerverdier som finnes` +
        `\n*    Eksempel: '!mz run dbget codStats' printe lagret codStats for alle brukere som har verdier der` +
        `\n*    Eksempel: vil '!mz run other/activeBet' finne alle aktive bets (som ligger lagret i /other/) og printe de. ` +
        `\n* Fikset en feil som gjorde at countdown ikke verifiserte at klokkeslett ble tatt med`
    // `\n* Gulag K/D og Damage Done/Taken ratio skal nå lagres og sammenliknes på lik måte som andre stats`

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
