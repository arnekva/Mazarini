import { CacheType, ChatInputCommandInteraction, Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MentionUtils } from './utils/mentionUtils'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '9.12.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* /snakk kan nå brukes for å få botten til å si noe i voice channel` +
        `\n* Bursdag er nå en slashcommand` +
        `\n* Countdown er nå en slashcommand` +
        `\n* Gamble er nå en slashcommand` +
        `\n* Roll er nå en slashcommand` +
        `\n* Electricity er nå en slashcommand` +
        `\n* Botstats er nå en slashcommand` +
        `\n* *!mz jærsk* er fjernet` +
        `\n* Electricity skal nå gi litt bedre oversikt over game state og hvem som må drikke (og hvor mye de må drikke)` +
        `\n* Du kan nå motta en chips-reward for bug reports til ${MentionUtils.mentionChannel(MessageUtils.CHANNEL_IDs.BOT_UTVIKLING)}` +
        `\n* Fikset en feil som gjorde at /helg kunne føre til at en at interaction kunne bli forsøkt besvart to ganger` +
        `\n* Lagt til en fallback hvis en interaksjon er opprettet, men kodestøtten ikke er pushet live enda`

    static getCurrentPatchNotes() {
        return PatchNotes.header + '\n' + PatchNotes.currentPatchNotes
    }

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }
    public getAllCommands(): ICommandElement[] {
        return [
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
        return [
            {
                commandName: 'patchnotes',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getCurrentPatchNotes())
                },
                category: 'annet',
            },
        ]
    }
}
