import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from 'discord.js'
import { ICommandElement } from './commands/commands'
import { MessageHelper } from './helpers/messageHelper'
export class PatchNotes {
    public static readonly currentVersion = '3.8.3'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `* WZ Stats sin (flaut) på damage taken er nå tilbake (for real this time)` +
        `\n* Adminer kan nå cancelle folk med '!mz cancel brukernavn' hvis de gjør eller sier noe krenkende` +
        `\n* Lagt til ny UserUtils for å lettere hente bruker og member objekter fra username og id`

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
