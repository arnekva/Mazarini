import { Channel, GuildMember, Message, TextChannel } from "discord.js";
import { ICommandElement } from "../commands/commands";
import { DatabaseHelper, dbPrefix } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { isInQuotation } from "../utils/textUtils";


export class Admin {

	static readonly command: ICommandElement = {
		commandName: "debug",
		description: "For testing. Resultat vil variere. ",
		hideFromListing: true,
		isAdmin: true,
		command: async (rawMessage: Message, messageContent: string) => {
			await DatabaseHelper.setValue("stock", rawMessage.author.id, rawMessage.content.replace("!mz debug ", ""))
			const x = await DatabaseHelper.getValue("stock", rawMessage.author.id, rawMessage)

		}

	}
	static setSpecificValue(message: Message, messageContent: string) {
		//setValueObject
		const content = messageContent.split(" ");
		const prefix = content[0] as dbPrefix;
		const key = content[1];

		let value = "";
		const newCont = content.slice(2)
		newCont.forEach((el) => value += el + " ")
		DatabaseHelper.setValue(prefix, key, value);
	}
	static setSpinValue(message: Message, messageContent: string) {

		const content = messageContent.split(" ");
		const key = content[0] as dbPrefix;
		let value = "";
		const newCont = content.slice(1)
		newCont.forEach((el) => value += el.trim())
		console.log("Setting spin <" + value + ">")
		DatabaseHelper.setValue("ATHspin", key, value)
	}
	static deleteSpecificValue(message: Message, messageContent: string) {
		const cmdSplit = messageContent.split(" ");
		const prefix = cmdSplit[0];
		const key = cmdSplit[1];
		const keyToDelete = prefix + "-" + key;
		//TODO:
		// DatabaseHelper.deleteValue(keyToDelete, () => {
		// 	MessageHelper.sendMessage(message.channel, "Slettet nøkkel <" + keyToDelete + ">.")

		// })

	}

	static async getSpecificValue(message: Message, messageContent: string) {

		const content = messageContent.split(" ");
		const prefix = content[0] as dbPrefix;
		const key = content[1];
		const val = await DatabaseHelper.getValue(prefix, key, message)

	}


	static async replyToMsgAsBot(rawMessage: Message, content: string) {

		const allChannels = rawMessage.client.channels.cache.array().filter(channel => channel instanceof TextChannel) as TextChannel[];

		const id = content.substr(0, content.indexOf(" "));
		// const id = c[0].trim();
		const replyString = content.substr(content.indexOf(" ") + 1);
		allChannels.forEach((channel: TextChannel) => {
			if (channel) {
				channel.messages.fetch(id).then(async message => {
					if (message.guild) {

						message.reply(replyString)

					}
				}).catch((error) => {
					//Catch thrown error
				})
			}

		})
	}
	static async reactToMsgAsBot(rawMessage: Message, content: string) {
		/*
			For å sleppe å måtte sende med channel id for meldingen (kun id på selve meld) så må man loope gjennom alle channels på leting. 
		*/
		//Filter out non-text channel and cast as TextChannel
		const allChannels = rawMessage.client.channels.cache.array().filter(channel => channel instanceof TextChannel) as TextChannel[];


		const c = content.split(" ");
		const id = c[0].trim();
		const emojiString = c[1];
		if (!!id && !!emojiString) {

			allChannels.forEach((channel: TextChannel) => {
				if (channel) {
					channel.messages.fetch(id).then(async message => {
						if (message.guild) {

							const reactionEmoji = await message.client.emojis.cache.find(emoji => emoji.name == emojiString)
							if (reactionEmoji)
								message.react(reactionEmoji)

							else {
								try {
									message.react(emojiString)
								} catch (error) {
									message.reply("dette gjekk te helvette. Stacktrace: " + error)
								}
							}
						}
					}).catch((error) => {
						//Catch thrown error
					})
				}

			})
		} else {
			MessageHelper.replyFormattingError(rawMessage, "<message id> <emoji navn>")
		}
	}
	static async sendMessageAsBotToSpecificChannel(message: Message) {
		const channelOld = message.channel;
		const content = message.content.replace("!mz send ", "")
		const splitList = content.split("-m")
		if (splitList[0] && splitList[1])
			MessageHelper.sendMessageToSpecificChannel(splitList[0], splitList[1], message.channel as TextChannel)
		else
			message.reply("Formatteringen er feil")
	}

	static async warnUser(message: Message, messageContent: string) {
        let username = messageContent.substr(0, messageContent.indexOf(" "))
        if(messageContent.includes('"')){
            username = isInQuotation(messageContent);
        }
		// const username = messageContent.substr(0, messageContent.indexOf(" "));
        
		const user = DatabaseHelper.findUserByUsername(username, message);// message.client.users.cache.find(user => user.username == username);
		// const id = c[0].trim();
        
		const replyString = messageContent.substr(messageContent.indexOf(username) + username.length+2);
		if (user) {
			if (user.username == message.author.username) {
				message.reply("Du kan kje warna deg sjøl, bro")
				return;
			}
			const userWarnings = DatabaseHelper.getValue("warningCounter", user.username, message);
			console.log(userWarnings);

			if (!isNaN(userWarnings)) {
				let newVal = parseInt(userWarnings)
				newVal += 1;
				DatabaseHelper.setValue("warningCounter", user.username, newVal.toString());
				MessageHelper.sendMessage(message, user.username + ", du har fått en advarsel. Du har nå " + newVal + " advarsler.")
				//Send msg to action-log
				MessageHelper.sendMessage(message, "", true, message.author.username + " ga en advarsel til " + user.username + " på grunn av: " + replyString + ". " + user.username + " har nå " + newVal + " advarsler", "warning")

			} else {
				MessageHelper.sendMessageToActionLog(message.channel as TextChannel, "Verdien for warningcounter er NaN: <" + userWarnings + ">.")
				message.reply("klarte ikke å øke warning counteren for " + user.username + ". Hendelsen er loggført.")

			}
		} else {
			MessageHelper.sendMessage(message, 'Feil: Du har enten skrevet feil bruker navn eller ikke inkludert en melding. *Hvis brukeren har mellomrom i navnet, bruk "hermetegn"*')
		}
	}

	static readonly deleteValFromPrefix: ICommandElement = {
		commandName: "deletekeys",
		description: "Slett alle databasenøkler og tilhørende verdier for den gitte prefixen (Virker ikke)",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			const prefix = rawMessage.content.replace("!mz deletekeys ", "") as dbPrefix;
			DatabaseHelper.deleteSpecificPrefixValues(prefix);
		}
	}
	static readonly deleteSpecificKey: ICommandElement = {
		commandName: "deletekey",
		description: "Slett en gitt nøkkel med oppgitt prefix. <prefix> <nøkkel> (Virker ikke)",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.deleteSpecificValue(rawMessage, messageContent);
		}
	}
	static readonly sendMsgAsBot: ICommandElement = {
		commandName: "send",
		description: "send en melding som boten. <channel id> -m <melding>",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.sendMessageAsBotToSpecificChannel(rawMessage);
		}
	}
	static readonly reactToMsg: ICommandElement = {
		commandName: "react",
		description: "reager på en melding som botten. <message id> <emoji>",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.reactToMsgAsBot(rawMessage, messageContent);
		}
	}
	static readonly replyToMsg: ICommandElement = {
		commandName: "reply",
		description: "reager på en melding som botten.",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.replyToMsgAsBot(rawMessage, messageContent);
		}
	}
	static readonly setVal: ICommandElement = {
		commandName: "setvalue",
		description: "Sett en spesifikk verdi i databasen. <prefix> <nøkkel> <verdi>",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.setSpecificValue(rawMessage, messageContent);
		}
	}
	static readonly setSpinVal: ICommandElement = {
		commandName: "setspin",
		description: "Sett en spin score for en bruker. <nøkkel> <verdi>",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.setSpinValue(rawMessage, messageContent);
		}
	}
	static readonly getVal: ICommandElement = {
		commandName: "getvalue",
		description: "Hent en spesifikk verdi i databasen. <prefix> <nøkkel> ",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.getSpecificValue(rawMessage, messageContent);
		}
	}
	static readonly warnUserCommand: ICommandElement = {
		commandName: "warn",
		description: "Gi en advarsel til en bruker. <nøkkel> <grunn> ",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			Admin.warnUser(rawMessage, messageContent);
		}
	}


	static isAuthorAdmin(member: GuildMember | null) {
		// member.roles.cache.some(role => role.name === "Mazarini-Bot-Admin")
		if (member)
			return member.roles.cache.has("821709203470680117");
		return false
	}
	static isAuthorSuperAdmin(member: GuildMember | null) {
		// member.roles.cache.some(role => role.name === "Mazarini-Bot-Admin")
		if (member)
			return member.id == "245607554254766081";
		return false
	}
}