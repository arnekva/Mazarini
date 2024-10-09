import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '18.1.0'
    public static readonly currentPatchNotes = `\n## Da kan vi omsider også lansere \`/loot trade\`!`
                                             + `\nEtterhvert som du sitter på masse duplikater av loot, vil du kanskje bytte inn disse for en sjanse på noe nytt?`
                                             + `\n### /loot trade in`
                                             + `\n* Bytt inn 3 gjenstander for en tilfeldig gjenstand av samme sjeldenhetsgrad`
                                             + `\n### /loot trade up`
                                             + `\n* Bytt inn 5 gjenstander for en tilfeldig gjenstand av neste sjeldenhetsgrad`
                                             + `\n### Hvordan funker det?`
                                             + `\n* Gjenstandene som byttes inn må være fra samme serie og rarity. Du kan f.eks **ikke** bytte inn 2 common + 1 rare. Autocomplete-en hjelper deg med å holde styr på dette`
                                             + `\n* Søk blant- og velg fra forslagene som dukker opp. Det funker ikke å sende inn manuelt innfylt data. Du kan søke på:`
                                             + `\n  * Serie`
                                             + `\n      * Etterhvert som det kommer flere serier kan du filtrere på disse`
                                             + `\n  * Rarity`
                                             + `\n      * F.eks "common" vil vise kun common gjenstander`
                                             + `\n  * Navn`
                                             + `\n      * Navnet på gjenstanden`
                                             + `\n  * Farge`
                                             + `\n      * "None" vil vise kun gjenstander uten farge, "Gold" vil vise kun gold gjenstander`
                                             + `\n* Etter at du har valgt item1, vil resten av feltene være filtrert til å kun vise deg gjenstander du fortsatt har fra samme serie og rarity`
                                             + `\n* Når du sender inn dataene vil Høie svare med en embed hvor du kan bekrefte eller kansellere traden`
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
