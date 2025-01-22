import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly currentVersion = '20.0.0'
    public static readonly currentPatchNotes = `## Introduserer 'More or Less'!`
                                             + `\nDere har etterlyst flere selstendige måter å opptjene chips, så da svares det med et individuelt spill`
                                             + `\n### Generelt om spillet`
                                             + `\n * Kommando: \`/moreorless spill\``
                                             + `\n * Spillet går enkelt og greit ut på å gjette riktig på en rekke "mer" :arrow_up: eller "mindre" :arrow_down: spørsmål`
                                             + `\n * Spillet foregår i en ephemeral embed (kun du kan se ditt eget spill) slik at andre ikke skal dra nytte av dine svar`
                                             + `\n * Spillet oppdateres med en ny kategori hver morgen som en del av daily jobs`
                                             + `\n * Du kan sjekke hvordan andre har gjort det i dagens kategori med kommandoen \`/moreorless resultater\``
                                             + `\n * Det er ingen grense for hvor mange forsøk du har hver dag`
                                             + `\n * Kategorier, spørsmål og svar hentes fra et API som ikke styres av Bot Høies utviklingsteam`
                                             + `\n   * Skrive- eller formuleringsfeil kan dermed **ikke anses som chokes** :exclamation:`
                                             + `\n   * Eventuelt utdaterte svar vil være sjelden, men uunngåelige`
                                             + `\n### Konkurranse-aspektet`
                                             + `\n * Du tjener 500 chips for hvert riktige svar du klarer på rad`
                                             + `\n   * Klarte du 5 riktige på rad ved første forsøk, og forbedrer deg til 7 riktige ved neste forsøk, vil du få differansen premiert (i dette tilfellet ytterligere 1000 chips)`
                                             + `\n * I tillegg til dette er det en daglig felles konkurranse! :trophy:`
                                             + `\n   * Den som har det beste **første** forsøket, vil bli premiert med en *basic loot chest* når spillet oppdateres med ny kategori`
                                             + `\n       * Dette er for at det ikke bare er den som har best tid som skal kunne vinne`
                                             + `\n   * Dersom 2 eller flere står likt, vil ditt beste forsøk være avgjørende i en tiebreak`
                                             + `\n   * Om det fortsatt skulle stå likt etter dette vil det ikke deles ut noen dagspremie`
                                             + `\n\nLykke til!`


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
