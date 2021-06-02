import { MessageHelper } from "./messageHelper";
import * as cleanTextUtils from 'clean-text-utils';
import { escapeString } from "./textUtils";
import { Spinner } from "./spinner";

import JSONdb from 'simple-json-db';
const db = new JSONdb('/database.json');
import emojiStrip from 'emoji-strip';

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

}
export type dbPrefix = "spin" | "birthday" | "stock" | "mygling" | "week" | "counterSpin" | "ATHspin" | "sCounterWeeklySpin" | "warningCounter" | "dogeCoin" | "test";

export class DatabaseHelper {

/**
 * @param prefix - Databaseprefix. Må være av type dbprefix. Nye prefixer MÅ legges til i typen på toppen av databaseHelper.
 * @param key - Nøkkel: Her bruker du vanligvis brukernavn (message.author.username)
 * @param value - Verdi som settes i databasen
 * @param clb - (Optional) Callback som kjøres (hvis oppgitt) som sier om det er successfull eller ei
 */
	static async setValue(prefix: dbPrefix, key: string, value: string, clb?: (success: boolean) => void) {
		// const asciiSafe = /^[\x00-\x7FÆØÅæøå]*$/
		// const success = asciiSafe.test(value) && asciiSafe.test(key);
		const keyVal = prefix + "-" + key;
		const strippedValue = emojiStrip(value);
		const success = !!strippedValue.trim(); //Get truthy/falsy value
		if (strippedValue.trim()) {
			try {
				await db.set(keyVal, strippedValue).then(() => {
					if (clb)
						clb(success);
				});
			} catch (error) {
				console.log("Klarte ikke sette verdi i databasen. ")
				if (clb)
					clb(success);
			}
		} else {
			console.log("Nøkkelen feilet: <" + value + ">.")
			if (clb)
				clb(success);
		}

	}

	static async setValueObject(prefix: dbPrefix, key: string, value: any, clb?: () => void ){
		const keyVal = prefix + "-" + key;
		try {
				await db.set(keyVal, value).then(() => {
					if (clb)
						clb();
				});
			} catch (error) {
				console.log("Klarte ikke sette verdi i databasen. ")
				if (clb)
					clb();
			}

	}
/**
 * @param prefix - Databaseprefix. Må være av type dbprefix. Nye prefixer MÅ legges til i typen på toppen av databaseHelper.
 * @param key - Nøkkel: Her bruker du vanligvis brukernavn (message.author.username)
 * @param clb - Callback som kjører (med verdien som parameter) etter at verdien er hentet ut. Det er her verdien behandles
 */
	static getValue(prefix: dbPrefix, key: string, clb: (val: string) => void) {
		let cleanKey = escapeString(key);
		const keyVal = prefix + "-" + cleanKey;
		if (cleanKey) {
			try {
				return db.get(keyVal).then((value: string) => {
					if (clb) {
						clb(value)
					}
				})
			} catch (error) {
				console.log("Klarte ikke hente verdi fra databasen. Stacktrace: " + error)
				return undefined;
			}
		}
		else {
			console.log("Nøkkelen er tom: <" + cleanKey + ">. Dette kan være forsårsaket av at brukernavnet er helt tomt.")
			return undefined;
		}
	};
	static async getValueWithoutPrefix(key: string, clb?: (val: string) => void) {
		try {
			return await db.get(key);
		} catch (error) {
			console.log("Pøvde å hente data for nøkkel <" + key + ">, men dataen er feilformattert.")
			// sendToErrorChannel("Pøvde å hente data for nøkkel  <" + key + ">, men dataen er feilformattert.")
			return "*<feilformattert data>*";
		}
	};



	static deleteValue(key: string, clb?: () => void) {
		db.delete(key).then(() => {
			if (clb)
				clb();
		});
	}

	//Feil
	static getAllValues(clb: () => void) {
		const keys: string[] = [];
		db.JSON().forEach((key: string) => {
			keys.push(key)
		});
		return keys;
	}

	static getAllKeysFromPrefix(prefix: dbPrefix){
		const keys: string[] = [];
		db.JSON().forEach((key: string) => {
			keys.push(key)
		});
		return keys;
		return db.JSON(prefix).then((keys: string) => {
			return keys;
		});
	}
	// https://replit.com/talk/learn/Replit-DB/43305
	//BARE FOR SPIN
	static async getAllValuesFromPrefix(prefix: dbPrefix, clb: (val: userValPair[]) => void) {
		/*
		const list = await db.list(prefix).then((val: string) => {
			const nameList = val.split("\n")

			const promiseList: any[] = [];
			nameList.forEach((el: string) => {
				promiseList.push(DatabaseHelper.getValueWithoutPrefix(el))
			})
			Promise.all(promiseList).then(
				(result: any) => {
					let userValueList: userValPair[] = [];

					promiseList.forEach((el: string, index: number) => {

						const name = DatabaseHelper.stripPrefixFromString(nameList[index], "spin")
						if (name !== "Arne#1111")
							userValueList.push({ key: name, value: result[index] })

					})
					
					userValueList.sort((a, b) => (parseInt(a.value) < parseInt(b.value)) ? 1 : -1)
					clb(userValueList)
				});
		})
		*/
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
export interface Score {
	key: string;
	val: string;
}













