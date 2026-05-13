# Updating data (draft)

## Refresh RPG or other WFS layers

1. Check [IGN Géoplateforme](https://data.geopf.fr/) WFS capabilities for current typenames (e.g. `RPG.2025:parcelles_graphiques` when available).
2. Update `typenames` in `scripts/download_wfs.py` if the service changed.
3. Run `python scripts/download_wfs.py`, then `python scripts/merge_layers.py`, then `python scripts/check_fgb_size.py`.

## Extend to more departments

1. Adjust the pilot bounding box constants in `scripts/download_wfs.py` and `scripts/merge_layers.py` (and the webapp pilot extent in `src/constants.js`).
2. Regenerate `unified_31_09.fgb` (rename if needed) and set `VITE_UNIFIED_FGB_URL` accordingly.

## Coefficient tables

Edit CSVs in `data/config/` and redeploy the webapp. If you change codes, regenerate the FlatGeobuf only if you also changed source attributes from WFS.
