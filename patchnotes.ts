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

    public static readonly currentVersion = '34.0.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## HP CCG – stor revamp',
                ' * Hele Harry Potter-settet er rebalansert fra bunnen av, med flere helt nye mekanikker.',
                ' * Samlingene er nullstilt: alle HP-kort er fjernet, så decka med HP-kort må bygges opp på nytt.',
                ' * Alle starter friskt med **300 shards**. Har du spilt CCG før, har du fått **2x Bertie Bott\'s** tilbake i inventaret.',
                ' * De neste **7 dagene** får alle **+50 shards hver dag** – logg innom og samle!',
                '',
                '## Nye nøkkelord',
                ' * **Shield** – en pool som tar imot skade over flere runder, helt til den er brukt opp.',
                ' * **Armor** – reduserer hvert innkommende angrep, men kun denne runden.',
                ' * **Pierce** – skade som går rett gjennom både shield og armor (f.eks. Filch).',
                ' * **Foresight** – en effekt som trigger når kortet trekkes (f.eks. Cedric: de neste 4 kortene du trekker koster permanent 1 mindre).',
                ' * **Auror** – spilte motstanderen en Death Eater denne runden, blir det kortet permanent 1 dyrere for dem.',
                '',
                '## Annet',
                ' * Magiske skapninger (Aragog, Basilisk, Fawkes, Buckbeak, Werewolf) kan ikke lenger trekkes fra pakker – de må tilkalles av Hagrid.',
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
