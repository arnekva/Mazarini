import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '23.2.0'
    public static readonly currentPatchNotes =
        '* Blackjack ved hasjwin tagges nå som en deathroll-blackjack og betyr:' +
        '\n  * Man får én gratis dpn per hasjwin dersom innsatsen er på >25k' +
        '\n  * Play again gir samme slight advantage som den innledende har gjort frem til nå' +
        '\n  * Play again på en deathroll-blackjack går nå inn med det du vant som innsats på neste' +
        '\n      * 20k hash > win > 40k play again' +
        '\n* Re-buffer nei takk innskuddet i deathroll' +
        '\n### TLDR' +
        '\n* Deathroll er bedre' +
        '\n* Blackjack ved hasjwin er bedre' +
        "\n* Bruk 'Play again' på hasjwin-blackjack-en heller enn å starte ny"

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
