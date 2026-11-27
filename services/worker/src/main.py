"""Entry point: one scan of every field with a boundary, then exit.

Exit codes: 0 when the run finished (individual field failures are recorded
per field), 1 when every field failed, 2 on bad configuration.
"""

import logging
import sys
from datetime import UTC, datetime

from config import ConfigError, load_settings
from db import PostgresRepository
from jobs.scan_fields import scan_all
from satellite.ingestion.reader import read_field_bands
from satellite.ingestion.stac import search_scenes
from storage import S3PixelStore


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    log = logging.getLogger("worker")
    try:
        settings = load_settings()
    except ConfigError as error:
        log.error("configuration: %s", error)
        return 2

    repository = PostgresRepository(settings.database_url)
    store = S3PixelStore(
        settings.s3_endpoint,
        settings.s3_region,
        settings.s3_access_key_id,
        settings.s3_secret_access_key,
    )
    try:
        summary = scan_all(
            repository,
            store,
            lambda boundary, start, end: search_scenes(settings.stac_url, boundary, start, end),
            read_field_bands,
            now=datetime.now(UTC),
            backfill_days=settings.backfill_days,
            max_fields=settings.max_fields,
        )
    finally:
        repository.close()
    log.info(
        "scanned %d fields: %d new passes, %d failures",
        summary.fields,
        summary.observations,
        summary.failures,
    )
    return 1 if summary.fields > 0 and summary.failures == summary.fields else 0


if __name__ == "__main__":
    sys.exit(main())
