"""Postgres access as the limited crop_worker role (ADR 0026)."""

import json
from datetime import datetime
from typing import Any

import psycopg

from jobs.scan_fields import PROCESSING_VERSION, SOURCE, FieldToScan, Observation

# The role's RLS policy already limits rows to active fields with a
# boundary. Fields checked longest ago go first, so a capped run still
# reaches every field over successive runs.
FIELDS_SQL = """
select field.id::text, field.tenant_id::text,
       extensions.st_asgeojson(field.boundary::extensions.geometry, 7)::jsonb,
       (select max(observation.observed_at) from public.field_observations as observation
        where observation.field_id = field.id and observation.source = %(source)s)
from public.fields as field
left join public.field_scan_status as status on status.field_id = field.id
order by status.last_checked_at nulls first
limit %(limit)s
"""

INSERT_SQL = """
insert into public.field_observations (
  tenant_id, field_id, observed_at, source, processing_version,
  cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean, raster_path
)
values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
on conflict on constraint field_observations_unique do nothing
"""

STATUS_SQL = """
insert into public.field_scan_status (field_id, tenant_id, last_checked_at, last_error)
values (%s, %s, %s, %s)
on conflict (field_id) do update
set last_checked_at = excluded.last_checked_at, last_error = excluded.last_error
"""


class PostgresRepository:
    def __init__(self, url: str) -> None:
        self._connection = psycopg.connect(url, autocommit=False)

    def fields_to_scan(self, limit: int) -> list[FieldToScan]:
        with self._connection.cursor() as cursor:
            cursor.execute(FIELDS_SQL, {"source": SOURCE, "limit": limit})
            rows: list[tuple[Any, ...]] = cursor.fetchall()
        self._connection.commit()
        return [
            FieldToScan(
                id=row[0],
                tenant_id=row[1],
                boundary_geojson=row[2] if isinstance(row[2], dict) else json.loads(row[2]),
                latest_observed_at=row[3],
            )
            for row in rows
        ]

    def insert_observation(self, observation: Observation) -> None:
        with self._connection.cursor() as cursor:
            cursor.execute(
                INSERT_SQL,
                (
                    observation.tenant_id,
                    observation.field_id,
                    observation.observed_at,
                    SOURCE,
                    PROCESSING_VERSION,
                    observation.cloud_cover_pct,
                    observation.quality,
                    observation.ndvi,
                    observation.ndre,
                    observation.ndmi,
                    observation.raster_path,
                ),
            )

    def record_check(self, field: FieldToScan, checked_at: datetime, error: str | None) -> None:
        with self._connection.cursor() as cursor:
            cursor.execute(STATUS_SQL, (field.id, field.tenant_id, checked_at, error))

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()
