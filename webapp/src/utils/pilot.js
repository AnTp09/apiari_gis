import { containsCoordinate, transformExtent } from 'ol/extent'

const PILOT_EXTENT_3857 = transformExtent(
  [0.84, 42.67, 3.23, 43.76],
  'EPSG:4326',
  'EPSG:3857',
)

export function getPilotExtent3857() {
  return PILOT_EXTENT_3857
}

/** @param {[number, number]} coord3857 */
export function pointInPilot3857(coord3857) {
  return containsCoordinate(PILOT_EXTENT_3857, coord3857)
}

/** @param {number} lon
 * @param {number} lat */
export function pointInPilot4326(lon, lat) {
  const [w, s, e, n] = [0.84, 42.67, 3.23, 43.76]
  return lon >= w && lon <= e && lat >= s && lat <= n
}
