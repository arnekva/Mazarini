import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '7.0.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Stor rework av databasen:` +
        `\n    * Brukere settes og hentes nå som objekt i stedet for å kun hente ut enkle verdier` +
        `\n    * Brukere types til en MazariniUser, så du kan hente brukeren en gang og ta user.coins i stedet for å kalle en getValue for hver verdi, eks. getValue(username, "coins")` +
        `\n    * Du setter nå også verdier ved å oppdatere objektet og kalle DatabaseHelper.updateUser(userobject)` +
        `\n    * Databasen lagrer nå på ID i stedet for brukernavn` +
        `\n    * Alle nåværende objekt er oppdatert til den nye stilen` +
        `\n    * Fjernet flere ugyldige innlegg i databasen` +
        `\n* Oppgradert flere npm moduler, deriblant Cod Stats modulen som forhåpentligvis gir litt raskere lastetider` +
        `\n* Action_log skal nå fange opp flere slettede meldinger (hvis de ikke ble slettet av author selv)` +
        `\n* Achievements er fjernet` +
        `\n* Fikset en feil som førte til at noen admin-kommandoer ikke ville kjøre` +
        `\n* Følgende kommandoer er foreløpig ikke fungerende:` +
        `\n    * setvalue` +
        `\n    * totalspins` +
        `\n    * ath` +
        `\n    * getvalue` +
        `\n    * run (dbget)`
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
