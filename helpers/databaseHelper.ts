import { MessageHelper } from "./messageHelper";
import * as cleanTextUtils from 'clean-text-utils';
import { escapeString } from "../utils/textUtils";


//https://openbase.com/js/node-json-db
import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
const db = new JsonDB(new Config("myDataBase", true, true, '/'));
const folderPrefix = "/users";
import emojiStrip from 'emoji-strip';
import { write } from "fs";
import { exception } from "console";
import { achievementIDs } from "../commands/achievements";
import { Message } from "discord.js";

//const db = new Database()
/**
 * Denne kan senere utvides. Bruker for å passe på at alle verdier som skal inn i databasen samsvarer
 */
export interface userValPair {
	key: string,
	value: string,
	opt?: any,
}

export interface dbObject {
	name: string,

}

export type dbPrefix = "spin" | "birthday" | "stock" | "mygling" | "week" | "counterSpin" | "ATHspin" | "sCounterWeeklySpin" | "warningCounter" | "dogeCoin" | "test" | "achievement" | "bonkCounter" | "lastFmUsername";

export class DatabaseHelper {

	/**
	 * @param prefix - Databaseprefix. Må være av type dbprefix. Nye prefixer MÅ legges til i typen på toppen av databaseHelper.
	 * @param key - Nøkkel: Her bruker du vanligvis brukernavn (message.author.username)
	 * @param value - Verdi som settes i databasen
	 */
	static setValue(prefix: dbPrefix, key: string, value: string) {

		db.push(`${folderPrefix}/${key}/${prefix}`, `${value}`)

	}
	static setAchievementObject(prefix: dbPrefix, key: string, achievementID: achievementIDs, value: any) {

		db.push(`${folderPrefix}/${key}/${prefix}/${achievementID}`, `${value}`)

	}
	static getAchievement(prefix: dbPrefix, key: string, achievementID: achievementIDs) {
		let data;
		try {
			data = db.getData(`${folderPrefix}/${key}/${prefix}/${achievementID}`);
		} catch (error) {
			//No data;
		}
		return data;

	}
	/** For missing folders, like achievement, you can add them using this */
	static addUserFolder(key: string, prefix: dbPrefix) {
		db.push(`${folderPrefix}/${key}/${prefix}`, {})
	}



	/**
	 * 
	 * @param prefix Databaseprefix - Verdien fra brukeren du er ute etter
	 * @param key Brukernavn
	 * @param message Message objekt er nødvendig for å kunne gi finne brukere
	 * @param noInsertions FUnksjonen oppretter en tom verdi hvis den ikke eksisterer. Sett denne true dersom den IKKE skal opprette default verdi hvis den ikke finnes
	 * @returns 
	 */
	static getValue(prefix: dbPrefix, key: string, message: Message, noInsertions?: boolean) {
		try {
			const data = db.getData(`${folderPrefix}/${key}/${prefix}`)
			return data;
		} catch (error) {
			if (noInsertions)
				return "";

			const val = DatabaseHelper.valueToPush(prefix);
			if (DatabaseHelper.findUserByUsername(key, message))
				db.push(`${folderPrefix}/${key}/${prefix}`, val)
			else {
				message.reply("brukeren finnes ikke")
				return undefined;
			}
			return "0";
		}

	};

	static valueToPush(prefix: dbPrefix) {
		if (prefix === "achievement")
			return {}
		else if (prefix === "spin" || prefix == "ATHspin")
			return "00"
		else
			return "0";
	}

	static async getAllUsers() {
		return db.getData("/users");
	};


	static deleteSpecificPrefixValues(prefix: dbPrefix) {
		const users = db.getData(`${folderPrefix}`);
		Object.keys(users).forEach((el) => {
			db.delete(`${folderPrefix}/${el}/${prefix}`)
		})
	}

	static findUserByUsername(username: string, rawMessage: Message) {
		return rawMessage.client.users.cache.find(user => user.username == username);
	}
	static findUserById(id: string, rawMessage: Message) {
		return rawMessage.client.users.cache.find(user => user.id == id);
	}





	/**
	 * FIXME: This abomination
	 * Ser gjennom alle brukere og sammenligner 1 med 2. Hvis 2 er større, setter funksjonen 1 = 2;
	 * Unnskyld fremtidige mennesker som ska prøva å tyda dette her.  
	 * @param prefix1 Compare
	 * @param prefix2 Compare
	 */
	static compareAndUpdateValue(prefix1: dbPrefix, prefix2: dbPrefix) {
		const users = db.getData(`${folderPrefix}`);
		Object.keys(users).forEach((el) => {
			Object.keys(users[el]).forEach((el2) => {
				if (el2 == prefix1) {
					Object.keys(users[el]).forEach((el4) => {
						if (el4 == prefix2) {
							if (users[el][el2] < users[el][el4]) {
								DatabaseHelper.setValue(prefix1, el, users[el][el4])
							}
						}
					})
				}
			})
		})
	}

	static getAllValuesFromPrefix(prefix: dbPrefix, message: Message) {
		const users = db.getData(`${folderPrefix}`);
		const valueList: ValuePair[] = [];
		Object.keys(users).forEach((el) => {
			const val = DatabaseHelper.getValue(prefix, el, message, true);
			//FIXME: Test this more?
			if (val)
				valueList.push({ key: el, val: val })
		})
		return valueList;
	}
	static async nukeDatabase() {
		/*await db.empty().then(() => {
			console.log("Database slettet. Alle verdier er fjernet.")
		})*/
	}

	static stripPrefixFromString(text: string, prefix: dbPrefix) {
		return text.replace(prefix + "-", "");
	}
}
export interface ValuePair {
	key: string;
	val: string;
}
export interface ValuePair {
	key: string;
	val: string;
}
export interface prefixVal {
	anyName: string;
}













