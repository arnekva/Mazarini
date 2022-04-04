import { dbPrefix } from '../helpers/databaseHelper'

export namespace ObjectUtils {
    export const isObjectOfTypeDbPrefix = (o: string): o is dbPrefix => {
        return <dbPrefix>o !== undefined
    }
    export const isObject = (o: any) => {
        return typeof o === 'object'
    }
}
