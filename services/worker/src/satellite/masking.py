"""Cloud masking with the Sentinel-2 scene classification layer (SCL)."""

from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray

# SCL classes treated as a clear view of the ground: vegetation (4), bare
# soil (5), water (6) and unclassified (7). Everything else is no data,
# saturated, dark/shadow, cloud, cirrus or snow.
CLEAR_SCL_CLASSES = (4, 5, 6, 7)

CLOUDY_FROM_PCT = 60.0
PARTLY_CLOUDY_FROM_PCT = 20.0
# Below this many clear pixels a field mean is not meaningful.
MIN_CLEAR_PIXELS = 3

Quality = Literal["good", "partly_cloudy", "cloudy"]


@dataclass(frozen=True)
class FieldSky:
    cloud_cover_pct: float
    quality: Quality


def clear_mask(scl: NDArray[np.integer]) -> NDArray[np.bool_]:
    return np.isin(scl, CLEAR_SCL_CLASSES)


def field_sky(clear: NDArray[np.bool_], inside: NDArray[np.bool_]) -> FieldSky:
    """Cloud share over the field's own pixels, and the resulting quality."""
    total = int(inside.sum())
    if total == 0:
        return FieldSky(100.0, "cloudy")
    clear_count = int((clear & inside).sum())
    cloud_pct = round(100.0 * (total - clear_count) / total, 2)
    if cloud_pct >= CLOUDY_FROM_PCT or clear_count < MIN_CLEAR_PIXELS:
        return FieldSky(cloud_pct, "cloudy")
    if cloud_pct >= PARTLY_CLOUDY_FROM_PCT:
        return FieldSky(cloud_pct, "partly_cloudy")
    return FieldSky(cloud_pct, "good")
