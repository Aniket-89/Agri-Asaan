"""Reads only the small window of each band that covers a field."""

import numpy as np
import rasterio
import shapely
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.windows import Window, from_bounds
from rasterio.windows import transform as window_transform
from shapely.geometry.base import BaseGeometry

from satellite.ingestion.stac import BandAsset, Scene
from satellite.processing.field_pass import Bands, ToLngLat

# GDAL settings for public cloud-optimised GeoTIFFs over HTTPS: no request
# signing, no directory listings, bounded retries.
GDAL_ENV = {
    "AWS_NO_SIGN_REQUEST": "YES",
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff",
    "GDAL_HTTP_MAX_RETRY": "3",
    "GDAL_HTTP_RETRY_DELAY": "2",
}
# One pixel of margin around the field.
PAD_PIXELS = 1


def _reflectance(raw: np.ndarray, asset: BandAsset) -> np.ndarray:
    values = raw.astype(np.float64) * asset.scale + asset.offset
    return np.where(raw == 0, np.nan, values)


def read_field_bands(
    scene: Scene, boundary_lnglat: BaseGeometry
) -> tuple[Bands, BaseGeometry, ToLngLat]:
    """The field's window on the 10 m grid, the boundary in the raster CRS,
    and a function back to lng/lat. 20 m bands are resampled onto the 10 m
    grid (bilinear for reflectance, nearest for the class layer)."""
    with rasterio.Env(**GDAL_ENV), rasterio.open(scene.bands["red"].href) as red_source:
        crs = red_source.crs
        forward = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        backward = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
        boundary = shapely.transform(boundary_lnglat, forward.transform, interleaved=False)

        west, south, east, north = boundary.bounds
        size = red_source.res[0]
        pad = PAD_PIXELS * size
        window = (
            from_bounds(west - pad, south - pad, east + pad, north + pad, red_source.transform)
            .round_offsets()
            .round_lengths()
        )
        window = window.intersection(Window(0, 0, red_source.width, red_source.height))
        shape = (int(window.height), int(window.width))
        grid_transform = window_transform(window, red_source.transform)
        bounds = rasterio.windows.bounds(window, red_source.transform)

        def read(name: str, resampling: Resampling) -> np.ndarray:
            with rasterio.open(scene.bands[name].href) as source:
                band_window = from_bounds(*bounds, transform=source.transform)
                values: np.ndarray = source.read(
                    1, window=band_window, out_shape=shape, resampling=resampling
                )
                return values

        red_raw = red_source.read(1, window=window)
        nir_raw = read("nir", Resampling.nearest)
        rededge_raw = read("rededge", Resampling.bilinear)
        swir_raw = read("swir", Resampling.bilinear)
        scl = read("scl", Resampling.nearest)

    bands = Bands(
        red=_reflectance(red_raw, scene.bands["red"]),
        nir=_reflectance(nir_raw, scene.bands["nir"]),
        rededge=_reflectance(rededge_raw, scene.bands["rededge"]),
        swir=_reflectance(swir_raw, scene.bands["swir"]),
        scl=scl,
        transform=(
            grid_transform.a,
            grid_transform.b,
            grid_transform.c,
            grid_transform.d,
            grid_transform.e,
            grid_transform.f,
        ),
    )

    def to_lnglat(xs: np.ndarray, ys: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        lngs, lats = backward.transform(xs, ys)
        return np.asarray(lngs), np.asarray(lats)

    return bands, boundary, to_lnglat
