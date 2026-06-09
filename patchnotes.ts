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

    public static readonly currentVersion = '32.6.0'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## CCG – Kortendringer',
                '* **Myrtle**: 4 -> 3 turns',
                '* **Lockhart**: 0 -> 1 cost. 80 -> 100 accuracy',
                '* **Seamus**: 3 -> 2 self damage',
                '* **Hagrid**: tilleggseffekt: summon random magical creature',
                '* **Luna**: 1 -> 0 cost',
                '* **Buckbeak**: 2 -> 1 cost',
                '* **Molly**: 2 -> 1 cost. 2 -> 3 damage',
                '* **Ron**: 2 -> 1 cost. Tilleggseffekt: bleed self 3 turns',
                '* **Mad-Eye**: 3 -> 2 cost',
                '* **Voldemort**: 3 -> 4 damage',
                '* **Snape**:',
                '  * 3 -> 2 heal',
                '  * 3 -> 2 damage',
                '  * Tilleggseffekt: Brew a random potion',
                '* **Slughorn**: Nytt design',
                '  * Steal 1 energy',
                '  * Brew a random potion',
                '* **Remus**: Nytt design',
                '  * 70 speed',
                '  * Shield 2 this turn',
                '  * 50% chance to transform into werewolf',
                '## Nye kort',
                '* **Werewolf**:',
                '  * Cost 2',
                '  * Deal 4 damage',
                '  * Kan ikke lootes - kan kun fås via summon eller Lupin transformation',
                '* **Felix Felicus**:',
                '  * Cannot Miss for 3 turns',
                '  * Cost 0',
                '  * Kan ikke lootes - kan kun fås via Snape eller Slughorn',
                '* **Amortentia**:',
                '  * Cost 1',
                '  * Neutralize an incoming attack',
                '  * Kan ikke lootes - kan kun fås via summon eller Lupin transformation',
                '* **Draught of Living Death**:',
                '  * Cost 2',
                '  * Make target sleep for 1 turn',
                '  * Kan ikke lootes - kan kun fås via summon eller Lupin transformation',
                '## Nye effekter',
                '* **Sleep**:',
                '  * Når du sover kan du hverken spille eller discarde kort.',
                '  * Men du får dobbel energy-recovery',
                '* **Cannot Miss**:',
                '  * Kortene dine får 100% accuracy',
                '  * Immun mot elusive',
                '## Bugfix',
                '* Fikset sånn at kort som ikke skal kunne lootes, faktisk ikke dukker opp i packs',
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
