import { Spinner } from "./spinner";
import { Message, TextChannel } from "discord.js";

import { JokeCommands } from "./jokeCommands";
import { Admin } from "../admin/admin";
import { GitHubCommands } from "./githubCommands";
import { GameCommands } from "./gameCommands";
import { GamblingCommands } from "./gamblingCommands";
import { WarzoneCommands } from "./warzoneCommands";
import { PatchNotes } from "../patchnotes";
import { MessageHelper } from "../helpers/messageHelper";


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
	commandName: string;
	description: string;
	command: (rawMessage: Message, messageContent: string, args: string[]) => void;
	hideFromListing?: boolean;
	isAdmin?: boolean;
	deprecated?: string;
}

const helpCommand: ICommandElement = {
	commandName: "help",
	description: "List alle metoder. Bruk '!mz help <command>' for å finne ut mer om en spesifikk kommando",
	command: (rawMessage, messageContent, args) => helperCommands(rawMessage, messageContent, args)
}

export const commands: ICommandElement[] = [
	Spinner.command,
	helpCommand,
	Spinner.highscoreCommand,
	Spinner.allTimeHighCommand,
	Admin.command,
	JokeCommands.roggaVaskHuset,
	JokeCommands.deadmaggi,
	JokeCommands.thomasFese,
	JokeCommands.mygleStatus,
	JokeCommands.getAllMygling,
	JokeCommands.masterCountdown,
	JokeCommands.countdown,
	JokeCommands.elDavido,
	JokeCommands.eivndPrideCommand,
	JokeCommands.reactWithWord,
	JokeCommands.bonkSender,
	JokeCommands.uwuMessage,
	Spinner.listNumberOfSpins,
	// Admin.nukeDatabase,
	Admin.setVal,
	Admin.setSpinVal,
	Admin.getVal,
	Admin.deleteSpecificKey,
	Admin.sendMsgAsBot,
	Admin.reactToMsg,
	Admin.replyToMsg,
	Admin.warnUserCommand,
	Spinner.setHighscoreCommand,
	Admin.deleteValFromPrefix,
	GitHubCommands.issueCommand,
	JokeCommands.eivindSkyld,
	GameCommands.getDropVerdansk,
	GameCommands.getDropRebirth,
	GameCommands.getDropFromGrid,
	GamblingCommands.addCoinsCommand,
	GamblingCommands.removeCoinsCommand,
	GamblingCommands.checkCoinsCommand,
	WarzoneCommands.getWZStats,
	WarzoneCommands.getWeeklyWZStats,
	WarzoneCommands.getWeaponStats,
	PatchNotes.getPatchNotes,
	PatchNotes.publishPatchNotes,
]

export const helperCommands = ((rawMessage: Message, messageContent: string, args: string[] | undefined) => {
	const isLookingForAllAdmin = !!args && args[0] === "admin" && Admin.isAuthorAdmin(rawMessage.member);
	let commandString = "Kommandoer: ";
	let commandStringList: string[] = [];
	const commandForHelp = messageContent.replace("!mz help", "").trim()

	if (args && args[0] !== "admin") {
		let found = 0;
		commands.forEach((cmd) => {
			if (cmd.commandName == commandForHelp) {
				MessageHelper.sendMessage(rawMessage, cmd.commandName + (cmd.isAdmin ? " (Admin) " : "") + ": " + cmd.description)
				found++;
			}
		})
		if (found == 0) {
			MessageHelper.sendMessage(rawMessage, "Fant ingen kommando '" + commandForHelp + "'. ")
		}
	}
	else {
		commands.forEach((cmd) => {

			if (isLookingForAllAdmin) {
				commandStringList.push(cmd.commandName + (cmd.isAdmin ? " (admin)" : (cmd.hideFromListing ? " (gjemt fra visning) " : "")));
			} else {
				if (!cmd.hideFromListing)
					commandStringList.push(cmd.commandName);
			}

		})
		commandStringList.sort();
		commandStringList.forEach((str) => commandString += "\n" + str)
		commandString += "\n\n" + "*Bruk '!mz help <command>' for beskrivelse*"
		MessageHelper.sendMessage(rawMessage, commandString)
	}

})