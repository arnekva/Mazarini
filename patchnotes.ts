import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes {
    public static readonly currentVersion = '4.2.2'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `* Fikset tekst når du går til krig mot deg selv eller botten` +
        `\n* Wallet viser nå både chips og coins, og '!mz chips' er markert deprecated` +
        `\n* Du kan nå gamble alt du har med '!mz gamble all/alt'` +
        `\n* setvalue skal nå gi beskjed hvis en prøver å sette en verdi på en bruker som ikke eksisterer. Inluderer logging til Action Log og @Bot-support tag slik at vi kan le av vedkommende` +
        `\n* Wallet skal ikke lenger rapportere NaN coins på brukere som ikke eksisterer` +
        `\n* Refactoret hvordan CommandElements hentes. De legges nå i en liste i stedet for som egne element. De kommer da i Commands automatisk` +
        `\n* Man kan nå skrive brukernavn med mellomrom i commands ved å bruke under_strek for å symbolisere mellomrommet`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }
    static PatchCommands: ICommandElement[] = [
        {
            commandName: 'patch',
            description: 'Vis nyligste patch notes',

            command: (rawMessage: Message, messageContent: string) => {
                const pn = PatchNotes.getCurrentPatchNotes()
                MessageHelper.sendMessage(rawMessage, pn)
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
                MessageHelper.sendMessageToSpecificChannel('802716150484041751', pn, rawMessage.channel as TextChannel)
            },
            category: 'admin',
        },
    ]
}
