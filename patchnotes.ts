import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { IInteractionElement } from './general/commands'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '13.0.0'
    public static readonly currentPatchNotes = 
    `\n* Opprettet MazariniClient som extender DiscordClient` +
    `\n* AbstractCommands er refaktorert til å ikke lenger ha behov for egen instanse av messageHelper` 

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
        msgHelper.sendMessage(MentionUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
        msgHelper.sendMessage(MentionUtils.CHANNEL_IDs.PATCH_NOTES, pn)
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
