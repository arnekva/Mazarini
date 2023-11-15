import { dateValPair } from '../commands/dateCommands'
import { ValuePair } from '../interfaces/database/databaseInterface'
import { RandomUtils } from './randomUtils'

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
    static randomChoiceFromArray<T>(arr: T[]) {
        const randomNumber = RandomUtils.getRandomInteger(0, arr.length - 1)
        return arr[randomNumber] as T
    }

    /** Check if array length is at least as large as the given number */
    static checkArgsLength(args: string[], amountWanted: number) {
        return args.length >= amountWanted
    }
    /** Remove one instance of an object from the given array */
    static removeItemOnce<T>(array: T[], value: any) {
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

    /** Will remove all duplicates from an array. Creates a set from the array and turns that set back into an array. Note that this does not manipulate original object */
    static removeAllDuplicates<T>(array: T[]) {
        const uniq = [...new Set(array)]
        return uniq as T[]
    }

    static kanIkkjeTekster(hasEg?: boolean): string[] {
        const obj = hasEg ? `du` : 'han'
        return [
            `kan ikkje, får kje lov av farsin :(`,
            `kan ikkje, ${obj} skamtrunte på vei te buen`,
            `kan ikkje, fekk husarrest for å leka me fyrstikker`,
            `kan faktisk, ${obj} fekk lo... ånei kødda, mamma seie nei aligavel`,
            `kan ikkje, ${obj} ska spisa pistasj :3`,
            `kan seff, maen e alltid klar for smellen på quellen`,
            `kan kje, mamma e så streng :(`,
            `kan, men ${obj} e kje klar før jæskla seint på quellen`,
            `får lov, men må ver hjemma før klokkå 9 hvis ikkje får ${obj} kje middag imårå`,
        ]
    }
}
