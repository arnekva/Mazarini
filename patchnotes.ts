import { Client, Message } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ICommandElement, IInteractionElement } from './General/commands'
import { MessageHelper } from './helpers/messageHelper'
import { MessageUtils } from './utils/messageUtils'
export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '9.8.0'

    private static readonly header = 'Patch notes for versjon ' + PatchNotes.currentVersion

    public static readonly currentPatchNotes: string =
        `\n* /aktivitet vil nå foretrekke andre aktiviteter foran Spotify selv om Spotify legger seg øverst. Hvis ingen andre er tilgjengelig bruker Spotify, men er mye mindre detaljrik enn /spotify` +
        `\n* Setvalue er nå slash command (/set)` +
        `\n* Vipps er nå en slash command` +
        `\n* Wallet er nå en slash command` +
        `\n* /set kan nå sette verdier inne i objekter. Eksempel for daily streak som er representert som *dailyClaimStreak:{streak: 1, wasAddedToday: true}* i databasen: /set dailyClaimStreak @Eivind 0 streak. Det siste argumentet (her streak) er optional, og legges kun til i slike tilfeller` +
        `\n* Fikset whitespace på /kort trekk` +
        `\n* Krig gjorde en chips-check på alle som reagerte på en krig, selvom den var rettet mot en spesifikk person` +
        `\n* Flere oppdateringer på database-typen som fjerner flere typer som debt, loanCounter, shopItems og flere` +
        `\n* Fikset en feil som gjorde at en bruker ikke kunne claime daily reward hvis en verdi i databasen ble satt til undefined` +
        `\n* De gamle tekstkommandoene *add*, *remove*, *navn*, *vær*, *kort*, *br*, *weekly*, *playlist* og *musikk* og flere er nå fjernet, og vil gi feilmelding i stedet for deprecated melding`

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
                description: 'Vis patch notes for ' + PatchNotes.currentVersion,
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    const pn = PatchNotes.getCurrentPatchNotes()
                    this.messageHelper.sendMessage(rawMessage.channelId, pn)
                },
                category: 'annet',
            },
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
        return []
    }
}
