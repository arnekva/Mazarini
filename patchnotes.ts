import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes {
    public static readonly currentVersion = '4.3.1'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string = `* Rocket League stats kjører nå Puppeteer`

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
