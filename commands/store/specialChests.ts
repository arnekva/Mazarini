import { ILootbox, ILootboxDistribution } from '../../interfaces/database/databaseInterface'

/** Reward-only chests, given with /reward chest. They aren't stored in the database: each is built on the fly from the regular basic/elite boxes. */
export namespace SpecialChests {
    export type Name = 'color' | 'super' | 'fantastic' | 'nondupe'

    interface ISpecialChest {
        label: string
        description: string
        build: (boxes: ILootbox[]) => ILootbox
    }

    /** Odds are cumulative thresholds on one roll: legendary if below `legendary`, else epic if below `epic`, and so on. Everything at 1 means "never anything lower". */
    const distribution = (overrides: Partial<ILootboxDistribution>): ILootboxDistribution => ({
        common: 1,
        rare: 1,
        epic: 1,
        legendary: 1,
        color: 0,
        ...overrides,
    })

    const baseBox = (boxes: ILootbox[], name: string): ILootbox | undefined => boxes.find((box) => box.name === name)

    /** Share of legendaries among epics + legendaries in the elite box, so Super chests keep the same ratio between the two as an elite chest has. */
    const eliteLegendaryShare = (boxes: ILootbox[]) => {
        const elite = baseBox(boxes, 'elite')?.probabilities
        return elite && elite.epic > 0 ? Math.min(1, elite.legendary / elite.epic) : 0.25
    }

    const chests: Record<Name, ISpecialChest> = {
        color: {
            label: 'Color',
            description: 'Basic chest, men alle items har farge',
            build: (boxes) => {
                const basic = baseBox(boxes, 'basic')
                return { ...basic, name: 'color', rewardOnly: true, probabilities: { ...basic.probabilities, color: 1 } }
            },
        },
        super: {
            label: 'Super',
            description: 'Kun epic og legendary, 70% sjanse for farge',
            build: (boxes) => {
                const basic = baseBox(boxes, 'basic')
                return {
                    ...basic,
                    name: 'super',
                    rewardOnly: true,
                    probabilities: distribution({ legendary: eliteLegendaryShare(boxes), color: 0.7 }),
                }
            },
        },
        fantastic: {
            label: 'Fantastic',
            description: 'Kun legendary, 40% sjanse for farge',
            build: (boxes) => {
                const basic = baseBox(boxes, 'basic')
                return { ...basic, name: 'fantastic', rewardOnly: true, probabilities: distribution({ color: 0.4 }) }
            },
        },
        nondupe: {
            label: 'Non-dupe',
            description: 'Kun items du mangler - effekter (high) hvis du mangler under 3',
            build: (boxes) => {
                const basic = baseBox(boxes, 'basic')
                return { ...basic, name: 'nondupe', rewardOnly: true, nonDupe: true }
            },
        },
    }

    export const names = Object.keys(chests) as Name[]

    export const isSpecial = (quality: string): quality is Name => names.includes(quality as Name)

    /** The box for a special chest, or undefined if the basic box it's built on doesn't exist. */
    export const resolve = (quality: string, boxes: ILootbox[]): ILootbox | undefined => {
        if (!isSpecial(quality) || !baseBox(boxes, 'basic')) return undefined
        return chests[quality].build(boxes)
    }

    /** "Super" for 'super', "Basic" for 'basic' - how a chest of the given quality is named to users. */
    export const displayName = (quality: string) => (isSpecial(quality) ? chests[quality].label : quality.charAt(0).toUpperCase() + quality.slice(1))

    export const autocompleteChoices = () => names.map((name) => ({ name: `${chests[name].label} chest - ${chests[name].description}`, value: name }))
}
