import { GetObjectCommand, PutObjectCommand, PutObjectCommandOutput, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { MessageHelper } from './messageHelper'

export class CloudflareHelper {
    private client: S3Client
    private messageHelper: MessageHelper

    constructor(s3Client: S3Client, messageHelper: MessageHelper) {
        this.client = s3Client
        this.messageHelper = messageHelper
    }

    public async getStorageData(key: string): Promise<ArrayBuffer> {
        const command = new GetObjectCommand({ Bucket: 'mazarini', Key: key })
        const response = await this.client.send(command)
        const arrayBuffer = (await response.Body.transformToByteArray()).buffer
        return arrayBuffer
    }

    public async getStorageLink(key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: 'mazarini',
            Key: key,
        })
        return await getSignedUrl(this.client, command, { expiresIn: 60000 })
    }

    public async uploadToStorage(key: string, data: Buffer, contentType?: string): Promise<PutObjectCommandOutput> {
        return await this.client.send(
            new PutObjectCommand({
                Bucket: 'mazarini',
                Key: key,
                Body: data,
                ContentType: contentType ?? 'image/png',
            })
        )
    }

    get msgHelper() {
        return this.messageHelper
    }
}
