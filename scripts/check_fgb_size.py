#!/usr/bin/env python3
"""Report FlatGeobuf size and feature count; warn near GitHub 100 MB limit."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FGB = ROOT / "data" / "unified" / "unified_31_09.fgb"
WARN_MB = 90
HARD_MB = 100


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_FGB
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    size_b = path.stat().st_size
    size_mb = size_b / (1024 * 1024)
    print(f"{path.name}: {size_b:,} bytes ({size_mb:.2f} MB)")

    try:
        import pyogrio
    except ImportError:
        print("(install pyogrio for feature count)")
        return 0

    meta = pyogrio.read_info(path)
    n = meta.get("features")
    if n is not None:
        print(f"Features: {n:,}")

    if size_mb >= HARD_MB:
        print(
            f"ERROR: file exceeds GitHub single-file limit ({HARD_MB} MB). "
            "Use stronger simplification or GitHub Release + LFS (see TechSpec §7.4).",
            file=sys.stderr,
        )
        return 2
    if size_mb >= WARN_MB:
        print(
            f"WARNING: file is above {WARN_MB} MB — stay under {HARD_MB} MB for raw.githubusercontent.com."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
