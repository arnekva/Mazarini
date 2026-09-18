// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldAtlas = require('world-atlas/countries-110m.json')

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

/** Renders a single country's outline as a standalone SVG path, fitted and centered in a VIEW_SIZE x VIEW_SIZE box. */
export async function getCountryOutlinePath(ccn3: string): Promise<{ path: string; viewBox: string } | undefined> {
    const [features, { geoMercator, geoPath }] = await Promise.all([getCountryFeatures(), dynamicImport('d3-geo')])
    const target = features.find((f: any) => f.id === ccn3)
    if (!target) return undefined

    const projection = geoMercator().fitSize([VIEW_SIZE, VIEW_SIZE], target)
    const path = geoPath(projection)(target)
    if (!path) return undefined

    return { path, viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}` }
}
