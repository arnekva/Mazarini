export namespace ObjectUtils {
    export const isObject = (o: any) => {
        return typeof o === 'object'
    }

    export const isObjKey = <T extends object>(key: PropertyKey, obj: T): key is keyof T => {
        return key in obj
    }

    /**
     *
     * @param obj1 Old object
     * @param obj2 New object
     * @returns An object that contains a stringified diff of the two objects, ```<key>: <new value> Gammel verdi: <old value>```. Also returns a string of the keys that are different.
     */
    export const getDiff = <T>(obj1: T, obj2: T): { keys: string; diff: string } => {
        const keyDifference = Object.fromEntries(Object.entries(obj2).filter(([k, v]) => obj1[k] !== v))
        const keyDifferenceOld = Object.fromEntries(Object.entries(obj1).filter(([k, v]) => obj2[k] !== v))
        const vals = Object.entries(keyDifference)
            .map(([key, value]) => `\n**${key}:** ${JSON.stringify(value)} \nGammel verdi:\n ${JSON.stringify(keyDifferenceOld[key]).slice(0, 200)}`)
            .join(' ')
        return {
            keys: Object.keys(keyDifference).join(', '),
            diff: vals,
        }
    }
}
