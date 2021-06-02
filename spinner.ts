import { MessageHelper } from "./messageHelper";
import { Message } from "discord.js";
import { Channel, Client, DMChannel, NewsChannel, TextChannel } from "discord.js";
import { ICommandElement } from "./commands";
import { DatabaseHelper, dbPrefix, userValPair } from "./databaseHelper";
import { getWeekNumber } from "./dateUtils";
import { escapeString } from "./textUtils";
import { getRndInteger, getRndBetween0and100, getRandomPercentage } from "./randomUtils";
import { ArrayUtils} from "./arrayUtils";

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

function didSpinnerBreak(){
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
			MessageHelper.sendMessage(message.channel, message.author.username + " spant fidget spinneren sin i " + min + " minutt og " + sec + " sekund!")
			if(min == 0 && sec == 0){
				MessageHelper.sendMessage(message.channel, "lol du suge")
			} else if(min == 10 && sec == 59){
				MessageHelper.sendMessage(message.channel, "gz bro")
			}
			const formatedScore = Spinner.formatScore(min + sec);
			Spinner.compareScore(message, formatedScore);
			Spinner.incrementCounter(message);
		}
	}

	static async incrementCounter(message: Message) {
		await DatabaseHelper.getValue("counterSpin", message.author.username, (val) => {
			if (val) {
				if (parseInt(val)) {
					let newVal = parseInt(val);
					newVal += 1;
					DatabaseHelper.setValue("counterSpin", message.author.username, newVal.toString(), (success) => {
						if (!success) {
							message.channel.send("Teksten inneholder ulovlige verdier")
						}
					});
				}
			}
			else
				DatabaseHelper.setValue("counterSpin", message.author.username, "1");
		})
	}

	static async compareScore(message: Message, newScore: string) {
		await DatabaseHelper.getValue("spin", message.author.username, (val) => {
			if (val) {
				if (parseInt(val) < parseInt(newScore)) {
					DatabaseHelper.setValue("spin", message.author.username, newScore);
				}
			}
			else
				DatabaseHelper.setValue("spin", message.author.username, newScore);
		})
	}

	static formatScore(score: string) {
		if (score.charAt(0) + score.charAt(1) == "10" && score.length == 3)
			return "100" + score.charAt(2);
		return score.length === 2 ? score.charAt(0) + "0" + score.charAt(1) : score;
	}

	static async listScores(message: Message, isWeeklyReset?: boolean) {
		const weekNumber = getWeekNumber(new Date())[1];
		MessageHelper.sendMessage(message.channel, "*** HIGHSCORE *** for uke " + (isWeeklyReset ? weekNumber - 1 : getWeekNumber(new Date())[1]));
		let scoreList = "";
		const vals = await DatabaseHelper.getAllValuesFromPrefix("spin", (val: userValPair[]) => {
			let scoreList = "";
			if (val.length > 0) {

				// ArrayUtils.sortUserValuePairArray(val)
				val.forEach((el) => {
					/* ATH start
						Linjene under sjekker nåværende highscore opp mot ATH highscore. Hvis ingen ATH eksisterer i DB, oprettes det med nåværende highscore.
					*/
					const currentATH = DatabaseHelper.getValue("ATHspin", el.key, (val) => {
						if (val && parseInt(val)) {
							if (parseInt(val) < parseInt(el.value))
								DatabaseHelper.setValue("ATHspin", el.key, el.value)
						}
						else {
							DatabaseHelper.setValue("ATHspin", el.key, el.value, (success) => {
								// console.log(success)
							})
							console.log("no val, setting ATH to current highscore for " + el.key)
						}
					})
					/*
					ATH END 
					 */

					scoreList += "\n" + el.key + ": " + Spinner.formatValue(el.value)
				})

				MessageHelper.sendMessage(message.channel, scoreList);
				if (isWeeklyReset) {
					let resultText = "\nUkens vinner er: " + val[0].key + "\nUkens taper er: " + val[val.length - 1].key;
					MessageHelper.sendMessage(message.channel, resultText);
				}

			} else {
				MessageHelper.sendMessage(message.channel, "Ingen har spunnet enda!");
			}


		}).then(() => {

			//empty for now
		}).catch((error) => {
			MessageHelper.sendMessage(message.channel, "Noe feilet: " + error);
		})
		// Spinner.sendWinner(message, "")
	}

	static async listSpinCounter(message: Message) {
		MessageHelper.sendMessage(message.channel, "*** Total Antall Spins ***"); // + getWeekNumber(new Date())[1]);

		const vals = await DatabaseHelper.getAllValuesFromPrefix("counterSpin", (val: userValPair[]) => {
			let spinCounterList = "";
			// ArrayUtils.sortUserValuePairArray(val);
			if (val.length > 0) {
				val.forEach((el) => {
					spinCounterList += "\n" + DatabaseHelper.stripPrefixFromString(el.key, "counterSpin",) + ": " + el.value;
				})
				MessageHelper.sendMessage(message.channel, spinCounterList);
			} else {
				MessageHelper.sendMessage(message.channel, "Ingen har spunnet enda!");
			}

		})

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

  static async allTimeHigh(message: Message) {
      	const grid = message.content.replace("!mz ATH ", "")
        let output = "Hei";
      const vals = await DatabaseHelper.getAllValuesFromPrefix("ATHspin", (val: userValPair[]) => { 
				// ArrayUtils.sortUserValuePairArray(val)
         const formattedValues = val.map((value) => 	
          value.key.replace("ATH", "") + ": " + Spinner.formatValue(value.value) + "\n")
        MessageHelper.sendMessage(message.channel, "" + formattedValues.join(""))
      }
      ).catch(error => {
        console.log("Got Error" + error)
        MessageHelper.sendMessage(message.channel, "Fikk error: " + error)
      })
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
					MessageHelper.sendMessage(rawMessage.channel, "Oppdaterte databaseverdi for nøkkel <" + newString[0] + "> med verdi <" + newString[1] + ">.")
				} catch (error) {
					MessageHelper.sendMessage(rawMessage.channel, "Kunne ikke ppdaterte databaseverdi for nøkkel <" + newString[0] + ">. Feilkode: " + error)
				}
			}
		}
	}
}