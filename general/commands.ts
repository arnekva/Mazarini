import { ButtonInteraction, CacheType, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js'
import { Admin } from '../admin/admin'
import { MazariniClient } from '../client/MazariniClient'
import { TrelloCommands } from '../commands/bot/trelloCommands'
import { CardCommands } from '../commands/cardCommands'
import { DateCommands } from '../commands/dateCommands'
import { RedBlackCommands } from '../commands/drinks/redBlack/redBlackCommands'
import { DrinksCommands } from '../commands/drinksCommands'
import { GameCommands } from '../commands/gameCommands'
import { JokeCommands } from '../commands/jokeCommands'
import { LinkCommands } from '../commands/linkCommands'
import { Meme } from '../commands/memeCommands'
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
import { TestCommands } from '../commands/testCommands'
import { TextCommands } from '../commands/textCommands'
import { UserCommands } from '../commands/userCommands'
import { WarzoneCommands } from '../commands/warzoneCommands'
import { Weather } from '../commands/weatherCommands'

export interface IInteractionCommand<T> {
    commandName: string
    command: (rawInteraction: T) => void
}

export interface IInteractionElement {
    /** Holds the list over all available commands */
    commands: {
        /** All interactions triggered by a chat input, i.e. slash commands */
        interactionCommands?: IInteractionCommand<ChatInputCommandInteraction<CacheType>>[]
        /** All interactions triggered by a button press */
        buttonInteractionComands?: IInteractionCommand<ButtonInteraction<CacheType>>[]
        /** All interactions triggered by a select menu (dropdown) */
        selectMenuInteractionCommands?: IInteractionCommand<StringSelectMenuInteraction<CacheType>>[]
        /** ALl interactions triggered by a modal dialog */
        modalInteractionCommands?: IInteractionCommand<ModalSubmitInteraction<CacheType>>[]
    }
}

export class Commands {
    private client: MazariniClient

    private gameCommands: GameCommands
    private spinner: Spinner
    private adminCommands: Admin
    private gamblingCommands: GamblingCommands
    private crimeCommands: CrimeCommands
    private moneyCommands: MoneyCommands
    private dateCommands: DateCommands
    private weatherCommands: Weather
    private jokeCommands: JokeCommands
    private warzoneCommands: WarzoneCommands
    private spotifyCommands: SpotifyCommands
    private testCommands: TestCommands
    private musicCommands: Music
    private memeCommands: Meme
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

    constructor(client: MazariniClient) {
        this.client = client
        this.gameCommands = new GameCommands(this.client)
        this.spinner = new Spinner(this.client)
        this.adminCommands = new Admin(this.client)
        this.gamblingCommands = new GamblingCommands(this.client)
        this.crimeCommands = new CrimeCommands(this.client)
        this.moneyCommands = new MoneyCommands(this.client)
        this.dateCommands = new DateCommands(this.client)
        this.weatherCommands = new Weather(this.client)
        this.jokeCommands = new JokeCommands(this.client)
        this.warzoneCommands = new WarzoneCommands(this.client)
        this.spotifyCommands = new SpotifyCommands(this.client)
        this.testCommands = new TestCommands(this.client)
        this.musicCommands = new Music(this.client)
        this.memeCommands = new Meme(this.client)
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
    }

    getAllInteractionCommands() {
        return [
            this.gameCommands.getAllInteractions(),
            this.spinner.getAllInteractions(),
            this.jokeCommands.getAllInteractions(),
            this.adminCommands.getAllInteractions(),
            this.gamblingCommands.getAllInteractions(),
            this.crimeCommands.getAllInteractions(),
            this.moneyCommands.getAllInteractions(),
            this.dateCommands.getAllInteractions(),
            this.warzoneCommands.getAllInteractions(),
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
