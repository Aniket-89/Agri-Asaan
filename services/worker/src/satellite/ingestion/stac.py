"""Finds Sentinel-2 L2A passes over a field in a public STAC catalogue."""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pystac_client import Client

log = logging.getLogger(__name__)

COLLECTION = "sentinel-2-l2a"
# Earth Search v1 asset keys: B04, B08 (10 m); B05, B11, SCL (20 m).
BAND_ASSETS = {"red": "red", "nir": "nir", "rededge": "rededge1", "swir": "swir16", "scl": "scl"}
# Tile-level prefilter only; the field's own cloud share decides quality.
MAX_TILE_CLOUD_PCT = 80
MAX_SCENES = 40


@dataclass(frozen=True)
class BandAsset:
    href: str
    # Digital number -> reflectance: dn * scale + offset (0 is no data).
    scale: float
    offset: float


@dataclass(frozen=True)
class Scene:
    id: str
    observed_at: datetime
    bands: dict[str, BandAsset]


def with_retries[T](call: Callable[[], T], attempts: int = 3, base_delay: float = 2.0) -> T:
    """Runs `call`, retrying with bounded exponential backoff."""
    for attempt in range(1, attempts + 1):
        try:
            return call()
        except Exception:
            if attempt == attempts:
                raise
            delay = base_delay * 2 ** (attempt - 1)
            log.warning("catalogue request failed (attempt %d), retrying in %.0fs", attempt, delay)
            time.sleep(delay)
    raise AssertionError("unreachable")


def _band_asset(asset: Any) -> BandAsset:
    bands = asset.extra_fields.get("raster:bands") or [{}]
    return BandAsset(
        href=asset.href,
        scale=float(bands[0].get("scale", 1.0)),
        offset=float(bands[0].get("offset", 0.0)),
    )


def search_scenes(
    stac_url: str, boundary_geojson: dict[str, Any], start: datetime, end: datetime
) -> list[Scene]:
    """Passes intersecting the boundary between `start` and `end`, oldest first."""

    def run() -> list[Any]:
        client = Client.open(stac_url)
        search = client.search(
            collections=[COLLECTION],
            intersects=boundary_geojson,
            datetime=[start, end],
            query={"eo:cloud_cover": {"lt": MAX_TILE_CLOUD_PCT}},
            sortby=[{"field": "properties.datetime", "direction": "asc"}],
            max_items=MAX_SCENES,
        )
        return list(search.items())

    scenes: list[Scene] = []
    for item in with_retries(run):
        if not all(key in item.assets for key in BAND_ASSETS.values()) or item.datetime is None:
            continue
        scenes.append(
            Scene(
                id=item.id,
                observed_at=item.datetime,
                bands={name: _band_asset(item.assets[key]) for name, key in BAND_ASSETS.items()},
            )
        )
    return scenes
