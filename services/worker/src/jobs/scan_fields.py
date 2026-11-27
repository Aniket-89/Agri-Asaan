"""Scans every field with a boundary for new Sentinel-2 passes.

Dependencies are passed in, so the job runs in tests with fakes.
"""

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from satellite.ingestion.stac import Scene
from satellite.processing.field_pass import Bands, PassResult, ToLngLat, process_pass

log = logging.getLogger(__name__)

SOURCE = "sentinel-2-l2a"
PROCESSING_VERSION = "s2-l2a-v1"
PIXEL_FILE_VERSION = 1

# Farmers can read field_scan_status, so it stores only a fixed category.
# The full exception (hosts, buckets, SQL) goes to the worker log.
ERROR_CATEGORIES = (
    (("psycopg",), "database_failed"),
    (("botocore", "boto3", "s3transfer"), "storage_failed"),
    (("pystac_client", "pystac", "requests", "urllib3"), "catalogue_unavailable"),
    (("rasterio",), "imagery_read_failed"),
)


def error_category(error: Exception) -> str:
    """Map an exception to a fixed, non-revealing label by the library that raised it."""
    root = type(error).__module__.split(".")[0]
    for modules, category in ERROR_CATEGORIES:
        if root in modules:
            return category
    return "imagery_read_failed" if isinstance(error, OSError) else "internal_error"


@dataclass(frozen=True)
class FieldToScan:
    id: str
    tenant_id: str
    boundary_geojson: dict[str, Any]
    # Newest Sentinel-2 pass already stored, if any.
    latest_observed_at: datetime | None


@dataclass(frozen=True)
class Observation:
    tenant_id: str
    field_id: str
    observed_at: datetime
    cloud_cover_pct: float
    quality: str
    ndvi: float | None
    ndre: float | None
    ndmi: float | None
    raster_path: str | None


class Repository(Protocol):
    def fields_to_scan(self, limit: int) -> list[FieldToScan]: ...
    def insert_observation(self, observation: Observation) -> None: ...
    def record_check(self, field: FieldToScan, checked_at: datetime, error: str | None) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...


class PixelStore(Protocol):
    def put_json(self, path: str, body: bytes) -> None: ...


SearchScenes = Callable[[dict[str, Any], datetime, datetime], list[Scene]]
ReadBands = Callable[[Scene, BaseGeometry], tuple[Bands, BaseGeometry, ToLngLat]]


@dataclass(frozen=True)
class ScanSummary:
    fields: int
    observations: int
    failures: int


def pixel_path(field: FieldToScan, observed_at: datetime) -> str:
    stamp = observed_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{field.tenant_id}/{field.id}/{stamp}-{PROCESSING_VERSION}.json"


def pixel_file(observed_at: datetime, result: PassResult) -> bytes:
    return json.dumps(
        {
            "version": PIXEL_FILE_VERSION,
            "observedAt": observed_at.astimezone(UTC).isoformat(),
            "cells": [
                {"ring": cell.ring, "ndvi": cell.ndvi, "ndre": cell.ndre, "ndmi": cell.ndmi}
                for cell in result.cells
            ],
        },
        separators=(",", ":"),
    ).encode()


def scan_field(
    field: FieldToScan,
    repository: Repository,
    store: PixelStore,
    search: SearchScenes,
    read: ReadBands,
    now: datetime,
    backfill_days: int,
) -> int:
    """Adds every new pass for one field; returns how many were stored."""
    start = (
        field.latest_observed_at + timedelta(seconds=1)
        if field.latest_observed_at
        else now - timedelta(days=backfill_days)
    )
    boundary = shape(field.boundary_geojson)
    stored = 0
    seen: set[datetime] = set()
    for scene in search(field.boundary_geojson, start, now):
        # Neighbouring tiles of one acquisition share a timestamp; keep one.
        if scene.observed_at in seen:
            continue
        seen.add(scene.observed_at)
        bands, boundary_in_crs, to_lnglat = read(scene, boundary)
        result = process_pass(bands, boundary_in_crs, to_lnglat)
        raster_path = None
        if result.means is not None and result.cells:
            raster_path = pixel_path(field, scene.observed_at)
            store.put_json(raster_path, pixel_file(scene.observed_at, result))
        means = result.means or {}
        repository.insert_observation(
            Observation(
                tenant_id=field.tenant_id,
                field_id=field.id,
                observed_at=scene.observed_at,
                cloud_cover_pct=result.sky.cloud_cover_pct,
                quality=result.sky.quality,
                ndvi=means.get("ndvi"),
                ndre=means.get("ndre"),
                ndmi=means.get("ndmi"),
                raster_path=raster_path,
            )
        )
        stored += 1
    return stored


def scan_all(
    repository: Repository,
    store: PixelStore,
    search: SearchScenes,
    read: ReadBands,
    now: datetime,
    backfill_days: int,
    max_fields: int,
) -> ScanSummary:
    """One failing field (bad scene, network) never stops the others. Logs
    carry field ids only, never coordinates (AGENTS.md privacy rule)."""
    fields = repository.fields_to_scan(max_fields)
    observations = 0
    failures = 0
    for field in fields:
        try:
            added = scan_field(field, repository, store, search, read, now, backfill_days)
            repository.record_check(field, now, None)
            repository.commit()
            observations += added
            log.info("field %s: %d new passes", field.id, added)
        except Exception as error:
            repository.rollback()
            failures += 1
            log.exception("field %s failed", field.id)
            repository.record_check(field, now, error_category(error))
            repository.commit()
    return ScanSummary(fields=len(fields), observations=observations, failures=failures)
