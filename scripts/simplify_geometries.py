#!/usr/bin/env python3
"""
Optional: simplify geometries in any file GeoPandas can read, write GeoJSON or GPKG.

Tolerance is in the **layer CRS units** (degrees on EPSG:4326 — do not pass "10" thinking
it is metres; that would wreck the data). For WFS raw GeoJSON in WGS84, reproject to
EPSG:3857 first, or use `merge_layers.py --pre-simplify M` instead.

Example (layer already in EPSG:3857, tolerance = metres):

  ogr2ogr -t_srs EPSG:3857 data/raw/rpg_3857.gpkg data/raw/rpg_pilot.geojson
  python scripts/simplify_geometries.py --input data/raw/rpg_3857.gpkg \\
      --output data/raw/rpg_simplified.gpkg --tolerance 10
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import geopandas as gpd


def main() -> int:
    p = argparse.ArgumentParser(description="Simplify geometries (projected CRS, meters).")
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument(
        "--tolerance",
        type=float,
        default=10.0,
        help="Simplification tolerance in the layer's CRS units (use meters in EPSG:3857).",
    )
    args = p.parse_args()

    gdf = gpd.read_file(args.input)
    if gdf.crs is None:
        print("Input has no CRS; set CRS before simplifying.", file=sys.stderr)
        return 1
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.simplify(args.tolerance, preserve_topology=True)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    suff = args.output.suffix.lower()
    driver = {".geojson": "GeoJSON", ".json": "GeoJSON", ".gpkg": "GPKG"}.get(suff)
    gdf.to_file(args.output, driver=driver)
    print(f"Wrote {args.output} ({len(gdf)} features)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
