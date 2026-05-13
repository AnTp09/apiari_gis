import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import { RADIUS_MAX_KM, RADIUS_MIN_KM, RADIUS_STEP_KM } from '../../constants'

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

function ScoreCard({ title, value, color }) {
  const v = value != null && !Number.isNaN(value) ? value.toFixed(1) : '—'
  return (
    <div className="score-card" style={{ borderColor: color }}>
      <div className="score-card-label">{title}</div>
      <div className="score-card-value" style={{ color }}>
        {v}
      </div>
      <div className="score-card-scale">/ 10</div>
    </div>
  )
}

function monthLabels() {
  return ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
}

export default function AnalysisPanel({ analysis, radiusKm, onRadiusChange }) {
  const comp = analysis?.composition || []
  const pieData = {
    labels: comp.map((c) => c.libelle),
    datasets: [
      {
        data: comp.map((c) => c.area / 10000),
        backgroundColor: comp.map((c) => c.couleur || '#aaaaaa'),
      },
    ],
  }

  const lineLabels = monthLabels()
  const nectarVals = analysis?.monthlyNectarArr || []
  const pollenVals = analysis?.monthlyPollenArr || []

  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: 'Nectar',
        data: nectarVals,
        borderColor: '#c9a227',
        backgroundColor: 'rgba(201, 162, 39, 0.15)',
        tension: 0.2,
        pointRadius: 0,
      },
      {
        label: 'Pollen',
        data: pollenVals,
        borderColor: '#2e6b3a',
        backgroundColor: 'rgba(46, 107, 58, 0.12)',
        tension: 0.2,
        pointRadius: 0,
      },
    ],
  }

  return (
    <aside className="analysis-panel glass">
      <h2 className="panel-title">Potentiel apicole</h2>

      <div className="panel-scores">
        <ScoreCard title="Mellifère" value={analysis?.scoreMellifere} color="#c9a227" />
        <ScoreCard title="Pollinifère" value={analysis?.scorePollinifere} color="#2e6b3a" />
      </div>

      <label className="radius-control">
        <span>
          Rayon : {radiusKm.toFixed(1)} km
        </span>
        <input
          type="range"
          min={RADIUS_MIN_KM}
          max={RADIUS_MAX_KM}
          step={RADIUS_STEP_KM}
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
        />
      </label>

      <div className="panel-section">
        <h3>Composition (ha dans le cercle)</h3>
        {comp.length ? (
          <div className="chart-wrap">
            <Doughnut
              data={pieData}
              options={{
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const ha = ctx.parsed
                        return `${ctx.label}: ${ha?.toFixed?.(2) ?? 0} ha`
                      },
                    },
                  },
                },
                maintainAspectRatio: false,
              }}
            />
          </div>
        ) : (
          <p className="muted">Aucune donnée — placez le cercle sur la carte (zoom ≥ 11).</p>
        )}
      </div>

      <div className="panel-section">
        <h3>Profil temporel (par mois)</h3>
        <div className="chart-wrap chart-wrap-tall">
          {analysis ? (
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    min: 0,
                    max: 10,
                    title: { display: true, text: 'Potentiel moyen (0–10)' },
                  },
                },
                plugins: { legend: { position: 'bottom' } },
              }}
            />
          ) : (
            <p className="muted">—</p>
          )}
        </div>
      </div>

      <div className="panel-summary">
        <div>Surface analysée : {analysis?.areaHa != null ? `${analysis.areaHa.toFixed(1)} ha` : '—'}</div>
        <div>Types distincts : {analysis?.typesCount ?? '—'}</div>
        <div>Rayon : {radiusKm.toFixed(1)} km</div>
      </div>
    </aside>
  )
}
