export namespace WeatherUtils {
    export const kelvinToCelcius = (tempInKelvin: number) => {
        return tempInKelvin - 273.15
    }

    export const windDegreesToDirectionalArrow = (degrees: number) => {
        const wind: string[] = ["⬇️", "↙️", "⬅️", "↖️", "⬆️", "↗️", "➡️", "↘️", "⬇️"]
        return wind[Math.round(degrees/45)]
    }
}
