import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes {
    public static readonly currentVersion = '3.7.11'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `* Fikset bonk URL-er ` +
        `\n* Lagt til flere emojies som Bot Høie vil reagere med på diverse kommandoer` +
        `\n* Endringer i gevinster for spin` +
        `\n* Oppdatert hjelp-beskrivelsen for spin til å reflektere at man nå kan vinne på hver spin`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }

    static readonly getPatchNotes: ICommandElement = {
        commandName: 'patch',
        description: 'Vis nyligste patch notes',

        command: (rawMessage: Message, messageContent: string) => {
            const pn = PatchNotes.getCurrentPatchNotes()
            MessageHelper.sendMessage(rawMessage, pn)
        },
        category: 'annet',
    }

    static readonly publishPatchNotes: ICommandElement = {
        commandName: 'publishnotes',
        description: 'Vis nyligste patch notes',
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            MessageFlags
            const pn = PatchNotes.getCurrentPatchNotes()
            MessageHelper.sendMessageToSpecificChannel('802716150484041751', pn, rawMessage.channel as TextChannel)
        },
        category: 'admin',
    }
}
