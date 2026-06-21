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

    public static readonly currentVersion = '32.8.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## Bugfix',
                ' * /rocket: Stats ble ikke lagret hvis ein av modusane (t.d. Tournament) mangla data frå tracker.gg. No fell det tilbake til siste kjente verdi og viser *(outdated)* i embeden.',
                '',
                '## Ytelsesforbedringer',
                ' * Brukare vert no bufra i minnet i 30 minutt. Dette gjer at knappeinteraksjonar og kommandoar som hentar same brukar fleire gongar er mykje raskare.',
                ' * Knapp- og kommandooppslag brukar no eit Map i staden for lineært søk – O(1) i staden for O(n).',
                ' * Pickpocket, vipps og frame-job hentar no begge brukarane parallelt i staden for sekvensielt.',
                ' * Wordle-oppdateringar vert no utført parallelt for alle brukarar.',
                '',
                '## Tekniske forbetringar',
                ' * Tøm brukarcache er lagt til under Scripts i botinnstillinger – nyttig om ein brukar er endra manuelt i Firebase.',
                ' * Firebase-skriv ventar no korrekt på svar frå databasen i heile kjeda.',
                ' * Boten bundlar no all kode til éi fil ved oppstart (esbuild). Dette reduserer talet på fillesingar frå SD-kortet og gjer oppstart raskare.',
                ' * Kommandoar vert no initialiserte etter at boten har logga inn på Discord i staden for før. Viss du brukar ein kommando i det korte vindauget medan boten startar opp, får du ein melding om at kommandoane ikkje er klare enno.',
                ' * Fleire stader som tidlegare svelgde feil vil no logge dei.',
                ' * Fleire småfiks og opprydding i gammal kode.',
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
