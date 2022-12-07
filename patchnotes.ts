import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './general/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '10.7.0'
    public static readonly nextVersion = 'Backlog'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion
    private static readonly headerNextRelease = 'Saker i ' + PatchNotes.nextVersion

    public static readonly currentPatchNotes: string =
        `\n* /vinmonopolet skal nå varsle om endrede åpningstider for hele måneden.` +
        `\n* Høie varsler til ${MentionUtils.mentionChannel(
            MentionUtils.CHANNEL_IDs.VINMONOPOLET
        )} på mandager når det finnes endrede åpningstider i nåværende måned eller uke` +
        `\n* Hvis botten ikke klarer å svare på en interaksjon og sender en normal melding skal du nå tagges i den meldingen` +
        `\n* Botten vil ikke lenger logge hele stacktracen på feilmeldinger som gjelder Unknown Interaction` +
        `\n* Det blir nå forsøkt logget hvem som timet out en bruker og grunnen som ble gitt`

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
    public getAllCommands(): ICommandElement[] {
        return []
    }
    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'patchnotes',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getCurrentPatchNotes())
                },
                category: 'annet',
            },
            {
                commandName: 'backlog',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getNextReleasePatchNotes())
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING, pn)
                    this.messageHelper.replyToInteraction(
                        rawInteraction,
                        `Patch notes sendt til ${MentionUtils.mentionChannel(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING)}`,
                        true
                    )
                },
                category: 'annet',
            },
        ]
    }
}
