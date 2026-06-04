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

    public static readonly currentVersion = '32.3.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '# CCG',
                '## Generelt',
                '* "Full" modus er omdøpt til **Wild**',
                '* Wild gir nå full belønning – samme som Standard',
                '* Wild Lett er nå betraktelig enklere',
                '* Fikset kortbakgrunn for HP serien',
                '',
                '## Nye bot-decks (Standard)',
                '* Vanskelig: To nye decks – **Dødsetere** og **Gryffindor**',
                '',
                '## Kortbalansering – HP',
                '* Arthur: accuracy 95% → 100%',
                '* Basilisk: accuracy 90% → 95%',
                '* Bellatrix: cost 2 → 1',
                '* Buckbeak: Heal Boost 1 → 2 turns',
                '* Dark Mark: cost 2 → 1, +2 energy immediate → over 2 turns',
                '* Draco: accuracy 80% → 85%',
                '* Fawkes: accuracy 90% → 100%',
                '* Fleur: accuracy 75% → 85%',
                '* Gyllen Snik: ny effekt – gir +2 energy ved bruk',
                '* Hagrid: cost 2 → 1',
                '* Harry Potter: cost 3 → 2, damage 3 → 4',
                '* Hermione: Heal 3 → 4',
                '* Kreacher: accuracy 100% → 90%',
                '* Gal-Øye Moody: cost 2 → 3, 1 → 2 turns',
                '* Molly: utløses nå av alle Dødsetere (ikke bare Bellatrix)',
                '* Neville: motstander energy chance 25% → 50%, accuracy 85% → 90%',
                '* Nymfadora Tonks: speed 100 → 5',
                '* Ron: +2 energy over 3 → 2 turns',
                '* Slughorn: accuracy 75% → 95%',
                '* Snape: Heal 5 → 3, fjerner +1 energy, ny effekt – deal 3 damage til motstander',
                '* Umbridge: Armor 1 → 2 turns',
                '* Fred & George: cost 2 → 1, gir flat 2 energy. Spilt sammen: **Utløser et tilfeldig prank!**',
                '',
                '## Pranks (Fred & George)',
                '* Dungbomb – 2 damage til motstander',
                '* Decoy Detonator – reduser neste innkommende angrep med 1',
                '* Wildfire Whiz-bang – 2 damage til begge spillere',
                '* Ton-Tongue Toffee – +2 energy over 2 turns',
                '',
                '## Kortbalansering – Mazarini',
                '* ShrekStare: Slow 1 → 2 turns',
                '* Geggi Excited: speed 60 → 84',
                '* kms2: damage 2 → 3',
                '* kys: speed 49 → 40',
                '* Høie: speed 65 → 85',
                '* Eivindpride: chance 15% → 18%',
                '* Arnenymous: accuracy 90% → 100%, cost reduction 1 → 2, 5 → 2 turns',
                '* PointerBrothers1: 3 → 2 turns',
                '* Sniff: viser motstanderens hånd i 3 turns (tidligere engangsbruk)',
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
