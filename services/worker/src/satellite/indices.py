"""Vegetation indices from Sentinel-2 surface reflectance (pure functions)."""

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]


def normalized_difference(a: FloatArray, b: FloatArray) -> FloatArray:
    """(a - b) / (a + b), NaN where either input is missing or the sum is zero."""
    with np.errstate(divide="ignore", invalid="ignore"):
        total = a + b
        result = np.where(total != 0, (a - b) / total, np.nan)
    return np.clip(result, -1.0, 1.0)


def ndvi(red: FloatArray, nir: FloatArray) -> FloatArray:
    """Vegetation vigour: NIR (B08) against red (B04)."""
    return normalized_difference(nir, red)


def ndre(rededge: FloatArray, nir: FloatArray) -> FloatArray:
    """Chlorophyll: NIR (B08) against red edge (B05)."""
    return normalized_difference(nir, rededge)


def ndmi(nir: FloatArray, swir: FloatArray) -> FloatArray:
    """Leaf water: NIR (B08) against short-wave infrared (B11)."""
    return normalized_difference(nir, swir)
