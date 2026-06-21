import { TextDisplayBuilder } from 'discord.js'
import { AbstractCommands } from './Abstracts/AbstractCommand'
import { ChatInteraction } from './Abstracts/MazariniInteraction'
import { SimpleContainer } from './Abstracts/SimpleContainer'
import { database, environment } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { DatabaseHelper } from './helpers/databaseHelper'
import { MessageHelper } from './helpers/messageHelper'
import { IInteractionElement } from './interfaces/interactionInterface'
import { ChannelIds } from './utils/mentionUtils'

export class PatchNotes extends AbstractCommands {
    public static readonly trelloBoardUrl = `https://trello.com/b/g4KkZwaX/bot-h%C3%B8ie`

    constructor(client: MazariniClient) {
        super(client)
    }

    public static readonly currentVersion = '33.0.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## Bugfix',
                ' * /rocket: Stats ble ikke lagret hvis én av modusene (f.eks. Tournament) manglet data fra tracker.gg. Faller nå tilbake til siste kjente verdi og viser *(outdated)* i embeden.',
                '',
                '## Ytelsesforbedringer',
                ' * Brukere caches nå i minnet i 30 minutter. Dette gjør at interactions og kommandoer som henter samme bruker flere ganger er mye raskere.',
                ' * Knapp- og kommandooppslag bruker nå et Map i stedet for lineært søk – O(1) i stedet for O(n).',
                ' * Pickpocket, vipps og frame-job henter nå begge brukerne parallelt i stedet for sekvensielt.',
                ' * Wordle-oppdateringer utføres nå parallelt for alle brukere.',
                '',
                '## Tekniske forbedringer',
                ' * Tøm brukercache er lagt til under Scripts i botinnstillinger – må gjøres om en bruker er endres manuelt i Firebase.',
                ' * Firebase-writes venter nå korrekt på svar fra databasen i hele kjeden.',
                ' * Boten bundler nå all kode til én fil ved oppstart (esbuild). Dette reduserer antall fillesinger fra SD-kortet og gjør oppstart raskere.',
                ' * Kommandoer initialiseres nå etter at boten har logget inn på Discord i stedet for før. Hvis du bruker en kommando i det korte vinduet mens boten starter opp, får du en melding om at kommandoene ikke er klare ennå.',
                ' * Flere steder som tidligere svelget feil vil nå logge dem.',
                ' * Flere småfikser og opprydding i gammel kode.',
            ].join('\n')
        )
        container.addSeparator()
        container.addComponent(text, 'currentPatchNotes')

        return container
    }
    static getNextReleasePatchNotes() {
        return 'Backlog:\n' + PatchNotes.trelloBoardUrl
    }

    static async compareAndSendPatchNotes(msgHelper: MessageHelper, dbHelper: DatabaseHelper) {
        const prev = await dbHelper.getBotData('version')
        if (prev && prev != PatchNotes.currentVersion && environment === 'prod') {
            PatchNotes.publishPatchNotes(msgHelper)
        }
        if (environment === database) {
            dbHelper.setBotData('version', PatchNotes.currentVersion)
        }
    }

    static publishPatchNotes(msgHelper: MessageHelper) {
        const patchNotes = PatchNotes.getCurrentPatchNotes()
        msgHelper.sendMessage(ChannelIds.BOT_UTVIKLING, { components: [patchNotes.container] }, { isComponentOnly: true })
        msgHelper.sendMessage(ChannelIds.PATCH_NOTES, { components: [patchNotes.container] }, { isComponentOnly: true })
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'patchnotes',
                        command: (rawInteraction: ChatInteraction) => {
                            this.messageHelper.replyToInteraction(rawInteraction, '', {}, [PatchNotes.getCurrentPatchNotes().container])
                        },
                    },
                    {
                        commandName: 'backlog',
                        command: (rawInteraction: ChatInteraction) => {
                            this.messageHelper.replyToInteraction(rawInteraction, PatchNotes.getNextReleasePatchNotes())
                        },
                    },
                ],
            },
        }
    }
}
