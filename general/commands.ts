import { CacheType, ChatInputCommandInteraction, Client, Interaction, Message } from 'discord.js'
import { Admin } from '../admin/admin'
import { CardCommands } from '../commands/cardCommands'
import { DateCommands } from '../commands/dateCommands'
import { DrinksCommands } from '../commands/drinksCommands'
import { GamblingCommands } from '../commands/gamblingCommands'
import { GameCommands } from '../commands/gameCommands'
import { JokeCommands } from '../commands/jokeCommands'
import { LinkCommands } from '../commands/linkCommands'
import { Meme } from '../commands/memeCommands'
import { Music } from '../commands/musicCommands'
import { NameCommands } from '../commands/nameCommands'
import { PoletCommands } from '../commands/poletCommands'
import { SoundCommands } from '../commands/soundCommands'
import { Spinner } from '../commands/spinner'
import { SpotifyCommands } from '../commands/spotifyCommands'
import { UserCommands } from '../commands/userCommands'
import { WarzoneCommands } from '../commands/warzoneCommands'
import { Weather } from '../commands/weatherCommands'
import { ButtonHandler } from '../handlers/buttonHandler'
import { ModalHandler } from '../handlers/modalHandler'
import { SelectMenuHandler } from '../handlers/selectMenuHandler'
import { MessageHelper } from '../helpers/messageHelper'
import { PatchNotes } from '../patchnotes'

/**
 * Interface for kommandoer. Alle kommandoer må følge dette oppsettet.
 */
export interface ICommandElement {
    /** The string which triggers the command */
    commandName: string | string[]
    /** Description of the command. Is shown in !mz help <kommando>. */
    description: string
    /** The function being run */
    command: (rawMessage: Message, messageContent: string, args: string[]) => void
    category: commandCategory
    /**  Set to true to hide it from the help list */
    hideFromListing?: boolean
    /**   Set to true if admin only  */
    isAdmin?: boolean
    /**  Used to indicate that another function has replaced it */
    deprecated?: string

    canOnlyBeUsedInSpecificChannel?: string[]
    isReplacedWithSlashCommand?: string
}

export interface IInteractionElement {
    commandName: string
    category: commandCategory
    isAdmin?: boolean
    /** TODO: Not yet implemented, but should reply with an ephemeral message saying it can't be used there */
    canOnlyBeUsedInSpecificChannel?: string[]
    command: (rawMessage: ChatInputCommandInteraction<CacheType>) => void
}

export type commandCategory = 'musikk' | 'gambling' | 'gaming' | 'tekst' | 'annet' | 'admin' | 'spin' | 'drink'

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
    private modalHandler: ModalHandler
    private selectMenuHandler: SelectMenuHandler
    private buttonHandler: ButtonHandler

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
        this.modalHandler = new ModalHandler(this.client, this.messageHelper)
        this.selectMenuHandler = new SelectMenuHandler(this.client, this.messageHelper)
        this.buttonHandler = new ButtonHandler(this.client, this.messageHelper)
    }

    getAllCommands() {
        return [
            this.helpCommand,
            ...this.gameCommands.getAllCommands(),
            ...this.spinner.getAllCommands(),
            ...this.jokeCommands.getAllCommands(),
            ...this.adminCommands.getAllCommands(),
            ...this.gamblingCommands.getAllCommands(),
            ...this.dateCommands.getAllCommands(),
            ...this.warzoneCommands.getAllCommands(),
            ...this.patchNotes.getAllCommands(),
            ...this.spotifyCommands.getAllCommands(),
            ...this.musicCommands.getAllCommands(),
            ...this.memeCommands.getAllCommands(),
            ...this.userCommands.getAllCommands(),
            ...this.weatherCommands.getAllCommands(),
            ...this.soundCommands.getAllCommands(),
            ...this.cardCommands.getAllCommands(),
            ...this.drinksCommands.getAllCommands(),
            ...this.nameCommands.getAllCommands(),
            ...this.poletCommands.getAllCommands(),
            ...this.linkCommands.getAllCommands(),
        ]
    }

    getAllInteractionCommands() {
        return [
            ...this.gameCommands.getAllInteractions(),
            ...this.spinner.getAllInteractions(),
            ...this.jokeCommands.getAllInteractions(),
            ...this.adminCommands.getAllInteractions(),
            ...this.gamblingCommands.getAllInteractions(),
            ...this.dateCommands.getAllInteractions(),
            ...this.warzoneCommands.getAllInteractions(),
            ...this.patchNotes.getAllInteractions(),
            ...this.spotifyCommands.getAllInteractions(),
            ...this.musicCommands.getAllInteractions(),
            ...this.memeCommands.getAllInteractions(),
            ...this.userCommands.getAllInteractions(),
            ...this.weatherCommands.getAllInteractions(),
            ...this.soundCommands.getAllInteractions(),
            ...this.cardCommands.getAllInteractions(),
            ...this.drinksCommands.getAllInteractions(),
            ...this.nameCommands.getAllInteractions(),
            ...this.poletCommands.getAllInteractions(),
            ...this.linkCommands.getAllInteractions(),
        ]
    }

    handleModalInteractions(interaction: Interaction<CacheType>): boolean {
        return this.modalHandler.handleIncomingModalInteraction(interaction)
    }
    handleSelectMenus(interaction: Interaction<CacheType>): boolean {
        return this.selectMenuHandler.handleIncomingSelectMenu(interaction)
    }
    handleButtons(interaction: Interaction<CacheType>): boolean {
        return this.buttonHandler.handleIncomingButtonInteraction(interaction)
    }

    getCommandCatgeories() {
        return ['lyd', 'gambling', 'gaming', 'tekst', 'annet', 'admin', 'spin']
    }

    helperCommands = (rawMessage: Message, messageContent: string, args: string[]) => {
        const isLookingForAllAdmin = !!args && args[0] === 'admin' && Admin.isAuthorAdmin(rawMessage.member)
        let commandString = 'Kommandoer: '
        let commandStringList: string[] = []
        const commandForHelp = messageContent.replace('!mz help ', '').trim()
        const commands = this.getAllCommands().filter((c) => !c.isReplacedWithSlashCommand)
        if (this.getCommandCatgeories().includes(args[0])) {
            commands.forEach((cmd) => {
                if (cmd.category == args[0]) commandStringList.push(Array.isArray(cmd.commandName) ? cmd.commandName[0] : cmd.commandName)
            })
            commandStringList.sort()
            commandStringList.forEach((str) => (commandString += '\n' + str))
            this.messageHelper.sendDM(rawMessage.author, commandString)
        } else if (args && args[0] !== 'admin' && commandForHelp.length > 0) {
            let found = 0
            commands.forEach((cmd) => {
                if (cmd.commandName == commandForHelp) {
                    this.messageHelper.sendMessage(rawMessage.channelId, cmd.commandName + (cmd.isAdmin ? ' (Admin) ' : '') + ': ' + cmd.description)
                    found++
                }
            })

            if (found == 0) {
                this.messageHelper.sendMessage(rawMessage.channelId, "Fant ingen kommando '" + commandForHelp + "'. ")
            }
        } else {
            commands.forEach((cmd) => {
                if (isLookingForAllAdmin) {
                    commandStringList.push(cmd.commandName + (cmd.isAdmin ? ' (admin)' : cmd.hideFromListing ? ' (gjemt fra visning) ' : ''))
                } else {
                    if (!cmd.hideFromListing) commandStringList.push(Array.isArray(cmd.commandName) ? cmd.commandName[0] : cmd.commandName)
                }
            })

            commandStringList.sort()
            commandStringList.forEach((str) => (commandString += '\n' + str))
            commandString += '\n\n' + "*Bruk '!mz help <command>' for beskrivelse*"
            commandString += "\n*Eller bruk '!mz help <kategori>' med en av følgende kategorier for en mindre liste:* "
            this.getCommandCatgeories().forEach((cat) => {
                commandString += ' *' + cat + ',*'
            })
            this.messageHelper.sendMessage(rawMessage.channelId, 'Liste over kommandoer er sendt på DM.')
            this.messageHelper.sendDM(rawMessage.author, commandString)
        }
    }

    //TODO: Refactor these:
    private helpCommand: ICommandElement = {
        commandName: ['help', 'hjelp'],
        description: "List alle metoder. Bruk '!mz help <command>' for å finne ut mer om en spesifikk kommando",
        command: (rawMessage, messageContent, args) => this.helperCommands(rawMessage, messageContent, args),
        category: 'annet',
    }

    get dateFunc() {
        return this.dateCommands
    }
}
