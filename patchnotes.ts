import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { IInteractionElement } from './general/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '12.0.1'
    public static readonly nextVersion = 'Backlog'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    private static readonly headerNextRelease = 'Saker i ' + PatchNotes.nextVersion

    public static readonly currentPatchNotes: string = `\n* Refaktorert parametere i replyToInteraction`

    public static readonly nextPatchNotes: string = `https://trello.com/b/g4KkZwaX/bot-h%C3%B8ie`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }
    static getNextReleasePatchNotes() {
        return PatchNotes.headerNextRelease + '\n' + PatchNotes.nextPatchNotes
    }

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
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
                            const pn = PatchNotes.getCurrentPatchNotes()
                            this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
                            this.messageHelper.sendMessage(MentionUtils.CHANNEL_IDs.PATCH_NOTES, pn)
                            this.messageHelper.replyToInteraction(
                                rawInteraction,
                                `Patch notes sendt til ${MentionUtils.mentionChannel(MentionUtils.CHANNEL_IDs.BOT_UTVIKLING)} og ${MentionUtils.mentionChannel(
                                    MentionUtils.CHANNEL_IDs.PATCH_NOTES
                                )}`,
                                { ephemeral: true }
                            )
                        },
                    },
                ],
            },
        }
    }
}
