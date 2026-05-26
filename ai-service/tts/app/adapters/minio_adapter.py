"""
MinIO storage adapter — infrastructure layer.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from minio import Minio
from minio.error import S3Error
from minio.lifecycleconfig import LifecycleConfig, Rule, Expiration
from minio.commonconfig import Filter

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

    def ensure_bucket(self, bucket_name: str) -> None:
        """Create bucket if it doesn't exist."""
        try:
            if not self._client.bucket_exists(bucket_name):
                self._client.make_bucket(bucket_name)
                logger.info(f"Created bucket: {bucket_name}")
        except S3Error as exc:
            logger.error(f"Failed to check/create bucket {bucket_name}: {exc}")
            raise

    def set_lifecycle_policy(self, bucket_name: str, days: int = 1) -> None:
        """Set lifecycle policy to delete objects after X days."""
        try:
            config = LifecycleConfig(
                [
                    Rule(
                        status="Enabled",
                        rule_filter=Filter(prefix=""),
                        rule_id="expire_old_files",
                        expiration=Expiration(days=days),
                    ),
                ],
            )
            self._client.set_bucket_lifecycle(bucket_name, config)
            logger.info(f"Lifecycle policy (expire after {days} day(s)) set for {bucket_name}")
        except S3Error as exc:
            logger.error(f"Failed to set lifecycle policy for {bucket_name}: {exc}")
            raise

    def upload(
        self,
        bucket_name: str,
        object_name: str,
        file_path: str,
        content_type: str = "audio/wav",
    ) -> None:
        """Upload local file to MinIO."""
        try:
            self._client.fput_object(
                bucket_name, object_name, file_path, content_type=content_type
            )
            logger.debug(f"Uploaded {file_path} to s3://{bucket_name}/{object_name}")
        except S3Error as exc:
            logger.error(f"MinIO upload failed: {exc}")
            raise

    def get_presigned_url(
        self, bucket_name: str, object_name: str, expires_sec: int = 3600
    ) -> str:
        """Generate a temporary public URL for an object."""
        try:
            return self._client.presigned_get_object(
                bucket_name, object_name, expires=timedelta(seconds=expires_sec)
            )
        except S3Error as exc:
            logger.error(f"Failed to generate presigned URL: {exc}")
            raise
