import { asposeClientID, asposeClientSecret } from '../client-env'

const fetch = require('node-fetch')

export namespace BarcodeUtils {
    export async function decodeImage(input: string) {
        const token = await getToken()

        const response: any = await fetch('https://api.aspose.cloud/v3.0/barcode/recognize?Type=EAN13&Timeout=30000&url=' + input, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
        })
        const res = await response.json()
        if (!res.barcodes) return undefined
        return res.barcodes[0]?.barcodeValue ?? undefined
    }

    export async function getToken() {
        const requestBody = new URLSearchParams()
        requestBody.append('grant_type', 'client_credentials')
        requestBody.append('client_id', asposeClientID)
        requestBody.append('client_secret', asposeClientSecret)
        const response: any = await fetch('https://api.aspose.cloud/connect/token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                ContentType: 'application/x-www-form-urlencoded',
            },
            body: requestBody,
        })
        const res = await response.json()
        return res.access_token
    }
}
