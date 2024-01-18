export namespace ObjectUtils {
    export const isObject = (o: any) => {
        return typeof o === 'object'
    }

    export const isObjKey = <T extends object>(key: PropertyKey, obj: T): key is keyof T => {
        return key in obj
    }
}
