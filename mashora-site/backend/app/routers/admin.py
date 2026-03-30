from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Addon, Organization, Tenant, User
from app.models.subscription import Subscription
from app.models.support_ticket import SupportTicket
from app.models.ticket_message import TicketMessage
from app.schemas.support import TicketMessageResponse, TicketResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(current_user: User) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _ticket_response(ticket: SupportTicket, user_email: str | None = None) -> TicketResponse:
    return TicketResponse(
        id=ticket.id,
        org_id=ticket.org_id,
        user_id=ticket.user_id,
        user_email=user_email,
        subject=ticket.subject,
        description=ticket.description,
        priority=ticket.priority,
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("/stats")
async def platform_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_admin(current_user)

    total_orgs = (await db.execute(select(func.count()).select_from(Organization))).scalar() or 0
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_tenants = (await db.execute(select(func.count()).select_from(Tenant))).scalar() or 0
    active_subs = (
        await db.execute(
            select(func.count()).select_from(Subscription).where(Subscription.status == "active")
        )
    ).scalar() or 0

    return {
        "total_organizations": total_orgs,
        "total_users": total_users,
        "total_tenants": total_tenants,
        "active_subscriptions": active_subs,
    }


@router.get("/tenants")
async def list_all_tenants(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_admin(current_user)

    query = select(Tenant).order_by(Tenant.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    tenants = result.scalars().all()
    total = (await db.execute(select(func.count()).select_from(Tenant))).scalar() or 0

    return {
        "tenants": [
            {
                "id": str(t.id),
                "org_id": str(t.org_id),
                "db_name": t.db_name,
                "subdomain": t.subdomain,
                "status": t.status,
                "mashora_version": t.mashora_version,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tenants
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/tickets", response_model=list[TicketResponse])
async def list_all_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    ticket_status: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketResponse]:
    _require_admin(current_user)

    query = select(SupportTicket, User.email).join(User, SupportTicket.user_id == User.id, isouter=True)
    if ticket_status:
        query = query.where(SupportTicket.status == ticket_status)
    query = query.order_by(SupportTicket.created_at.desc()).offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    rows = result.all()

    return [
        _ticket_response(row.SupportTicket, row.email)
        for row in rows
    ]


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def admin_update_ticket(
    ticket_id: UUID,
    ticket_status: str = Query(..., alias="status"),
    staff_message: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    _require_admin(current_user)

    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    valid_statuses = {"open", "in_progress", "resolved", "closed"}
    if ticket_status not in valid_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status. Must be one of: {valid_statuses}")

    ticket.status = ticket_status
    ticket.updated_at = datetime.now(timezone.utc)

    if staff_message:
        msg = TicketMessage(
            ticket_id=ticket_id,
            user_id=current_user.id,
            message=staff_message,
            is_staff=True,
        )
        db.add(msg)

    await db.commit()
    await db.refresh(ticket)

    result2 = await db.execute(select(User.email).where(User.id == ticket.user_id))
    user_email = result2.scalar_one_or_none()
    return _ticket_response(ticket, user_email)


@router.patch("/addons/{addon_id}/status")
async def admin_update_addon_status(
    addon_id: UUID,
    addon_status: str = Query(..., alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_admin(current_user)

    result = await db.execute(select(Addon).where(Addon.id == addon_id))
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Addon not found")

    valid_statuses = {"pending", "published", "rejected", "suspended"}
    if addon_status not in valid_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status. Must be one of: {valid_statuses}")

    addon.status = addon_status
    await db.commit()
    return {"id": str(addon.id), "status": addon.status, "message": f"Addon status updated to {addon_status}"}


@router.get("/users")
async def list_all_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _require_admin(current_user)

    query = select(User).order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()
    total = (await db.execute(select(func.count()).select_from(User))).scalar() or 0

    return {
        "users": [
            {
                "id": str(u.id),
                "org_id": str(u.org_id),
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }
