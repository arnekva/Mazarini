import moment, { Moment } from 'moment'

export const dateRegex = new RegExp(/^(0[1-9]|[12][0-9]|3[01])[-](0[1-9]|1[012])[-](19|20)\d\d$/) ///^(0[1-9]|[12][0-9]|3[01])[- /.](0[1-9]|1[012])[- /.](19|20)\d\d$/ old
/** Checks a string against 24hr format HH:MM */
export const timeRegex = new RegExp(/([01]?[0-9]|2[0-3]):[0-5][0-9]/)
export function getWeekNumber(d: Date) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    // Set to nearest Thursday: current date + 4 - current day number Make
    // Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

    const weekStartDate = new Date(d.getTime())
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 3)

    const weekEndDate = new Date(d.getTime())
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 3)

    return [d.getUTCFullYear(), weekNo, weekStartDate, weekEndDate] as const
}

export const isValidDate = (o: any) => {
    return new Date(o).toString() !== 'Invalid Date'
}
export interface countdownTime {
    days: number
    hours: number
    minutes: number
    seconds: number
}
export class DateUtils {
    /**
     * Get time untill a given date
     * @param date The date
     * @returns An object with days, hours, minutes and seconds
     */
    static getTimeTo(date: Moment | Date): countdownTime | undefined {
        const total = (date instanceof Date ? date.getTime() : date.valueOf()) - moment().valueOf() //- new Date().getTime()

        if (total < 0) return undefined
        const rDate: countdownTime = {
            days: Math.floor(total / (1000 * 60 * 60 * 24)),
            hours: Math.floor((total / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((total / 1000 / 60) % 60),
            seconds: Math.floor((total / 1000) % 60),
        }

        return rDate
    }

    /**
     * Get time since a date
     * @param date The date
     * @returns An object with days, hours, minutes and seconds
     */
    static getTimeSince(date: Date): countdownTime | undefined {
        const total = new Date().getTime() - date.getTime()
        if (total < 0) return undefined
        const rDate: countdownTime = {
            days: Math.floor(total / (1000 * 60 * 60 * 24)),
            hours: Math.floor((total / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((total / 1000 / 60) % 60),
            seconds: Math.floor((total / 1000) % 60),
        }
        return rDate
    }

    static isValidDate(date: Date | number) {
        return date instanceof Date && !isNaN(Number(date))
    }
    /** This function finds the next instance of the specified day
     * @params date - Date to search from (defaults to today)
     * @params day_in_week - Day to search for (e.g. 5 for friday)
     */
    static nextWeekdayDate(day_in_week: number) {
        var ret = moment()
        ret.date(ret.date() + ((day_in_week - 1 - ret.day() + 7) % 7) + 1)
        return ret
    }

    static secondsToMinutes(t: number) {
        return Math.floor(t / 60)
    }

    static secondsToHours(t: number) {
        return Math.floor(t / 3600)
    }

    static secondsToHoursAndMinutes(t: number): { hours: number; minutes: number } {
        const hours = this.secondsToHours(t)
        const minutes = this.secondsToMinutes(t) - hours * 60
        return {
            hours: hours,
            minutes: minutes,
        }
    }
    static secondsToMinutesAndSeconds(t: number): { minutes: number; seconds: number } {
        const minutes = this.secondsToMinutes(t)

        const seconds = t - minutes * 60
        return {
            minutes: minutes,
            seconds: seconds,
        }
    }

    static isToday(compareDate: Date, ignoreMonthOffset?: boolean) {
        const today = new Date()
        return compareDate.getDate() == today.getDate() && compareDate.getMonth() == today.getMonth() + (ignoreMonthOffset ? 0 : 1)
    }

    static formatCountdownText(dateObj: countdownTime | undefined, textEnding: string, finishedText?: string, noTextEnding?: boolean) {
        if (!dateObj) return finishedText ?? ''
        const timeTab: string[] = []
        let timeString = 'Det er'

        if (dateObj.days > 0) timeTab.push(' ' + dateObj.days + ` ${dateObj.days == 1 ? 'dag' : 'dager'}`)
        if (dateObj.hours > 0) timeTab.push(' ' + dateObj.hours + ` ${dateObj.hours == 1 ? 'time' : 'timer'}`)
        if (dateObj.minutes > 0) timeTab.push(' ' + dateObj.minutes + ` ${dateObj.minutes == 1 ? 'minutt' : 'minutter'}`)
        if (dateObj.seconds > 0) timeTab.push(' ' + dateObj.seconds + ` ${dateObj.seconds == 1 ? 'sekund' : 'sekunder'}`)
        if (timeTab.length < 1) return noTextEnding ? '' : textEnding + ' er ferdig!'
        timeTab.forEach((text, index) => {
            timeString += text
            if (index <= timeTab.length - 2 && timeTab.length > 1) timeString += index == timeTab.length - 2 ? ' og' : ','
        })
        timeString += ' ' + textEnding
        return timeString
    }

    static dateHasPassed(d: Date) {
        return moment(d).isBefore(moment(), 'day') || DateUtils.isToday(d, true)
    }

    static formatDate(d: Date) {
        return `${DateUtils.addZero(d.getUTCDate())}.${DateUtils.addZero(d.getUTCMonth() + 1)}.${String(d.getUTCFullYear()).substring(2, 4)}`
    }

    static addZero(n: number) {
        if (String(n).length < 2) {
            return `0${n}`
        }
        return n
    }

    /** Checks if the string supplied is today (e.g. "monday")  */
    static isDateNameToday(day: string) {
        const dateName = new Date().toLocaleDateString('no', { weekday: 'long' })

        return dateName.toLowerCase() === day.toLowerCase()
    }

    static isDateBefore(date1: Date, date2: Date) {
        return moment(date1).isBefore(moment(date2))
    }

    static dateIsMaxXDaysInFuture(date: Date, numDays: number) {
        return moment(date).isBefore(moment().add(numDays, 'days'))
    }

    static isHourMinuteBefore(hour: number, minute: number) {
        return moment().isBefore(moment({ hour: hour, minute: minute }))
    }

    static getCurrentTimeFormatted() {
        return `${moment().format('HH:mm:ss DD-MM-YYYY ')}`
    }

    static isDecember() {
        return moment().month() === 11
    }

    static dateIsWithinLastHour(d: Date) {
        return moment(d).isBetween(moment().subtract(1, 'hours'), moment())
    }

    static dateIsWithinNextHour(d: Date) {
        return moment(d).isBetween(moment(), moment().add(1, 'hours'))
    }

    static dateIsClosestHour(d: Date) {
        return moment().minutes() >= 30 ? DateUtils.dateIsWithinNextHour(d) : DateUtils.dateIsWithinLastHour(d)
    }
}
