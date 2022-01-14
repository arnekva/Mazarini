import { dateValPair } from '../commands/dateCommands'
import { userValPair, ValuePair } from '../helpers/databaseHelper'

export class ArrayUtils {
    static sortUserValuePairArray(val: ValuePair[]) {
        val.sort((a, b) => (a.val < b.val ? 1 : -1))
    }

    static sortDateArray(array: Date[]) {
        array.sort((a, b) => a.getTime() - b.getTime())
    }
    static sortDateStringArray(array: dateValPair[]) {
        array.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
    /**
     * Splitter et Valuepair til "key value" med line break på splutten.
     * @param valuePair Paret som skal splittes opp
     * @param formatValue Hvis value skal formatteres, legg ved format funksjonen her (Se ATH Spinner for eksempel)
     * @returns the string
     */
    static makeValuePairIntoOneString(valuePair: ValuePair[], formatValue?: (val: string) => string, header?: string) {
        let str = header ? '***' + header + '***\n' : ''
        valuePair.forEach((val) => (str += val.key + ' ' + (formatValue ? formatValue(val.val) : val.val) + '\n'))
        return str
    }

    /** Get a random object from the array */
    static randomChoiceFromArray(arr: any[]) {
        return arr[Math.floor(arr.length * Math.random())]
    }

    /** Check if array length is at least as large as the given number */
    static checkArgsLength(args: string[], amountWanted: number) {
        return args.length >= amountWanted
    }
    /** Remove one instance of an object from the given array */
    static removeItemOnce(array: any[], value: any) {
        var i = 0
        while (i < array.length) {
            if (array[i] === value) {
                array.splice(i, 1)
            } else {
                ++i
            }
        }
        return array
    }

    /** Remove all instances of a object from the given array */
    static removeItemAll(array: any[], value: any) {
        var index = array.indexOf(value)
        if (index > -1) {
            array.splice(index, 1)
        }
        return array
    }
}
