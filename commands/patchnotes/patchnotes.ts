import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { environment } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'

import { DatabaseHelper } from '../../helpers/databaseHelper'
import { MessageHelper } from '../../helpers/messageHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { ChannelIds } from '../../utils/mentionUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '15.11.0'
    public static readonly currentPatchNotes =
        `\n* Fikset rocket league stats og lagt til en ny modus - tournament`
        + `\n* Lagt inn logikk i /terning for å håndtere deathroll`
        + `\n * Ingen grense på hvor mange brukere som er med i en runde`
        + `\n * Ingen grense på hvor mange samtidige runder som pågår`
        + `\n * Triller du på nytt på din egen terning vil dette starte et nytt, parallelt spill`
        + `\n * Autocomplete vil alltid foreslå terning i følgende rekkefølge`
        + `\n   * Runder du allerede er med i`
        + `\n   * Runder du kan bli med i (straks noe triller for andre gang i en runde, kan den ikke lenger joines)`
        + `\n   * Standard trill på 10 000 - som starter en ny runde`

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    public static readonly trelloBoardUrl = `https://trello.com/b/g4KkZwaX/bot-h%C3%B8ie`

    constructor(client: MazariniClient) {
        super(client)
    }

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }
    static getNextReleasePatchNotes() {
        return 'Backlog:\n' + PatchNotes.trelloBoardUrl
    }

    static async compareAndSendPatchNotes(msgHelper: MessageHelper, dbHelper: DatabaseHelper) {
        const prev = await dbHelper.getBotData('version')
        if (prev && prev != PatchNotes.currentVersion && environment === 'prod') {
            PatchNotes.publishPatchNotes(msgHelper)
        }
        dbHelper.setBotData('version', PatchNotes.currentVersion)
    }

    static publishPatchNotes(msgHelper: MessageHelper) {
        const patchNotes = PatchNotes.getCurrentPatchNotes()
        msgHelper.sendMessage(ChannelIds.BOT_UTVIKLING, { text: patchNotes })
        msgHelper.sendMessage(ChannelIds.PATCH_NOTES, { text: patchNotes })
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'patchnotes',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getCurrentPatchNotes())
                        },
                    },
                    {
                        commandName: 'backlog',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getNextReleasePatchNotes())
                        },
                    },
                ],
            },
        }
    }
}
