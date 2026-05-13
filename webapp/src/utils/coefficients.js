/**
 * Parse simple CSV (no quoted commas in fields). Header row required.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',')
    const row = {}
    header.forEach((h, j) => {
      row[h] = (cells[j] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

/**
 * @param {Record<string, string>[]} rows
 * @returns {Record<string, {
 *   code: string,
 *   libelle: string,
 *   couleur: string,
 *   coeff_mellifere: number,
 *   coeff_pollinifere: number,
 *   semaines_production: string,
 *   mois_production: string,
 * }>}
 */
export function rowsToMap(rows) {
  const map = {}
  for (const r of rows) {
    const code = r.code != null ? String(r.code).trim() : ''
    if (!code) continue
    map[code] = {
      code,
      libelle: r.libelle || code,
      couleur: r.couleur || '#AAAAAA',
      coeff_mellifere: parseFloat(r.coeff_mellifere) || 0,
      coeff_pollinifere: parseFloat(r.coeff_pollinifere) || 0,
      semaines_production: r.semaines_production || '',
      mois_production: r.mois_production || '',
    }
  }
  return map
}

export async function loadCoefficientTables(urls) {
  const [cultures, forets, clc] = await Promise.all([
    fetch(urls.cultures).then((r) => {
      if (!r.ok) throw new Error(`CSV cultures: ${r.status}`)
      return r.text()
    }),
    fetch(urls.forets).then((r) => {
      if (!r.ok) throw new Error(`CSV forêts: ${r.status}`)
      return r.text()
    }),
    fetch(urls.clc).then((r) => {
      if (!r.ok) throw new Error(`CSV CLC: ${r.status}`)
      return r.text()
    }),
  ])
  return {
    rpg: rowsToMap(parseCsv(cultures)),
    foret: rowsToMap(parseCsv(forets)),
    clc: rowsToMap(parseCsv(clc)),
  }
}

export function csvUrlsFromEnv() {
  const base = import.meta.env.BASE_URL || '/'
  const local = (name) => `${base}config/${name}`.replace(/\/+/g, '/')
  return {
    cultures:
      import.meta.env.VITE_CSV_CULTURES_URL || local('cultures-config.csv'),
    forets: import.meta.env.VITE_CSV_FORETS_URL || local('forets-config.csv'),
    clc: import.meta.env.VITE_CSV_CLC_URL || local('clc-config.csv'),
  }
}
