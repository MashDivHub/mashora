import re
from uuid import UUID

import asyncpg
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Tenant


class TenantProvisioner:
    @staticmethod
    async def create_tenant(
        db: AsyncSession,
        org_id: UUID,
        db_name: str,
        subdomain: str | None = None,
    ) -> Tenant:
        # Validate db_name: alphanumeric + underscore only
        if not re.fullmatch(r"[a-zA-Z0-9_]+", db_name):
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="db_name must contain only alphanumeric characters and underscores",
            )

        # Check uniqueness of db_name
        result = await db.execute(select(Tenant).where(Tenant.db_name == db_name))
        if result.scalar_one_or_none() is not None:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A tenant with db_name '{db_name}' already exists",
            )

        # Check uniqueness of subdomain if provided
        if subdomain is not None:
            result = await db.execute(select(Tenant).where(Tenant.subdomain == subdomain))
            if result.scalar_one_or_none() is not None:
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A tenant with subdomain '{subdomain}' already exists",
                )

        settings = get_settings()

        tenant = Tenant(
            org_id=org_id,
            db_name=db_name,
            db_host=settings.erp_db_host,
            db_port=settings.erp_db_port,
            subdomain=subdomain or db_name,
            status="provisioning",
        )
        db.add(tenant)
        await db.flush()

        await TenantProvisioner._provision_database(db_name)

        tenant.status = "active"
        await db.flush()
        return tenant

    @staticmethod
    async def _provision_database(db_name: str) -> None:
        settings = get_settings()
        conn = await asyncpg.connect(
            user=settings.erp_db_user,
            password=settings.erp_db_password,
            host=settings.erp_db_host,
            port=settings.erp_db_port,
            database="postgres",
        )
        try:
            # CREATE DATABASE cannot run inside a transaction block
            await conn.execute(f'CREATE DATABASE "{db_name}"')
        except asyncpg.DuplicateDatabaseError:
            pass  # database already exists, that's fine
        finally:
            await conn.close()

    @staticmethod
    async def list_tenants(db: AsyncSession, org_id: UUID) -> list[Tenant]:
        result = await db.execute(
            select(Tenant).where(Tenant.org_id == org_id, Tenant.status != "archived")
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_tenant(
        db: AsyncSession, tenant_id: UUID, org_id: UUID
    ) -> Tenant | None:
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.org_id == org_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def suspend_tenant(db: AsyncSession, tenant_id: UUID) -> Tenant:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant is None:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        tenant.status = "suspended"
        await db.flush()
        return tenant

    @staticmethod
    async def delete_tenant(db: AsyncSession, tenant_id: UUID) -> None:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant is None:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        tenant.status = "archived"
        await db.flush()
