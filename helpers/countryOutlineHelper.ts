// 110m was too coarse to recognize most countries by shape alone, and 50m still smooths off a lot of coastline. 10m has the real edges - fjords, islands and all.
// It's far too heavy to store as-is though, so the projected points are thinned out below (thinningContext).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldAtlas = require('world-atlas/countries-10m.json')

/** The longest side of the drawing, in path units. Coordinates are written as whole numbers, so this is also the resolution of the outline. */
const VIEW_SIZE = 2000
/** Room around the shape for the stroke it's drawn with. */
const VIEW_PADDING = 12

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

type Ring = [number, number][]
type Polygon = Ring[]
type GeoArea = (geometry: any) => number

function polygonsOf(geometry: any): Polygon[] {
    if (geometry?.type === 'Polygon') return [geometry.coordinates]
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates
    return []
}

const countPoints = (polygons: Polygon[]) => polygons.reduce((sum, polygon) => sum + polygon.reduce((s, ring) => s + ring.length, 0), 0)

// ---------- which pieces of a country to draw ----------
//
// A country is usually many pieces: a mainland and its islands - and sometimes something on the other side of the planet (France's overseas
// departments, the Netherlands' Caribbean islands, Easter Island). Drawing everything shrinks the actual country to a dot to make room for
// the far-away bits, so those have to go. But which pieces stay can't be decided by size: that was the first attempt (keep anything at
// least 5% as big as the biggest piece), and it threw away every island of Norway, Greece, Chile and Canada - exactly what makes their
// outlines recognisable. It's decided by distance instead:
//   - start with the biggest piece
//   - a piece that's a real share of the country joins even from far off (MAJOR): the other half of Malaysia
//   - a sizeable piece joins if it's fairly close (MEDIUM): Alaska, Sardinia, Bioko - not Svalbard, not French Guiana
//   - everything else joins if it's close to something that's already in (SMALL_REACH). That's a chain, so islands lead on to further islands.
// "Close" is measured against the size of the country itself, so the same rule works for Singapore and for Russia.

const EARTH_RADIUS_KM = 6371
/** Size classes, as a fraction of the biggest piece's area - and how far from what's already in a piece of that class may be: that many
 * times the biggest piece's own radius, but never less than REACH_MIN_KM. */
const MAJOR = { areaFraction: 0.3, reach: 1.5 }
const MEDIUM = { areaFraction: 0.05, reach: 0.5 }
const REACH_MIN_KM = 400
/** How far from what's already in a small piece may be, as a fraction of the radius of the bigger pieces together. */
const SMALL_REACH = 0.3

interface Piece {
    polygon: Polygon
    area: number
    /** A sample of the outer ring as points on the unit sphere (x, y, z, x, y, z, ...) - straight-line distances between those need no trigonometry. */
    points: Float64Array
    center: [number, number, number]
    /** Furthest sampled point from the center, as a straight-line distance on the unit sphere. */
    radius: number
}

const kmToChord = (km: number) => 2 * Math.sin(km / EARTH_RADIUS_KM / 2)
const chordToKm = (chord: number) => 2 * Math.asin(Math.min(1, chord / 2)) * EARTH_RADIUS_KM

function centerAndRadius(points: Float64Array): { center: [number, number, number]; radius: number } {
    let x = 0
    let y = 0
    let z = 0
    for (let i = 0; i < points.length; i += 3) {
        x += points[i]
        y += points[i + 1]
        z += points[i + 2]
    }
    const length = Math.hypot(x, y, z) || 1
    const center: [number, number, number] = [x / length, y / length, z / length]
    let radius = 0
    for (let i = 0; i < points.length; i += 3) radius = Math.max(radius, Math.hypot(points[i] - center[0], points[i + 1] - center[1], points[i + 2] - center[2]))
    return { center, radius }
}

function toPiece(polygon: Polygon, area: number): Piece {
    const ring = polygon[0]
    const step = Math.max(1, Math.ceil(ring.length / 200))
    const points = new Float64Array(Math.ceil(ring.length / step) * 3)
    let n = 0
    for (let i = 0; i < ring.length; i += step) {
        const lng = (ring[i][0] * Math.PI) / 180
        const lat = (ring[i][1] * Math.PI) / 180
        points[n++] = Math.cos(lat) * Math.cos(lng)
        points[n++] = Math.cos(lat) * Math.sin(lng)
        points[n++] = Math.sin(lat)
    }
    return { polygon, area, points, ...centerAndRadius(points) }
}

/** Whether two pieces come within `reach` of each other (straight-line distance on the unit sphere). */
function within(a: Piece, b: Piece, reach: number): boolean {
    if (Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1], a.center[2] - b.center[2]) - a.radius - b.radius > reach) return false
    const reachSquared = reach * reach
    for (let i = 0; i < a.points.length; i += 3) {
        for (let j = 0; j < b.points.length; j += 3) {
            const dx = a.points[i] - b.points[j]
            const dy = a.points[i + 1] - b.points[j + 1]
            const dz = a.points[i + 2] - b.points[j + 2]
            if (dx * dx + dy * dy + dz * dz <= reachSquared) return true
        }
    }
    return false
}

/** Moves every candidate that's within `reach` of something in `kept` over to it - and then whatever is within reach of those, and so on. */
function absorb(kept: Piece[], candidates: Piece[], reach: number): Piece[] {
    let remaining = candidates
    let frontier = kept.slice()
    while (frontier.length > 0 && remaining.length > 0) {
        const joined: Piece[] = []
        const left: Piece[] = []
        for (const piece of remaining) (frontier.some((k) => within(piece, k, reach)) ? joined : left).push(piece)
        kept.push(...joined)
        frontier = joined
        remaining = left
    }
    return remaining
}

/** The pieces of a country worth drawing - see the notes above. */
function selectPieces(polygons: Polygon[], geoArea: GeoArea): Polygon[] {
    if (polygons.length <= 1) return polygons
    const pieces = polygons.map((polygon) => toPiece(polygon, geoArea({ type: 'Polygon', coordinates: polygon }))).sort((a, b) => b.area - a.area)
    const biggest = pieces[0]

    const kept = [biggest]
    const reachOf = (factor: number) => kmToChord(Math.max(REACH_MIN_KM, chordToKm(biggest.radius) * factor))
    const atLeast = (fraction: number) => pieces.filter((piece) => !kept.includes(piece) && piece.area >= biggest.area * fraction)
    absorb(kept, atLeast(MAJOR.areaFraction), reachOf(MAJOR.reach))
    absorb(kept, atLeast(MEDIUM.areaFraction), reachOf(MEDIUM.reach))

    const all = new Float64Array(kept.reduce((sum, piece) => sum + piece.points.length, 0))
    let offset = 0
    for (const piece of kept) {
        all.set(piece.points, offset)
        offset += piece.points.length
    }
    const smallReach = kmToChord(chordToKm(centerAndRadius(all).radius) * SMALL_REACH)
    absorb(
        kept,
        pieces.filter((piece) => !kept.includes(piece)),
        smallReach
    )
    return kept.map((piece) => piece.polygon)
}

// ---------- a finer source for small countries ----------
//
// The atlas is drawn for a 1:10 000 000 map: fine for Norway, but Singapore is 40 points in it - a blob, with none of the harbours and
// islands that make it Singapore. For a country the atlas only has a rough shape of, the outline comes from geoBoundaries instead (open
// data, surveyed at a far larger scale, one file per country). That's a download, so the atlas stays the fallback for when it's
// unreachable, slow or huge - and for when its idea of the country differs too much from the atlas's (some of its sources draw the
// territorial waters rather than the coast, which is the opposite of what's wanted here).

/** d3 reads a ring that's the "wrong" way round as everything *except* what's inside it (a sphere-sized area), which is also what a degenerate sliver
 * (a few almost-collinear points - the atlas has some for the Maldives) turns out to be. Those get turned the right way round. Left alone, one of them
 * counts as the country's biggest piece and is drawn as a rectangle the size of the world. */
function windRight(polygons: Polygon[], geoArea: GeoArea): Polygon[] {
    return polygons.map((polygon) => (geoArea({ type: 'Polygon', coordinates: polygon }) > 2 * Math.PI ? polygon.map((ring) => [...ring].reverse()) : polygon))
}

/** Fewer points than this in the atlas means it only has a rough shape - about a third of all countries, the small ones. */
const COARSE_POINT_COUNT = 600
/** ...and so does a country that's many tiny pieces (an atlas atoll is a 4-point ring): the Maldives have over a thousand points, spread over 176 islands. */
const COARSE_MIN_POINTS_PER_PIECE = 15
const COARSE_MIN_PIECES = 20
const FINE_SOURCE_MAX_BYTES = 25 * 1024 * 1024
/** How the finer source's total area may compare to the atlas's before it's taken to be a different thing (waters, another border). Generous,
 * because the atlas's own idea of a country this small is rough too. */
const FINE_SOURCE_AREA_RATIO = { min: 0.6, max: 2 }
/** An atlas outline with fewer points than this isn't a shape to compare the finer source's area against. */
const ATLAS_MARKER_POINT_COUNT = 20

async function fetchFinePolygons(cca3: string, atlasPolygons: Polygon[], geoArea: GeoArea): Promise<Polygon[] | undefined> {
    try {
        const meta = await (await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${cca3}/ADM0/`, { signal: AbortSignal.timeout(10_000) })).json()
        if (!meta?.gjDownloadURL) return undefined
        const response = await fetch(meta.gjDownloadURL, { signal: AbortSignal.timeout(45_000) })
        if (!response.ok || Number(response.headers.get('content-length') ?? 0) > FINE_SOURCE_MAX_BYTES) return undefined
        const collection = await response.json()

        // GeoJSON and d3 disagree on which way round a ring goes - see windRight.
        const polygons = windRight(
            ((collection?.features ?? []) as any[]).flatMap((f) => polygonsOf(f.geometry)),
            geoArea
        )
        if (polygons.length === 0) return undefined

        // An atlas shape that's only a handful of points (Monaco's is 12, the Vatican's a degenerate 4) is a marker rather than a measurement - nothing
        // to compare against. Holding the finer source to it rejected exactly the countries that need it most.
        if (countPoints(atlasPolygons) < ATLAS_MARKER_POINT_COUNT) return polygons

        const area = (list: Polygon[]) => list.reduce((sum, polygon) => sum + geoArea({ type: 'Polygon', coordinates: polygon }), 0)
        const ratio = area(polygons) / area(atlasPolygons)
        if (ratio < FINE_SOURCE_AREA_RATIO.min || ratio > FINE_SOURCE_AREA_RATIO.max) return undefined
        return polygons
    } catch (err) {
        console.warn(`Fant ikke et finere omriss for ${cca3} - bruker atlaset`, err)
        return undefined
    }
}

// ---------- drawing ----------

/** The most a path may weigh (characters) - it's stored in the database and sent to everyone who opens the puzzle. */
const MAX_PATH_LENGTH = 90_000

/** A canvas-style drawing context for d3's geoPath that writes an SVG path, dropping every point closer than `spacing` to the last one kept: detail
 * nobody can see, but most of the weight of a detailed outline. d3 still does the projection and the clipping (antimeridian, poles), which is why this
 * is a context rather than a loop over the raw coordinates. */
function thinningContext(spacing: number) {
    let d = ''
    let last: [number, number] | null = null
    const fmt = (n: number) => Math.round(n)
    return {
        moveTo(x: number, y: number) {
            d += `M${fmt(x)},${fmt(y)}`
            last = [x, y]
        },
        lineTo(x: number, y: number) {
            if (last && Math.hypot(x - last[0], y - last[1]) < spacing) return
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

/** Renders a single country's outline as a standalone SVG path. The viewBox hugs the shape (its longest side is VIEW_SIZE), so a wide or
 * tall country doesn't come with empty space around it. `cca3` lets a small country be drawn from a finer source than the bundled atlas. */
export async function getCountryOutlinePath(ccn3: string, cca3?: string): Promise<{ path: string; viewBox: string } | undefined> {
    const [features, { geoMercator, geoPath, geoArea, geoCentroid }] = await Promise.all([getCountryFeatures(), dynamicImport('d3-geo')])
    const rawTarget = features.find((f: any) => f.id === ccn3)
    if (!rawTarget) return undefined

    let polygons = windRight(polygonsOf(rawTarget.geometry), geoArea)
    const points = countPoints(polygons)
    const isCoarse = points < COARSE_POINT_COUNT || (polygons.length >= COARSE_MIN_PIECES && points / polygons.length < COARSE_MIN_POINTS_PER_PIECE)
    if (cca3 && isCoarse) polygons = (await fetchFinePolygons(cca3, polygons, geoArea)) ?? polygons
    const target = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: selectPieces(polygons, geoArea) } }

    // Turned so the country itself is in the middle of the map: one that lies across the date line (Russia, the USA with the Aleutians, Fiji)
    // would otherwise be drawn in two parts at opposite edges of the world, with the whole width of it in between.
    const projection = geoMercator()
        .rotate([-geoCentroid(target)[0], 0])
        .fitSize([VIEW_SIZE, VIEW_SIZE], target)
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(target)
    const box = [x0 - VIEW_PADDING, y0 - VIEW_PADDING, x1 - x0 + 2 * VIEW_PADDING, y1 - y0 + 2 * VIEW_PADDING].map((n) => Math.round(n))

    // As detailed as fits: start at the resolution of the coordinates themselves, and coarsen until the path is light enough.
    for (let spacing = 1.5; ; spacing *= 1.4) {
        const context = thinningContext(spacing)
        geoPath(projection, context)(target)
        const path = context.result()
        if (!path) return undefined
        if (path.length <= MAX_PATH_LENGTH || spacing > 40) return { path, viewBox: box.join(' ') }
    }
}
