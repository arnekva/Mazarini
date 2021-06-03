import { userValPair, ValuePair } from "../helpers/databaseHelper";

export class ArrayUtils {
	static sortUserValuePairArray(val: ValuePair[]) {
		val.sort((a, b) => (a.val < b.val) ? 1 : -1)
	}
	/**
	 * Splitter et Valuepair til "key value" med line break på splutten.
	 * @param valuePair Paret som skal splittes opp
	 * @param formatValue Hvis value skal formatteres, legg ved format funksjonen her (Se ATH Spinner for eksempel)
	 * @returns 
	 */
	static makeValuePairIntoOneString(valuePair: ValuePair[], formatValue?: (val: string) => string, header?: string) {
		let str = header ? "***" + header + "***\n" : "";
		valuePair.forEach((val) => str += val.key + " " + (formatValue ? formatValue(val.val) : val.val) + "\n");
		return str;
	}
}
