import { useState } from 'react'
import { searchAddress } from '../services/geocoding'
import { pointInPilot4326 } from '../utils/pilot'

export default function SearchBar({ onPick, disabled }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)

  const onChange = async (v) => {
    setQ(v)
    setMsg('')
    if (v.trim().length < 3) {
      setResults([])
      setOpen(false)
      return
    }
    try {
      const r = await searchAddress(v)
      setResults(r)
      setOpen(r.length > 0)
    } catch {
      setMsg('Géocodage indisponible')
      setResults([])
    }
  }

  const pick = (item) => {
    setQ(item.label)
    setOpen(false)
    if (!pointInPilot4326(item.lon, item.lat)) {
      setMsg('Adresse hors zone pilote (31 / 09)')
      return
    }
    setMsg('')
    onPick?.(item.lon, item.lat)
  }

  return (
    <div className={`search-bar glass ${disabled ? 'disabled' : ''}`}>
      <input
        type="search"
        placeholder="Rechercher une adresse…"
        value={q}
        disabled={disabled}
        onChange={(e) => void onChange(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        aria-label="Recherche d'adresse"
      />
      {open && (
        <ul className="search-results" role="listbox">
          {results.map((item) => (
            <li key={item.label}>
              <button type="button" className="search-hit" onClick={() => pick(item)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="search-msg">{msg}</p>}
    </div>
  )
}
