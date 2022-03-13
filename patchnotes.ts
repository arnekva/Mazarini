import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.0.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Botten bruker nå Mocha for unit testing` +
        `\n* Opprettet test-mappe for testfiler` +
        `\n* Fikset en feil som gjorde at du kunne ende opp med desimaltall som chips-verdier når banken tok renter` +
        `\n* Du kan nå fryse daily streaken din hvis du vet at du skal være uten nettilgang i opp til 4 dager. Bruk '!mz freezedaily 4' for å fryse i 4 dager. Du kan se hvor mange dager du har igjen ved å prøve '!Mz daily'. Denne kan ikke fjernes eller overskrives` +
        `\n* Adminer kan nå sette statusen til botten dynamisk ved å bruke '!mz botstatus watching kaptein sabeltann'. Bruk help for å se lovlige aktivitetstyper` +
        `\n* Kommandoer kan nå låses til å kun brukes i spesifikke kanaler. "Gamble" er først ut og blir låst til kun <#808992127249678386>` +
        `\n* Botten tagger nå ikke Bot Support automatisk når spesifikke feil oppstår. Feilkode logges, og bruker får mulighet til å reagere med tommel opp for å automatisk tagge support` +
        `\n* Stats er delvis reimplementert og viser foreløpig kun antall meldinger sent siden sist oppstart` +
        `\n* Du skal ikke lenger kunne gå til krig over 0 chips`

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
