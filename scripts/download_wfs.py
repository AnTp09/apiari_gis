#!/usr/bin/env python3
"""
Download IGN WFS layers for the pilot bounding box (depts 31 + 09) with pagination.

IGN WFS 2.0 expects BBOX in geographic order south,west,north,east with
urn:ogc:def:crs:EPSG::4326 (see TechSpec §7.1).
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import requests

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
WFS_URL = "https://data.geopf.fr/wfs/ows"

# Pilot envelope (degrees): West, East, South, North (document convention)
WEST, EAST, SOUTH, NORTH = 0.954437,1.201630,42.957428,43.101986



# WFS BBOX parameter value: south,west,north,east
WFS_BBOX = f"{SOUTH},{WEST},{NORTH},{EAST},urn:ogc:def:crs:EPSG::4326"

LAYERS = [
    {
        "name": "rpg_pilot",
        "typenames": "RPG.2024:parcelles_graphiques",
    },
    {
        "name": "foret_pilot",
        "typenames": "LANDCOVER.FORESTINVENTORY.V2:formation_vegetale",
    },
    {
        "name": "clc_pilot",
        "typenames": "LANDCOVER.CLC18_FR:clc18_fr",
    },
]

PAGE_SIZE = 1000
MAX_RETRIES = 3
BACKOFF_SEC = (1, 2, 4)


def wfs_getfeature_params(typenames: str, start_index: int) -> dict:
    return {
        "SERVICE": "WFS",
        "VERSION": "2.0.0",
        "REQUEST": "GetFeature",
        "TYPENAMES": typenames,
        "SRSNAME": "urn:ogc:def:crs:EPSG::4326",
        "COUNT": str(PAGE_SIZE),
        "STARTINDEX": str(start_index),
        "BBOX": WFS_BBOX,
        "OUTPUTFORMAT": "application/json",
    }


def fetch_page(session: requests.Session, params: dict) -> dict:
    url = f"{WFS_URL}?{urlencode(params)}"
    last_err: Exception | None = None
    for attempt, wait in enumerate(BACKOFF_SEC):
        try:
            r = session.get(url, timeout=120)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)
    raise RuntimeError(f"WFS request failed after retries: {last_err}") from last_err


def download_layer(session: requests.Session, spec: dict) -> Path:
    typenames = spec["typenames"]
    out_path = RAW_DIR / f"{spec['name']}.geojson"
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    all_features: list = []
    start = 0
    total_matched: int | None = None

    while True:
        params = wfs_getfeature_params(typenames, start)
        data = fetch_page(session, params)
        feats = data.get("features") or []
        if total_matched is None:
            total_matched = data.get("numberMatched")
            print(f"  {spec['name']}: numberMatched={total_matched}", flush=True)

        all_features.extend(feats)
        print(f"  {spec['name']}: fetched {len(feats)} (total {len(all_features)})", flush=True)

        if len(feats) < PAGE_SIZE:
            break
        start += PAGE_SIZE

    fc = {
        "type": "FeatureCollection",
        "features": all_features,
        "name": spec["name"],
    }
    out_path.write_text(json.dumps(fc), encoding="utf-8")
    print(f"  wrote {out_path} ({len(all_features)} features)", flush=True)
    return out_path


def main() -> int:
    print("Downloading WFS layers for pilot BBOX (south,west,north,east)=", WFS_BBOX)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with requests.Session() as session:
        session.headers.update({"User-Agent": "apiari_gis-download_wfs/1.0"})
        for spec in LAYERS:
            download_layer(session, spec)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
