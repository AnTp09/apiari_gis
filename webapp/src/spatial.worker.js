/**
 * Web Worker: intersect parcels with the analysis circle and aggregate scores.
 * Coefficients and labels come from each feature's properties (denormalised in the FGB).
 * Temporal profile uses months only (mois_production: "3;4;5").
 */
import area from '@turf/area'
import { featureCollection } from '@turf/helpers'
import intersect from '@turf/intersect'

/**
 * @param {import('geojson').Feature} polyFeature
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

function parseMonths(moisStr) {
  if (moisStr == null || moisStr === '') return []
  return String(moisStr)
    .split(';')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n))
}

self.onmessage = (e) => {
  const { type, payload } = e.data || {}
  if (type !== 'ANALYZE') return

  const { features, circleFeature } = payload
  const A_total = area(circleFeature)
  if (!A_total || A_total <= 0) {
    self.postMessage({ type: 'RESULT', payload: { error: 'Zone invalide' } })
    return
  }

  let sumM = 0
  let sumP = 0
  /** @type {Record<string, { libelle: string, area: number, coeff_mellifere: number, coeff_pollinifere: number, couleur: string, source: string, code: string }>} */
  const composition = {}
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
    const m = Number(props.coeff_mellifere ?? 0)
    const p = Number(props.coeff_pollinifere ?? 0)
    const libelle = props.libelle != null ? String(props.libelle) : code
    const couleur = props.couleur != null ? String(props.couleur) : '#888888'

    const Ai = intersectionArea(feat, circleFeature)
    if (Ai <= 0) continue

    sumM += Ai * m
    sumP += Ai * p

    const key = `${source}:${code}`
    if (!seenTypes.has(key)) {
      seenTypes.add(key)
      typesCount += 1
    }

    if (!composition[key]) {
      composition[key] = {
        libelle,
        area: 0,
        coeff_mellifere: m,
        coeff_pollinifere: p,
        source,
        code,
        couleur,
      }
    }
    composition[key].area += Ai

    const months = parseMonths(props.mois_production)
    for (const mo of months) {
      if (mo >= 1 && mo <= 12) {
        monthlyNectar[mo] += Ai * m
        monthlyPollen[mo] += Ai * p
      }
    }
  }

  const scoreMellifere = sumM / A_total
  const scorePollinifere = sumP / A_total

  const monthlyNectarArr = Array.from({ length: 12 }, (_, i) => monthlyNectar[i + 1] / A_total)
  const monthlyPollenArr = Array.from({ length: 12 }, (_, i) => monthlyPollen[i + 1] / A_total)

  self.postMessage({
    type: 'RESULT',
    payload: {
      scoreMellifere,
      scorePollinifere,
      composition: Object.values(composition),
      monthlyNectarArr,
      monthlyPollenArr,
      areaHa: A_total / 10000,
      typesCount,
    },
  })
}
