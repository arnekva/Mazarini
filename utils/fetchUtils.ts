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

    static async checkImageUrl(url: string): Promise<boolean> {
        const res = await fetch(url)
        const buff = await res.blob()
        return res.status === 200 || buff.type.startsWith('image/')
    }
}
