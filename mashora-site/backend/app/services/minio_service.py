import io
from typing import BinaryIO

from app.config import get_settings

settings = get_settings()


class MinioService:
    """Thin wrapper around MinIO object storage for addon file uploads/deletions."""

    def __init__(self):
        try:
            from minio import Minio

            self._client = Minio(
                settings.minio_endpoint,
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=False,
            )
            self._bucket = settings.minio_bucket
            self._ensure_bucket()
        except ImportError:
            self._client = None
            self._bucket = settings.minio_bucket

    def _ensure_bucket(self) -> None:
        if self._client and not self._client.bucket_exists(self._bucket):
            self._client.make_bucket(self._bucket)

    def upload_file(self, object_name: str, data: bytes, content_type: str = "application/zip") -> str:
        """Upload bytes to MinIO and return the object path."""
        if self._client is None:
            raise RuntimeError("MinIO client is not available")
        self._client.put_object(
            self._bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return object_name

    def delete_file(self, object_name: str) -> None:
        """Delete an object from MinIO."""
        if self._client is None:
            raise RuntimeError("MinIO client is not available")
        self._client.remove_object(self._bucket, object_name)
