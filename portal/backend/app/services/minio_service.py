import io
from pathlib import Path
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

    @classmethod
    def _local_root(cls) -> Path:
        root = Path(__file__).resolve().parents[2] / "storage" / "addons"
        root.mkdir(parents=True, exist_ok=True)
        return root

    @classmethod
    async def upload_addon(
        cls,
        technical_name: str,
        version: str,
        data: bytes,
        filename: str,
    ) -> str:
        object_name = f"{technical_name}/{version}/{filename}"
        service = cls()
        if service._client is not None:
            return service.upload_file(object_name, data)

        target = cls._local_root() / object_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return object_name

    @classmethod
    async def delete_addon(cls, object_name: str) -> None:
        service = cls()
        if service._client is not None:
            service.delete_file(object_name)
            return

        target = cls._local_root() / object_name
        if target.exists():
            target.unlink()
