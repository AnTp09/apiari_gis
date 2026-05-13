/**
 * Legend built from features currently loaded on the map (each feature carries libelle/couleur).
 */
export default function Legend({ items }) {
  if (!items?.length) return null

  const groups = ['rpg', 'foret', 'clc'].map((src) => ({
    key: src,
    label: src === 'rpg' ? 'RPG' : src === 'foret' ? 'Forêt' : 'CLC',
    rows: items.filter((i) => i.source === src),
  }))

  return (
    <aside className="legend glass">
      <h3 className="legend-title">Légende</h3>
      {groups.map(({ key, label, rows }) => {
        if (!rows.length) return null
        return (
          <div key={key} className="legend-group">
            <div className="legend-group-title">{label}</div>
            <ul className="legend-list">
              {rows.map((r) => (
                <li key={`${r.source}-${r.code}`} className="legend-item">
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: r.couleur || '#aaa' }}
                    aria-hidden
                  />
                  <span>{r.libelle}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </aside>
  )
}
