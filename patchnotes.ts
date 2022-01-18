import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '5.0.1'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `* Refaktorert hvordan commands er satt opp` +
        `\n* En command kan nå ha flere triggere ved å legge commandName som en array (eks trigger "sivert", "geggien", "trackpad" og "steve" alle samme commanden)` +
        `\n* Ingen klasser er lenger statiske (utenom hjelpeklasser)` +
        `\n* Refaktorert MessageHelper til å ikke lenger være avhengig av Message-objekter` +
        `\n* Alle klasser har nå tilgang til client og messageHelper via this` +
        `\n* 'krig' kan nå trigges med tall og brukernavn i begge argument-plasser` +
        `\n* Midlertidig skrudd av interaksjoner` +
        `\n* Lagt til command for Sivert` +
        `\n* !zm support er midlertidig fjernet noen steder` +
        `\n* Github commands fjernet`

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
