import { dbPrefix } from '../interfaces/database/databaseInterface'

export namespace ObjectUtils {
    export const isObjectOfTypeDbPrefix = (o: string): o is dbPrefix => {
        return <dbPrefix>o !== undefined
    }
    export const isObject = (o: any) => {
        return typeof o === 'object'
    }

    export const isObjKey = <T extends object>(key: PropertyKey, obj: T): key is keyof T => {
        return key in obj
    }
}
