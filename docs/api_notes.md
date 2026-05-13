# API and hosting notes (draft)

## WFS

- Base URL: `https://data.geopf.fr/wfs/ows`
- JSON output: `OUTPUTFORMAT=application/json`
- Pagination: `COUNT`, `STARTINDEX` (WFS 2.0)
- **BBOX** with `urn:ogc:def:crs:EPSG::4326` uses order **south,west,north,east** (verified for this service).

## GitHub raw vs Git LFS

- `raw.githubusercontent.com` serves full bytes for normal files and supports **Range** requests (needed for FlatGeobuf partial reads).
- **Git LFS** pointer files on `raw.githubusercontent.com` are not the binary; use a **Release asset** URL instead (see `TechSpec` §7.4).

## Geocoding

- Address search: `https://api-adresse.data.gouv.fr/search/?q=…` (returns GeoJSON features with WGS84 coordinates).
