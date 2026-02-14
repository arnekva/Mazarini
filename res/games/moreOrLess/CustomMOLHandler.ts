const fs = require('fs')
const path = require('path')

export type customGameNames =
    | 'norwegianCities'
    | 'norwegianMountains'
    | 'celebAge'
    | 'kommuneInnbygger'
    | 'kommuneSize'
    | 'mostKnownNorwegian'
    | 'tvSeriesEpisodeCount'
    | 'medalsByCountry'
    | 'top30TaylorSwiftSongs'
    | 'top30NorwegianArtistsInternationally'
    | 'mostKnownWineDistricts'
    | 'countriesMostBillboard1Hits'
    | 'legoSetsByPieces'
    | 'cryptocurrenciesByWorth'
    | 'citiesByAverageRent'
    | 'countriesByPassportStrength'
    | 'citiesByPollutionIndex'
    | 'bordersByLength'

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

    static getJSONByName(name: string) {
        const fileMap: { [key: string]: string } = {
            norwegianCities: 'norwegianCities.json',
            norwegianMountains: 'norwegianMountains.json',
            celebAge: 'celebAge.json',
            kommuneInnbygger: 'kommuneInnbygger.json',
            kommuneSize: 'largestKommune.json',
            tvSeriesEpisodeCount: 'tvSeriesEpisodeCount.json',
            medalsByCountry: 'medalsByCountry.json',
            footballAllTimeGoalsTop25: 'footballers-by-goals.json',
            worldPopulationTop40: 'countries-by-population.json',
            elementsAtomicNumber: 'atom-number.json',
            languagesBySpeakersTop50: 'language-by-speakers.json',
            animalsTopSpeedTop30: 'animal-by-topspeed.json',
            companiesFoundedYear: 'companies-by-founding-date.json',
            norwegianTvSeriesPremiere: 'norwegian-TV-by-launch.json',
            mostVisitedTouristAttractions: 'tourist-destionations-by-visitors.json',
            moviesByRuntime: 'movies-by-runtime.json',
            tvSeriesBySeasons: 'tv-series-by-seasons.json',
            top30TaylorSwiftSongs: 'top30-taylor-swift-songs.json',
            top30NorwegianArtistsInternationally: 'top30-norwegian-artists-internationally.json',
            mostKnownWineDistricts: 'most-known-wine-districts.json',
            countriesMostBillboard1Hits: 'countries-most-billboard-1-hits.json',
            legoSetsByPieces: 'lego-sets-by-pieces.json',
            cryptocurrenciesByWorth: 'cryptocurrencies-by-worth.json',
            citiesByAverageRent: 'cities-by-average-rent.json',
            countriesByPassportStrength: 'countries-by-passport-strength.json',
            citiesByPollutionIndex: 'cities-by-pollution-index.json',
            bordersByLength: 'borders-by-length.json',
        }

        const fileName = fileMap[name]
        if (!fileName) {
            throw new Error(`Game JSON for name "${name}" not found.`)
        }

        const filePath = path.resolve(__dirname, 'customGames', fileName)
        const data = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(data)
    }

    static getAllCustomGames() {
        const filePath = path.resolve(__dirname, 'allCustomGames.json')
        const data = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(data)
    }
    static collectAllJSONsFromFolder() {
        const folderPath = path.resolve(__dirname, 'customGames')
        const files = fs.readdirSync(folderPath)
        const jsonFiles = files.filter((file) => file.endsWith('.json'))

        const games = jsonFiles.map((file) => {
            const filePath = path.join(folderPath, file)
            const data = fs.readFileSync(filePath, 'utf-8')
            return {
                name: path.basename(file, '.json'),
                content: JSON.parse(data),
            }
        })

        return games
    }
}
