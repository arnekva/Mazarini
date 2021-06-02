import { Message, User, TextChannel } from "discord.js";
import { ICommandElement } from "./commands";
import { DatabaseHelper, userValPair } from "./databaseHelper";
import { MessageHelper } from "./messageHelper";
import { findLetterEmoji } from "./miscUtils"
import { bonkMemeUrls } from "./globals"

export class JokeCommands {

	static async vaskHuset(message: Message) {
		await MessageHelper.sendMessage(message.channel, Math.random() < 0.5 ? "Øyvind, vask huset!" : "Fin klokka")

	}

	static async kLikka(message: Message) {
		await MessageHelper.sendMessage(message.channel, Math.random() < 0.95 ? "Han " + (Math.random() < 0.5 ? "skææææææm" : "") + "trunte på vei te buen " : "kLikka")

	}

	static async thomasTing(message: Message) {
		await MessageHelper.sendMessage(message.channel, Math.random() < 0.5 ? "Har fese!" : (Math.random() < 0.5) ? "Hæ, Erlend Navle?" : "Roe kebaben sin")

	}

	static async eivind(message: Message) {
		await MessageHelper.sendMessage(message.channel, Math.random() < 0.5 ? "Leke me fyrstikker :3" : "Blei busta av Mamma med fyrstikker :S")

	}

	static async isMaggiPlaying(message: Message) {
		const guild = message.channel.client.guilds.cache.get("340626855990132747");
		if (guild) {
			const maggi = guild.members.cache.get("221739293889003520")
			if (maggi) {
				// await MessageHelper.sendMessage(message.channel, "Han leve")
				if (maggi.presence.clientStatus) {
					if (maggi.presence.activities && maggi.presence.activities[0]) {
						const game = maggi.presence.activities[0].name == "Custom Status" ? maggi.presence.activities[1] : maggi.presence.activities[0];
						if (game && maggi.presence.clientStatus.desktop) {
							if (game.name == "Visual Studio Code") {
								await MessageHelper.sendMessage(message.channel, "Han har Visual Studio Code åpent! Han jobbe faktisk med masteren!")
							}
							else if (maggi.presence.clientStatus.desktop == "online") {
								await MessageHelper.sendMessage(message.channel, "Ja Magnus, kordan går det med masteren? Ser du spele *" + game.name + "*.")
							} else if (maggi.presence.clientStatus.desktop == "idle") {
								await MessageHelper.sendMessage(message.channel, "Maen e idle akkurat nå, men det kan ver han spele *" + game.name + "* fordeom.")
							} else if (maggi.presence.clientStatus.desktop == "dnd") {
								await MessageHelper.sendMessage(message.channel, "Maen har Do Not Disturb på, mens han spele *" + game.name + "*. Må la an ver i fred >:(")
							}
						} else {
							if (maggi.presence.clientStatus.mobile) {
								await MessageHelper.sendMessage(message.channel, "Han har Discord åpent på telefonen, så han game nok ikkje.")
							} else if (maggi.presence.clientStatus.web) {
								await MessageHelper.sendMessage(message.channel, "Ser ut som om han besøker Discord fra nettleseren? Wtf")
							} else if (maggi.presence.clientStatus.desktop) {
								await MessageHelper.sendMessage(message.channel, "Han er på PC-en, men gjør ingenting akkurat nå. ")
							}
						}
					}
					else {
					await MessageHelper.sendMessage(message.channel, "Ingen aktivitet registrert på Discord. Sover han? Drikker han? Begge deler samtidig? ")
				}
				} else {
					await MessageHelper.sendMessage(message.channel, "Magnus er ikke online. Da sover han mest sannsynlig. Kødda, han får ikke sove med alt bråket fra byggeplassen kekw")
				}
			} else {
				await MessageHelper.sendMessage(message.channel, "Ingen bruker med id '221739293889003520' er registrert på serveren. Har Maggi rage quitta?")
			}
		}
	}


	static async updateMygleStatus(message: Message, messageContent: string) {
		const regex = new RegExp(/(?<=\<)(.*?)(?=\>)/ig)
		let content = messageContent;
		const matchedUsrname = content.match(regex);
		if (matchedUsrname) {
			const id = matchedUsrname.forEach(
				(el, index) => {
					const mentionedId = el.replace("@!", "")
					message.mentions.users.forEach(
						(el) => {
							if (mentionedId == el.id) {
								const replaceThis = "<" + matchedUsrname[index] + ">"
								content = content.replace(replaceThis, el.username)
							}
						})
				});
		};

		if (content.length < 150) {
			DatabaseHelper.setValue("mygling", message.author.username, content, (success) => {
				if (!success)
					message.channel.send("Meldingen inneholder ulovlige tegn.")
				else{
					let emoji = "";
					const randInt = Math.random();
					if(randInt <= 0.3)
					emoji = "👍"
					else if( randInt <= 0.4)
					emoji ="🤙"
					else if(randInt <= 0.5)
					emoji ="🙌"
					else if(randInt <= 0.6)
					emoji = "🤔"
					else if(randInt <= 0.7)
					emoji = "🙏"
					else if(randInt <= 0.8)
					emoji = "💩"
					else if(randInt <= 0.9)
					emoji = "👏"
					else if(randInt > 0.9)
					emoji = "👌"
					else
					emoji = "🖕" //Failsafe?

					message.react(emoji)
				}
			});

		}
		else {
			MessageHelper.sendMessage(message.channel, "Du kan kje mygla så møye. Mindre enn 150 tegn, takk");
		}
	}
	static async getAllMygleStatus(message: Message) {
		const vals = await DatabaseHelper.getAllValuesFromPrefix("mygling", (val: userValPair[]) => {
			if (val.length > 0 && val[0].value !== null) {
				// const nameList = val.split("\n")
				let mygleListe = "";
				val.forEach((el) => {
					mygleListe += "\n" + el.key.replace("mygling-", "") + " " + el.value;
				})
				MessageHelper.sendMessage(message.channel, mygleListe);
			} else
				MessageHelper.sendMessage(message.channel, "Ingen så mygle ennå");
		}).then(() => {

		})
	}
	static async countdownToDate(message: Message) {
		let sendThisText = "";
		const total = new Date(2021, 5, 1, 6).getTime() - new Date().getTime();
		const seconds = Math.floor((total / 1000) % 60);
		const minutes = Math.floor((total / 1000 / 60) % 60);
		const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
		const days = Math.floor(total / (1000 * 60 * 60 * 24));
		if(total > 0)
		sendThisText += ( "Det er " + days + (days != 1 ? " dager, " : " dag, ") + hours + (hours > 1 ? " timer, " : " time, ") + minutes + " minutter og " + seconds + " sekunder til Arne skal inn i HV! :(")
		else 
		sendThisText += "\n" + ( "Arne er nå i HV :)")
		const total3 = new Date(2021, 5, 1, 10).getTime() - new Date().getTime();
		const seconds3 = Math.floor((total3 / 1000) % 60);
		const minutes3 = Math.floor((total3 / 1000 / 60) % 60);
		const hours3 = Math.floor((total3 / (1000 * 60 * 60)) % 24);
		const days3 = Math.floor(total3 / (1000 * 60 * 60 * 24));
			if(total3 > 0)
		sendThisText += "\n" +("Det er " + days3 + (days3 != 1 ? " dager, " : " dag, ") + hours3 + (hours3 > 1 ? " timer, " : " time, ") + minutes3 + " minutter og " + seconds3 + " sekunder igjen av Eivind sin master!")
		else 
		sendThisText += "\n" + ("Eivind har levert masteren sin :)")
		const total2 = new Date(2021, 5, 15, 10).getTime() - new Date().getTime();
		const seconds2 = Math.floor((total2 / 1000) % 60);
		const minutes2 = Math.floor((total2 / 1000 / 60) % 60);
		const hours2 = Math.floor((total2 / (1000 * 60 * 60)) % 24);
		const days2 = Math.floor(total2 / (1000 * 60 * 60 * 24));
		if(total2 > 0)
		sendThisText += "\n" + ("Det er " + days2 + " dager, " + hours2 + " timer, " + minutes2 + " minutter og " + seconds2 + " sekunder igjen av Magnus sin master!")
		else
		sendThisText += "\n" + ("Magnus har levert masteren sin :)")

		MessageHelper.sendMessage(message.channel, sendThisText)
	}

	/**
	 * Denne funksjonen fungerer ikke, siden den krever Node v12 eller høyere. Repl.it kjører bare v10.24
	 */
	static async eivindprideItAll(message: Message) {
		try {
			const channel = message.channel as TextChannel;
			if (message.client) {
				//channel.messages.fetch({ limit: 15,  }, true, true).then((el) => {
				//})
			}
		} catch (error) {
			console.log(error);
		}
		if (message.guild) {
			const react = message.guild.emojis.cache.find(emoji => emoji.name == "eivindpride")
			if (react) {
			}
		}
	}
	/** 
	 * String sent must not contain repeat characters 
	 */
	static async reactWithLetters(message: Message, msgContent: string, args: string[] | undefined){
		console.log(args)
		const splitTab = msgContent.split(" ");
		let msgId = "";
		let letterTab: string[] = []

		for(let i = 0; i<splitTab.length; i++){
			if(splitTab[i].length > 10 && parseInt(splitTab[i]))
			msgId = splitTab[i];
			else {
				const newWord = (i == 0 ? "" : " ") + splitTab[i];
				letterTab = letterTab.concat(newWord.split(""))
			}
		}

		let messageToReactTo = message;
		if(msgId){
			let searchMessage = await MessageHelper.findMessageById(message, msgId)
			if(searchMessage)
				messageToReactTo = searchMessage;
		}

		let usedLetter = "";
		let spaceCounter = 0;
		letterTab.forEach((letter: string) => {
			if(usedLetter.includes(letter) && letter == " "){
				spaceCounter++;
			}
			const emoji = usedLetter.includes(letter) ? findLetterEmoji(letter, true, spaceCounter) : findLetterEmoji(letter)
			usedLetter += letter
			messageToReactTo.react(emoji)
		})
	}
	
	//TODO: Finish this, currently doesnt send message. Missing some ascii emojies to concat in front and end
	static async uWuIfyer(message: Message, msgContent: string){
		const msgToUwU = await MessageHelper.findMessageById(message, msgContent) ?? "";
		msgToUwU.replace("r", "w").replace("l", "w").concat("(´・ω・｀)")
	}

	static async sendBonk(message: Message){
		const img = bonkMemeUrls[Math.floor(Math.random() * bonkMemeUrls.length)]
		MessageHelper.sendMessage(message.channel, img)
	}

	/*
	COMMAND ELEMENTS START

	*/
	static readonly roggaVaskHuset: ICommandElement = {
		commandName: "øyvind",
		description: "Vask huset maen. Og husk å vask den fine klokkå",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.vaskHuset(rawMessage);
		}
	}
	static readonly bonkSender: ICommandElement = {
		commandName: "bonk",
		description: "Send en bonk meme",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.sendBonk(rawMessage);
		}
	}
	static readonly reactWithWord: ICommandElement = {
		commandName: "spell",
		description: "Stav ut en setning som emojier i reactions. Syntax: <ord/setning> <(optional) message-id>. Ordet bør ikke inneholde repeterte bokstaver; kun ABCIMOPRSTVX har to versjoner og kan repeteres. Hvis ingen message id gis reagerer den på sendt melding. ",
		command: (rawMessage: Message, messageContent: string, args: string[] | undefined) => {
			JokeCommands.reactWithLetters(rawMessage, messageContent, args);
		}
	}
	static readonly masterCountdown: ICommandElement = {
		commandName: "master",
		description: "Se hvor lenge det er igjen før Magnus og Eivind må levere masteren sin",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.countdownToDate(rawMessage);
		},
		deprecated: "countdown"
	}
	static readonly countdown: ICommandElement = {
		commandName: "countdown",
		description: "Se hvor lenge det er igjen",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.countdownToDate(rawMessage);
		},
	}
	static readonly mygleStatus: ICommandElement = {
		commandName: "status",
		description: "Sett din status",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.updateMygleStatus(rawMessage, messageContent);
		}
	}
	static readonly getAllMygling: ICommandElement = {
		commandName: "statuser",
		description: "Mygles det?",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.getAllMygleStatus(rawMessage);
		}
	}
	static readonly thomasFese: ICommandElement = {
		commandName: "thomas",
		description: "Thomas svarer alltid ja",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.thomasTing(rawMessage);
		}
	}
	static readonly deadmaggi: ICommandElement = {
		commandName: "maggi",
		description: "Går det egentlig bra med masteren te Magnus?",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.isMaggiPlaying(rawMessage);
		}
	}
	static readonly eivindSkyld: ICommandElement = {
		commandName: "eivind",
		description: "Eivind sin feil",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.eivind(rawMessage);
		}
	}
	static readonly elDavido: ICommandElement = {
		commandName: "david",
		description: "nå klikke det snart",
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.kLikka(rawMessage);
		}
	}
	static readonly eivndPrideCommand: ICommandElement = {
		commandName: "eivindpride",
		description: "Eivindpride it. Eivindpride it ALL. (Virker ikke)",
		hideFromListing: true,
		command: (rawMessage: Message, messageContent: string) => {
			JokeCommands.eivindprideItAll(rawMessage);
		}
	}
}
