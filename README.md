# Apiari GIS

Web decision-support map for beekeepers (pilot: French departments **31** Haute-Garonne and **09** Ariège). See **`TechSpec`** for the full technical specification.

## Layout

- **`data/config/`** — Coefficient CSVs (`cultures-config.csv`, `forets-config.csv`, `clc-config.csv`).
- **`data/raw/`** — WFS downloads (gitignored); produced by `scripts/download_wfs.py`.
- **`data/unified/`** — Output FlatGeobuf `unified_31_09.fgb` (generated; may be large).
- **`scripts/`** — Python pipeline to fetch and merge IGN / RPG data.
- **`webapp/`** — React + Vite + OpenLayers SPA.

## Data pipeline (Python)

Use a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

1. Download WFS data for the pilot bbox:

   ```bash
   python scripts/download_wfs.py
   ```

2. Build the unified FlatGeobuf (merge RPG → Forêt → CLC, simplify before overlay in EPSG:3857):

   ```bash
   python scripts/merge_layers.py
   ```

   `merge_layers.py` now applies pre-overlay simplification by default (`--pre-simplify 10`).
   You can tune it:

   ```bash
   python scripts/merge_layers.py --pre-simplify 15
   ```

   Post-merge simplification is disabled by default to avoid reintroducing overlaps at boundaries.
   Enable only if needed:

   ```bash
   python scripts/merge_layers.py --post-simplify 5
   ```

   Do **not** run `simplify_geometries.py` on `data/raw/*.geojson` with `--tolerance 10`: those
   files are in **WGS84**, so the tolerance would be interpreted as **degrees**, not metres.

3. Check size (GitHub raw file limit 100 MB):

   ```bash
   python scripts/check_fgb_size.py
   ```

Optional: `python scripts/simplify_geometries.py --input path --output path` to simplify any GeoPackage / GeoJSON layer.

**Note:** IGN `data.geopf.fr` WFS uses BBOX order **`south,west,north,east`** with `urn:ogc:def:crs:EPSG::4326` (see `scripts/download_wfs.py`). RPG JSON properties use `surf_parc` (not `surf_parcel`).

## Web application

Requires Node.js 20+ (or 18 LTS).

```bash
cd webapp
cp .env.example .env
npm install
npm run dev
```

Set `VITE_UNIFIED_FGB_URL` to the raw URL of `unified_31_09.fgb` and CSV URLs (or use local `/config/*.csv` in `public/config/` for offline dev).

## GitHub Pages deployment

For this repository (`AnTp09/apiari_gis`), the public app URL is:

- `https://antp09.github.io/apiari_gis/`

**Do not use the default “Deploy Jekyll” workflow** GitHub may suggest: it builds the **repository root** as a Jekyll site and you will only see **README.md** in the browser. This project uses **Vite** instead; the workflow **Deploy webapp to GitHub Pages** builds `webapp/` and uploads `webapp/dist`.

To make that URL serve the app:

1. Push `main` with:
   - `webapp/.env.production`
   - `.github/workflows/deploy-pages.yml`
2. **Delete** any `jekyll-gh-pages.yml` (or similar Jekyll) workflow if it exists, so only the Vite deploy workflow runs.
3. In GitHub repository settings, open **Pages** and select **Build and deployment: GitHub Actions**.
4. Push any commit to `main` (or run the workflow manually in **Actions**).
5. Wait until workflow **Deploy webapp to GitHub Pages** is green, then open the URL above.

### If you get "There isn't a GitHub Pages site here" (404)

This almost always means the app has **not been deployed yet** (or Pages is not set to GitHub Actions):

1. Confirm these files are pushed to `main`:
   - `.github/workflows/deploy-pages.yml`
   - `webapp/.env.production`
2. In GitHub: `Settings` → `Pages`:
   - Build and deployment: **GitHub Actions**
3. In GitHub: `Actions` tab:
   - open workflow **Deploy webapp to GitHub Pages**
   - if needed, click **Run workflow**
4. Wait for both jobs (`build`, `deploy`) to be green.
5. Refresh `https://antp09.github.io/apiari_gis/` (hard refresh: Ctrl+F5).

If `build` fails:
- check `webapp/package.json` is valid and pushed
- check `.env.production` values and path to `data/unified/unified_31_09.fgb`
- rerun workflow after pushing a fix

## Local visualisation (without GitHub Pages)

To view the web map locally:

```bash
cd webapp
cp .env.example .env
npm install
npm run dev
```

Then open the URL shown in terminal (usually `http://localhost:5173/`).

## Status

See **`IMPLEMENTATION_STATUS.md`** for task tracking.

## Licence

Specify your licence in a `LICENSE` file when you publish the repository.
