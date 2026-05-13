import circle from '@turf/circle'
import { geojson } from 'flatgeobuf'
import GeoJSON from 'ol/format/GeoJSON'
import { transform } from 'ol/proj'

const geoJsonFmt = new GeoJSON()

/**
 * @param {import('geojson').Feature} fgbFeature - coordinates in EPSG:3857
 * @returns {import('geojson').Feature} WGS84
 */
export function fgbFeatureTo4326(fgbFeature) {
  const olf = geoJsonFmt.readFeature(fgbFeature, {
    dataProjection: 'EPSG:3857',
    featureProjection: 'EPSG:3857',
  })
  return geoJsonFmt.writeFeatureObject(olf, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  })
}

/**
 * Collect GeoJSON features (EPSG:3857) from FlatGeobuf for a rectangle in EPSG:3857.
 * @param {string} fgbUrl
 * @param {[number, number, number, number]} extent3857 minX minY maxX maxY
 */
export async function loadFgbFeaturesInExtent(fgbUrl, extent3857) {
  const [minX, minY, maxX, maxY] = extent3857
  const rect = { minX, minY, maxX, maxY }
  const out = []
  for await (const f of geojson.deserialize(fgbUrl, rect)) {
    out.push(f)
  }
  return out
}

/**
 * @param {[number, number]} center3857
 * @param {number} radiusKm
 * @returns {import('geojson').Feature<import('geojson').Polygon>}
 */
export function buildCircleFeature4326(center3857, radiusKm) {
  const lonLat = transform(center3857, 'EPSG:3857', 'EPSG:4326')
  return circle(lonLat, radiusKm, { steps: 64, units: 'kilometers' })
}

/**
 * @param {import('geojson').Feature[]} features3857
 * @param {import('geojson').Feature<import('geojson').Polygon>} circle4326
 * @param {Worker} worker
 */
export function runWorkerAnalysis(features3857, circle4326, worker) {
  // Turf in the worker expects geographic coordinates (EPSG:4326).
  const features4326 = features3857.map(fgbFeatureTo4326)
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const { type, payload } = ev.data || {}
      if (type === 'RESULT') {
        worker.removeEventListener('message', onMsg)
        worker.removeEventListener('error', onErr)
        if (payload?.error) reject(new Error(payload.error))
        else resolve(payload)
      }
    }
    const onErr = (err) => {
      worker.removeEventListener('message', onMsg)
      worker.removeEventListener('error', onErr)
      reject(err)
    }
    worker.addEventListener('message', onMsg)
    worker.addEventListener('error', onErr)
    worker.postMessage({
      type: 'ANALYZE',
      payload: {
        features: features4326,
        circleFeature: circle4326,
      },
    })
  })
}
