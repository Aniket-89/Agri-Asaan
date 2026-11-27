"""Worker settings from the environment, validated at start-up."""

import os
from dataclasses import dataclass

DEFAULT_STAC_URL = "https://earth-search.aws.element84.com/v1"


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Settings:
    database_url: str
    s3_endpoint: str
    s3_region: str
    s3_access_key_id: str
    s3_secret_access_key: str
    stac_url: str
    backfill_days: int
    max_fields: int


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(f"{name} is not set")
    return value


def _bounded_int(name: str, default: int, low: int, high: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ConfigError(f"{name} must be a whole number") from error
    if not low <= value <= high:
        raise ConfigError(f"{name} must be between {low} and {high}")
    return value


def load_settings() -> Settings:
    stac_url = os.environ.get("STAC_API_URL", "").strip() or DEFAULT_STAC_URL
    if not stac_url.startswith("https://"):
        raise ConfigError("STAC_API_URL must use https")
    return Settings(
        database_url=_required("WORKER_DATABASE_URL"),
        s3_endpoint=_required("STORAGE_S3_ENDPOINT"),
        s3_region=_required("STORAGE_S3_REGION"),
        s3_access_key_id=_required("STORAGE_S3_ACCESS_KEY_ID"),
        s3_secret_access_key=_required("STORAGE_S3_SECRET_ACCESS_KEY"),
        stac_url=stac_url,
        backfill_days=_bounded_int("BACKFILL_DAYS", 60, 1, 365),
        max_fields=_bounded_int("MAX_FIELDS_PER_RUN", 200, 1, 5000),
    )
