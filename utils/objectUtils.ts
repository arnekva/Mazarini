export namespace ObjectUtils {
    export const isObject = (o: any) => {
        return typeof o === 'object'
    }

    export const isObjKey = <T extends object>(key: PropertyKey, obj: T): key is keyof T => {
        return key in obj
    }

    export const getDiff = <T>(obj1: T, obj2: T) => {
        const keyDifference = Object.fromEntries(Object.entries(obj1).filter(([k, v]) => obj2[k] !== v))
        const keyDifferenceOld = Object.fromEntries(Object.entries(obj2).filter(([k, v]) => obj1[k] !== v))
        const vals = Object.entries(keyDifference)
            .map(([key, value]) => `\n**${key}:** ${JSON.stringify(value)} \nGammel verdi:\n ${JSON.stringify(keyDifferenceOld[key])}`)
            .join(' ')
        return vals
    }
}
