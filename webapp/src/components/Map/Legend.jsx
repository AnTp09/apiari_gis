export default function Legend({ coeffBySource }) {
  if (!coeffBySource) return null
  const groups = [
    ['rpg', 'RPG'],
    ['foret', 'Forêt'],
    ['clc', 'CLC'],
  ]
  return (
    <aside className="legend glass">
      <h3 className="legend-title">Légende</h3>
      {groups.map(([key, label]) => {
        const rows = Object.values(coeffBySource[key] || {})
        if (!rows.length) return null
        return (
          <div key={key} className="legend-group">
            <div className="legend-group-title">{label}</div>
            <ul className="legend-list">
              {rows.map((r) => (
                <li key={`${key}-${r.code}`} className="legend-item">
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
