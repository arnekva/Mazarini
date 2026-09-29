// 110m was too coarse to recognize most countries by shape alone, and 50m still smooths off a lot of coastline. 10m has the real edges - it's far too heavy to
// store as-is though, so the projected points are thinned out below (buildPath): it keeps every point that's at least MIN_POINT_SPACING pixels from the last one kept.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldAtlas = require('world-atlas/countries-10m.json')

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

/** Points closer than this (in the VIEW_SIZE box) to the previously kept one are dropped - sub-pixel detail nobody can see, but it's most of the size of a 10m path. */
const MIN_POINT_SPACING = 0.3

/** A canvas-style drawing context for d3's geoPath that writes an SVG path, thinning points as described above. d3 still does the projection and the
 * clipping (antimeridian, poles), which is why this is a context rather than a loop over the raw coordinates. */
function thinningContext() {
    let d = ''
    let last: [number, number] | null = null
    const fmt = (n: number) => n.toFixed(1)
    return {
        moveTo(x: number, y: number) {
            d += `M${fmt(x)},${fmt(y)}`
            last = [x, y]
        },
        lineTo(x: number, y: number) {
            if (last && Math.hypot(x - last[0], y - last[1]) < MIN_POINT_SPACING) return
            d += `L${fmt(x)},${fmt(y)}`
            last = [x, y]
        },
        closePath() {
            d += 'Z'
        },
        rect() {},
        arc() {},
        result: () => d,
    }
}

/** Renders a single country's outline as a standalone SVG path, fitted and centered in a VIEW_SIZE x VIEW_SIZE box. */
export async function getCountryOutlinePath(ccn3: string): Promise<{ path: string; viewBox: string } | undefined> {
    const [features, { geoMercator, geoPath, geoArea }] = await Promise.all([getCountryFeatures(), dynamicImport('d3-geo')])
    const rawTarget = features.find((f: any) => f.id === ccn3)
    if (!rawTarget) return undefined
    const target = dropFarFlungExclaves(rawTarget, geoArea)

    const projection = geoMercator().fitSize([VIEW_SIZE, VIEW_SIZE], target)
    const context = thinningContext()
    geoPath(projection, context)(target)
    const path = context.result()
    if (!path) return undefined

    return { path, viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}` }
}
