const OPTIONS = [
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'esri', label: 'Satellite (Esri)' },
  { id: 'topo', label: 'Relief (OpenTopoMap)' },
]

export default function LayerControls({ value, onChange }) {
  return (
    <div className="layer-controls glass">
      <span className="layer-controls-label">Fond de carte</span>
      <div className="layer-controls-buttons">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={value === o.id ? 'btn-active' : 'btn-secondary'}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
