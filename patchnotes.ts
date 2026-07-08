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

    public static readonly currentVersion = '34.3.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## Kortendringer (HP CCG)',
                ' * **Skjold** – stacker nå til ett felles lager i stedet for separate, uavhengige skjold. Vises nå som :shield: + totalt antall.',
                ' * **Remus Lupin & Nymphadora Tonks** – summoner ikke lenger hverandre til hånden. Legger i stedet den andre øverst i bunken.',
                ' * **Draco Malfoy** – bounty-effekten fungerer nå som Dark Mark sin: **Bounty 3: Death Eater** (egen neste Death Eater gjør bonus-skade), i stedet for den gamle debuff-varianten på motstanderen.',
                ' * **Prank: Sorting Jinx** (Fred & George) – sorteringsretningen avhenger nå av kasterens energi: over 4 energi sorterer motstanderens bunke med dyreste kort først, ellers billigste først.',
                '',
                '## Belønninger',
                ' * **More or Less**, **Wordle** og **Mastermind** – dagens vinnere får nå også shards (henholdsvis 5/5/10), i tillegg til chips.',
                '',
                '## Bot',
                ' * Fikset en feil der kort man eide fra før en sjeldenhetsendring (f.eks. Hermione Epic → Legendary) kunne vises som duplikater i deck-editoren.',
                ' * Fikset en feil der belønninger fra eksterne aktiviteter (f.eks. Lykkehjulet) kunne ta opptil 30 minutter før de dukket opp i boten.',
                ' * Hvis du er heldig kan du nå få shards fra lykkehjulet',
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
