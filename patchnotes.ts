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

    public static readonly currentVersion = '34.2.1'

    static getCurrentPatchNotes() {
        const container = new SimpleContainer()

        const text1 = new TextDisplayBuilder().setContent([`# Patch notes for versjon ${this.currentVersion}`].join('\n'))

        container.addComponent(text1, 'header')

        const text = new TextDisplayBuilder().setContent(
            [
                '## Balanse (HP CCG)',
                ' * **Harry Potter** – hastighet 90 → 72. Selvskade økt til 4 HP.',
                ' * **Snape** – hastighet 65 → 95. Skjold redusert til 2, Rustning økt til 4.',
                ' * **Hermione** – nøyaktighet → 100.',
                ' * **Ron** – nøyaktighet 90 → 100.',
                ' * **Ginny** – helbred 2 → 4.',
                ' * **Buckbeak** – nødhelbred 1 → 3.',
                ' * **Dobby** – restitusjonsvarighet 3 → 2 runder.',
                ' * **Myrtle** – blødningsvarighet 3 → 4 runder.',
                ' * **Umbridge** – nøyaktighet 90 → 100.',
                ' * **Tonks** – hastighet 5 → 100. Redesignet: helbreder 3 HP og kaller inn Lupin.',
                ' * **Lupin** – kaller nå også inn Tonks når han spilles.',
                ' * **Kingsley Shacklebolt** – hastighet 62 → 89. Helbred 2 → 3. Nøyaktighet → 100.',
                ' * **Luna Lovegood** – kostnad 3 → 1. Hastighet → 75. Nøyaktighet → 100. Redesignet: gjør 2 skade + 50 % sjanse for å helbrede 2.',
                ' * **Barty Crouch Jr.** – blødningsvarighet 2 → 3 runder.',
                ' * **Fleur Delacour** – redesignet: 50 % sjanse for å helbrede 4, 50 % sjanse for å gjøre 3 skade.',
                ' * **Draco Malfoy** – fullstendig redesign. Kostnad 3. Gjør 1 skade, kaller inn en Dødseter, legger Dusør 4 på motstanderen, og kaster alle Gryffindor-kort fra motstanderens hånd.',
                ' * **Lucius Malfoy** – betingelsestrigger 25 % → 50 %.',
                ' * **Hagrid** – innkallingsverdi 2 → 3. Kortbeskrivelsen avslører ikke lenger kostnad på innkalt kort.',
                ' * **Sirius Black** – fullstendig redesign. Kostnad 1, hastighet 68. Gjør skade lik posisjonen kortet løses i – 1. kort gjør 1 skade, siste gjør opptil 4.',
                ' * **Viktor Krum** – hastighet 75 → 40. Snitch-fangstsjanse 10 % → 5 %.',
                ' * **Polyjuice-drikk** – kostnad 1 → 0.',
                ' * **Den gyldne snapen** – kostnad 10 → 12. Hastighet 80 → 70.',
                ' * **Bertie Botts bønner** – kostnad 2 → 1.',
                ' * **Minerva McGonagall** – Reflect varer nå kun inneværende runde (ned fra 2).',
                ' * **Fred Weasley** – helbreder 3. Bonus når spilt med George: +1 energi og utløser en prank.',
                ' * **George Weasley** – gjør 3 skade. Bonus når spilt med Fred: +1 energi.',
                '',
                '## Prank-revisjon',
                "Prank-poolen er fullstendig redesignet med 12 unike pranks basert på Weasleys' Wizard Wheezes-produkter:",
                ' * **Dungbomb** – gjør 3 skade på motstanderen.',
                ' * **Decoy Detonator** – gir deg Skjold 2.',
                ' * **Wildfire Whiz-bang** – gjør 3 skade på motstanderen og 3 på deg selv.',
                ' * **Ton-Tongue Toffee** – bytter energi med motstanderen.',
                ' * **Peruvian Darkness Powder** – motstanderens hånd vises som blank i 1 runde.',
                ' * **Hiccough Sweets** – randomiserer kortkostnader for begge spillere i 3 runder.',
                ' * **Fainting Fancy** – utjevner begge spilleres HP til gjennomsnittet.',
                ' * **Fever Fudge** – randomiserer nøyaktighet for begge spillere i 2 runder.',
                ' * **Sorting Jinx** – sorterer motstanderens kortstokk alfabetisk.',
                ' * **Confundus Candy** – motstanderens håndknapper stokkes og merkes "Kort" i 1 runde.',
                ' * **Malfunction** – gjør 7 skade på deg selv.',
                ' * **Rubber Duck** – fyller motstanderens hånd med gummikanaer.',
                '',
                '## Feilrettinger',
                ' * Rettet en feil der spillere med gyldige Wild-dekk feilaktig ble avvist i PvP.',
                ' * Rettet Minervas Reflect som feilaktig reflekterte alle effekter i stedet for kun fiendtlige.',
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
