const fetch = require('node-fetch')
export class FetchUtils {
    static async fetchWithTimeout(resource, options: any = { timeout: 8000 }) {
        const { timeout = 8000 } = options

        const controller = new AbortController()
        const id = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(resource, {
            ...options,
            signal: controller.signal,
        })
        clearTimeout(id)

        return response
    }
}
