"""Turns one satellite pass over one field into field statistics and pixels.

Pure: inputs are arrays already read from the scene, so this runs in tests
without network access.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np
import shapely
from numpy.typing import NDArray
from shapely.geometry.base import BaseGeometry

from satellite.indices import FloatArray, ndmi, ndre, ndvi
from satellite.masking import FieldSky, clear_mask, field_sky

# A pixel counts towards the field mean when at least half of it is inside.
STATS_MIN_COVERAGE = 0.5
DECIMALS = 3

# Affine (a, b, c, d, e, f): x = a*col + b*row + c, y = d*col + e*row + f.
Transform = tuple[float, float, float, float, float, float]

# (x, y) in the raster CRS -> (longitude, latitude).
ToLngLat = Callable[[FloatArray, FloatArray], tuple[FloatArray, FloatArray]]


@dataclass(frozen=True)
class Bands:
    """Surface reflectance on one 10 m grid (NaN = no data), plus SCL."""

    red: FloatArray
    nir: FloatArray
    rededge: FloatArray
    swir: FloatArray
    scl: NDArray[np.integer]
    transform: Transform


@dataclass(frozen=True)
class Cell:
    ring: list[tuple[float, float]]
    ndvi: float | None
    ndre: float | None
    ndmi: float | None


@dataclass(frozen=True)
class PassResult:
    sky: FieldSky
    # Field means over clear pixels; None when the pass is cloudy.
    means: dict[str, float] | None
    cells: list[Cell]


def pixel_boxes(shape: tuple[int, int], transform: Transform) -> Any:
    """One shapely box per pixel (rows x cols), north-up grids only."""
    a, _, c, _, e, f = transform
    rows, cols = shape
    col_index, row_index = np.meshgrid(np.arange(cols), np.arange(rows))
    x0 = c + a * col_index
    y0 = f + e * row_index
    return shapely.box(x0, y0 + e, x0 + a, y0)


def _rounded(value: float) -> float | None:
    return None if np.isnan(value) else round(float(value), DECIMALS)


def process_pass(bands: Bands, boundary: BaseGeometry, to_lnglat: ToLngLat) -> PassResult:
    """`boundary` is in the raster CRS, like `bands.transform`."""
    boxes = pixel_boxes(bands.red.shape, bands.transform)
    pixel_area = abs(bands.transform[0] * bands.transform[4])
    clipped = shapely.intersection(boxes, boundary)
    coverage = shapely.area(clipped) / pixel_area

    counted = coverage >= STATS_MIN_COVERAGE
    has_data = ~(np.isnan(bands.red) | np.isnan(bands.nir))
    clear = clear_mask(bands.scl) & has_data
    sky = field_sky(clear, counted)

    indices = {
        "ndvi": ndvi(bands.red, bands.nir),
        "ndre": ndre(bands.rededge, bands.nir),
        "ndmi": ndmi(bands.nir, bands.swir),
    }

    means: dict[str, float] | None = None
    if sky.quality != "cloudy":
        means = {}
        for name, values in indices.items():
            mean = _rounded(float(np.nanmean(np.where(clear & counted, values, np.nan))))
            if mean is None:
                means = None
                break
            means[name] = mean

    cells: list[Cell] = []
    if means is not None:
        for row, col in zip(*np.nonzero(coverage > 0), strict=True):
            ring = _ring_lnglat(clipped[row, col], to_lnglat)
            if ring is None:
                continue
            visible = bool(clear[row, col])
            cells.append(
                Cell(
                    ring=ring,
                    ndvi=_rounded(indices["ndvi"][row, col]) if visible else None,
                    ndre=_rounded(indices["ndre"][row, col]) if visible else None,
                    ndmi=_rounded(indices["ndmi"][row, col]) if visible else None,
                )
            )
    return PassResult(sky=sky, means=means, cells=cells)


def _ring_lnglat(shape: BaseGeometry, to_lnglat: ToLngLat) -> list[tuple[float, float]] | None:
    """Outer ring of the clipped pixel in lng/lat, or None if degenerate.

    A concave field can split a pixel into pieces; the largest piece is kept,
    which is plenty for a 10 m display cell.
    """
    if shape.is_empty:
        return None
    if shape.geom_type == "MultiPolygon":
        shape = max(shape.geoms, key=lambda part: part.area)
    if shape.geom_type != "Polygon":
        return None
    xs, ys = shape.exterior.coords.xy
    lngs, lats = to_lnglat(np.asarray(xs, dtype=float), np.asarray(ys, dtype=float))
    return [
        (round(float(lng), 7), round(float(lat), 7)) for lng, lat in zip(lngs, lats, strict=True)
    ]
