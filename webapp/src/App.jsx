import { useEffect, useRef, useState } from 'react'
import './App.css'
import OpenLayersMap from './components/Map/OpenLayersMap'
import Legend from './components/Map/Legend'
import AnalysisPanel from './components/Panel/AnalysisPanel'
import LayerControls from './components/LayerControls'
import SearchBar from './components/SearchBar'
import { DEFAULT_RADIUS_KM } from './constants'
import { csvUrlsFromEnv, loadCoefficientTables } from './utils/coefficients'

export default function App() {
  const mapRef = useRef(null)
  const [coeff, setCoeff] = useState(null)
  const [coeffErr, setCoeffErr] = useState(null)
  const [basemap, setBasemap] = useState('osm')
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM)
  const [analysis, setAnalysis] = useState(null)
  const [outPilot, setOutPilot] = useState(false)
  const [fgbErr, setFgbErr] = useState(false)

  const [temporalMode, setTemporalMode] = useState('week')

  useEffect(() => {
    loadCoefficientTables(csvUrlsFromEnv())
      .then((c) => {
        setCoeff(c)
        setCoeffErr(null)
      })
      .catch((e) => setCoeffErr(String(e.message || e)))
  }, [])

  const fgbUrl = import.meta.env.VITE_UNIFIED_FGB_URL

  if (coeffErr) {
    return (
      <div className="blocking-screen">
        <h1>Apiari GIS</h1>
        <p>Impossible de charger les coefficients (CSV).</p>
        <p className="muted">{coeffErr}</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      {!fgbUrl && (
        <div className="banner banner-warn" role="status">
          Définissez <code>VITE_UNIFIED_FGB_URL</code> dans <code>webapp/.env</code> pour charger le
          fichier FGB (parcelles).
        </div>
      )}
      {fgbErr && (
        <div className="banner banner-error" role="alert">
          Données indisponibles — vérifiez l’URL du FGB ou votre connexion.
        </div>
      )}
      {outPilot && (
        <div className="banner banner-warn" role="status">
          Zone hors du périmètre pilote — données non disponibles pour cette zone.
        </div>
      )}
      <header className="app-header glass">
        <h1 className="app-title">Apiari GIS</h1>
        <SearchBar
          disabled={!coeff}
          onPick={(lon, lat) => mapRef.current?.flyTo4326(lon, lat)}
        />
        <LayerControls value={basemap} onChange={setBasemap} />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            navigator.geolocation?.getCurrentPosition(
              (pos) => {
                mapRef.current?.flyTo4326(pos.coords.longitude, pos.coords.latitude)
              },
              () => {},
            )
          }}
        >
          Ma position
        </button>
      </header>
      <main className="app-main">
        <OpenLayersMap
          ref={mapRef}
          coeffBySource={coeff}
          basemap={basemap}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          onAnalysis={(a) => {
            setAnalysis(a)
            if (a) setFgbErr(false)
          }}
          onOutOfPilot={setOutPilot}
          onFgbError={() => setFgbErr(true)}
        />
        {coeff && <Legend coeffBySource={coeff} />}
        <AnalysisPanel
          analysis={analysis}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          temporalMode={temporalMode}
          onTemporalModeChange={setTemporalMode}
        />
      </main>
    </div>
  )
}
