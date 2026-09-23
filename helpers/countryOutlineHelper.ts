// 110m was too coarse to recognize most countries by shape alone (near-featureless blobs for anything
// but the largest countries) - 50m keeps the SVG paths reasonably light while giving real detail.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldAtlas = require('world-atlas/countries-50m.json')

const VIEW_SIZE = 300

// d3-geo is ESM-only. TypeScript compiled to CommonJS (ts-node's default locally) downlevels a plain
// `await import(...)` back into a `require()` call, which then fails on an ESM-only package - so the
// import is hidden behind `new Function` to force a genuine runtime dynamic import instead.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>

async function getCountryFeatures(): Promise<any[]> {
    const { feature } = await dynamicImport('topojson-client')
    const collection = feature(worldAtlas, worldAtlas.objects.countries) as any
    return collection.features
}

/** Country ids (ISO 3166-1 numeric, matches REST Countries' ccn3) that have geometry in the bundled atlas. */
export async function getOutlineCapableCcn3s(): Promise<Set<string>> {
    const features = await getCountryFeatures()
    return new Set(features.map((f: any) => f.id as string))
}

// A tiny far-flung exclave (e.g. the Netherlands' BES islands, France's overseas departments) is
// nowhere near the same order of magnitude of area as a country's actual mainland - dropping any
// polygon under this fraction of the biggest one's area keeps genuinely multi-island countries (all
// their main islands stay comparable in size) while cutting the distant specks that were shrinking
// the whole projection down to make room for a barely-visible dot, which is what made the outline
// unrecognizable (e.g. the Netherlands used to render as a tiny blob plus a stray pixel for Sint
// Eustatius/Saba/Bonaire way off to the side).
const MIN_AREA_FRACTION = 0.05

/** Drops MultiPolygon rings that are tiny relative to the country's largest landmass - see MIN_AREA_FRACTION. */
function dropFarFlungExclaves(target: any, geoArea: (geometry: any) => number): any {
    if (target.geometry?.type !== 'MultiPolygon') return target

    const polygons: [number, number][][][] = target.geometry.coordinates
    const areas = polygons.map((coordinates) => geoArea({ type: 'Polygon', coordinates }))
    const maxArea = Math.max(...areas)
    const kept = polygons.filter((_, i) => areas[i] >= maxArea * MIN_AREA_FRACTION)
    if (kept.length === polygons.length) return target

    return { ...target, geometry: kept.length === 1 ? { type: 'Polygon', coordinates: kept[0] } : { type: 'MultiPolygon', coordinates: kept } }
}

/** Renders a single country's outline as a standalone SVG path, fitted and centered in a VIEW_SIZE x VIEW_SIZE box. */
export async function getCountryOutlinePath(ccn3: string): Promise<{ path: string; viewBox: string } | undefined> {
    const [features, { geoMercator, geoPath, geoArea }] = await Promise.all([getCountryFeatures(), dynamicImport('d3-geo')])
    const rawTarget = features.find((f: any) => f.id === ccn3)
    if (!rawTarget) return undefined
    const target = dropFarFlungExclaves(rawTarget, geoArea)

    const projection = geoMercator().fitSize([VIEW_SIZE, VIEW_SIZE], target)
    const path = geoPath(projection)(target)
    if (!path) return undefined

    return { path, viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}` }
}
