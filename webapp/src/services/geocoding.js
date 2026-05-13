/**
 * Search addresses (France) via api-adresse.data.gouv.fr
 * @param {string} q
 * @returns {Promise<{ label: string, lon: number, lat: number }[]>}
 */
export async function searchAddress(q) {
  const trimmed = q.trim()
  if (trimmed.length < 2) return []
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmed)}&limit=8`
  const r = await fetch(url)
  if (!r.ok) throw new Error('Géocodage indisponible')
  const data = await r.json()
  const feats = data.features || []
  return feats.map((f) => {
    const [lon, lat] = f.geometry.coordinates
    return { label: f.properties.label, lon, lat }
  })
}
