import { dateValPair } from '../commands/dateCommands'
import { ValuePair } from '../interfaces/database/databaseInterface'
import { RandomUtils } from './randomUtils'

export class ArrayUtils {
    static sortDateStringArray(array: dateValPair[]) {
        array.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    /** Get a random object from the array */
    static randomChoiceFromArray<T>(arr: T[]) {
        const randomNumber = RandomUtils.getRandomInteger(0, arr.length - 1)
        return arr[randomNumber] as T
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
}
