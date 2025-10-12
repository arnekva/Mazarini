const fs = require('fs')
const path = require('path')

export type customGameNames = 'norwegianCities' | 'norwegianMountains' | 'celebAge' | 'kommuneInnbygger' | 'kommuneSize' | 'mostKnownNorwegian'
/* 
    Steps for adding a custom game:
    1. Add a new json file in res/games/moreOrLess, following the norwegianCities.json format (its extremely important to have the "CUSTOM_MAZARINI_GAME" tag in the tags array)
    2. Add the name of the file (without .json) to the customGameNames type above. (the slug)
    3. Add the name to the getAllNames() function below
    4. Make sure to point getJSONByName to the correct file

    getAllNames() will run during daily job and concat custom games with normal games from API.
*/
export class CustomMOLHandler {
    public static readonly customGameTag = 'CUSTOM_MAZARINI_GAME'
    static getAllNames() {
        return ['norwegianCities', 'celebAge', 'norwegianMountains', 'kommuneInnbygger'] as customGameNames[]
    }
    static getJSONByName(name: customGameNames) {
        if (name === 'norwegianCities') {
            const filePath = path.resolve(__dirname, 'customGames', 'norwegianCities.json')
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        }
        if (name === 'norwegianMountains') {
            const filePath = path.resolve(__dirname, 'customGames', 'norwegianMountains.json')
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        }
        if (name === 'celebAge') {
            const filePath = path.resolve(__dirname, 'customGames', 'celebAge.json')
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        }
        if (name === 'kommuneInnbygger') {
            const filePath = path.resolve(__dirname, 'customGames', 'kommuneInnbygger.json')
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        }
        if (name === 'kommuneSize') {
            const filePath = path.resolve(__dirname, 'customGames', 'largestKommune.json')
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        }
        if (name === 'mostKnownNorwegian') {
            const filePath = path.resolve(__dirname, 'customGames', 'mostKnownNorwegian.json')
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        }
    }

    static getAllCustomGames() {
        const filePath = path.resolve(__dirname, 'allCustomGames.json')
        const data = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(data)
    }
}
