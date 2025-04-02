import { MazariniClient } from '../client/MazariniClient'
import { Admin } from '../commands/admin/admin'
import { DateCommands } from '../commands/dateCommands'
import { DrinksCommands } from '../commands/drinks/drinksCommands'
import { PoletCommands } from '../commands/drinks/poletCommands'
import { RedBlackCommands } from '../commands/drinks/redBlack/redBlackCommands'
import { VivinoCommands } from '../commands/drinks/vivinoCommands'
import { CardCommands } from '../commands/games/cardCommands'
import { Deathroll } from '../commands/games/deathroll'
import { Ludo } from '../commands/games/ludo/ludo'
import { CallOfDutyCommands } from '../commands/gaming/callofdutyCommands'
import { RocketLeagueCommands } from '../commands/gaming/rocketleagueCommands'
import { StatsCommands } from '../commands/gaming/statsCommands'
import { JokeCommands } from '../commands/jokeCommands'
import { MemeCommands } from '../commands/memes/memeCommands'
import { CrimeCommands } from '../commands/money/crimeCommands'
import { GamblingCommands } from '../commands/money/gamblingCommands'
import { MoneyCommands } from '../commands/money/moneyCommands'
import { Spinner } from '../commands/money/spinner'
import { NameCommands } from '../commands/nameCommands'
import { TrelloCommands } from '../commands/trello/trelloCommands'

import { Blackjack } from '../commands/games/blackjack'
import { DailyClaimCommands } from '../commands/money/dailyClaimCommands'
import { PollCommands } from '../commands/pollcommands'
import { Music } from '../commands/sound/musicCommands'
import { SoundCommands } from '../commands/sound/soundCommands'
import { SpotifyCommands } from '../commands/sound/spotifyCommands'
// import { TestCommands } from '../commands/test/testCommands'
import { ButtonInteraction, CacheType, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { CalendarCommands } from '../commands/calendarCommands'
import { DealOrNoDeal } from '../commands/games/dealOrNoDeal'
import { MoreOrLess } from '../commands/games/moreOrLess'
import { LootboxCommands } from '../commands/store/lootboxCommands'
import { TestCommands } from '../commands/test/testCommands'
import { TextCommands } from '../commands/textCommands'
import { LinkCommands } from '../commands/user/linkCommands'
import { UserCommands } from '../commands/user/userCommands'
import { Weather } from '../commands/weatherCommands'
import { IInteractionCommand, IInteractionElement } from '../interfaces/interactionInterface'
import { PatchNotes } from '../patchnotes'

export class Commands {
    private client: MazariniClient

    private spinner: Spinner
    private adminCommands: Admin
    private gamblingCommands: GamblingCommands
    private crimeCommands: CrimeCommands
    private moneyCommands: MoneyCommands
    private dateCommands: DateCommands
    private weatherCommands: Weather
    private jokeCommands: JokeCommands
    private callOfDutyCommands: CallOfDutyCommands
    private spotifyCommands: SpotifyCommands
    private testCommands: TestCommands
    private musicCommands: Music
    private memeCommands: MemeCommands
    private userCommands: UserCommands
    private patchNotes: PatchNotes
    private soundCommands: SoundCommands
    private cardCommands: CardCommands
    private drinksCommands: DrinksCommands
    private nameCommands: NameCommands
    private poletCommands: PoletCommands
    private linkCommands: LinkCommands
    private textCommands: TextCommands
    private redBlackCommands: RedBlackCommands
    private trelloCommands: TrelloCommands
    private pollCommands: PollCommands
    private ludo: Ludo
    private rocketLeagueCommands: RocketLeagueCommands
    private vivinoCommands: VivinoCommands
    private statsCommands: StatsCommands
    private deathroll: Deathroll
    private blackjack: Blackjack
    private lootboxCommands: LootboxCommands
    private dailyClaimCommands: DailyClaimCommands
    private calendarCommands: CalendarCommands
    private moreOrLess: MoreOrLess
    private dealOrNoDeal: DealOrNoDeal

    allTextCommands: IInteractionCommand<ChatInputCommandInteraction<CacheType>>[]
    allModalCommands: IInteractionCommand<ModalSubmitInteraction<CacheType>>[]
    allButtonCommands: IInteractionCommand<ButtonInteraction<CacheType>>[]
    allSelectMenuCommands: IInteractionCommand<StringSelectMenuInteraction<CacheType>>[]

    constructor(client: MazariniClient) {
        this.client = client
        this.spinner = new Spinner(this.client)
        this.adminCommands = new Admin(this.client)
        this.gamblingCommands = new GamblingCommands(this.client)
        this.crimeCommands = new CrimeCommands(this.client)
        this.moneyCommands = new MoneyCommands(this.client)
        this.dateCommands = new DateCommands(this.client)
        this.weatherCommands = new Weather(this.client)
        this.jokeCommands = new JokeCommands(this.client)
        this.callOfDutyCommands = new CallOfDutyCommands(this.client)
        this.spotifyCommands = new SpotifyCommands(this.client)
        this.testCommands = new TestCommands(this.client)
        this.musicCommands = new Music(this.client)
        this.memeCommands = new MemeCommands(this.client)
        this.userCommands = new UserCommands(this.client)
        this.weatherCommands = new Weather(this.client)
        this.patchNotes = new PatchNotes(this.client)
        this.soundCommands = new SoundCommands(this.client)
        this.cardCommands = new CardCommands(this.client)
        this.drinksCommands = new DrinksCommands(this.client)
        this.nameCommands = new NameCommands(this.client)
        this.poletCommands = new PoletCommands(this.client)
        this.linkCommands = new LinkCommands(this.client)
        this.trelloCommands = new TrelloCommands(this.client)
        this.textCommands = new TextCommands(this.client)
        this.redBlackCommands = new RedBlackCommands(this.client)
        this.pollCommands = new PollCommands(this.client)
        this.ludo = new Ludo(this.client)
        this.rocketLeagueCommands = new RocketLeagueCommands(this.client)
        this.vivinoCommands = new VivinoCommands(this.client)
        this.statsCommands = new StatsCommands(this.client)
        this.deathroll = new Deathroll(this.client)
        this.blackjack = new Blackjack(this.client)
        this.lootboxCommands = new LootboxCommands(this.client)
        this.dailyClaimCommands = new DailyClaimCommands(this.client)
        this.calendarCommands = new CalendarCommands(this.client)
        this.moreOrLess = new MoreOrLess(this.client)
        this.dealOrNoDeal = new DealOrNoDeal(this.client)

        this.allTextCommands = this.getAllTextCommands()
        this.allModalCommands = this.getAllModalCommands()
        this.allButtonCommands = this.getAllButtonCommands()
        this.allSelectMenuCommands = this.getAllSelectMenuCommands()
    }

    getAll(): AbstractCommands[] {
        const allClasses = []
        for (const i in this) {
            if (this[i] instanceof AbstractCommands) {
                allClasses.push(this[i])
            }
        }
        return allClasses
    }

    getAllInteractionCommands(): IInteractionElement[] {
        const allClasses = this.getAll()
        return allClasses.flatMap((c) => c.getAllInteractions())
    }

    async doSaveAllCommands() {
        const allClasses = this.getAll()
        for (const c of allClasses) {
            await c.onSave()
        }
    }
    async doRefreshAllCommands() {
        const allClasses = this.getAll()
        for (const c of allClasses) {
            await c.refresh()
        }
    }

    private getAllTextCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.interactionCommands)
            .filter((c) => !!c)
    }

    private getAllModalCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.modalInteractionCommands)
            .filter((c) => !!c)
    }

    private getAllButtonCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.buttonInteractionComands)
            .filter((c) => !!c)
    }

    private getAllSelectMenuCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.selectMenuInteractionCommands)
            .filter((c) => !!c)
    }

    get dateFunc() {
        return this.dateCommands
    }
}
