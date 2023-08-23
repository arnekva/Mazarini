import { ButtonInteraction, CacheType, ChatInputCommandInteraction, Client, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js'
import { Admin } from '../admin/admin'
import { TrelloCommands } from '../commands/bot/trelloCommands'
import { CardCommands } from '../commands/cardCommands'
import { DateCommands } from '../commands/dateCommands'
import { RedBlackCommands } from '../commands/drinks/redBlack/redBlackCommands'
import { DrinksCommands } from '../commands/drinksCommands'
import { GamblingCommands } from '../commands/gamblingCommands'
import { GameCommands } from '../commands/gameCommands'
import { JokeCommands } from '../commands/jokeCommands'
import { LinkCommands } from '../commands/linkCommands'
import { Meme } from '../commands/memeCommands'
import { Music } from '../commands/musicCommands'
import { NameCommands } from '../commands/nameCommands'
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
import { MessageHelper } from '../helpers/messageHelper'
import { PatchNotes } from '../patchnotes'

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
    private client: Client
    private messageHelper: MessageHelper
    private gameCommands: GameCommands
    private spinner: Spinner
    private adminCommands: Admin
    private gamblingCommands: GamblingCommands
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

    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
        this.gameCommands = new GameCommands(this.client, this.messageHelper)
        this.spinner = new Spinner(this.client, this.messageHelper)
        this.adminCommands = new Admin(this.client, this.messageHelper)
        this.gamblingCommands = new GamblingCommands(this.client, this.messageHelper)
        this.dateCommands = new DateCommands(this.client, this.messageHelper)
        this.weatherCommands = new Weather(this.client, this.messageHelper)
        this.jokeCommands = new JokeCommands(this.client, this.messageHelper)
        this.warzoneCommands = new WarzoneCommands(this.client, this.messageHelper)
        this.spotifyCommands = new SpotifyCommands(this.client, this.messageHelper)
        this.testCommands = new TestCommands(this.client, this.messageHelper)
        this.musicCommands = new Music(this.client, this.messageHelper)
        this.memeCommands = new Meme(this.client, this.messageHelper)
        this.userCommands = new UserCommands(this.client, this.messageHelper)
        this.weatherCommands = new Weather(this.client, this.messageHelper)
        this.patchNotes = new PatchNotes(this.client, this.messageHelper)
        this.soundCommands = new SoundCommands(this.client, this.messageHelper)
        this.cardCommands = new CardCommands(this.client, this.messageHelper)
        this.drinksCommands = new DrinksCommands(this.client, this.messageHelper)
        this.nameCommands = new NameCommands(this.client, this.messageHelper)
        this.poletCommands = new PoletCommands(this.client, this.messageHelper)
        this.linkCommands = new LinkCommands(this.client, this.messageHelper)
        this.trelloCommands = new TrelloCommands(this.client, this.messageHelper)
        this.textCommands = new TextCommands(this.client, this.messageHelper)
        this.redBlackCommands = new RedBlackCommands(this.client, this.messageHelper)
        this.pollCommands = new PollCommands(this.client, this.messageHelper)
    }

    getAllInteractionCommands() {
        return [
            this.gameCommands.getAllInteractions(),
            this.spinner.getAllInteractions(),
            this.jokeCommands.getAllInteractions(),
            this.adminCommands.getAllInteractions(),
            this.gamblingCommands.getAllInteractions(),
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
