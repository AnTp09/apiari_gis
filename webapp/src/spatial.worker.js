import area from '@turf/area'
import { featureCollection } from '@turf/helpers'
import intersect from '@turf/intersect'

/**
 * @param {import('geojson').Feature} polyFeature - parcel (Polygon | MultiPolygon)
 * @param {import('geojson').Feature<import('geojson').Polygon>} circleFeature
 */
function intersectionArea(polyFeature, circleFeature) {
  try {
    const inter = intersect(featureCollection([polyFeature, circleFeature]))
    if (!inter || !inter.geometry) return 0
    return area(inter)
  } catch {
    return 0
  }
}

function parseWeeksMonths(row) {
  const weeks = (row.semaines_production || '')
    .split(';')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n))
  const months = (row.mois_production || '')
    .split(';')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n))
  return { weeks, months }
}

self.onmessage = (e) => {
  const { type, payload } = e.data || {}
  if (type !== 'ANALYZE') return

  const { features, circleFeature, coeffBySource } = payload
  const A_total = area(circleFeature)
  if (!A_total || A_total <= 0) {
    self.postMessage({ type: 'RESULT', payload: { error: 'Zone invalide' } })
    return
  }

  let sumM = 0
  let sumP = 0
  /** @type {Record<string, { libelle: string, area: number, coeff_mellifere: number, coeff_pollinifere: number }>} */
  const composition = {}
  const weeklyNectar = Object.fromEntries(
    Array.from({ length: 53 }, (_, i) => [i + 1, 0]),
  )
  const weeklyPollen = Object.fromEntries(
    Array.from({ length: 53 }, (_, i) => [i + 1, 0]),
  )
  const monthlyNectar = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, 0]),
  )
  const monthlyPollen = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, 0]),
  )

  let typesCount = 0
  const seenTypes = new Set()

  for (const feat of features) {
    if (!feat.geometry) continue
    const props = feat.properties || {}
    const source = props.source
    const code = props.code != null ? String(props.code) : ''
    const table = coeffBySource[source]
    const row = table?.[code]
    if (!row) continue

    const Ai = intersectionArea(feat, circleFeature)
    if (Ai <= 0) continue

    const m = row.coeff_mellifere
    const p = row.coeff_pollinifere
    sumM += Ai * m
    sumP += Ai * p

    const key = `${source}:${code}`
    if (!seenTypes.has(key)) {
      seenTypes.add(key)
      typesCount += 1
    }

    const lib = row.libelle || code
    if (!composition[key]) {
      composition[key] = {
        libelle: lib,
        area: 0,
        coeff_mellifere: m,
        coeff_pollinifere: p,
        source,
        code,
        couleur: row.couleur || '#888888',
      }
    }
    composition[key].area += Ai

    const { weeks, months } = parseWeeksMonths(row)
    for (const w of weeks) {
      if (w >= 1 && w <= 53) {
        weeklyNectar[w] += Ai * m
        weeklyPollen[w] += Ai * p
      }
    }
    for (const mo of months) {
      if (mo >= 1 && mo <= 12) {
        monthlyNectar[mo] += Ai * m
        monthlyPollen[mo] += Ai * p
      }
    }
  }

  const scoreMellifere = sumM / A_total
  const scorePollinifere = sumP / A_total

  const norm = (o) => {
    const out = {}
    for (const [k, v] of Object.entries(o)) {
      out[k] = v / A_total
    }
    return out
  }

  const weeklyNectarArr = Array.from({ length: 53 }, (_, i) => weeklyNectar[i + 1] / A_total)
  const weeklyPollenArr = Array.from({ length: 53 }, (_, i) => weeklyPollen[i + 1] / A_total)
  const monthlyNectarArr = Array.from({ length: 12 }, (_, i) => monthlyNectar[i + 1] / A_total)
  const monthlyPollenArr = Array.from({ length: 12 }, (_, i) => monthlyPollen[i + 1] / A_total)

  self.postMessage({
    type: 'RESULT',
    payload: {
      scoreMellifere,
      scorePollinifere,
      composition: Object.values(composition),
      weeklyNectar: norm(weeklyNectar),
      weeklyPollen: norm(weeklyPollen),
      monthlyNectar: norm(monthlyNectar),
      monthlyPollen: norm(monthlyPollen),
      weeklyNectarArr,
      weeklyPollenArr,
      monthlyNectarArr,
      monthlyPollenArr,
      areaHa: A_total / 10000,
      typesCount,
    },
  })
}
