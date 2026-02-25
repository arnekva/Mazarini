import { GameValues } from '../../general/values'
import { TextUtils } from '../../utils/textUtils'

const gameplay = [
    '## 🧩 Gameplay',
    'Lær hvordan en CCG-kamp fungerer fra start til slutt.',
    'Denne seksjonen forklarer spillmoduser, runder, kortresolusjon, effekter og vinnerbetingelser.',
].join('\n')

const cards = ['## 🃏 Kort', 'Kort er kjernen i spillet.', 'Her kan du lære hvordan du leser kort, forstår statistikken deres og hvordan de balanseres.'].join(
    '\n'
)

const decks = [
    '## 🧰 Decks',
    'Decket ditt definerer strategien din.',
    'Denne seksjonen dekker deck-regler, deck-bygging og hvordan du administrerer deckene dine.',
].join('\n')

const progression = [
    '## 🎁 Progresjon',
    'Ved å spille kamper tjener du belønninger og nye kort.',
    'Denne seksjonen forklarer hvordan kortanskaffelse, belønninger og økonomien fungerer.',
].join('\n')

const stats = [
    '## 📊 Statistikk',
    'Følg med på prestasjonen din og utforsk spillets data.',
    'Denne seksjonen dekker spillerstatistikk, kortstatistikk og langsiktig progresjon.',
].join('\n')

const game_modes = [
    '## 🎮 Spillmoduser',
    '**CCG** er et **1v1 konkurransebasert kortspill**.',
    '',
    'Tilgjengelige moduser:',
    '### **PvP** (/ccg play player)',
    '  • Spill mot en annen spiller',
    '  • Spillere spiller med skjulte hender',
    '  • Du kan spille om chips (valgfritt)',
    '### **PvE** (/ccg play bot)',
    '  • Du kan spille mot Høie i **practice mode** gratis',
    '  • eller',
    `  • Du kan betale en inngangsbillett på ${GameValues.ccg.rewards.entryFee / 1000}K for å spille om **shards**`,
    `    (les mer under "Progression > Rewards")`,
    '  • Høie har 3 vanskelighetsgrader (lett, medium, vanskelig) som påvirker:',
    '    • Bot-Høies deck',
    '    • Starttilstanden til spilleren',
    '    • Belønninger',
    '',
    'Alle moduser følger de samme grunnleggende reglene og kortmekanikkene.',
].join('\n')

const rounds = [
    '## 🔄 Runder',
    'Hvert spill spilles over en serie med **runder**.',
    '',
    'I hver runde:',
    '• Begge spillere får **Energy**',
    '• Begge spillere velger opptil 2 kort fra hånden sin – eller ingen hvis du vil spare energi',
    '• Kortene låses inn og avsløres samtidig',
    '',
    'Rundene gjentas til en spiller når **0 HP**.',
].join('\n')

const card_resolution = [
    '## ⚡ Kortavvikling',
    'Etter at begge spillere har sendt inn kortene sine, blir alle kort resolvert automatisk.',
    '',
    'Rekkefølge for resolusjon:',
    '• Kort resolvers etter **Speed** (høyest først)',
    '• Kort med lik Speed resolver i tilfeldig rekkefølge',
    '• Hvert kort ruller sin **Accuracy**',
    '',
    'Hvis et kort bommer, har effekten ingen virkning.',
].join('\n')

const statuses_and_effects = [
    '## 🧪 Statuser og effekter',
    'Alle kort oppgir i beskrivelsesfeltet hva de gjør.',
    'Et kort kan ha flere effekter, som trigges i den rekkefølgen de er listet på kortet.',
    '',
    'Noen kort har spesielle effekter som «få ekstra energi» eller «reduser kostnaden på kort».',
    'Disse effektene varer gjennom hele spillet, med mindre annet er spesifisert.',
    '',
    'Hvis et kort **APPLIES** noe, legger det til en **status condition** på den målrettede spilleren.',
    'Status Conditions:',
    '• **Chokester** – Alle kortene dine har 50 % accuracy',
    '• **Slow** – Speed på alle kortene dine halveres',
    '• **Bleed** – Du tar bleed-skade mellom rundene',
    '• **Retarded** – 33% sannsynlighet for at target på kort-effektene dine flippes',
    '• **Mygling** – Du healer på slutten av runden, men får ikke default energy-en mellom runder',
    '• **Reflect** – Du reflecter all aktiv damage dealt',
    '',
    'Status conditions kan fjernes av enkelte kort',
].join('\n')

const winning_and_losing = [
    '## 🏁 Vinne og Tape',
    'Målet med spillet er enkelt:',
    '',
    '• Reduser motstanderen din til **0 HP**',
    '• Overlev lenger enn motstanderen din',
    '',
    'Det vil alltid være en vinner og en taper – aldri uavgjort.',
].join('\n')

const card_anatomy = [
    '## 🃏 Kortstruktur',
    'Hvert kort inneholder følgende elementer:',
    '',
    '• **Navn & bilde** – Kortets identitet',
    '• **Cost** – Energy som kreves for å spille kortet',
    '• **Speed** – Når det resolver – høyere speed resolver raskere',
    '• **Accuracy** – Sjanse for å lykkes',
    '• **Effektbeskrivelse** – Hva kortet gjør',
    '',
    'Å forstå disse er nøkkelen til å vinne.',
].join('\n')

const balancing = [
    '## ⚖️ Balansering',
    'Ingen kort er ment å være perfekte alene.',
    'Alle kort kan bli balansert når som helst.',
    'Dette kan føre til buffs/debuffs av speed, accuracy og power.',
    '',
    'Kort balanseres rundt:',
    '• Risiko vs belønning',
    '• Prediksjon og tankespill',
    '• Energieffektivitet',
    '',
    'Sterke effekter kommer ofte med lavere accuracy eller høyere kostnad.',
].join('\n')

const cardTypeLimits = () => {
    const cardTypeTexts = new Array<string>()
    for (const type of GameValues.ccg.deck.validationTypes) {
        cardTypeTexts.push(`  • *${TextUtils.capitalizeFirstLetter(type)}*: **${GameValues.ccg.deck.typeCaps[type]}** kort`)
    }
    return cardTypeTexts
}

const deck_rules = [
    '## 📦 Deck Regler',
    'Hver spiller kan bygge **egendefinerte decks**. Hvis du ikke har et aktivt deck, brukes et standard-deck.',
    '',
    '### Følgende regler gjelder nå:',
    `• Størrelse: **${GameValues.ccg.deck.size}** kort`,
    '',
    `• Rarity-limits`,
    `  • *Common*: Ingen limit`,
    `  • *Rare*: **${GameValues.ccg.deck.rarityCaps.rare}** kort`,
    `  • *Epic*: **${GameValues.ccg.deck.rarityCaps.epic}** kort`,
    `  • *Legendary*: **${GameValues.ccg.deck.rarityCaps.legendary}** kort`,
    '',
    `• Type-limits`,
    ...cardTypeLimits(),
    '',
    'Ulovlige decks kan ikke brukes i spill.',
].join('\n')

const deck_builder = [
    '## 🛠️ Deck Bygger',
    'Deck builder lar deg administrere kortene dine.',
    '',
    'Du kan:',
    '• Legge til eller fjerne kort',
    '• Lage flere decks',
    '• Sette et **aktivt deck**',
    '',
    'Det aktive decket ditt låses når et spill starter.',
].join('\n')

const card_trading = [
    '## :recycle: Trade in',
    'Du kan trade inn kort du ikke trenger/ønsker for å få litt ekstra shards.',
    '',
    'Du får følgende shard-verdi for de forskjellige kortene:',
    `• Common: ${GameValues.ccg.trade.values.common}`,
    `• Rare: ${GameValues.ccg.trade.values.rare}`,
    `• Epic: ${GameValues.ccg.trade.values.epic}`,
    `• Legendary: ${GameValues.ccg.trade.values.legendary}`,
].join('\n')

const commands = [
    '## ⌨️ Deck kommandoer',
    'Du har flere muligheter for å administrere deckene dine.',
    '',
    'Nyttige kommandoer:',
    '• `/deck new` – Opprett et nytt deck',
    '• `/deck edit` – Rediger et eksisterende deck',
    '• `/deck rename` – Gi nytt navn til et eksisterende deck',
    '• `/deck copy` – Lag en kopi av et eksisterende deck',
    '• `/deck set` – Velg hvilket deck som er aktivt',
    '• `/deck delete` – Slett et av deckene dine',
    '• `/deck trade` – Trade in kort for shards',
].join('\n')

const card_acquisition = [
    '## 🎁 Kortanskaffelse',
    'Kort tjenes gjennom **å spille CCG**, ikke ved å grinde chips.',
    '',
    'Måter å få kort på:',
    '• Kjøp en "/loot pack" med **shards**',
    '  • Velg mellom 3 forskjellige kort',
    '• Spesielle event-belønninger direkte fra spill',
    '',
    'Det finnes ikke noe pay-to-win-system.',
].join('\n')

const rewards = [
    '## 🏆 Belønninger',
    '### PvP',
    '• Når du spiller mot en annen spiller, kan du enten spille for moro – eller satse chips',
    '• Vinneren tar alt',
    '',
    '### VS Høie',
    '• Å spille mot Høie i **practice mode** gir ingen belønning',
    '• Å spille mot Høie i **reward mode**:',
    `  • Du må betale en inngangsbillett på ${GameValues.ccg.rewards.entryFee / 1000}K for å spille om belønninger`,
    `  • Du kan fritt velge vanskelighetsgrad`,
    `  • Belønninger:`,
    `    • Tap: **${GameValues.ccg.rewards.loss} shards**`,
    `    • Seier (easy): **${GameValues.ccg.rewards.win} shards**`,
    `    • Seier (medium): **${GameValues.ccg.rewards.win * GameValues.ccg.rewards.difficultyMultiplier.medium} shards**`,
    `    • Seier (hard): **${GameValues.ccg.rewards.win * GameValues.ccg.rewards.difficultyMultiplier.hard} shards**`,
    `    • Dagens første game i reward mode gir også en bonus på: **${GameValues.ccg.rewards.dailyBonus} shards**`,
    '',
    'Seire mot høyere vanskelighetsgrader gir større belønninger, men øker risikoen for kun å få tapsbelønning.',
].join('\n')

const economy = [
    '## 💰 Økonomi',
    'CCG bruker en **kontrollert økonomi** for å unngå inflasjon.',
    '',
    'Viktige regler:',
    `• Det finnes et ukentlig belønningstak på ${GameValues.ccg.rewards.weeklyLimit}`,
    '• Ingen uendelig grinding',
    '• Adskilt fra chip-baserte spill',
    '',
    'Dette holder spillet rettferdig på lang sikt.',
].join('\n')

const seasons = [
    '## 🗓️ Sesonger',
    'Spillet kan være delt inn i **sesonger**.',
    '',
    'Sesonger kan inkludere:',
    '• Nullstilling av statistikk',
    '• Regelendringer',
    '• Nye kortsett',
    '',
    'Samlingen din blir aldri slettet.',
].join('\n')

const player_stats = [
    '## 📈 Spillerstatistikk',
    'Prestasjonen din spores over tid.',
    '',
    'For hver spiller (og bot-vanskelighetsgrad) du spiller mot, spores følgende statistikk:',
    '• Antall spill',
    '• Seire',
    '• Tap',
    '• Kortbruk',
    '• Påført skade',
    '• Mottatt skade',
    '• Tellere for hver status condition',
    '• Treff med kort',
    '• Bom med kort',
    '• Totale chips vunnet/tapt',
    '',
    'Statistikk er for moro og balanseanalyse.',
].join('\n')

export namespace HelperText {
    export const Gameplay = gameplay
    export const Kort = cards
    export const Decks = decks
    export const Progresjon = progression
    export const Stats = stats
    export const Spillmoduser = game_modes
    export const Runder = rounds
    export const Kortavvikling = card_resolution
    export const Statuser_og_effekter = statuses_and_effects
    export const Vinne_og_tape = winning_and_losing
    export const Kortstruktur = card_anatomy
    export const Balansering = balancing
    export const Trading = card_trading
    export const Deck_regler = deck_rules
    export const Deck_bygger = deck_builder
    export const Kommandoer = commands
    export const Kortanskaffelse = card_acquisition
    export const Belønninger = rewards
    export const Økonomi = economy
    export const Sesonger = seasons
    export const Spillerstatistikk = player_stats
}

// ENGLISH TEXTS:

// const gameplay = [
//     '## 🧩 Gameplay',
//     'Learn how a CCG match works from start to finish.',
//     'This section explains game modes, rounds, card resolution, effects, and win conditions.',
// ].join('\n')

// const cards = [
//     '## 🃏 Cards',
//     'Cards are the core of the game.',
//     'Here you can learn how to read cards, understand their stats, and how they are balanced.',
// ].join('\n')

// const decks = ['## 🧰 Decks', 'Your deck defines your strategy.', 'This section covers deck rules, deck building, and how to manage your decks.'].join('\n')

// const progression = [
//     '## 🎁 Progression',
//     'Playing games earns you rewards and new cards.',
//     'This section explains how card acquisition, rewards, and the economy work.',
// ].join('\n')

// const stats = [
//     '## 📊 Stats',
//     'Track your performance and explore the game’s data.',
//     'This section covers player stats, card stats, and long-term progression.',
// ].join('\n')

// const game_modes = [
//     '## 🎮 Game Modes',
//     '**CCG** is a **1v1 competitive card game**.',
//     '',
//     'Available modes:',
//     '### **PvP** (/ccg play player)',
//     '  • Play against another player',
//     '  • Players play with hidden (ephemeral) hands',
//     '  • You can play for chips (optional)',
//     '### **PvE** (/ccg play bot)',
//     '  • You can play against Høie in **practice mode** for free',
//     '  • or',
//     `  • You can pay an entry fee of ${GameValues.ccg.rewards.entryFee / 1000}K in order to play for **shards**`,
//     `    (read more under "Progression > Rewards")`,
//     '  • Høie has 3 difficulties (easy, medium, hard) which impact:',
//     '    • Bot Høie’s deck',
//     '    • Initial player state',
//     '    • Rewards',
//     '',
//     'All modes follow the same core rules and card mechanics.',
// ].join('\n')

// const rounds = [
//     '## 🔄 Rounds',
//     'Each game is played over a series of **rounds**.',
//     '',
//     'In every round:',
//     '• Both players gain **Energy**',
//     '• Both players select up to 2 cards from their hand - or none if you want to conserve energy',
//     '• Cards are locked in and revealed simultaneously',
//     '',
//     'Rounds repeat until a player reaches **0 HP**.',
// ].join('\n')

// const card_resolution = [
//     '## ⚡ Card Resolution',
//     'After both players submit their cards, all cards are resolved automatically.',
//     '',
//     'Resolution order:',
//     '• Cards resolve by **Speed** (highest first)',
//     '• Equal Speed cards resolve in a randomized order',
//     '• Each card rolls its **Accuracy**',
//     '',
//     'If a card misses, its effect does nothing.',
// ].join('\n')

// const statuses_and_effects = [
//     '## 🧪 Statuses & Effects',
//     'All cards state in their description field what they do.',
//     'A card can have multiple effects, which are triggered in the order in which they are listed on the card',
//     '',
//     'Some cards have special effects such as "gain extra energy" or "decrease cost of cards".',
//     'These effects last for the entirety of the game unless otherwise specified.',
//     '',
//     'If a card **APPLIES** something, it adds a **status condition** to the targeted player.',
//     'Status Conditions:',
//     '• **Chokester** – All your cards have an accuracy of 50%',
//     '• **Slow** – The speed of all you cards are cut in half',
//     '• **Bleed** – You take bleed damage between rounds',
//     '• **Retarded** – The target of all your cards’ effects are randomized',
//     '',
//     'Status conditions are removable by certain cards',
// ].join('\n')

// const winning_and_losing = [
//     '## 🏁 Winning & Losing',
//     'The goal of the game is simple:',
//     '',
//     '• Reduce your opponent to **0 HP**',
//     '• Survive longer than your opponent',
//     '',
//     'There will always be a winner and a loser - never a tie.',
// ].join('\n')

// const card_anatomy = [
//     '## 🃏 Card Anatomy',
//     'Every card contains the following elements:',
//     '',
//     '• **Name & Image** – The card’s identity',
//     '• **Cost** – Energy required to play',
//     '• **Speed** – When it resolves - higher speed resolves faster',
//     '• **Accuracy** – Chance to succeed',
//     '• **Effect description** – What the card does',
//     '',
//     'Understanding these is key to winning.',
// ].join('\n')

// const balancing = [
//     '## ⚖️ Balancing Philosophy',
//     'No card is meant to be perfect on its own.',
//     'All cards are prone to balancing at any point.',
//     'This can result in buffs/debuffs of speed, accuracy and power.',
//     '',
//     'Cards are balanced around:',
//     '• Risk vs reward',
//     '• Prediction and mind games',
//     '• Energy efficiency',
//     '',
//     'Strong effects often come with lower accuracy or higher cost.',
// ].join('\n')

// const deck_rules = [
//     '## 📦 Deck Rules',
//     'Each player can build **custom decks**. If you don’t have an active deck - a default deck will be used.',
//     '',
//     'General rules:',
//     '• Decks have a fixed size',
//     '• Duplicate limits may apply',
//     '• Only owned cards can be used',
//     '',
//     'Illegal decks cannot be used in games.',
// ].join('\n')

// const deck_builder = [
//     '## 🛠️ Deck Builder',
//     'The deck builder lets you manage your cards.',
//     '',
//     'You can:',
//     '• Add or remove cards',
//     '• Create multiple decks',
//     '• Set an **active deck**',
//     '',
//     'Your active deck is locked when a game starts.',
// ].join('\n')

// const commands = [
//     '## ⌨️ Deck commands',
//     'You have a number of possibilities for administering your decks.',
//     '',
//     'Useful commands:',
//     '• `/deck new` – Create a new deck',
//     '• `/deck edit` – Edit an existing deck',
//     '• `/deck rename` – Rename an existing deck',
//     '• `/deck copy` – Make a copy of an existing deck',
//     '• `/deck set` – Set which of your decks is active',
//     '• `/deck delete` – Delete one of your decks',
// ].join('\n')

// const card_acquisition = [
//     '## 🎁 Card Acquisition',
//     'Cards are earned through **playing CCG**, not grinding chips.',
//     '',
//     'Ways to get cards:',
//     '• Buy a "/loot pack" using **shards**',
//     '  • Choose between 3 different cards',
//     '• Special event rewards directly from play',
//     '',
//     'There is no pay-to-win system.',
// ].join('\n')

// const rewards = [
//     //TODO
//     '## 🏆 Rewards',
//     '### PvP',
//     '• When playing against another player, you can either play for fun - or you can wager chips',
//     '• Winner takes all',
//     '',
//     '### VS Høie',
//     '• Playing against Høie in **practice mode** gives no reward',
//     '• Playing against Høie in **reward mode**:',
//     `  • You have to pay an entry fee of ${GameValues.ccg.rewards.entryFee / 1000}K in order to play for rewards`,
//     `  • You can freely choose difficulty`,
//     `  • Rewards:`,
//     `    • Loss: **${GameValues.ccg.rewards.loss} shards**`,
//     `    • Win (easy): **${GameValues.ccg.rewards.win} shards**`,
//     `    • Win (medium): **${GameValues.ccg.rewards.win * GameValues.ccg.rewards.difficultyMultiplier.medium} shards**`,
//     `    • Win (hard): **${GameValues.ccg.rewards.win * GameValues.ccg.rewards.difficultyMultiplier.hard} shards**`,
//     '',
//     'Wins against tougher difficulties grant more rewards, but increase the risk of only getting a loss reward.',
// ].join('\n')

// const economy = [
//     '## 💰 Economy',
//     'CCG uses a **controlled economy** to avoid inflation.',
//     '',
//     'Important rules:',
//     `• There is a weekly reward cap of ${GameValues.ccg.rewards.weeklyLimit}`,
//     '• No infinite grinding',
//     '• Separate from chip-based games',
//     '',
//     'This keeps the game fair long-term.',
// ].join('\n')

// const seasons = [
//     '## 🗓️ Seasons',
//     'The game may be split into **seasons**.',
//     '',
//     'Seasons can include:',
//     '• Stat resets',
//     '• Rule changes',
//     '• New card sets',
//     '',
//     'Your collection is never wiped.',
// ].join('\n')

// const player_stats = [
//     '## 📈 Player Stats',
//     'Your performance is tracked over time.',
//     '',
//     'For every player (and bot difficulty) you play against, the following stats are tracked:',
//     '• Games played',
//     '• Wins',
//     '• Losses',
//     '• Card usage',
//     '• Damage dealt',
//     '• Damage received',
//     '• Counters for each status condition',
//     '• Card hits',
//     '• Card misses',
//     '• Total chips won/lost',
//     '',
//     'Stats are for fun and balance analysis.',
// ].join('\n')
