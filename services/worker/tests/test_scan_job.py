"""The scan job with fake catalogue, reader, database and storage."""

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import numpy as np
import shapely
from shapely.geometry.base import BaseGeometry

from jobs.scan_fields import FieldToScan, Observation, ReadBands, pixel_path, scan_all
from satellite.ingestion.stac import BandAsset, Scene
from satellite.processing.field_pass import Bands, ToLngLat

NOW = datetime(2026, 11, 27, 12, 0, tzinfo=UTC)
TENANT = "d7a00000-0000-4000-8000-00000000000a"
FIELD_ID = "d7e00000-0000-4000-8000-000000000001"
BOUNDARY = {
    "type": "Polygon",
    "coordinates": [
        [
            [77.5995, 27.4995],
            [77.6005, 27.4995],
            [77.6005, 27.5005],
            [77.5995, 27.5005],
            [77.5995, 27.4995],
        ]
    ],
}


class FakeRepository:
    def __init__(self, fields: list[FieldToScan]) -> None:
        self.fields = fields
        self.pending: list[Observation] = []
        self.observations: list[Observation] = []
        self.checks: list[tuple[str, str | None]] = []
        self.limit: int | None = None

    def fields_to_scan(self, limit: int) -> list[FieldToScan]:
        self.limit = limit
        return self.fields

    def insert_observation(self, observation: Observation) -> None:
        self.pending.append(observation)

    def record_check(self, field: FieldToScan, checked_at: datetime, error: str | None) -> None:
        self.checks.append((field.id, error))

    def commit(self) -> None:
        self.observations.extend(self.pending)
        self.pending = []

    def rollback(self) -> None:
        self.pending = []


class FakeStore:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    def put_json(self, path: str, body: bytes) -> None:
        self.files[path] = body


def scene(day: int, minute: int = 30) -> Scene:
    asset = BandAsset(href="fake.tif", scale=1.0, offset=0.0)
    return Scene(
        id=f"S2_{day}",
        observed_at=datetime(2026, 11, day, 5, minute, tzinfo=UTC),
        bands=dict.fromkeys(["red", "nir", "rededge", "swir", "scl"], asset),
    )


# A local metre grid around the field: ~0.0001 degree per 10 m pixel.
def to_metres(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    return (x - 77.599) * 100000, (y - 27.499) * 100000


def fake_read(cloudy_days: set[int]) -> ReadBands:
    def read(item: Scene, boundary: BaseGeometry) -> tuple[Bands, BaseGeometry, ToLngLat]:
        shape = (20, 20)
        scl_value = 9 if item.observed_at.day in cloudy_days else 4
        bands = Bands(
            red=np.full(shape, 0.05),
            nir=np.full(shape, 0.45),
            rededge=np.full(shape, 0.2),
            swir=np.full(shape, 0.25),
            scl=np.full(shape, scl_value, dtype=np.uint8),
            transform=(10.0, 0.0, 0.0, 0.0, -10.0, 200.0),
        )

        def back(xs: np.ndarray, ys: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
            return xs / 100000 + 77.599, ys / 100000 + 27.499

        return bands, shapely.transform(boundary, to_metres, interleaved=False), back

    return read


def field(latest: datetime | None = None, field_id: str = FIELD_ID) -> FieldToScan:
    return FieldToScan(
        id=field_id, tenant_id=TENANT, boundary_geojson=BOUNDARY, latest_observed_at=latest
    )


def test_backfills_new_field_and_uploads_pixels() -> None:
    repository = FakeRepository([field()])
    store = FakeStore()
    searched: list[tuple[datetime, datetime]] = []

    def search(boundary: dict[str, Any], start: datetime, end: datetime) -> list[Scene]:
        searched.append((start, end))
        return [scene(10), scene(15), scene(20)]

    summary = scan_all(repository, store, search, fake_read({15}), NOW, 60, 50)

    assert repository.limit == 50
    assert searched == [(NOW - timedelta(days=60), NOW)]
    assert summary.observations == 3 and summary.failures == 0
    qualities = [observation.quality for observation in repository.observations]
    assert qualities == ["good", "cloudy", "good"]
    cloudy = repository.observations[1]
    assert cloudy.ndvi is None and cloudy.raster_path is None
    clear = repository.observations[0]
    assert clear.ndvi == 0.8
    assert clear.raster_path == pixel_path(field(), scene(10).observed_at)
    assert clear.raster_path.startswith(f"{TENANT}/{FIELD_ID}/20261110T053000Z")
    pixels = json.loads(store.files[clear.raster_path])
    assert pixels["version"] == 1 and len(pixels["cells"]) > 50
    lng, lat = pixels["cells"][0]["ring"][0]
    assert 77.59 < lng < 77.61 and 27.49 < lat < 27.51
    assert repository.checks == [(FIELD_ID, None)]


def test_only_searches_after_the_latest_stored_pass() -> None:
    latest = datetime(2026, 11, 20, 5, 30, tzinfo=UTC)
    repository = FakeRepository([field(latest)])
    searched: list[datetime] = []

    def search(boundary: dict[str, Any], start: datetime, end: datetime) -> list[Scene]:
        searched.append(start)
        return []

    scan_all(repository, FakeStore(), search, fake_read(set()), NOW, 60, 50)
    assert searched == [latest + timedelta(seconds=1)]


def test_duplicate_tiles_of_one_acquisition_are_stored_once() -> None:
    repository = FakeRepository([field()])
    scan_all(
        repository, FakeStore(), lambda *_: [scene(10), scene(10)], fake_read(set()), NOW, 60, 50
    )
    assert len(repository.observations) == 1


def test_a_failing_field_is_recorded_and_others_continue() -> None:
    broken = field(field_id="d7e00000-0000-4000-8000-000000000002")
    repository = FakeRepository([broken, field()])

    def read(item: Scene, boundary: BaseGeometry) -> tuple[Bands, BaseGeometry, ToLngLat]:
        if repository.checks == []:
            raise OSError("tile unavailable")
        return fake_read(set())(item, boundary)

    summary = scan_all(repository, FakeStore(), lambda *_: [scene(10)], read, NOW, 60, 50)

    assert summary.failures == 1 and summary.observations == 1
    assert repository.checks[0] == (broken.id, "OSError: tile unavailable")
    assert repository.checks[1] == (FIELD_ID, None)
    assert [observation.field_id for observation in repository.observations] == [FIELD_ID]
