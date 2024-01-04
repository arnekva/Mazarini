import { MazariniClient } from '../client/MazariniClient'
import { Admin } from '../commands/admin/admin'
import { TrelloCommands } from '../commands/bot/trelloCommands'
import { CardCommands } from '../commands/cardCommands'
import { DateCommands } from '../commands/dateCommands'
import { RedBlackCommands } from '../commands/drinks/redBlack/redBlackCommands'
import { DrinksCommands } from '../commands/drinksCommands'
import { Ludo } from '../commands/games/ludo/ludo'
import { CallOfDutyCommands } from '../commands/gaming/callofdutyCommands'
import { RocketLeagueCommands } from '../commands/gaming/rocketleagueCommands'
import { JokeCommands } from '../commands/jokeCommands'
import { LinkCommands } from '../commands/linkCommands'
import { MemeCommands } from '../commands/memes/memeCommands'
import { CrimeCommands } from '../commands/money/crimeCommands'
import { GamblingCommands } from '../commands/money/gamblingCommands'
import { MoneyCommands } from '../commands/money/moneyCommands'
import { Music } from '../commands/musicCommands'
import { NameCommands } from '../commands/nameCommands'
import { PatchNotes } from '../commands/patchnotes/patchnotes'
import { PoletCommands } from '../commands/poletCommands'
import { PollCommands } from '../commands/pollcommands'
import { SoundCommands } from '../commands/soundCommands'
import { Spinner } from '../commands/spinner'
import { SpotifyCommands } from '../commands/spotifyCommands'
import { StatsCommands } from '../commands/statsCommands'
import { TestCommands } from '../commands/testCommands'
import { TextCommands } from '../commands/textCommands'
import { UserCommands } from '../commands/userCommands'
import { VivinoCommands } from '../commands/vivinoCommands'
import { Weather } from '../commands/weatherCommands'
import { IInteractionElement } from '../interfaces/interactionInterface'

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
    }

    getAllInteractionCommands(): IInteractionElement[] {
        return [
            this.spinner.getAllInteractions(),
            this.jokeCommands.getAllInteractions(),
            this.adminCommands.getAllInteractions(),
            this.gamblingCommands.getAllInteractions(),
            this.crimeCommands.getAllInteractions(),
            this.moneyCommands.getAllInteractions(),
            this.dateCommands.getAllInteractions(),
            this.callOfDutyCommands.getAllInteractions(),
            this.patchNotes.getAllInteractions(),
            this.spotifyCommands.getAllInteractions(),
            this.testCommands.getAllInteractions(),
            this.musicCommands.getAllInteractions(),
            this.memeCommands.getAllInteractions(),
            this.userCommands.getAllInteractions(),
            this.pollCommands.getAllInteractions(),
            this.weatherCommands.getAllInteractions(),
            this.soundCommands.getAllInteractions(),
            this.cardCommands.getAllInteractions(),
            this.drinksCommands.getAllInteractions(),
            this.nameCommands.getAllInteractions(),
            this.poletCommands.getAllInteractions(),
            this.linkCommands.getAllInteractions(),
            this.textCommands.getAllInteractions(),
            this.redBlackCommands.getAllInteractions(),
            this.trelloCommands.getAllInteractions(),
            this.ludo.getAllInteractions(),
            this.rocketLeagueCommands.getAllInteractions(),
            this.vivinoCommands.getAllInteractions(),
            this.statsCommands.getAllInteractions(),
        ]
    }

    getAllTextCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.interactionCommands)
            .filter((c) => !!c)
    }

    getAllModalCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.modalInteractionCommands)
            .filter((c) => !!c)
    }

    getAllButtonCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.buttonInteractionComands)
            .filter((c) => !!c)
    }

    getAllSelectMenuCommands() {
        return this.getAllInteractionCommands()
            .flatMap((c) => c.commands.selectMenuInteractionCommands)
            .filter((c) => !!c)
    }

    get dateFunc() {
        return this.dateCommands
    }
}
