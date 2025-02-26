import { GoogleGenerativeAI } from '@google/generative-ai'
import { GeminiKey } from '../client-env'
import { MessageHelper } from './messageHelper'

export namespace GeminiHelper {
    export const generateAnswer = async (question: string) => {
        const genAI = new GoogleGenerativeAI(GeminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `Du skal svare kort, presis, og riktig på følgende spørsmål: "${question}". `

        const result = await model.generateContent(prompt)
        return result.response.text()
    }

    export const fetchAndSendMessage = async (question: string, msgHelper: MessageHelper, channelId: string) => {
        const answer = await generateAnswer(question)
        msgHelper.sendMessage(channelId, { text: answer })
    }
}
