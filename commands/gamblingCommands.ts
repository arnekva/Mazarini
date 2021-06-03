
import { Message } from "discord.js";
import { Channel, Client, DMChannel, NewsChannel, TextChannel } from "discord.js";
import { dbPrefix } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";



export class GamblingCommands {

	//Todo: Add mz startPoll
	//Todo: Add mz endPoll
	//TOdo: Fikse coins converter
	//Todo: Add Butikk
	//!mz addcoins arne 2000
	static async manageCoins(message: Message, messageContent: string, isRemove?: boolean) {
		const content = messageContent.split("-v"); //V for value (:
		const username = content[0].trim();
		let value = "";
		const newCont = content.slice(1)
		newCont.forEach((el) => value += el.trim())
		console.log("Adding dogeCoins <" + value + "> for key <" + username + ">")
		// await DatabaseHelper.getValue("dogeCoin", username, (val) => {
		// 	if (val) {
		// 		if (parseInt(val)) { // <- do it there
		// 			let newVal = isRemove ? parseInt(val) - parseInt(value) : parseInt(val) + parseInt(value);
		// 			DatabaseHelper.setValue("dogeCoin", username, newVal.toString(), (success) => {
		// 				if (!success) {
		// 					message.channel.send("Teksten inneholder ulovlige verdier")
		// 				}
		// 				else {
		// 					MessageHelper.sendMessage(message.channel, isRemove ? "DogeCoins removed" : "DogeCoins Added!")
		// 				}
		// 			});
		// 		}
		// 		else {
		// 			MessageHelper.sendMessage(message.channel, "Plz use norwegian tall.")
		// 		}
		// 	}
		// 	else {
		// 		MessageHelper.sendMessage(message.channel, "Brukeren suger, han har ikke tall")
		// 	}

		// })
	}

	static async removeCoins(message: Message, messageContent: string) {
		const content = messageContent.split("-v"); //V for value (:
		const username = content[0].trim();
		let value = "";
		const newCont = content.slice(1)
		newCont.forEach((el) => value += el.trim())
		console.log("Removing dogeCoins <" + value + ">")
		// await DatabaseHelper.getValue("dogeCoin", username, (val) =>{ 
		//     if (val) {
		// 			  if (parseInt(val)) { // <- do it there
		//         if(parseInt(val) < parseInt(value)){
		// 				    let newVal = parseInt(val) - parseInt(value);
		// 				    DatabaseHelper.setValue("dogeCoin", username, newVal.toString(), (success) => {
		// 					    if (!success) {
		// 						    message.channel.send("Teksten inneholder ulovlige verdier")
		// 					    }
		// 				    });
		//         }
		//         else{
		// 			      MessageHelper.sendMessage(message.channel, "User has to few DogeCoins to remove.")
		//         }
		// 			  }
		//       else{
		//         MessageHelper.sendMessage(message.channel, "Plz use norwegian tall.")
		//       }
		// 		  }


		// }) 
		await MessageHelper.sendMessage(message.channel, "DogeCoins removed!")
	}

	static async checkCoins(message: Message, messageContent: string) {
		const content = messageContent.split(" ");
		const prefix = content[0] as dbPrefix;
		const key = "dogeCoin";
		// const val = await DatabaseHelper.getValue("dogeCoin", prefix, (val) => {
		// 	if (val)
		// 		MessageHelper.sendMessage(message.channel, val)
		// 	else
		// 		MessageHelper.sendMessage(message.channel, "Ingen verdi funnet for nøkkel <" + key + "> med prefix <" + prefix + ">")
		// })
	}

	static readonly addCoinsCommand: ICommandElement = {
		commandName: "addcoins",
		description: "Add coins to person",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			GamblingCommands.manageCoins(rawMessage, messageContent);
		}
	}
	static readonly removeCoinsCommand: ICommandElement = {
		commandName: "removecoins",
		description: "Remove coins from person",
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			GamblingCommands.manageCoins(rawMessage, messageContent, true);
		}
	}
	static readonly checkCoinsCommand: ICommandElement = {
		commandName: "checkcoins",
		description: "Check coins on a person",
		command: (rawMessage: Message, messageContent: string) => {
			GamblingCommands.checkCoins(rawMessage, messageContent);
		}
	}

}