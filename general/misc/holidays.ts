import moment from 'moment'
export namespace Holidays {
    export type holidays =
        | 'Nyttårsaften'
        | '1. Nyttårsdag'
        | 'Skjærtorsdag'
        | 'Langfredag'
        | 'Palmesøndag'
        | '1. Påskedag'
        | '2. Påskedag'
        | '1. mai'
        | '17. mai'
        | 'Kristi Himmelfartsdag'
        | '1. Pinsedag'
        | '2. Pinsedag'
        | 'Julaften'
        | '1. Juledag'
        | '2. Juledag'

    //See https://stackoverflow.com/questions/1284314/easter-date-in-javascript
    const findEaster = (Y) => {
        const C = Math.floor(Y / 100)
        const N = Y - 19 * Math.floor(Y / 19)
        const K = Math.floor((C - 17) / 25)
        let I = C - Math.floor(C / 4) - Math.floor((C - K) / 3) + 19 * N + 15
        I = I - 30 * Math.floor(I / 30)
        I = I - Math.floor(I / 28) * (1 - Math.floor(I / 28) * Math.floor(29 / (I + 1)) * Math.floor((21 - N) / 11))
        let J = Y + Math.floor(Y / 4) + I + 2 - C + Math.floor(C / 4)
        J = J - 7 * Math.floor(J / 7)
        const L = I - J
        const M = 3 + Math.floor((L + 40) / 44)
        const D = L + 28 - 31 * Math.floor(M / 4)

        return padout(M) + '.' + padout(D)
    }

    const padout = (num: number) => {
        return num < 10 ? '0' + num : num
    }

    export const getNorwegianPublicHolidays = (year: number): { name: string; date: string }[] => {
        const easter = findEaster(year)
        const holidays: { name: string; date: string }[] = []

        // Calculate Easter Sunday
        const easterDate = moment(`${year}-${easter.split('.')[0]}-${easter.split('.')[1]}`).format('YYYY-MM-DD')

        // Maundy Thursday (Skjærtorsdag) - 3 days before Easter Sunday
        holidays.push({ name: 'Skjærtorsdag', date: moment(easterDate).subtract(3, 'days').format('YYYY-MM-DD') })

        // Good Friday (Langfredag) - 2 days before Easter Sunday
        holidays.push({ name: 'Langfredag', date: moment(easterDate).subtract(2, 'days').format('YYYY-MM-DD') })

        // Easter Eve (Påskeaften) - 1 day before Easter Sunday
        holidays.push({ name: 'Påskeaften', date: moment(easterDate).subtract(1, 'days').format('YYYY-MM-DD') })

        // Easter Sunday (1. Påskedag)
        holidays.push({ name: '1. Påskedag', date: easterDate })

        // Easter Monday (2. Påskedag) - 1 day after Easter Sunday
        holidays.push({ name: '2. Påskedag', date: moment(easterDate).add(1, 'days').format('YYYY-MM-DD') })

        // Ascension Day (Kristi Himmelfartsdag) - 39 days after Easter Sunday
        holidays.push({ name: 'Kristi Himmelfartsdag', date: moment(easterDate).add(39, 'days').format('YYYY-MM-DD') })

        // Pentecost Eve (Pinseaften) - 49 days after Easter Sunday
        holidays.push({ name: 'Pinseaften', date: moment(easterDate).add(49, 'days').format('YYYY-MM-DD') })

        // Pentecost (1. Pinsedag) - 50 days after Easter Sunday
        holidays.push({ name: '1. Pinsedag', date: moment(easterDate).add(50, 'days').format('YYYY-MM-DD') })

        // Whit Monday (2. Pinsedag) - 51 days after Easter Sunday
        holidays.push({ name: '2. Pinsedag', date: moment(easterDate).add(51, 'days').format('YYYY-MM-DD') })

        // New Year's Eve (Nyttårsaften)
        holidays.push({ name: 'Nyttårsaften', date: moment(`${year}-12-31`).format('YYYY-MM-DD') })

        holidays.push({ name: '1. mai', date: moment().year(year).month('may').date(1).format('YYYY-MM-DD') })
        holidays.push({ name: '17. mai', date: moment().year(year).month('may').date(17).format('YYYY-MM-DD') })
        holidays.push({ name: 'Julaften', date: moment().year(year).month('december').date(24).format('YYYY-MM-DD') })
        holidays.push({ name: '1. Juledag', date: moment().year(year).month('december').date(25).format('YYYY-MM-DD') })
        holidays.push({ name: '2. Juledag', date: moment().year(year).month('december').date(26).format('YYYY-MM-DD') })
        holidays.push({
            name: '1. mai',
            date: moment().year(year).month('may').date(1).format('YYYY-MM-DD'),
        })
        return holidays
    }
}
