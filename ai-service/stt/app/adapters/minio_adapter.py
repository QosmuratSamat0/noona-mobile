"""
MinIO storage adapter — infrastructure layer.
Responsible ONLY for downloading/deleting objects.
The service layer never touches MinIO directly.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from minio import Minio
from minio.error import S3Error

logger = logging.getLogger(__name__)


class MinioAdapter:
    """Thin wrapper around the MinIO Python client."""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        use_ssl: bool = False,
    ) -> None:
        self._client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=use_ssl,
        )

    def download(
        self,
        bucket_name: str,
        object_name: str,
        dest_path: str,
    ) -> None:
        """
        Download *object_name* from *bucket_name* to the local *dest_path*.

        Raises:
            S3Error: on any MinIO-level error (bucket not found, no object, etc.)
            OSError: if local directory creation fails.
        """
        # Ensure parent directory exists
        Path(dest_path).parent.mkdir(parents=True, exist_ok=True)

        logger.debug(
            "Downloading s3://%s/%s → %s", bucket_name, object_name, dest_path
        )
        try:
            self._client.fget_object(bucket_name, object_name, dest_path)
        except S3Error as exc:
            logger.error(
                "MinIO download failed: bucket=%s key=%s error=%s",
                bucket_name,
                object_name,
                exc,
            )
            raise

    def delete(self, bucket_name: str, object_name: str) -> None:
        """
        Remove an object from MinIO.
        Logs and suppresses errors — deletion is best-effort.
        """
        try:
            self._client.remove_object(bucket_name, object_name)
            logger.debug("Deleted s3://%s/%s", bucket_name, object_name)
        except S3Error as exc:
            logger.warning(
                "Failed to delete s3://%s/%s: %s", bucket_name, object_name, exc
            )
