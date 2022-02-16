import { Client, Message } from 'discord.js'
import { Admin } from '../admin/admin'
import { Achievements } from '../commands/achievements'
import { DateCommands } from '../commands/dateCommands'
import { GamblingCommands } from '../commands/gamblingCommands'
import { GameCommands } from '../commands/gameCommands'
import { JokeCommands } from '../commands/jokeCommands'
import { Meme } from '../commands/memeCommands'
import { Music } from '../commands/musicCommands'
import { SoundCommands } from '../commands/soundCommands'
import { Spinner } from '../commands/spinner'
import { SpotifyCommands } from '../commands/spotifyCommands'
import { UserCommands } from '../commands/userCommands'
import { WarzoneCommands } from '../commands/warzoneCommands'
import { Weather } from '../commands/weatherCommands'
import { MessageHelper } from '../helpers/messageHelper'
import { PatchNotes } from '../patchnotes'

/**
 * Interface for kommandoer. Alle kommandoer må følge dette oppsettet.
 * @param commandName Stringen som trigger kommandoen (kommer etter !mz)  - her kan man ha flere ved å legge det i en array
 * @param description Beskrivelse av kommandoen. Vises i !mz help <kommando>.
 * @param command Funksjon som skal kjøres
 * @param hideFromListing (Optional) Sett til true for å gjemme funksjonen fra !mz help listen.
 * @param isAdmin (Optional) Sett til true for å kun la admins kjøre.
 * @param deprecated (Optional) Hvis commanden bytter navn, sett den gamle til deprecated og la verdien være navnet på den nye commanden (eks !mz master bytter til !mz countdown -> behold !mz master og ha "countdown" i verdien på deprecated). Da vil botten legge til informasjon om deprecated og be de bruke den nye neste gang
 */
export interface ICommandElement {
    commandName: string | string[]
    description: string
    command: (rawMessage: Message, messageContent: string, args: string[]) => void
    category: commandCategory
    hideFromListing?: boolean
    isAdmin?: boolean
    deprecated?: string
    isSuperAdmin?: boolean
}

export type commandCategory = 'musikk' | 'gambling' | 'gaming' | 'tekst' | 'annet' | 'admin' | 'spin'

export class Commands {
    private client: Client
    private messageHelper: MessageHelper
    private gameCommands: GameCommands
    private spinner: Spinner
    private adminCommands: Admin
    private gamblingCommands: GamblingCommands
    private dateCommands: DateCommands
    private weatherCommands: Weather
    private achievementCommands: Achievements
    private jokeCommands: JokeCommands
    private warzoneCommands: WarzoneCommands
    private spotifyCommands: SpotifyCommands
    private musicCommands: Music
    private memeCommands: Meme
    private userCommands: UserCommands
    private patchNotes: PatchNotes
    private soundCommands: SoundCommands

    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
        this.gameCommands = new GameCommands(this.client, this.messageHelper)
        this.spinner = new Spinner(this.client, this.messageHelper)
        this.adminCommands = new Admin(this.client, this.messageHelper)
        this.gamblingCommands = new GamblingCommands(this.client, this.messageHelper)
        this.dateCommands = new DateCommands(this.client, this.messageHelper)
        this.weatherCommands = new Weather(this.client, this.messageHelper)
        this.achievementCommands = new Achievements(this.client, this.messageHelper)
        this.jokeCommands = new JokeCommands(this.client, this.messageHelper)
        this.warzoneCommands = new WarzoneCommands(this.client, this.messageHelper)
        this.spotifyCommands = new SpotifyCommands(this.client, this.messageHelper)
        this.musicCommands = new Music(this.client, this.messageHelper)
        this.memeCommands = new Meme(this.client, this.messageHelper)
        this.userCommands = new UserCommands(this.client, this.messageHelper)
        this.weatherCommands = new Weather(this.client, this.messageHelper)
        this.patchNotes = new PatchNotes(this.client, this.messageHelper)
        this.soundCommands = new SoundCommands(this.client, this.messageHelper)
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
            ...this.achievementCommands.getAllCommands(),
            ...this.spotifyCommands.getAllCommands(),
            ...this.musicCommands.getAllCommands(),
            ...this.memeCommands.getAllCommands(),
            ...this.userCommands.getAllCommands(),
            ...this.weatherCommands.getAllCommands(),
            ...this.soundCommands.getAllCommands(),
        ]
    }

    getCommandCatgeories() {
        return ['lyd', 'gambling', 'gaming', 'tekst', 'annet', 'admin', 'spin']
    }

    helperCommands = (rawMessage: Message, messageContent: string, args: string[]) => {
        const isLookingForAllAdmin = !!args && args[0] === 'admin' && Admin.isAuthorAdmin(rawMessage.member)
        let commandString = 'Kommandoer: '
        let commandStringList: string[] = []
        const commandForHelp = messageContent.replace('!mz help ', '').trim()
        const commands = this.getAllCommands()
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
