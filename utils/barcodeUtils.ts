import { Message } from 'discord.js'
import { asposeClientID, asposeClientSecret } from '../client-env'

const fetch = require('node-fetch')

export namespace BarcodeUtils {
    export async function decodeImage(input: string, msg: Message) {
        const token = await getToken()

        let response: any = await fetch('https://api.aspose.cloud/v3.0/barcode/recognize?Type=EAN13&Timeout=60000&url=' + encodeURIComponent(input), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
        })
        if (!response.ok) {
            msg.edit('Fant ikke strekkode med EAN13, prøver på nytt med UPCA')
            response = await fetch('https://api.aspose.cloud/v3.0/barcode/recognize?Type=UPCA&Timeout=60000&url=' + encodeURIComponent(input), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            })
        }
        const res = await response.json()
        if (!res.barcodes) return undefined
        return res.barcodes?.map((bc) => bc.barcodeValue) ?? undefined
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
