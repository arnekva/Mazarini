export namespace Languages {
    export const weekdayTranslate = (day: string): string => {
        if (day === 'Monday') return 'Mandag'
        if (day === 'Tuesday') return 'Tirsdag'
        if (day === 'Wednesday') return 'Onsdag'
        if (day === 'Thursday') return 'Torsdag'
        if (day === 'Friday') return 'Fredag'
        if (day === 'Saturday') return 'Lørdag'
        return 'Søndag'
    }
}
