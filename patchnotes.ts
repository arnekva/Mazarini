import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { IInteractionElement } from './general/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '11.2.0'
    public static readonly nextVersion = 'Backlog'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    private static readonly headerNextRelease = 'Saker i ' + PatchNotes.nextVersion

    public static readonly currentPatchNotes: string =
        `\n* Du kan nå sette klokkeslett for feriestart når du registrerer /ferie. Gamle ferieperioder defaulter til midnatt` +
        `\n* Du kan nå sette locale på /wiki-søkene dine (norsk eller engelsk). Defaulter til norsk` +
        `\n* Meldinger som blir slettet i ${MentionUtils.mentionChannel(MentionUtils.CHANNEL_IDs.LOKAL_BOT_SPAM)} skal ikke lenger bli logget` +
        `\n* Det tas nå bedre regne for helligdager når det regnes tid til helg, samt at helligdager midt i uken nå blir med i meldingen`

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

    getAllInteractions(): IInteractionElement[] {
        return [
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
                    this.messageHelper.replyToInteraction(
                        rawInteraction,
                        `Patch notes sendt til ${MentionUtils.mentionChannel(MentionUtils.CHANNEL_IDs.BOT_UTVIKLING)}`,
                        true
                    )
                },
            },
        ]
    }
}
