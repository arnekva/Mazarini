// Basic strategy for this table's rules: the move that loses the least (wins the most) in the long run for every hand against every
// dealer up-card, and a Norwegian explanation of why.
//
// Source: Wizard of Odds (Michael Shackleford), Blackjack Basic Strategy calculator -
// https://wizardofodds.com/games/blackjack/strategy/calculator/ - set to this table's rules: 1 deck, dealer stands on soft 17,
// double after split allowed, no surrender, no peek (European / no hole card). The dealer odds quoted in the explanations are from
// the same site's "Dealer Odds in Blackjack under European Rules", 1 deck, dealer stands on soft 17 -
// https://wizardofodds.com/games/blackjack/dealer-odds-blackjack-european-rules/
//
// The chart is total-dependent basic strategy - it doesn't look at which cards have already been dealt this round.
// If the table's rules change (decks, soft 17, peek, double rules) the chart below has to be redone from the calculator.

export const STRATEGY_SOURCES = [
  {
    label: "Wizard of Odds: Blackjack Basic Strategy-kalkulator",
    detail: "1 kortstokk, dealer står på myk 17, double etter split, ingen surrender, ingen peek",
    url: "https://wizardofodds.com/games/blackjack/strategy/calculator/",
  },
  {
    label: "Wizard of Odds: Dealer Odds in Blackjack under European Rules",
    detail: "1 kortstokk, dealer står på myk 17 - sannsynligheten for at dealeren buster eller har blackjack",
    url: "https://wizardofodds.com/games/blackjack/dealer-odds-blackjack-european-rules/",
  },
]

type Cell = "H" | "S" | "P" | "Dh" | "Ds"
export type Move = "hit" | "stand" | "double" | "split"

interface CardLike {
  rank: string
}

// Columns: dealer up-card 2, 3, 4, 5, 6, 7, 8, 9, 10, A.
const row = (cells: string): Cell[] => cells.split(" ") as Cell[]

const HARD: Record<number, Cell[]> = {
  8: row("H H H Dh Dh H H H H H"),
  9: row("Dh Dh Dh Dh Dh H H H H H"),
  10: row("Dh Dh Dh Dh Dh Dh Dh Dh H H"),
  11: row("Dh Dh Dh Dh Dh Dh Dh Dh H H"),
  12: row("H H S S S H H H H H"),
  13: row("S S S S S H H H H H"),
  14: row("S S S S S H H H H H"),
  15: row("S S S S S H H H H H"),
  16: row("S S S S S H H H H H"),
}

const SOFT: Record<number, Cell[]> = {
  13: row("H H Dh Dh Dh H H H H H"),
  14: row("H H Dh Dh Dh H H H H H"),
  15: row("H H Dh Dh Dh H H H H H"),
  16: row("H H Dh Dh Dh H H H H H"),
  17: row("Dh Dh Dh Dh Dh H H H H H"),
  18: row("S Ds Ds Ds Ds S S H H S"),
  19: row("S S S S Ds S S S S S"),
}

/** Keyed by the pair's card value (10 for any two 10-value cards, 11 for aces). */
const PAIRS: Record<number, Cell[]> = {
  2: row("P P P P P P H H H H"),
  3: row("P P P P P P P H H H"),
  4: row("H H P P P H H H H H"),
  5: row("Dh Dh Dh Dh Dh Dh Dh Dh H H"),
  6: row("P P P P P P H H H H"),
  7: row("P P P P P P P H S H"),
  8: row("P P P P P P P P H H"),
  9: row("P P P P P S P P S S"),
  10: row("S S S S S S S S S S"),
  11: row("P P P P P P P P P H"),
}

/** Per dealer up-card (same column order): how often the dealer ends up bust, and how often holds blackjack. 1 deck, S17, no peek. */
const DEALER_BUST = [35.3, 37.6, 40.3, 42.9, 42.1, 26.0, 23.9, 23.3, 21.4, 11.7]
const DEALER_BLACKJACK: Record<number, number> = { 8: 7.8, 9: 31.4 }

const cardValue = (rank: string) => (rank === "A" ? 11 : ["J", "Q", "K"].includes(rank) ? 10 : Number(rank))
/** Column index for a dealer up-card: 2..10 -> 0..8, ace -> 9. */
const column = (up: CardLike) => (up.rank === "A" ? 9 : cardValue(up.rank) - 2)
const dealerName = (up: CardLike) => (up.rank === "A" ? "ess" : ["J", "Q", "K"].includes(up.rank) ? `${up.rank} (10)` : up.rank)
const pct = (n: number) => `${n.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %`

function totals(cards: CardLike[]) {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += cardValue(c.rank)
    if (c.rank === "A") aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}

/** Chance that one more card busts a hard total (each rank 1/13, 10-value cards 4/13 - an even deck, close enough for the explanation). */
function bustChance(hardTotal: number): number {
  let busting = 0
  for (let v = 1; v <= 10; v++) if (hardTotal + v > 21) busting += v === 10 ? 4 : 1
  return (busting / 13) * 100
}

export interface StrategyAdvice {
  move: Move
  /** One line, e.g. "Hard 16 mot 10". */
  situation: string
  /** A short reason for under the move. */
  summary: string
  /** The in-depth explanation, one paragraph per entry. */
  details: string[]
}

export interface AdviceInput {
  cards: CardLike[]
  dealerUp: CardLike
  canDouble: boolean
  canSplit: boolean
}

/** The recommended move for a hand, or null when there's nothing to decide (21 already, or bust). */
export function recommendMove({ cards, dealerUp, canDouble, canSplit }: AdviceInput): StrategyAdvice | null {
  const { total, soft } = totals(cards)
  if (total >= 21 || cards.length < 2) return null

  const col = column(dealerUp)
  const up = dealerName(dealerUp)
  const bust = DEALER_BUST[col]
  const dealerBj = DEALER_BLACKJACK[col]
  const weakDealer = col <= 4
  const dealerLine = `Dealeren viser ${up} og må trekke til minst 17 - med dette kortet ender dealeren bust i ${pct(bust)} av rundene${
    dealerBj ? `, og har blackjack i ${pct(dealerBj)}` : ""
  }.`

  // ---------- pairs ----------
  const isPair = cards.length === 2 && cards[0].rank === cards[1].rank
  if (isPair) {
    const pv = cardValue(cards[0].rank)
    const cell = PAIRS[pv][col]
    const pairName = cards[0].rank === "A" ? "to ess" : `${cards[0].rank}+${cards[1].rank}`
    if (cell === "P" && canSplit) return splitAdvice(pv, pairName, up, col, dealerLine)
    if (cell === "P") {
      // Can't afford the split - play it as the total it is.
    } else if (cell === "H" || cell === "S") {
      return pairNoSplitAdvice(pv, pairName, cell, total, soft, up, col, dealerLine, dealerBj)
    }
    // "Dh" on 5+5 (a hard 10) falls through to the hard totals below.
  }

  // ---------- soft totals ----------
  if (soft) {
    const cell = SOFT[Math.max(13, total)]?.[col] ?? "S"
    return softAdvice(cell, total, up, col, dealerLine, canDouble)
  }

  // ---------- hard totals ----------
  const cell = total <= 7 ? "H" : total >= 17 ? "S" : HARD[total][col]
  return hardAdvice(cell, total, up, dealerLine, bust, weakDealer, canDouble)
}

function resolveDouble(cell: Cell, canDouble: boolean): Move {
  if (cell === "Dh") return canDouble ? "double" : "hit"
  if (cell === "Ds") return canDouble ? "double" : "stand"
  return cell === "H" ? "hit" : cell === "S" ? "stand" : "split"
}

const noDoubleNote = "Dobling hadde vært enda bedre her, men det går bare på de to første kortene og når du har råd til én innsats til."

function hardAdvice(cell: Cell, total: number, up: string, dealerLine: string, bust: number, weakDealer: boolean, canDouble: boolean): StrategyAdvice {
  const move = resolveDouble(cell, canDouble)
  const situation = `Hard ${total} mot ${up}`
  const myBust = bustChance(total)

  if (move === "double") {
    return {
      move,
      situation,
      summary: `Sterk start mot et ${weakDealer ? "svakt" : "middels"} dealerkort - doble innsatsen.`,
      details: [
        total >= 9
          ? `Med ${total} kan du ikke buste av ett kort, og et 10-verdikort (10, J, Q, K - 4 av 13 kort) gir deg ${total + 10}. Mange andre kort gir også en hånd som slår det dealeren pleier å ende på.`
          : `Med 8 kan du ikke buste av ett kort, og dealeren er på sitt aller svakeste.`,
        dealerLine,
        `Når du i snitt vinner oftere enn dealeren i en situasjon, lønner det seg å ha mer penger på bordet - selv om du bare får ett kort til. Det er hele poenget med å doble.`,
      ],
    }
  }

  if (move === "stand") {
    if (total >= 17) {
      return {
        move,
        situation,
        summary: `Du buster på ${pct(myBust)} av kortene - stå.`,
        details: [
          `Med hard ${total} får du bust på ${pct(myBust)} av kortene hvis du trekker. Det lille du kan vinne på å komme nærmere 21 er langt mindre enn det du taper på alle bustene.`,
          dealerLine,
          `Stå alltid på hard 17 eller mer.`,
        ],
      }
    }
    return {
      move,
      situation,
      summary: `Dealeren er svak - la dealeren ta sjansen på å buste.`,
      details: [
        `Med hard ${total} buster du på ${pct(myBust)} av kortene hvis du trekker.`,
        dealerLine,
        `Mot et svakt dealerkort (2-6) er det dealeren som er i fare: dealeren må fortsette å trekke til 17, og buster ofte. Står du, vinner du hver gang dealeren buster - uten å ta noen risiko selv. Trekker du, risikerer du å buste først, og da taper du uansett hva dealeren får.`,
        ...(cell === "Ds" ? [noDoubleNote] : []),
      ],
    }
  }

  // hit
  if (total <= 11) {
    return {
      move,
      situation,
      summary: `Du kan ikke buste med ${total} - trekk.`,
      details: [
        `Med ${total} kan intet enkelt kort få deg over 21, så å trekke er gratis.`,
        dealerLine,
        ...(cell === "Dh" ? [noDoubleNote] : [`${total} er for lavt til å vinne alene, så du trenger flere kort.`]),
      ],
    }
  }
  return {
    move,
    situation,
    summary: weakDealer ? `12 mot ${up} er for svakt til å stå på - trekk.` : `Dealeren viser et sterkt kort - trekk, selv om du kan buste.`,
    details: [
      `Med hard ${total} buster du på ${pct(myBust)} av kortene hvis du trekker.`,
      dealerLine,
      weakDealer
        ? `Med 12 buster du bare på 10-verdikort. Dealeren er heller ikke svak nok med ${up} til at det lønner seg å vente: et nytt kort forbedrer hånden din oftere enn det ødelegger den.`
        : `Står du på ${total}, vinner du bare når dealeren buster (${pct(bust)}) - alt annet ender på 17 eller mer og slår deg. Å trekke gir en ekte sjanse til å nå 17-21, og det taper mindre i det lange løp selv om du noen ganger buster.`,
    ],
  }
}

function softAdvice(cell: Cell, total: number, up: string, col: number, dealerLine: string, canDouble: boolean): StrategyAdvice {
  const move = resolveDouble(cell, canDouble)
  const situation = `Myk ${total} mot ${up}`
  const softNote = `En myk hånd har et ess som teller 11 - hvis neste kort ville gitt over 21, teller esset bare 1 i stedet. Derfor kan du ikke buste av ett kort.`

  if (move === "double") {
    return {
      move,
      situation,
      summary: `Ingen bust-fare, og dealeren er svak - doble.`,
      details: [softNote, dealerLine, `Med en hånd som ikke kan buste mot en dealer som ofte buster, vil du ha mest mulig penger på bordet. Dobling gir dobbel gevinst de gangene dealeren buster - som er mange.`],
    }
  }
  if (move === "stand") {
    return {
      move,
      situation,
      summary: total >= 19 ? `${total} er en sterk hånd - stå.` : `18 er godt nok mot ${up} - stå.`,
      details: [
        total >= 19
          ? `Myk ${total} slår det meste dealeren ender på. Å trekke gjør hånden bedre for sjelden til at det lønner seg.`
          : col === 9
            ? `Mot ess ender dealeren ofte på 17-20, men å trekke på 18 gjør hånden dårligere oftere enn bedre. Å stå taper minst.`
            : `Mot ${up} ender dealeren ofte på 17 eller 18 - 18 slår eller spiller likt mot det.`,
        dealerLine,
        ...(cell === "Ds" ? [noDoubleNote] : []),
      ],
    }
  }
  return {
    move,
    situation,
    summary: total === 18 ? `18 taper ofte mot ${up} - trekk, du kan ikke buste.` : `Myk ${total} vinner sjelden alene - trekk gratis.`,
    details: [
      softNote,
      total === 18
        ? `Dealeren med ${up} ender svært ofte på 19 eller 20, og da taper 18. Siden du ikke kan buste av ett kort, er det bedre å prøve å forbedre hånden.`
        : `Myk ${total} vinner bare når dealeren buster. Et kort til kan ikke skade, men kan gi deg en hånd som slår dealeren.`,
      dealerLine,
      ...(cell === "Dh" ? [noDoubleNote] : []),
    ],
  }
}

function splitAdvice(pv: number, pairName: string, up: string, col: number, dealerLine: string): StrategyAdvice {
  const situation = `${pairName === "to ess" ? "Ess-par" : `Par ${pairName}`} mot ${up}`
  const das = `Du kan doble etter split, så trekker du godt på en av hendene, kan du sette inn enda mer.`
  if (pv === 11) {
    return {
      move: "split",
      situation,
      summary: `Splitt alltid ess - to hender som starter på 11.`,
      details: [
        `To ess er bare 2 eller 12 - en svak hånd. Splittet blir det to hender som hver starter på 11, og hvert 10-verdikort (4 av 13) gir 21.`,
        dealerLine,
        `En 21 etter split teller som 21, ikke som blackjack, men det er likevel blant de beste startene du kan få.`,
      ],
    }
  }
  if (pv === 8) {
    return {
      move: "split",
      situation,
      summary: `16 er den verste hånden - splitt den til to hender på 8.`,
      details: [
        `8+8 er 16: for høyt til å trekke trygt og for lavt til å vinne. To hender som starter på 8 taper mye mindre enn én hånd på 16.`,
        dealerLine,
        das,
      ],
    }
  }
  if (pv === 9) {
    return {
      move: "split",
      situation,
      summary: `To hender på 9 vinner mer enn én 18 mot ${up}.`,
      details: [
        `18 er en grei hånd, men mot ${up} ender dealeren ofte på 19 eller mer, eller buster. To hender som starter på 9 gir mer gevinst i snitt.`,
        dealerLine,
        das,
      ],
    }
  }
  return {
    move: "split",
    situation,
    summary: `Dealeren er ${col <= 4 ? "svak" : "sårbar"} - få mer penger på bordet med to hender.`,
    details: [
      `${pairName} som én hånd er svak. Splittet starter du to hender på ${pv}, og mot ${up} er dealeren sårbar.`,
      dealerLine,
      `Når dealeren ofte buster, vil du ha flere innsatser på bordet. ${das}`,
    ],
  }
}

function pairNoSplitAdvice(
  pv: number,
  pairName: string,
  cell: "H" | "S",
  total: number,
  soft: boolean,
  up: string,
  col: number,
  dealerLine: string,
  dealerBj: number | undefined
): StrategyAdvice {
  const move: Move = cell === "H" ? "hit" : "stand"
  const situation = `${pairName === "to ess" ? "Ess-par" : `Par ${pairName}`} mot ${up}`
  const noPeek = dealerBj
    ? `Dealeren her sjekker ikke hullkortet for blackjack før til slutt. Har dealeren blackjack (${pct(dealerBj)} med ${up}), taper du også innsatsen på den splittede hånden - derfor lønner det seg ikke å splitte her.`
    : null

  if (pv === 10) {
    return {
      move,
      situation,
      summary: `20 er nesten best mulig - ikke splitt, stå.`,
      details: [`To 10-verdikort er 20. Bare 21 slår det. Å splitte en 20 bytter bort en nesten sikker gevinst mot to usikre hender.`, dealerLine],
    }
  }
  if (pv === 11) {
    return {
      move,
      situation,
      summary: `Ikke splitt ess mot ess uten peek - trekk på myk 12.`,
      details: [noPeek ?? "", `Spill hånden som myk 12: du kan ikke buste av ett kort.`, dealerLine].filter(Boolean),
    }
  }
  if (pv === 8) {
    return {
      move,
      situation,
      summary: `Uten peek lønner det seg ikke å splitte 8-ere mot ${up} - trekk på 16.`,
      details: [noPeek ?? "", `Spill hånden som hard 16. Mot et så sterkt dealerkort er det bedre å trekke enn å stå.`, dealerLine].filter(Boolean),
    }
  }
  if (pv === 9 && cell === "S") {
    return {
      move,
      situation,
      summary: col === 5 ? `Dealeren ender ofte på 17 - 18 slår det, stå.` : `18 er godt nok - ikke splitt mot ${up}.`,
      details: [
        col === 5
          ? `Med 7 ender dealeren svært ofte på akkurat 17. Da vinner 18. Å splitte ville gitt to hender på 9 som ofte ender dårligere.`
          : `Mot ${up} er dealeren sterk. 18 er en hånd du kan stå på, mens to hender på 9 mot et sterkt kort ofte taper begge.`,
        noPeek ?? "",
        dealerLine,
      ].filter(Boolean),
    }
  }
  if (pv === 7 && cell === "S") {
    return {
      move,
      situation,
      summary: `Spesialtilfelle med én kortstokk - stå på 14.`,
      details: [
        `Vanligvis trekker man på 14 mot 10. Men med bare én kortstokk har du selv to av de fire 7-erne, så det er færre kort igjen som gir deg en god hånd - og 10-verdikortene som buster deg er fortsatt der.`,
        `Med akkurat 7+7 mot 10 taper du derfor litt mindre på å stå enn på å trekke.`,
        dealerLine,
      ],
    }
  }
  // Small pairs against a strong card (2+2/3+3 vs 8+, 4+4 vs most, 6+6 vs 8+, 7+7 vs 9/A).
  return {
    move,
    situation,
    summary: `Ikke splitt mot ${up} - spill hånden som ${soft ? "myk" : "hard"} ${total}.`,
    details: [
      `Å splitte ${pairName} gir to hender som starter på ${pv}. Mot ${up} vinner dealeren for ofte til at det lønner seg å sette inn mer penger.`,
      `Spill den heller som ${total}: ${cell === "H" ? `trekk, siden ${total} sjelden vinner alene` : "stå"}.`,
      dealerLine,
    ],
  }
}
