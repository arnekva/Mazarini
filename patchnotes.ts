import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes {
    public static readonly currentVersion = '3.13.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `* Du kan nå legge til quotes ved eks '!mz quote Magnius Nord er alltid rett fram'. Du kan hente et random quote med '!mz quote' (og '!mz quote Magnus' for spesifikk person)` +
        `\n* Meme-navn i '!mz meme' er nå case insensetive (eks. både "TIMMY og timmy" vil trigge timmy's dad meme)` +
        `\n* Flere nye funksjoner i DatabaseHelper er lagt til for å forenkle prosessen med non-user values`

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
