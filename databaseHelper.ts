import { MessageHelper } from "./messageHelper";
import * as cleanTextUtils from 'clean-text-utils';
import { escapeString } from "./textUtils";
import { Spinner } from "./spinner";

const fs = require('fs');

import emojiStrip from 'emoji-strip';
import { write } from "fs";

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
		let rawdata = fs.readFileSync('database.json');
		let allData = JSON.parse(rawdata);
		let isFound = false;
		Object.keys(allData).forEach(function(key1, index) {
			console.log("*******");
			
			console.log(allData[index]);
			console.log(key1);
			if(allData[key1].name == key){
				console.log("was found");
				
				isFound = true;
				allData[prefix] = value;
			}
		});
		if(!isFound){
			console.log("not found");
			
			const data = {
				"name": key,
				[prefix]: value,
			}
			let writeData = JSON.stringify(data);
			fs.writeFileSync('database.json', writeData);
		}

	}

	static async setValueObject(prefix: dbPrefix, key: string, value: any, clb?: () => void ){
		const keyVal = prefix + "-" + key;
		/*try {
				await db.set(keyVal, value)
				/*.then(() => {
					if (clb)
						clb();
				});*/
			} catch () {
				console.log("Klarte ikke sette verdi i databasen. ")
				//if (clb)
				//	clb();
			}
			/*
	}
/**
 * @param prefix - Databaseprefix. Må være av type dbprefix. Nye prefixer MÅ legges til i typen på toppen av databaseHelper.
 * @param key - Nøkkel: Her bruker du vanligvis brukernavn (message.author.username)
 * @param clb - Callback som kjører (med verdien som parameter) etter at verdien er hentet ut. Det er her verdien behandles
 */
	static getValue(prefix: dbPrefix, key: string, clb: (val: string) => void) {
		let rawdata = fs.readFileSync('database.json');
		let allData = JSON.parse(rawdata);
		let valToReturn = "";
		Object.keys(allData).forEach(function(key1) {
			console.log(key1, allData[key]);
			if(allData[key1].name == key)
			valToReturn = allData[prefix];
		});
		return valToReturn;
	};
	static async getValueWithoutPrefix(key: string, clb?: (val: string) => void) {
		let rawdata = fs.readFileSync('database.json');
		let allData = JSON.parse(rawdata);
		let valToReturn = "";
		Object.keys(allData).forEach(function(key1) {
			console.log(key1, allData[key]);
			if(allData[key1].name == key)
			valToReturn = allData[key];
		});
		return valToReturn;
	};



	static deleteValue(key: string, clb?: () => void) {
		//db.delete(key)
		//if (clb)
		//	clb();
		
	}

	//Feil
	static getAllValues(clb: () => void) {
		const keys: string[] = [];
		/*db.JSON().forEach((key: string) => {
			keys.push(key)
		});*/
		return keys;
	}

	static getAllKeysFromPrefix(prefix: dbPrefix){
		const keys: string[] = [];
		let rawdata = fs.readFileSync('database.json');
		let allData = JSON.parse(rawdata);
		Object.keys(allData).forEach(function(key1) {
			console.log(key1, allData[key1]);
			if(!!allData[prefix])
			keys.push(allData[prefix])
		});
		return keys;
		/*return db.JSON(prefix).then((keys: string) => {
			return keys;
		});*/
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













