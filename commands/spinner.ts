
import { Message } from "discord.js";
import { Channel, Client, DMChannel, NewsChannel, TextChannel } from "discord.js";
import { AchievementHelper } from "../helpers/achievementHelper";
import { DatabaseHelper } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ArrayUtils } from "../utils/arrayUtils";
import { getWeekNumber } from "../utils/dateUtils";
import { getRandomPercentage } from "../utils/randomUtils";
import { escapeString } from "../utils/textUtils";
import { Achievements } from "./achievements";
import { ICommandElement } from "./commands";



const weightedRandomObject = require("weighted-random-object");

const spinMinutes = [
	{
		"number": "0",
		"weight": 40
	}, {
		"number": "1",
		"weight": 30
	}, {
		"number": "2",
		"weight": 10
	}, {
		"number": "3",
		"weight": 4
	}, {
		"number": "4",
		"weight": 3
	}, {
		"number": "5",
		"weight": 2
	}, {
		"number": "6",
		"weight": 1
	}, {
		"number": "7",
		"weight": 0.5
	}, {
		"number": "8",
		"weight": 0.5
	}, {
		"number": "9",
		"weight": 0.09
	}, {
		"number": "10",
		"weight": 0.005
	}
];

function didSpinnerBreak() {
	return getRandomPercentage(1); //1% sjanse for å ødelegge spinneren
}

export class Spinner {

	static spin(message: Message) {
		const min = weightedRandomObject(spinMinutes).number;
		const sec = Math.floor(Math.random() * 60);
		const cleanUsername = escapeString(message.author.username);

		Spinner.addSpinnerRole(message)
		if (cleanUsername.length < 2) {
			message.reply("Det kan virke som om brukernavnet ditt inneholder for få lovlige tegn (" + cleanUsername + "). Dette må rettes opp i før du får spinne.")
		} else {
			MessageHelper.sendMessage(message, message.author.username + " spant fidget spinneren sin i " + min + " minutt og " + sec + " sekund!")
			if (min == 0 && sec == 0) {
				MessageHelper.sendMessage(message, "lol du suge")
			} else if (min == 10 && sec == 59) {
				MessageHelper.sendMessage(message, "gz bro")
			}
			const formatedScore = Spinner.formatScore(min + sec);
			Spinner.compareScore(message, formatedScore);
			Spinner.incrementCounter(message);
		}
	}

	static async incrementCounter(message: Message) {
		// const currentVal = DatabaseHelper.getValue("counterSpin", message.author.username, () => { });
		const currentTotalspin = DatabaseHelper.getValue("counterSpin", message.author.username);
		if (currentTotalspin) {
			try {
				let cur = parseInt(currentTotalspin);
				cur = cur += 1;
				AchievementHelper.awardSpinningAch(message.author.username, cur.toString(), message)

				DatabaseHelper.setValue("counterSpin", message.author.username, cur.toString())
			} catch (error) {
				MessageHelper.sendMessageToActionLog(message.channel as TextChannel, "Noe gikk galt med incrementing av spinner totalen for " + message.author.username + ". Stacktrace: " + error)
				message.reply("Noe gikk galt. Feilen blir loggført. Stacktrace: " + error)
			}
		}
	}

	static async compareScore(message: Message, newScore: string) {
		const val = DatabaseHelper.getValue("spin", message.author.username)
		if (parseInt(val) < parseInt(newScore)) {
			DatabaseHelper.setValue("spin", message.author.username, newScore);
		}
	}

	static formatScore(score: string) {
		if (score.charAt(0) + score.charAt(1) == "10" && score.length == 3)
			return "100" + score.charAt(2);
		return score.length === 2 ? score.charAt(0) + "0" + score.charAt(1) : score;
	}

	static async listScores(message: Message, isWeeklyReset?: boolean) {
		const weekNumber = getWeekNumber(new Date())[1];
		MessageHelper.sendMessage(message, "*** HIGHSCORE *** for uke " + (isWeeklyReset ? weekNumber - 1 : getWeekNumber(new Date())[1]));

		const val2 = DatabaseHelper.getAllValuesFromPrefix("spin");
		const highscoreList = ArrayUtils.makeValuePairIntoOneString(val2, Spinner.formatValue);
		MessageHelper.sendMessage(message, highscoreList);

	}

	static async listSpinCounter(message: Message) {
		const val = DatabaseHelper.getAllValuesFromPrefix("counterSpin");
		ArrayUtils.sortUserValuePairArray(val);
		const printList = ArrayUtils.makeValuePairIntoOneString(val, undefined, "Total antall spins");
		MessageHelper.sendMessage(message, printList)

	}

	static formatValue(val: string) {
		if (val.length == 2)
			return `0${val.charAt(0)}:0${val.charAt(1)}`

		if (val.length == 3)
			return `0${val.charAt(0)}:${val.charAt(1)}${val.charAt(2)}`
		if (val.length == 4)
			return `${val.charAt(0)}${val.charAt(1)}:${val.charAt(2)}${val.charAt(3)}`
		return "Ugyldig verdi";
	}

	static sendWinner(message: Message, text: string) {
		const finalMsg = "*** HIGHSCORE *** \n" + text
	}

	static async addSpinnerRole(message: Message) {
		if (message.guild == null || message.member == null) {
			return
		}
		const role = await message.guild.roles.fetch("823504322213838888")

		if (role) {
			message.member.roles.add(role)
		}
	}

	static updateATH() {
		DatabaseHelper.compareAndUpdateValue("ATHspin", "spin")
	}

	static async allTimeHigh(message: Message) {
		Spinner.updateATH();
		const val = DatabaseHelper.getAllValuesFromPrefix("ATHspin");
		ArrayUtils.sortUserValuePairArray(val);
		const printList = ArrayUtils.makeValuePairIntoOneString(val, Spinner.formatValue);
		MessageHelper.sendMessage(message, printList)
	}

	static readonly allTimeHighCommand: ICommandElement = {
		commandName: "ATH",
		description: "Printer hver person sin beste spin!",
		command: (rawMessage: Message, messageContent: string) => {
			Spinner.allTimeHigh(rawMessage);
		}
	}

	static readonly command: ICommandElement = {
		commandName: "spin",
		description: "Spin fidgetspinneren. Beste tid per bruker registreres i databasen. Tallene er tilfeldige, men vektet. ",
		command: (rawMessage: Message, messageContent: string) => {
			Spinner.spin(rawMessage);
		}
	}

	static readonly highscoreCommand: ICommandElement = {
		commandName: "highscore",
		description: "Highscore for fidget spinning ",
		command: (rawMessage: Message, messageContent: string) => {
			Spinner.listScores(rawMessage);
		}
	}

	static readonly listNumberOfSpins: ICommandElement = {
		commandName: "totalspins",
		description: "Antall spins per person",
		command: (rawMessage: Message, messageContent: string) => {
			Spinner.listSpinCounter(rawMessage);
		}
	}

	static readonly setHighscoreCommand: ICommandElement = {
		commandName: "setscore",
		description: "Sett spin score verdi manuelt med <navn> <verdi> ",
		hideFromListing: true,
		command: (rawMessage: Message, messageContent: string) => {
			if (rawMessage.author.id === "245607554254766081" || rawMessage.author.id === "239154365443604480") {

				let mainString = rawMessage.content.replace("!mz setscore ", "");
				let newString = mainString.split(" ");
				try {
					DatabaseHelper.setValue("spin", newString[0], newString[1])
					MessageHelper.sendMessage(rawMessage, "Oppdaterte databaseverdi for nøkkel <" + newString[0] + "> med verdi <" + newString[1] + ">.")
				} catch (error) {
					MessageHelper.sendMessage(rawMessage, "Kunne ikke ppdaterte databaseverdi for nøkkel <" + newString[0] + ">. Feilkode: " + error)
				}
			}
		}
	}
}