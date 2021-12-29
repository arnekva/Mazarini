import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes {
    public static readonly currentVersion = '3.12.4'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `* Shop bruker nå coins i stedet for chips` +
        `\n* Du kan nå hente ut daglige ekstra chips og coins ved å bruke '!mz daily'. Kan brukes en gang daglig. Du får mer hvis du klarer 5 dager på rad` +
        `\n* Slash-command inventory skal nå vise korrekt navn på debuffs`

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
