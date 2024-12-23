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
     * @param dontInclude Keys that should not be included in the diff - will be filtered out
     * @returns An object that contains a stringified diff of the two objects, ```<key>: <new value> Gammel verdi: <old value>```. Also returns a string of the keys that are different.
     */
    export const getDiff = <T>(obj1: T, obj2: T, dontInclude?: (keyof T)[]): { keys: string; diff: string } => {
        const oldObject = { ...obj1 }
        const newObject = { ...obj2 }
        if (dontInclude) {
            dontInclude.forEach((key) => {
                delete oldObject[key]
                delete newObject[key]
            })
        }
        const keyDifference = Object.fromEntries(Object.entries(newObject).filter(([k, v]) => JSON.stringify(oldObject[k]) !== JSON.stringify(v)))
        const keyDifferenceOld = Object.fromEntries(Object.entries(oldObject).filter(([k, v]) => JSON.stringify(newObject[k]) !== JSON.stringify(v)))
        const vals = Object.entries(keyDifference)
            .map(
                ([key, value]) => `\n**${key}:** ${JSON.stringify(value)} \nGammel verdi:\n ${JSON.stringify(keyDifferenceOld[key])?.slice(0, 200) ?? 'Ukjent'}`
            )
            .join(' ')
        return {
            keys: Object.keys(keyDifference).join(', '),
            diff: vals,
        }
    }
}
