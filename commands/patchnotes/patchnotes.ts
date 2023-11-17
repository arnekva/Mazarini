import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { environment } from '../../client-env'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../general/commands'
import { DatabaseHelper } from '../../helpers/databaseHelper'
import { MessageHelper } from '../../helpers/messageHelper'
import { MentionUtils } from '../../utils/mentionUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '14.1.0'
    public static readonly currentPatchNotes =
        `\n* /poll har nå en parameter som heter flervalg. Sett denne til True for å tillate et personer svarer på mer enn ett valg` +
        `\n* Rettet en feil som gjorde at det kunne bli logget veldig mange feilmeldinger dersom en AutoComplete ikke ble besvart i koden`

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

    static compareAndSendPatchNotes(msgHelper: MessageHelper) {
        const prev = DatabaseHelper.getBotData('version')
        if (prev && prev != PatchNotes.currentVersion && environment === 'prod') {
            PatchNotes.publishPatchNotes(msgHelper)
        }
        DatabaseHelper.setBotData('version', PatchNotes.currentVersion)
    }

    static publishPatchNotes(msgHelper: MessageHelper, rawInteraction?: ChatInputCommandInteraction<CacheType>) {
        const pn = PatchNotes.getCurrentPatchNotes()
        msgHelper.sendMessage(MentionUtils.CHANNEL_IDs.BOT_UTVIKLING, { text: pn })
        msgHelper.sendMessage(MentionUtils.CHANNEL_IDs.PATCH_NOTES, { text: pn })
        if (rawInteraction) {
            msgHelper.replyToInteraction(
                rawInteraction,
                `Patch notes sendt til ${MentionUtils.mentionChannel(MentionUtils.CHANNEL_IDs.BOT_UTVIKLING)} og ${MentionUtils.mentionChannel(
                    MentionUtils.CHANNEL_IDs.PATCH_NOTES
                )}`,
                { ephemeral: true }
            )
        }
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
                    // {
                    //     commandName: 'publishnotes',
                    //     command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    //         this.publishPatchNotes(rawInteraction)
                    //     },
                    // },
                ],
            },
        }
    }
}
