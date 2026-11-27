"""Uploads pixel files through Supabase Storage's S3 protocol (ADR 0026)."""

import boto3
from botocore.config import Config

BUCKET = "field-rasters"


class S3PixelStore:
    def __init__(
        self, endpoint: str, region: str, access_key_id: str, secret_access_key: str
    ) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(
                s3={"addressing_style": "path"},
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    def put_json(self, path: str, body: bytes) -> None:
        self._client.put_object(Bucket=BUCKET, Key=path, Body=body, ContentType="application/json")
