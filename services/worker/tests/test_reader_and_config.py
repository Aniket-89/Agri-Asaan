"""Window reading from local GeoTIFFs (no network) and settings validation."""

from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

from config import ConfigError, load_settings
from satellite.ingestion.reader import read_field_bands
from satellite.ingestion.stac import BandAsset, Scene

CRS = "EPSG:32643"  # UTM 43N, which covers western Uttar Pradesh
ORIGIN_X, ORIGIN_Y = 700000.0, 3045000.0


def write_band(path: Path, values: np.ndarray, size: float) -> str:
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=values.shape[1],
        height=values.shape[0],
        count=1,
        dtype=values.dtype,
        crs=CRS,
        transform=from_origin(ORIGIN_X, ORIGIN_Y, size, size),
        nodata=0,
    ) as target:
        target.write(values, 1)
    return str(path)


def make_scene(tmp_path: Path) -> Scene:
    ten = np.full((100, 100), 1500, dtype=np.uint16)  # 0.05 reflectance after scaling
    nir = np.full((100, 100), 5500, dtype=np.uint16)  # 0.45
    twenty = np.full((50, 50), 3000, dtype=np.uint16)  # 0.20
    scl = np.full((50, 50), 4, dtype=np.uint8)

    def asset(name: str, values: np.ndarray, size: float) -> BandAsset:
        href = write_band(tmp_path / f"{name}.tif", values, size)
        return BandAsset(href=href, scale=0.0001, offset=-0.1)

    return Scene(
        id="local",
        observed_at=datetime(2026, 11, 20, 5, 30, tzinfo=UTC),
        bands={
            "red": asset("red", ten, 10),
            "nir": asset("nir", nir, 10),
            "rededge": asset("rededge", twenty, 20),
            "swir": asset("swir", twenty, 20),
            "scl": asset("scl", scl, 20),
        },
    )


def test_reads_the_field_window_on_the_10m_grid(tmp_path: Path) -> None:
    scene = make_scene(tmp_path)
    from pyproj import Transformer

    to_lnglat = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)
    # A 100 m x 100 m field inside the scene, expressed in lng/lat.
    west, north = to_lnglat.transform(ORIGIN_X + 300, ORIGIN_Y - 300)
    east, south = to_lnglat.transform(ORIGIN_X + 400, ORIGIN_Y - 400)
    bands, boundary, back = read_field_bands(scene, box(west, south, east, north))

    rows, cols = bands.red.shape
    assert 10 <= rows <= 14 and 10 <= cols <= 14  # field plus one pixel of margin
    assert bands.rededge.shape == bands.red.shape == bands.scl.shape
    assert bands.red[0, 0] == pytest.approx(0.05)
    assert bands.nir[0, 0] == pytest.approx(0.45)
    assert bands.rededge[0, 0] == pytest.approx(0.20)
    assert bands.transform[0] == 10.0 and bands.transform[4] == -10.0
    assert boundary.area == pytest.approx(10000, rel=0.02)
    lngs, lats = back(np.array([ORIGIN_X + 300]), np.array([ORIGIN_Y - 300]))
    assert lngs[0] == pytest.approx(west) and lats[0] == pytest.approx(north)


def test_no_data_becomes_nan(tmp_path: Path) -> None:
    scene = make_scene(tmp_path)
    blank = np.zeros((100, 100), dtype=np.uint16)
    scene.bands["red"] = BandAsset(
        href=write_band(tmp_path / "blank.tif", blank, 10), scale=0.0001, offset=-0.1
    )
    from pyproj import Transformer

    to_lnglat = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)
    west, north = to_lnglat.transform(ORIGIN_X + 300, ORIGIN_Y - 300)
    east, south = to_lnglat.transform(ORIGIN_X + 400, ORIGIN_Y - 400)
    bands, _, _ = read_field_bands(scene, box(west, south, east, north))
    assert np.isnan(bands.red).all()


SETTINGS_ENV = {
    "WORKER_DATABASE_URL": "postgresql://crop_worker:fake@localhost:5432/postgres",
    "STORAGE_S3_ENDPOINT": "http://localhost:54321/storage/v1/s3",
    "STORAGE_S3_REGION": "local",
    "STORAGE_S3_ACCESS_KEY_ID": "fake-id",
    "STORAGE_S3_SECRET_ACCESS_KEY": "fake-secret",
}


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in SETTINGS_ENV.items():
        monkeypatch.setenv(name, value)
    settings = load_settings()
    assert settings.stac_url == "https://earth-search.aws.element84.com/v1"
    assert settings.backfill_days == 60 and settings.max_fields == 200


def test_settings_reject_missing_and_bad_values(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in SETTINGS_ENV.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("BACKFILL_DAYS", "1000")
    with pytest.raises(ConfigError, match="BACKFILL_DAYS"):
        load_settings()
    monkeypatch.delenv("BACKFILL_DAYS")
    monkeypatch.setenv("STAC_API_URL", "http://insecure.example")
    with pytest.raises(ConfigError, match="https"):
        load_settings()
    monkeypatch.delenv("STAC_API_URL")
    monkeypatch.delenv("WORKER_DATABASE_URL")
    with pytest.raises(ConfigError, match="WORKER_DATABASE_URL"):
        load_settings()
