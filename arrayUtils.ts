import { userValPair } from "./databaseHelper";

export class ArrayUtils {
static sortUserValuePairArray(val: userValPair[]){
	val.sort((a, b) => (a.value < b.value) ? 1 : -1)
}
}
