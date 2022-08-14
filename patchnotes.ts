import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '9.4.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Fikset at stats med en feil ble forsøkt inkludert i siste 10 sanger fra /musikk` +
        `\n* Fikset en i CommandRunner hvor det sjekkes om avsender er admin; for eksterne news-channel vil ikke avsender være del av guild, og dermed ikke ha roles. ` +
        `\n* Prestige-kravet for Daily Claim er senket til 30 dager (var 100). Prestige multiplier vil være 1 + (0.05 * prestige-nivå)` +
        `\n* Fikset en feil som gjorde at Høie ikke fikk svart på /stats kommandoen` +
        `\n* /musikk inkluderer nå en header som sier hvilken kommand som ble brukt (siste, topp artist, topp album eller topp sanger)`

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
                description: 'Vis patch notes for ' + PatchNotes.currentVersion,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(rawMessage.channelId, pn)
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                description: 'Publiser nyeste patch notes til Bot-utvikling',
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
    getAllInteractions(): IInteractionElement[] {
        return []
    }
}
