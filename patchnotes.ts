import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '19.0.0'
    public static readonly currentPatchNotes =
        `## I år kan du bygge opp julestemningen med nyvinningen \`/julekalender\`! :santa:` +
        `\n* Start dagen med en tilfeldig bonus som kan komme godt med utover dagen` +
        `\n* Ikke stress om du går glipp av en gave en dag, akkurat som med en fysisk julekalender kan du alltids hente deg inn igjen!` +
        `\n    * Du åpner uansett bare én gave om gangen, og Høie henter alltid frem den tidligste gaven du har tilgjengelig` +
        `\n* Enkelte gaver er bonuser du beholder frem til du har brukt dem, mens andre varer bare frem til neste morgen` +
        `\n    * Det er lurt å åpne gaven tidlig, slik at du får brukt de kortvarige bonusene` +
        `\n  * Det står spesifisert i gaven om den bare gjelder ut dagen` +
        `\n* Alle får en tilfeldig generert kalender, så du får ikke nødvendigvis spoilet gaven din dersom noen andre åpner sin før deg` +
        `\n* Så gøy som det hadde vært med 24 helt unike gaver, så er ikke det det enkleste - så forvent en del dupliserte gaver` +
        `\n\n**Annet misc**` +
        `\n* Nå printes den faktiske hasjen du vinner, heller enn et mattestykke` +
        `\n* Høie vil nå garantert svare med tid til høytid/fridag dersom man skriver det nøyaktige triggerordet (f.eks 'jul'), men vil bare ha en 10% sannynlighet for å svare med tid dersom det bare inneholder triggerordet (f.eks 'skjule')` +
        `\n* Skjult utvikling er omsider faktisk skjult - og slettede meldinger herfra vil ikke logges`


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
