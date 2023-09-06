import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { IInteractionElement } from './general/commands'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '12.0.3'
    public static readonly nextVersion = 'Backlog'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    private static readonly headerNextRelease = 'Saker i ' + PatchNotes.nextVersion

    public static readonly currentPatchNotes: string = `\n* Patchnotes vil nå publiseres automatisk ved oppstart dersom versjonsnr er endret`

    public static readonly nextPatchNotes: string = `https://trello.com/b/g4KkZwaX/bot-h%C3%B8ie`

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.compareAndSendPatchNotes()
    }

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }
    static getNextReleasePatchNotes() {
        return PatchNotes.headerNextRelease + '\n' + PatchNotes.nextPatchNotes
    }

    private compareAndSendPatchNotes() {
        const prev = DatabaseHelper.getBotData('version')
        if (prev && prev != PatchNotes.currentVersion) {
            this.publishPatchNotes()
        }
        DatabaseHelper.setBotData('version', PatchNotes.currentVersion)
    }

    private publishPatchNotes(rawInteraction?: ChatInputCommandInteraction<CacheType>) {
        const pn = PatchNotes.getCurrentPatchNotes()
        this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
        this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.PATCH_NOTES, pn)
        if (rawInteraction) {
            this.messageHelper.replyToInteraction(
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
                    {
                        commandName: 'publishnotes',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.publishPatchNotes(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
