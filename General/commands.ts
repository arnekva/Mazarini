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
import { MessageHelper } from '../helpers/messageHelper'
import { PatchNotes } from '../patchnotes'
import { ModalHandler } from './modalHandler'

/**
 * Interface for kommandoer. Alle kommandoer må følge dette oppsettet.
 */
export interface ICommandElement {
    /** Stringen som trigger kommandoen (kommer etter !mz)  - her kan man ha flere ved å legge det i en array */
    commandName: string | string[]
    /**  Beskrivelse av kommandoen. Vises i !mz help <kommando>. */
    description: string
    /** Funksjon som skal kjøres. */
    command: (rawMessage: Message, messageContent: string, args: string[]) => void
    category: commandCategory
    /**  Sett til true for å gjemme funksjonen fra !mz help listen. Default false */
    hideFromListing?: boolean
    /**   Sett til true for å kun la admins kjøre. Default false  */
    isAdmin?: boolean
    /**  Hvis commanden bytter navn, sett den gamle til deprecated og la verdien være navnet på den nye commanden (eks !mz master bytter til !mz countdown -> behold !mz master og ha "countdown" i verdien på deprecated). Da vil botten legge til informasjon om deprecated og be de bruke den nye neste gang */
    deprecated?: string
    /** Kun la super admins kjøre commanden */
    isSuperAdmin?: boolean
    /** Oppgi channel-IDer i en array her hvis commanden kun kan brukes i de channelene */
    canOnlyBeUsedInSpecificChannel?: string[]
    isReplacedWithSlashCommand?: string
}

export interface IInteractionElement {
    /** Oppgi interaction ID for interactionen som skal kjøre denne commanden */
    commandName: string
    category: commandCategory
    isAdmin?: boolean
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
    }

    getAllCommands() {
        return [
            this.helpCommand,
            this.helpCommand2,
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

    handleModalInteractions(interaction: Interaction<CacheType>) {
        this.modalHandler.handleIncomingModalInteraction(interaction)
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
                    if (cmd.isSuperAdmin)
                        this.messageHelper.sendMessage(
                            rawMessage.channelId,
                            cmd.commandName + (cmd.isSuperAdmin ? ' (Superadmin) ' : '') + ': ' + cmd.description
                        )
                    else this.messageHelper.sendMessage(rawMessage.channelId, cmd.commandName + (cmd.isAdmin ? ' (Admin) ' : '') + ': ' + cmd.description)
                    found++
                }
            })

            if (found == 0) {
                this.messageHelper.sendMessage(rawMessage.channelId, "Fant ingen kommando '" + commandForHelp + "'. ")
            }
        } else {
            commands.forEach((cmd) => {
                if (isLookingForAllAdmin) {
                    commandStringList.push(
                        cmd.commandName +
                            (cmd.isSuperAdmin ? ' (superadmin)' : '') +
                            (cmd.isAdmin ? ' (admin)' : cmd.hideFromListing ? ' (gjemt fra visning) ' : '')
                    )
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
        commandName: 'help',
        description: "List alle metoder. Bruk '!mz help <command>' for å finne ut mer om en spesifikk kommando",
        command: (rawMessage, messageContent, args) => this.helperCommands(rawMessage, messageContent, args),
        category: 'annet',
    }
    private helpCommand2: ICommandElement = {
        commandName: 'hjelp',
        description: "List alle metoder. Bruk '!mz help <command>' for å finne ut mer om en spesifikk kommando",
        command: (rawMessage, messageContent, args) => this.helperCommands(rawMessage, messageContent, args),
        category: 'annet',
    }
}
