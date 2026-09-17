import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldAtlas = require('world-atlas/countries-110m.json')

const VIEW_SIZE = 300

/** Country ids (ISO 3166-1 numeric, matches REST Countries' ccn3) that have geometry in the bundled atlas. */
export function getOutlineCapableCcn3s(): Set<string> {
    const collection = feature(worldAtlas, worldAtlas.objects.countries) as any
    return new Set(collection.features.map((f: any) => f.id as string))
}

/** Renders a single country's outline as a standalone SVG path, fitted and centered in a VIEW_SIZE x VIEW_SIZE box. */
export function getCountryOutlinePath(ccn3: string): { path: string; viewBox: string } | undefined {
    const collection = feature(worldAtlas, worldAtlas.objects.countries) as any
    const target = collection.features.find((f: any) => f.id === ccn3)
    if (!target) return undefined

    const projection = geoMercator().fitSize([VIEW_SIZE, VIEW_SIZE], target)
    const path = geoPath(projection)(target)
    if (!path) return undefined

    return { path, viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}` }
}
