import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '6.7.1'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* Ny gamblingkommando - !mz krig alle. Gå til krig mot alle som reagerer med tommel opp innen 60 sekund. Én person tar hele potten` +
        `\n* Du kan nå også starte en krig mot hvem som helst - '!Mz krig 100' vil starte en krig for 100 chips med førstemann som reagerer med tommel opp` +
        `\n* Superadmins får nå en rolle i stedet for å ha bruker-ID hardkodet inn` +
        `\n* Weekly og BR defaulter nå til 'me' hvis du ikke sender med parametere` +
        `\n* Du får nå en forklaring på hvorfor bot status ikke kan settes til streaming hvis du mangler en url som parameter 1` +
        `\n* Fikset en bug som førte til en infinite loop med logging til #action_log` +
        `\n* Senket utbetalingen for spins under 10 minutt`

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
                description: 'Vis nyligste patch notes',
                command: (rawMessage: Message, messageContent: string) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(rawMessage.channelId, pn)
                },
                category: 'annet',
            },
            {
                commandName: 'publishnotes',
                description: 'Vis nyligste patch notes',
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
}
