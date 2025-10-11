const fs = require('fs')
const path = require('path')

export type customGameNames = 'norwegianCities'
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
        return ['norwegianCities'] as customGameNames[]
    }
    static getJSONByName(name: customGameNames) {
        if (name === 'norwegianCities') {
            const filePath = path.resolve(__dirname, 'customGames', 'norwegianCities.json')
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        }
        return null
    }

    static getAllCustomGames() {
        const filePath = path.resolve(__dirname, 'allCustomGames.json')
        const data = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(data)
    }
}
