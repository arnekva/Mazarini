import { Spinner } from './spinner'
import { Message, TextChannel } from 'discord.js'

import { JokeCommands } from './jokeCommands'
import { Admin } from '../admin/admin'
import { GitHubCommands } from './githubCommands'
import { GameCommands } from './gameCommands'
import { GamblingCommands } from './gamblingCommands'
import { WarzoneCommands } from './warzoneCommands'
import { PatchNotes } from '../patchnotes'
import { MessageHelper } from '../helpers/messageHelper'
import { Achievements } from './achievements'
import { SpotifyCommands } from './spotifyCommands'
import { Music } from './musicCommands'
import { Meme } from './memeCommands'
import { User } from './userCommands'
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

const helpCommand: ICommandElement = {
    commandName: 'help',
    description: "List alle metoder. Bruk '!mz help <command>' for å finne ut mer om en spesifikk kommando",
    command: (rawMessage, messageContent, args) => helperCommands(rawMessage, messageContent, args),
    category: 'annet',
}
const helpCommand2: ICommandElement = {
    commandName: 'hjelp',
    description: "List alle metoder. Bruk '!mz help <command>' for å finne ut mer om en spesifikk kommando",
    command: (rawMessage, messageContent, args) => helperCommands(rawMessage, messageContent, args),
    category: 'annet',
}

export const commands: ICommandElement[] = [
    Spinner.command,
    helpCommand,
    helpCommand2,
    Spinner.highscoreCommand,
    Spinner.allTimeHighCommand,
    Admin.command,
    JokeCommands.roggaVaskHuset,
    JokeCommands.thomasFese,
    JokeCommands.mygleStatus,
    JokeCommands.getAllMygling,
    JokeCommands.elDavido,
    JokeCommands.eivndPrideCommand,
    JokeCommands.reactWithWord,
    JokeCommands.bonkSender,
    JokeCommands.uwuMessage,
    JokeCommands.mordiMessage,
    JokeCommands.jaerskCommand,
    JokeCommands.pheseCommand,
    Spinner.listNumberOfSpins,
    // Admin.nukeDatabase,
    Admin.setVal,
    Admin.setSpinVal,
    Admin.getVal,
    Admin.deleteSpecificKey,
    Admin.sendMsgAsBot,
    Admin.reactToMsg,
    Admin.replyToMsg,
    Admin.deleteMessages,
    Admin.warnUserCommand,
    Admin.statsCommand,
    Spinner.setHighscoreCommand,
    Admin.deleteValFromPrefix,
    GitHubCommands.issueCommand,
    JokeCommands.eivindSkyld,
    JokeCommands.activityCommand,
    JokeCommands.kanCommand,
    GameCommands.getDropVerdansk,
    GameCommands.getDropRebirth,
    GameCommands.getDropFromGrid,
    GamblingCommands.addCoinsCommand,
    GamblingCommands.createBetCommand,
    GamblingCommands.resolveBetCommand,
    GamblingCommands.gambleCoins,
    GamblingCommands.rulett,
    GamblingCommands.takeLoanCommand,
    GamblingCommands.payDebtCommand,
    GamblingCommands.walletCommand,
    GamblingCommands.checkChipsCommand,
    GamblingCommands.vippsCommand,
    GamblingCommands.krigCommand,
    GamblingCommands.bailoutCommand,
    GamblingCommands.showActiveBetCommand,
    GamblingCommands.gambleCoinsShort,
    DateCommands.remindMeCommand,
    DateCommands.countdownCommand,
    WarzoneCommands.getWZStats,
    WarzoneCommands.getWeeklyWZStats,
    WarzoneCommands.getWeaponStats,
    PatchNotes.getPatchNotes,
    PatchNotes.publishPatchNotes,
    Achievements.listAchievements,
    Achievements.giveMissingAchievements,
    SpotifyCommands.currentUserIsPlaying,
    Music.musicCommands,
    Meme.makeMemeCommand,
    User.seeWarningCounterCommand,
    User.sendRoleAssignmentCommand,
    Weather.getWeatherForGivenCityCommand,
]
function getCommandCatgeories() {
    return ['lyd', 'gambling', 'gaming', 'tekst', 'annet', 'admin', 'spin']
}
export const helperCommands = (rawMessage: Message, messageContent: string, args: string[]) => {
    const isLookingForAllAdmin = !!args && args[0] === 'admin' && Admin.isAuthorAdmin(rawMessage.member)
    let commandString = 'Kommandoer: '
    let commandStringList: string[] = []
    const commandForHelp = messageContent.replace('!mz help ', '').trim()
    // if (!args[0]) {
    //     MessageHelper.sendMessage(rawMessage, `Du må spesifisere en av følgende kategorier: ${getCommandCatgeories().join(", ")}`)
    //     return;
    // }
    let category = args[0] ?? 'unspecified'
    //spesifikk command
    if (getCommandCatgeories().includes(args[0])) {
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
    }
    //List alle
    else {
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
        getCommandCatgeories().forEach((cat) => {
            commandString += ' *' + cat + ',*'
        })
        MessageHelper.sendMessage(rawMessage, 'Liste over kommandoer er sendt på DM.')
        MessageHelper.sendDM(rawMessage.author, commandString, rawMessage)
    }
}
