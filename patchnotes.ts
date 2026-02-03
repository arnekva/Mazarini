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

    public static readonly currentVersion = '30.0.1'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '### CCG',
                '* Lagt til muligheten for å reward-e loot packs',
                '* Knappene for å spille/discarde kort er nå deaktivert i 3 sek for å unngå mis-click',
                '',
                '### Nerfs introdusert i patch 30.0.0',
                '* Ternong',
                '  * Fjernet muligheten for å få lootbox i stedet for innskudd',
                '  * Halve opprinnelige hasjen legges tilbake ved blackjacktap: deaktivert',
                '  * Ingen gratis dpn',
                '  * Unspecial numbers multiplier: -9 > -1',
                '  * Fjerner 2024 fra unspecial numbers',
                '  * Special numbers multiplier: 3 > 1',
                '  * Dicetarget multiplier: 5 > 3',
                '  * 9/11 sannsynlighet: 99% > 25%',
                '  * Fjerner potskip penalty',
                '* MoL',
                '  * Rette svar 1-50: 200 chips',
                '  * Rette svar 51+: 50 chips',
                '  * Premie for fullført MoL: lootbox > 2500 chips',
                '  * Premie for beste forsøk: chest > 2500 chips',
                '* Daily',
                '  * Alle dager gir nå 1000 * streak',
                '  * Fjernet chest reward på dag 7',
                '* Dond',
                '  * Effect-odds sannsynlighet: 40% > 10%',
                '* Wordle',
                '  * Premiepott: 5000 > 10000',
                '  * Maks per pers: 2500',
                '* Mastermind',
                '  * 10000 > 2500',
                '* Misc',
                '  * 1337 i mld-id: 10000 > 1000',
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
