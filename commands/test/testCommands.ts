// import {
//     ActionRowBuilder,
//     ButtonBuilder,
//     ButtonInteraction,
//     ButtonStyle,
//     CacheType,
//     ChatInputCommandInteraction,
//     EmbedBuilder,
//     Message,
//     ModalSubmitInteraction,
//     StringSelectMenuInteraction,
// } from 'discord.js'
// import { AbstractCommands } from '../../Abstracts/AbstractCommand'
// import { MazariniClient } from '../../client/MazariniClient'
// import { ItemRarity, IUserCollectable } from '../../interfaces/database/databaseInterface'
// import { IInteractionElement } from '../../interfaces/interactionInterface'
// import { LootboxCommands } from '../store/lootboxCommands'

// const defaultButtonRow = new ActionRowBuilder<ButtonBuilder>()
// defaultButtonRow.addComponents(
//     new ButtonBuilder({
//         custom_id: `TEST_BUTTON_1`,
//         style: ButtonStyle.Primary,
//         label: `Test`,
//         disabled: false,
//         type: 2,
//     })
// )
// const fetch = require('node-fetch')
// // var fs = require('fs')
// // NB: IKKE PUSH ENDRINGER I DENNE KLASSEN MED MINDRE DET ER GENERISKE HJELPEMETODER

// // Skall-klasse for testing av alt mulig random shit.
// // Fungerer også som en template for andre klasser

// export class TestCommands extends AbstractCommands {
//     private embedMessage: Message
//     private buttonsMessage: Message
//     private embed: EmbedBuilder
//     private currentButtons: ActionRowBuilder<ButtonBuilder>
//     private lootCmmds: LootboxCommands
//     // private gsh: GameStateHandler<LudoPlayer>

//     constructor(client: MazariniClient) {
//         super(client)
//         this.embedMessage = undefined
//         this.buttonsMessage = undefined
//         this.embed = undefined
//         this.currentButtons = defaultButtonRow
//         this.lootCmmds = new LootboxCommands(client)
//         // this.gsh = new GameStateHandler<LudoPlayer>()
//     }

//     mockData: IUserCollectable[] = [
//         { name: 'arne', series: 'mazarini', rarity: ItemRarity.Rare, inventory: { none: 1, silver: 1, gold: 1, diamond: 1 } },
//         { name: 'arne_satisfied', series: 'mazarini', rarity: ItemRarity.Common, inventory: { none: 1, silver: 0, gold: 1, diamond: 0 } },
//         { name: 'shrekstare', series: 'mazarini', rarity: ItemRarity.Epic, inventory: { none: 1, silver: 1, gold: 0, diamond: 0 } },
//         { name: 'polse', series: 'mazarini', rarity: ItemRarity.Legendary, inventory: { none: 1, silver: 1, gold: 1, diamond: 0 } },
//     ]

//     testCollectable: IUserCollectable = {
//         name: 'crycatthumbsup',
//         series: 'mazarini',
//         rarity: ItemRarity.Common,
//         inventory: { none: 0, silver: 0, gold: 1, diamond: 0 },
//     }

//     private async test(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
//         // const user = await this.client.database.getUser(interaction.user.id)
//         // user.collectables = user.collectables.filter(x => x.series === 'mazarini')
//         // this.client.database.updateUser(user)

//         // const defer = true
//         // if (defer) interaction.deferReply()
//         // const imgGenHelper = new ImageGenerationHelper(this.client)
//         // const revealGif = await imgGenHelper.generateRevealGifForCollectable(this.testCollectable)
//         // const file = new AttachmentBuilder(revealGif, {name: 'collectable.gif'})
//         // // const inventory = await imgGenHelper.generateImageForCollectables(this.mockData)
//         // // const file = new AttachmentBuilder(inventory, {name: 'inventory.png'})
//         // this.messageHelper.replyToInteraction(interaction, '', {hasBeenDefered: defer}, undefined, [file])
//         const currentVersion = '18.0.0'
//         const currentPatchNotes =
//             `\n# Mazarinibot v18.0 er endelig her!` +
//             `\n\nDa er tiden omsider inne for å avsløre hva denne mystiske nedtellingen som har etterlatt samtlige Mazarini-brukere i en ` +
//             `\n  * Frame-forsøk har en 1/10 sjanse for å lykkes` +
//             `\n* Pickpocket sannsynlighet har blitt endret og tilsvarer nå andelen av offeret sine chips man prøver å stjele` +
//             `\n  * Stjele 100 av 1000 chips har 90% successrate` +
//             `\n  * Stjele 50 000 av 100 000 har 50% successrate`
//         const header = 'Patch notes for versjon ' + currentVersion
//         const notes1 =
//             '🎉 Patch Notes - Versjon 18.0.0 🎉' +
//             '\n# 🎁 Lansering av Lootboxer! 🎁' +
//             '\nEtter en spennende uke med en mystisk nedtelling og litt for mange uheldige hint, er vi glade for å endelig introdusere vår helt nye Lootbox-funksjon! Nå kan du oppleve spenningen av å åpne kister og samle unike samleobjekter. Les videre for å finne ut hva som er nytt!' +
//             '\n## 🔑 Nytt innhold: Lootboxer!' +
//             '\n* **Kjøp og Åpne**: Dere kan nå kjøpe Lootboxer med chips dere har tjent i serveren. Åpning av en Lootbox gir en spennende mulighet for å motta sjeldne samleobjekter!' +
//             '\n* **Samleobjekter**: Hver Lootbox har en sjanse for å inneholde en sjelden gjenstand som er svært ettertraktet. Hold øynene åpne for de ekstraordinære belønningene!' +
//             '\n  * Gjenstander tilhører én av fire sjeldenhetsgrader:' +
//             '\n      * Common' +
//             '\n    * Rare' +
//             '\n    * Epic' +
//             '\n    * Legendary' +
//             '\n  * I tillegg har hver gjenstand en sjanse for å være farget i en av fargene:' +
//             '\n      * :white_circle: Silver ' +
//             '\n    * :yellow_circle: Gold ' +
//             '\n    * :large_blue_diamond: Diamond ' +
//             '\n## 💡 Hvordan funker det?' +
//             '\n1. **Kjøp en Lootbox**: Bruk kommandoen `/loot box` for å kjøpe en Lootbox. Du kan velge mellom følgende:' +
//             '\n  - **Basic Lootbox**' +
//             '\n      - Dette er standard-boksen som har basis-sannsynlighet for både sjeldenhet og farge. Den har størst sannsynlighet for å gi deg et mindre sjeldent samleobjekt, men lukker ikke døren for de mer sjeldne' +
//             '\n      - Pris: 5000 chips' +
//             '\n  - **Premium Lootbox**' +
//             '\n      - Denne boksen øker sannsynligheten for både sjeldnere samleobjekter og for at disse kommer i en farget utgave' +
//             '\n      - Pris: 20000 chips' +
//             '\n  - **Elite Lootbox**' +
//             '\n      - Det koster å være storkar! Denne boksen gir deg garantert en Rare gjenstand eller sjeldnere, og har stor sannsynlighet for å kaste på en farge i tillegg' +
//             '\n      - Pris: 50000 chips'
//         //neste melding

//         const notes2 =
//             '\n2. **Åpne Lootboxen**: Når du kjøper en lootbox, vil Høie ta en tur bak på lageret og stelle i stand en verdig avsløring av din nye gjenstand. Vær tålmodig - det er verdt ventingen!' +
//             '\n3. **Samle og vis frem**: Vis frem dine samleobjekter ved å bruke kommandoen `/loot inventory` og bli en legende på serveren!' +
//             '\n## 💡 Tips og Tricks:' +
//             '\nJo mer du spiller og engasjerer deg med serveren, desto flere chips tjener du til å kjøpe Lootboxer!' +
//             '\nVed spesielle tilfeller er det mulig å få seg en lootbox som reward!' +
//             '\n## 🚀 Fremtidige oppdateringer' +
//             '\nVi jobber med å introdusere et trade-system som vil la deg veksle inn uønskede gjenstander (duplikater kanskje?) for en sjanse for å få noe bedre. Det vil også komme flere Lootbox-temaer etterhvert, så hold øynene åpne for kommende oppdateringer!' +
//             '\n### :pencil: Annet nytt' +
//             '\n* /daily har fått seg en renovering' +
//             '\n  * Prestige-systemet pensjoneres og erstattes av standardiserte daglige belønninger:' +
//             '\n      * Dag 1: 1000 chips' +
//             '\n    * Dag 2: 1500 chips' +
//             '\n    * Dag 3: 2000 chips' +
//             '\n    * Dag 4: 2500 chips + en basic lootbox' +
//             '\n    * Dag 5: 3000 chips' +
//             '\n    * Dag 6: 3500 chips' +
//             '\n    * Dag 7: 4000 chips + en premium lootbox' +
//             '\n  * `/daily freeze` fjernes' +
//             '\n  * Det sendes ikke lenger en knapp for å claime daily hver dag - nå må man huske det selv igjen'
//         //neste mld

//         const notes3 =
//             '\n* :game_die: Deathroll :game_die:' +
//             '\n  * For at disse lootboxene skal ha noe verdi har vi valgt å kjøle ned økonomien litt slik at det skal litt mer til for å sitte på 1m chips' +
//             '\n      * Enkelte innskudd i hasjen er redusert' +
//             '\n  * Shuffle er nå knyttet til diceTarget og vil kun shuffle de siste x antall sifrene i hasjen tilsvarende antall sifre i diceTarget' +
//             '\n      * 12345 (1 - 54321) => de siste 5 sifrene i hasjen shuffles' +
//             '\n    * 1234 (1 - 4321) => de siste 4 sifrene i hasjen shuffles' +
//             '\n    * 123 (1 - 3021) => de siste 4 sifrene i hasjen shuffles' +
//             '\n  * Hyppigere utbetaling av hasj' +
//             '\n      * Det vil nå daglig genereres 3 skjulte tall mellom 70 og 200 som også vil trigge utbetaling av hasjen i tillegg til den faste 69' +
//             '\n* Pickpocket :money_with_wings:' +
//             '\n  * Vi går tilbake til den gamle måten å beregne sannsynligheten, og justerer den litt ned' +
//             '\n* Fikset en feil som gjorde at prod-botten lakk meldinger fra hemmelig dev-server ( <:hhhhheeehhhhhh:1255794610433953793> )'

//         // this.messageHelper.sendMessage(interaction.channelId, { text: notes1 })
//         // this.messageHelper.sendMessage(interaction.channelId, { text: notes2 })
//         // this.messageHelper.sendMessage(interaction.channelId, { text: notes3 })
//     }

//     private async testSelectMenu(selectMenu: StringSelectMenuInteraction<CacheType>) {
//         const value = selectMenu.values[0]
//         // Kode
//         selectMenu.deferUpdate()
//     }

//     private async testButton(interaction: ButtonInteraction<CacheType>) {
//         // Kodedsddsad
//         interaction.deferUpdate()
//     }

//     private async testModalSubmit(interaction: ModalSubmitInteraction<CacheType>) {
//         const value = interaction.fields.getTextInputValue('someCustomFieldId')
//         // Kode
//         interaction.deferUpdate()
//     }

//     //Redigerer eksisterende embed hvis det er en knapp interaction, sender ny embed hvis ikke
//     private async replyToInteraction(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
//         if (interaction.isButton()) {
//             this.embedMessage.edit({ embeds: [this.embed] })
//             interaction.deferUpdate()
//         } else {
//             this.messageHelper.replyToInteraction(interaction, 'Test')
//             this.embedMessage = await this.messageHelper.sendMessage(interaction?.channelId, { embed: this.embed })
//             this.buttonsMessage = await this.messageHelper.sendMessage(interaction?.channelId, { components: [this.currentButtons] })
//         }
//     }

//     //Flytt embed ned til bunnen
//     private async resendMessages(interaction: ButtonInteraction<CacheType>) {
//         this.deleteMessages()
//         this.embedMessage = await this.messageHelper.sendMessage(interaction?.channelId, { embed: this.embed })
//         this.buttonsMessage = await this.messageHelper.sendMessage(interaction?.channelId, { components: [this.currentButtons] })
//     }

//     //Slett meldingene
//     private deleteMessages() {
//         this.embedMessage.delete()
//         this.buttonsMessage.delete()
//         this.embedMessage = undefined
//         this.buttonsMessage = undefined
//     }

//     private testSwitch(interaction: ChatInputCommandInteraction<CacheType>) {
//         const action = interaction.options.getSubcommand()
//         if (action) {
//             switch (action.toLowerCase()) {
//                 case '-1-': {
//                     this.test(interaction)
//                     break
//                 }
//                 case '-2-': {
//                     this.test(interaction)
//                     break
//                 }
//                 case '-3-': {
//                     this.test(interaction)
//                     break
//                 }
//                 case '-4-': {
//                     this.test(interaction)
//                     break
//                 }
//                 default: {
//                     this.messageHelper.replyToInteraction(interaction, 'Default test sub-command')
//                 }
//             }
//         } else {
//             this.messageHelper.replyToInteraction(interaction, 'Ingen test sub-command angitt')
//         }
//     }

//     getAllInteractions(): IInteractionElement {
//         return {
//             commands: {
//                 interactionCommands: [
//                     {
//                         commandName: 'test',
//                         command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
//                             this.testSwitch(rawInteraction)
//                         },
//                     },
//                 ],
//                 buttonInteractionComands: [
//                     {
//                         commandName: 'TEST_BUTTON_1',
//                         command: (rawInteraction: ButtonInteraction<CacheType>) => {
//                             this.testButton(rawInteraction)
//                         },
//                     },
//                 ],
//                 modalInteractionCommands: [
//                     {
//                         commandName: 'TEST_MODAL_1',
//                         command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
//                             this.testModalSubmit(rawInteraction)
//                         },
//                     },
//                 ],
//                 selectMenuInteractionCommands: [
//                     {
//                         commandName: 'TEST_SELECT_MENU_1',
//                         command: (rawInteraction: StringSelectMenuInteraction<CacheType>) => {
//                             this.testSelectMenu(rawInteraction)
//                         },
//                     },
//                 ],
//             },
//         }
//     }
// }
