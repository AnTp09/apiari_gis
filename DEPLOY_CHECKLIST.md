# Deploy checklist (public repo)

Use this checklist each time before publishing to GitHub Pages.

## 1) Data and config

- [ ] `data/unified/unified_31_09.fgb` exists and size checked (`python scripts/check_fgb_size.py`)
- [ ] `data/config/*.csv` contain expected values (not placeholders for production)
- [ ] `webapp/.env.production` points to the right raw GitHub URLs

## 2) Local validation

- [ ] `cd webapp && npm install`
- [ ] `npm run dev` opens correctly
- [ ] map renders polygons at zoom >= 11
- [ ] search, geolocation, circle analysis and charts work
- [ ] no critical console errors

## 3) Pages deployment

- [ ] `.github/workflows/deploy-pages.yml` is present on `main`
- [ ] GitHub `Settings -> Pages -> Build and deployment` is set to **GitHub Actions**
- [ ] last run of **Deploy webapp to GitHub Pages** is green
- [ ] public URL loads: `https://antp09.github.io/apiari_gis/`

## 4) Public repo hygiene

- [ ] no secrets in committed files (`.env`, tokens, keys)
- [ ] README deployment section is up to date
- [ ] `IMPLEMENTATION_STATUS.md` reflects real status
