# Apiari GIS — implementation tracker

This file tracks work against the technical specification in **`TechSpec`**. Update the **Status** column as you progress (suggested values: `Not started`, `In progress`, `Blocked`, `Done`).

| ID | Area | Task | Status | Notes |
|----|------|------|--------|-------|
| P0-1 | Repo | Initialise git, `.gitignore` (node, Python, `data/raw/`), README with scope and licence | Done | `README.md`, `.gitignore` |
| P0-2 | Repo | Align env URLs: `VITE_UNIFIED_FGB_URL`, optional `VITE_*` for CSV bases | Done | `webapp/.env.example` |
| P1-1 | Data | Python env (`requirements.txt`): geopandas, requests, pyogrio | Done | |
| P1-2 | Data | `scripts/download_wfs.py`: BBOX pilot, pagination, retries | Done | BBOX order `south,west,north,east` for EPSG:4326 |
| P1-3 | Data | `scripts/simplify_geometries.py` | Done | Optional standalone simplify |
| P1-4 | Data | `scripts/merge_layers.py`: RPG → Forêt → CLC, EPSG:3857, `code` + `source` | Done | Run after download |
| P1-5 | Data | `data/unified/unified_31_09.fgb` + `check_fgb_size.py` | Not started | Run pipeline locally; file large → gitignore or LFS |
| P1-6 | Data | CSVs in `data/config/` + copies in `webapp/public/config/` | Done | Placeholder rows — extend with real coefficients |
| P2-1 | Docs | `docs/methodology.md`, `update_instructions.md`, `api_notes.md` | Done | Draft stubs |
| P3-1 | Webapp | Scaffold React + Vite; `flatgeobuf`, `ol`, Turf, Chart.js | Done | `webapp/` — run `npm install` |
| P3-2 | Webapp | FGB bbox reads + zoom ≥ 11 gate | Done | `OpenLayersMap.jsx` vector loader |
| P3-3 | Webapp | Map extent, bases OSM / Esri / OpenTopoMap, styles from CSV | Done | IGN topo deferred (clé souvent requise) |
| P3-4 | Webapp | Legend from CSV tables | Done | `Legend.jsx` |
| P3-5 | Webapp | Analysis circle, radius slider, keyboard +/- / Esc | Done | |
| P3-6 | Webapp | `spatial.worker.js` Turf intersect + scores | Done | `@turf/intersect` v7 = FeatureCollection |
| P3-7 | Webapp | Analysis panel: scores, doughnut, temporal line | Done | |
| P3-8 | Webapp | Adresse.data.gouv search, geolocation, pilot banner | Done | |
| P3-9 | Webapp | Loading line, `prefers-color-scheme` glass UI | Partial | Onboarding hint on map |
| P4-1 | Deploy | GitHub Pages build | Not started | `npm run build`, `base: './'` set |
| P4-2 | Deliverable | Guide utilisateur (FR) | Not started | |

## Milestone summary

| Milestone | Criteria | Status |
|-----------|----------|--------|
| M1 — Data pipeline | Scripts run; `unified_31_09.fgb` produced | In progress |
| M2 — Map + data | Map + FGB layer + legend | Done (needs real FGB URL) |
| M3 — Analysis | Worker + panel wired | Done |
| M4 — Release | Deployed SPA, smoke-tested | Not started |

## Last updated

- 2026-04-03 — Initial implementation: Python scripts, webapp scaffold, docs, sample CSVs.
