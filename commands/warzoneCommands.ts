
import { Channel, Client, DMChannel, Message, NewsChannel, TextChannel } from "discord.js";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";
const API = require('call-of-duty-api')();

export class WarzoneCommands {

	static async getBRContent(message: Message, messageContent: string, isWeekly?: boolean) {
		const content = messageContent.split(" ")
		const gamertag = content[0];
		const platform = content[1];

		try {
			await API.login("arne.kva@gmail.com", "Mazarini332");
		} catch (Error) {
			message.reply("Klarte ikke logge inn")
		}

		const sentMessage = await MessageHelper.sendMessage(message, "Henter data...")
		if (isWeekly) {
			let response = "Weekly Warzone stats for <" + gamertag + ">";
			try {
				let data = await API.MWweeklystats(gamertag, platform);
				const stats = data.wz.mode.br_all.properties;

				response += "\nKills: " + stats.kills;
				response += "\nDeaths: " + stats.deaths;
				response += "\nK/D Ratio: " + (stats.kdRatio).toFixed(3);
				response += "\nKills per game: " + (stats.killsPerGame).toFixed(3);
				response += "\nDamage Done: " + stats.damageDone;
				response += "\nDamage Taken: " + stats.damageTaken + (stats.damageTaken > stats.damageDone ? " (flaut) " : "");
				response += "\nHeadshots: " + stats.headshots;
				response += "\nWall bangs: " + stats.wallBangs;
				response += "\nAverage Lifetime: " + stats.avgLifeTime.toFixed(3);
				// response += "\nDistance Traveled: " + stats.distanceTraveled;
				response += "\nMunition boxes used: " + stats.objectiveMunitionsBoxTeammateUsed ?? "0";
				response += "\nNo. items bought at store: " + stats.objectiveBrKioskBuy ?? "0";
				response += "\nGulag Deaths: " + stats.gulagDeaths;
				response += "\nGulag Kills: " + stats.gulagKills;
				response += "\nGulag K/D: " + (stats.gulagKills / stats.gulagDeaths).toFixed(3);
				response += "\nTime played (må formaterast): " + stats.timePlayed;
				response += "\nHeadshot percentage: " + stats.headshotPercentage.toFixed(3);
				response += "\nExecutions: " + stats.executions;
				response += "\nMatches Played: " + stats.matchesPlayed;
				response += "\nChests opened: " + stats.objectiveBrCacheOpen;
				response += "\nEnemies down (circle 1, 2, 3, 4, 5): " + stats.objectiveBrDownEnemyCircle1 + ", " + stats.objectiveBrDownEnemyCircle2 + ", " + stats.objectiveBrDownEnemyCircle3 + ", " + stats.objectiveBrDownEnemyCircle4 + ", " + stats.objectiveBrDownEnemyCircle5 + " ";
				if (sentMessage)
					sentMessage.edit(response)
				else
					MessageHelper.sendMessage(message, response)
			} catch (error) {
				message.reply(error)
			}
			// MessageHelper.sendMessage(message.channel, response)
		} else {

			try {
				let data = await API.MWBattleData(gamertag, platform);
				// console.log(data)
				let responseString = "Battle Royale stats for <" + gamertag + ">:";
				responseString += "\nWins: " + data.br.wins;
				responseString += "\nKills: " + data.br.kills;
				responseString += "\nDeaths: " + data.br.deaths;
				responseString += "\nK/D Ratio: " + (data.br.kdRatio).toFixed(3);
				responseString += "\nTop 25: " + data.br.topTwentyFive;
				responseString += "\nTop 5: " + data.br.topFive;
				responseString += "\nNumber of Contracts: " + data.br.contracts;
				responseString += "\nTime Played: " + convertTime(data.br.timePlayed);
				responseString += "\nGames Played: " + data.br.gamesPlayed;
				if (sentMessage)
					sentMessage.edit(responseString)
				else
					MessageHelper.sendMessage(message, responseString)
			} catch (error) {
				message.reply(error)
			}

		}
	}
	static async getWeaponContent(message: Message, messageContent: string, isWeekly?: boolean) {
		//Smurf account
		const content = messageContent.split(" ")
		const gamertag = content[0];
		const platform = content[1];
		const weapon = content[2];


		try {
			await API.login("arne.kva@gmail.com", "Mazarini332");
			console.log("here?")
		} catch (error) {
			message.reply("Klarte ikke logge inn")
		}

		try {
			console.log("next try?")
			let data = API.MWwzstats(gamertag, platform).then((response: any) => {
				const weapons = response.lifetime.itemData;
				let maindata;
				console.log(response)
			});
			// console.log(data)
			let responseString = "Battle Royale stats for <" + gamertag + ">:";


			// MessageHelper.sendMessage(message.channel, responseString)
		} catch (error) {
			message.reply(error)
		}

	}

	static readonly getWZStats: ICommandElement = {
		commandName: "br",
		description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
		command: (rawMessage: Message, messageContent: string) => {
			WarzoneCommands.getBRContent(rawMessage, messageContent);
		}
	}
	static readonly getWeeklyWZStats: ICommandElement = {
		commandName: "weekly",
		description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
		command: (rawMessage: Message, messageContent: string) => {
			WarzoneCommands.getBRContent(rawMessage, messageContent, true);
		}
	}
	static readonly getWeaponStats: ICommandElement = {
		commandName: "weapon",
		description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
		command: (rawMessage: Message, messageContent: string) => {
			WarzoneCommands.getWeaponContent(rawMessage, messageContent);
		}
	}

}

function convertTime(seconds: number) {
	let days = Math.floor(seconds / 86400);
	let remainingSeconds = seconds % 86400;
	let hours = Math.floor(remainingSeconds / 3600);
	let remainingSeconds2 = remainingSeconds % 3600;
	let minutes = Math.floor(remainingSeconds2 / 60);
	let timeString = days + "D " + hours + "H " + minutes + "M"
	return timeString;
}

function getMode(mode: string) {
	let gameMode = "";
	switch (mode) {
		case "br":
		case "battleroyale":
		case "battle":
			gameMode = "br";
			break;

		case "pl":
		case "plunder":
			gameMode = "plunder";
			break;

		case "mr":
		case "mini":
			gameMode = "mini";
			break;

		case "resurgence":
		case "rebirth":
		case "rs":
			gameMode = "resurgence";
			break;
		default:
			gameMode = "ugyldig";
			return gameMode;

	}
}