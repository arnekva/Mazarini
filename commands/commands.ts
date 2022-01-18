import { Spinner } from './spinner'
import { Client, Message, TextChannel, User } from 'discord.js'

import { JokeCommands } from './jokeCommands'
import { Admin } from '../admin/admin'
import { GameCommands } from './gameCommands'
import { GamblingCommands } from './gamblingCommands'
import { WarzoneCommands } from './warzoneCommands'
import { PatchNotes } from '../patchnotes'
import { MessageHelper } from '../helpers/messageHelper'
import { Achievements } from './achievements'
import { SpotifyCommands } from './spotifyCommands'
import { Music } from './musicCommands'
import { Meme } from './memeCommands'
import { UserCommands } from './userCommands'
import { DateCommands } from './dateCommands'
import { Weather } from './weatherCommands'

/**
 * Interface for kommandoer. Alle kommandoer må følge dette oppsettet.
 * @param commandName Stringen som trigger kommandoen (kommer etter !mz)
 * @param description Beskrivelse av kommandoen. Vises i !mz help <kommando>.
 * @param command Funksjon som skal kjøres
 * @param hideFromListing (Optional) Sett til true for å gjemme funksjonen fra !mz help listen.
 * @param isAdmin (Optional) Sett til true for å kun la admins kjøre.
 * @param deprecated (Optional) Hvis commanden bytter navn, sett den gamle til deprecated og la verdien være navnet på den nye commanden (eks !mz master bytter til !mz countdown -> behold !mz master og ha "countdown" i verdien på deprecated). Da vil botten legge til informasjon om deprecated og be de bruke den nye neste gang
 */
export interface ICommandElement {
    commandName: string
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

    constructor(client: Client) {
        this.client = client
        this.gameCommands = new GameCommands(this.client)
        this.spinner = new Spinner(this.client)
        this.adminCommands = new Admin(this.client)
        this.gamblingCommands = new GamblingCommands(this.client)
        this.dateCommands = new DateCommands(this.client)
        this.weatherCommands = new Weather(this.client)
        this.achievementCommands = new Achievements(this.client)
        this.jokeCommands = new JokeCommands(this.client)
        this.warzoneCommands = new WarzoneCommands(this.client)
        this.spotifyCommands = new SpotifyCommands(this.client)
        this.musicCommands = new Music(this.client)
        this.memeCommands = new Meme(this.client)
        this.userCommands = new UserCommands(this.client)
        this.weatherCommands = new Weather(this.client)
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
            ...PatchNotes.PatchCommands,
            ...this.achievementCommands.getAllCommands(),
            ...this.spotifyCommands.getAllCommands(),
            ...this.musicCommands.getAllCommands(),
            ...this.memeCommands.getAllCommands(),
            ...this.userCommands.getAllCommands(),
            ...this.weatherCommands.getAllCommands(),
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
                if (cmd.category == args[0]) commandStringList.push(cmd.commandName)
            })
            commandStringList.sort()
            commandStringList.forEach((str) => (commandString += '\n' + str))
            MessageHelper.sendDM(rawMessage.author, commandString, rawMessage)
        } else if (args && args[0] !== 'admin' && commandForHelp.length > 0) {
            let found = 0
            commands.forEach((cmd) => {
                if (cmd.commandName == commandForHelp) {
                    if (cmd.isSuperAdmin)
                        MessageHelper.sendMessage(rawMessage, cmd.commandName + (cmd.isSuperAdmin ? ' (Superadmin) ' : '') + ': ' + cmd.description)
                    else MessageHelper.sendMessage(rawMessage, cmd.commandName + (cmd.isAdmin ? ' (Admin) ' : '') + ': ' + cmd.description)
                    found++
                }
            })

            if (found == 0) {
                MessageHelper.sendMessage(rawMessage, "Fant ingen kommando '" + commandForHelp + "'. ")
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
                    if (!cmd.hideFromListing) commandStringList.push(cmd.commandName)
                }
            })

            commandStringList.sort()
            commandStringList.forEach((str) => (commandString += '\n' + str))
            commandString += '\n\n' + "*Bruk '!mz help <command>' for beskrivelse*"
            commandString += "\n*Eller bruk '!mz help <kategori>' med en av følgende kategorier for en mindre liste:* "
            this.getCommandCatgeories().forEach((cat) => {
                commandString += ' *' + cat + ',*'
            })
            MessageHelper.sendMessage(rawMessage, 'Liste over kommandoer er sendt på DM.')
            MessageHelper.sendDM(rawMessage.author, commandString, rawMessage)
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
