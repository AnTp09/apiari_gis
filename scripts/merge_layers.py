#!/usr/bin/env python3
"""
Merge RPG, BD Forêt, CLC with priority (RPG > Forêt > CLC), clip to pilot extent,
simplify (optional, metres in EPSG:3857), write FlatGeobuf unified_31_09.fgb.

Expects GeoJSON from scripts/download_wfs.py in data/raw/.

Coefficient tables under data/config/ are joined onto each polygon before export so
the web client only reads feature attributes (no separate CSV fetch at runtime).
Attributes written: libelle, couleur, coeff_mellifere, coeff_pollinifere, mois_production
(semaines_production is ignored on purpose — monthly profile only in the app).
"""

from __future__ import annotations

import argparse
import sys
import warnings
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
CONFIG_DIR = ROOT / "data" / "config"
OUT_DIR = ROOT / "data" / "unified"
OUT_FGB = OUT_DIR / "unified_31_09.fgb"

WEST, EAST, SOUTH, NORTH = 0.840, 3.230, 42.670, 43.760
CRS_WGS84 = "EPSG:4326"
CRS_WEBMERC = "EPSG:3857"
SIMPLIFY_METERS = 10.0
DEFAULT_COLOUR = "#AAAAAA"


def _nonempty_geom_mask(geom: gpd.GeoSeries) -> pd.Series:
    """GeoPandas 1+: explicit empty + missing filter (avoids notna() deprecation noise)."""
    return ~geom.is_empty & ~geom.isna()


def _series_union_all(geom: gpd.GeoSeries):
    """Prefer union_all(); older GeoPandas only had unary_union."""
    if hasattr(geom, "union_all"):
        return geom.union_all()
    return geom.unary_union


def _pilot_clip_polygon() -> gpd.GeoDataFrame:
    """Pilot rectangle in EPSG:3857."""
    corners = gpd.GeoDataFrame(
        geometry=gpd.points_from_xy(
            [WEST, WEST, EAST, EAST],
            [SOUTH, NORTH, SOUTH, NORTH],
            crs=CRS_WGS84,
        )
    )
    corners = corners.to_crs(CRS_WEBMERC)
    xmin, ymin = corners.geometry.x.min(), corners.geometry.y.min()
    xmax, ymax = corners.geometry.x.max(), corners.geometry.y.max()
    rect = box(xmin, ymin, xmax, ymax)
    return gpd.GeoDataFrame(geometry=[rect], crs=CRS_WEBMERC)


def _read_raw(name: str) -> gpd.GeoDataFrame:
    path = RAW_DIR / f"{name}.geojson"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run: python scripts/download_wfs.py"
        )
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        gdf = gdf.set_crs(CRS_WGS84)
    # Some WFS layers occasionally come back in projected coordinates but with EPSG:4326 metadata.
    # Detect this by impossible lon/lat bounds and correct guessed source CRS.
    if str(gdf.crs).upper() in {"EPSG:4326", "WGS 84"} and len(gdf) > 0:
        minx, miny, maxx, maxy = gdf.total_bounds
        if abs(minx) > 180 or abs(maxx) > 180 or abs(miny) > 90 or abs(maxy) > 90:
            guessed = CRS_WEBMERC
            # Lambert-93 typical range over France (meters): x≈0..1,300,000, y≈6,000,000..7,200,000
            if 0 <= minx <= 1300000 and 0 <= maxx <= 1300000 and 5800000 <= miny <= 7300000:
                guessed = "EPSG:2154"
            print(
                f"  warning: {name} appears projected but tagged EPSG:4326; "
                f"forcing source CRS to {guessed}",
                flush=True,
            )
            gdf = gdf.set_crs(guessed, allow_override=True)
    return gdf


def _repair_geom(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Make geometries valid before clip/overlay (avoids GEOS TopologyException)."""
    if gdf.empty:
        return gdf
    gdf = gdf.loc[_nonempty_geom_mask(gdf.geometry)].copy()
    if gdf.empty:
        return gdf
    # Only repair invalid geometries to avoid unnecessary transformations.
    invalid = ~gdf.geometry.is_valid
    if invalid.any() and hasattr(gdf.geometry, "make_valid"):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            gdf.loc[invalid, "geometry"] = gdf.loc[invalid, "geometry"].make_valid()
    gdf["geometry"] = gdf.geometry.buffer(0)
    return gdf.loc[_nonempty_geom_mask(gdf.geometry)]


def _load_coeff_table(name: str) -> pd.DataFrame:
    path = CONFIG_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing coefficient CSV: {path}")
    df = pd.read_csv(path, dtype=str, encoding="utf-8")
    if "code" not in df.columns:
        raise ValueError(f"{path} must contain a 'code' column")
    df = df.copy()
    df["code"] = df["code"].astype(str).str.strip()
    return df.drop_duplicates(subset=["code"], keep="first").reset_index(drop=True)


def _enrich_from_coeff_table(gdf: gpd.GeoDataFrame, table: pd.DataFrame, label: str) -> gpd.GeoDataFrame:
    """Attach libelle, couleur, coefficients, mois_production from CSV rows keyed by code."""
    if gdf.empty:
        return gdf
    gdf = gdf.copy()
    idx = table.set_index("code", drop=False)
    libs, cols, ms, ps, mois = [], [], [], [], []
    for code in gdf["code"].astype(str):
        if code in idx.index:
            row = idx.loc[code]
            if isinstance(row, pd.DataFrame):
                row = row.iloc[0]
            libs.append(str(row.get("libelle", code) or code))
            c = row.get("couleur", "") or ""
            cols.append(str(c).strip() if str(c).strip() else DEFAULT_COLOUR)
            try:
                ms.append(float(row.get("coeff_mellifere", 0) or 0))
            except (TypeError, ValueError):
                ms.append(0.0)
            try:
                ps.append(float(row.get("coeff_pollinifere", 0) or 0))
            except (TypeError, ValueError):
                ps.append(0.0)
            m = row.get("mois_production", "")
            mois.append("" if pd.isna(m) else str(m).strip())
        else:
            print(f"  warning: {label} unknown code '{code}' — using defaults", flush=True)
            libs.append(code)
            cols.append(DEFAULT_COLOUR)
            ms.append(0.0)
            ps.append(0.0)
            mois.append("")
    gdf["libelle"] = libs
    gdf["couleur"] = cols
    gdf["coeff_mellifere"] = ms
    gdf["coeff_pollinifere"] = ps
    gdf["mois_production"] = mois
    return gdf


def _prepare_rpg(gdf: gpd.GeoDataFrame, clip_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf.to_crs(CRS_WEBMERC)
    gdf = _repair_geom(gdf)
    gdf = gpd.clip(gdf, clip_gdf)
    gdf = gdf.loc[_nonempty_geom_mask(gdf.geometry)]
    if gdf.empty:
        return gdf
    gdf = gdf.copy()
    gdf["code"] = gdf["code_cultu"].astype(str)
    gdf["source"] = "rpg"
    keep = ["geometry", "code", "source"]
    return gdf[keep]


def _prepare_foret(gdf: gpd.GeoDataFrame, clip_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf.to_crs(CRS_WEBMERC)
    gdf = _repair_geom(gdf)
    gdf = gpd.clip(gdf, clip_gdf)
    gdf = gdf.loc[_nonempty_geom_mask(gdf.geometry)]
    if gdf.empty:
        return gdf
    gdf = gdf.copy()
    gdf["code"] = gdf["code_tfv"].astype(str)
    gdf["source"] = "foret"
    return gdf[["geometry", "code", "source"]]


def _prepare_clc(gdf: gpd.GeoDataFrame, clip_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf.to_crs(CRS_WEBMERC)
    gdf = _repair_geom(gdf)
    gdf = gpd.clip(gdf, clip_gdf)
    gdf = gdf.loc[_nonempty_geom_mask(gdf.geometry)]
    if gdf.empty:
        return gdf
    gdf = gdf.copy()
    gdf["code"] = gdf["code_18"].astype(str)
    gdf["source"] = "clc"
    return gdf[["geometry", "code", "source"]]


def _fix_geom(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if gdf.empty:
        return gdf
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.buffer(0)
    return gdf.loc[_nonempty_geom_mask(gdf.geometry)]


def _simplify_layer_m(gdf: gpd.GeoDataFrame, meters: float, label: str) -> gpd.GeoDataFrame:
    """Simplify in projected CRS (EPSG:3857): tolerance is metres."""
    if gdf.empty or meters <= 0:
        return gdf
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.simplify(meters, preserve_topology=True)
    gdf = gdf.loc[_nonempty_geom_mask(gdf.geometry)]
    print(f"  pre-simplified {label}: {len(gdf)} features ({meters} m)", flush=True)
    return gdf


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--pre-simplify",
        type=float,
        metavar="M",
        default=SIMPLIFY_METERS,
        help=(
            "Simplify each source layer in EPSG:3857 after clip (M metres), "
            "before overlay. Default is 10 m. Use 0 to disable. "
            "Do not use scripts/simplify_geometries.py on WGS84 raw files with a metre value."
        ),
    )
    ap.add_argument(
        "--post-simplify",
        type=float,
        metavar="M",
        default=0.0,
        help=(
            "Optional simplify after concatenation (default 0 = disabled). "
            "Warning: post-simplify can create tiny overlaps at shared boundaries."
        ),
    )
    args = ap.parse_args()

    print("Loading coefficient CSVs from data/config/…", flush=True)
    cultures = _load_coeff_table("cultures-config.csv")
    forets = _load_coeff_table("forets-config.csv")
    clc_tbl = _load_coeff_table("clc-config.csv")

    clip_gdf = _pilot_clip_polygon()

    print("Loading RPG…")
    rpg = _prepare_rpg(_read_raw("rpg_pilot"), clip_gdf)
    rpg = _enrich_from_coeff_table(rpg, cultures, "RPG")
    rpg = _fix_geom(rpg)
    if rpg.empty:
        print("RPG layer empty after clip — aborting.", file=sys.stderr)
        return 1
    print(f"  RPG prepared: {len(rpg)} features", flush=True)

    print("Loading BD Forêt…")
    foret = _prepare_foret(_read_raw("foret_pilot"), clip_gdf)
    foret = _enrich_from_coeff_table(foret, forets, "Forêt")
    foret = _fix_geom(foret)
    print(f"  Forêt prepared: {len(foret)} features", flush=True)
    print("Loading CLC…")
    clc = _prepare_clc(_read_raw("clc_pilot"), clip_gdf)
    clc = _enrich_from_coeff_table(clc, clc_tbl, "CLC")
    clc = _fix_geom(clc)
    print(f"  CLC prepared: {len(clc)} features", flush=True)

    if args.pre_simplify and args.pre_simplify > 0:
        print(f"Pre-simplify each layer ({args.pre_simplify} m, EPSG:3857) before overlay…")
        rpg = _simplify_layer_m(rpg, args.pre_simplify, "RPG")
        foret = _simplify_layer_m(foret, args.pre_simplify, "Forêt")
        clc = _simplify_layer_m(clc, args.pre_simplify, "CLC")
        if rpg.empty:
            print("RPG empty after pre-simplify — aborting.", file=sys.stderr)
            return 1

    print("Building RPG coverage mask…")
    rpg_union = gpd.GeoDataFrame(geometry=[_series_union_all(rpg.geometry)], crs=CRS_WEBMERC)
    rpg_union = _fix_geom(rpg_union)

    print("Subtracting RPG from Forêt…")
    if foret.empty:
        foret_diff = foret
    else:
        foret_diff = gpd.overlay(foret, rpg_union, how="difference")
        foret_diff = _fix_geom(foret_diff)
    print(f"  Forêt after RPG difference: {len(foret_diff)} features", flush=True)

    print("Subtracting RPG + Forêt from CLC…")
    if clc.empty:
        clc_diff = clc
    else:
        rpg_geom = rpg_union.geometry.iloc[0]
        if foret_diff.empty:
            mask_geom = rpg_geom
        else:
            mask_geom = unary_union([rpg_geom, _series_union_all(foret_diff.geometry)])
        mask = gpd.GeoDataFrame(geometry=[mask_geom], crs=CRS_WEBMERC)
        mask = _fix_geom(mask)
        clc_diff = gpd.overlay(clc, mask, how="difference")
        clc_diff = _fix_geom(clc_diff)
    print(f"  CLC after RPG+Forêt difference: {len(clc_diff)} features", flush=True)

    print("Concatenating layers…")
    unified = gpd.GeoDataFrame(
        pd.concat([rpg, foret_diff, clc_diff], ignore_index=True),
        crs=CRS_WEBMERC,
    )
    unified = unified.loc[_nonempty_geom_mask(unified.geometry)]

    if args.post_simplify and args.post_simplify > 0:
        print(
            f"Post-simplifying ({args.post_simplify} m, preserve_topology=True)…",
            flush=True,
        )
        unified["geometry"] = unified.geometry.simplify(
            args.post_simplify, preserve_topology=True
        )
        unified = unified.loc[_nonempty_geom_mask(unified.geometry)]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Writing {OUT_FGB}…")
    unified.to_file(OUT_FGB, driver="FlatGeobuf", spatial_index=True)
    print(f"Features: {len(unified)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
