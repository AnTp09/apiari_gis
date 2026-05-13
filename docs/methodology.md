# Methodology (draft)

The unified land-cover layer combines **RPG 2024**, **BD Forêt V2**, and **CLC 2018** over the pilot bounding box (departments 31 and 09), with strict priority so polygons do not overlap: RPG first, then forest outside RPG, then CLC outside the union of the first two. All processing uses **EPSG:3857** after an initial fetch in **EPSG:4326** from the IGN WFS.

Coefficients (`coeff_mellifere`, `coeff_pollinifere`) and flowering calendars (`semaines_production`, `mois_production`) are maintained in CSV files under `data/config/`. They are expert-derived placeholders in this repository until replaced by your full reference tables.

Scores in the application are area-weighted means of coefficients over the user-defined circle (see `TechSpec` §3).
