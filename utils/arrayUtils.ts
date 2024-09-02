import { dateValPair } from '../commands/dateCommands'
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

    /** Remove all instances of an object from the given array */
    static removeItemAll<T>(array: T[], value: any) {
        let i = 0
        while (i < array.length) {
            if (array[i] === value) {
                array.splice(i, 1)
            } else {
                ++i
            }
        }
        return array
    }

    /** Remove an instance of a object from the given array */
    static removeItemOnce<T>(array: T[], value: any) {
        const index = array.indexOf(value)
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

    /** Randmly shuffles the given array */
    static shuffleArray<T>(array: T[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const temp = array[i]
            array[i] = array[j]
            array[j] = temp
        }
        return array
    }

    static areArraysEqual<T>(a: T[], b: T[]) {
        if (a === b) return true
        if (a == null || b == null) return false
        if (a.length !== b.length) return false

        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false
        }
        return true
    }
}
