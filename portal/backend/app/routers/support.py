from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import User
from app.models.support_ticket import SupportTicket
from app.models.ticket_message import TicketMessage
from app.schemas.support import (
    TicketCreate,
    TicketDetailResponse,
    TicketList,
    TicketMessageCreate,
    TicketMessageResponse,
    TicketResponse,
)

router = APIRouter(prefix="/support", tags=["support"])


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


def _message_response(msg: TicketMessage, user_email: str | None = None) -> TicketMessageResponse:
    return TicketMessageResponse(
        id=msg.id,
        ticket_id=msg.ticket_id,
        user_id=msg.user_id,
        user_email=user_email,
        message=msg.message,
        is_staff=msg.is_staff,
        sender="support" if msg.is_staff else "user",
        created_at=msg.created_at,
    )


@router.post("/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    ticket = SupportTicket(
        org_id=current_user.org_id,
        user_id=current_user.id,
        subject=body.subject,
        description=body.description,
        priority=body.priority,
        category=body.category,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return _ticket_response(ticket, current_user.email)


@router.get("/tickets", response_model=TicketList)
async def list_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketList:
    query = (
        select(SupportTicket)
        .where(SupportTicket.org_id == current_user.org_id)
        .order_by(SupportTicket.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    tickets = result.scalars().all()

    count_result = await db.execute(
        select(SupportTicket).where(SupportTicket.org_id == current_user.org_id)
    )
    total = len(count_result.scalars().all())

    return TicketList(
        tickets=[_ticket_response(t, current_user.email if t.user_id == current_user.id else None) for t in tickets],
        total=total,
    )


@router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket(
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailResponse:
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id, SupportTicket.org_id == current_user.org_id)
        .options(selectinload(SupportTicket.messages).selectinload(TicketMessage.user))
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    return TicketDetailResponse(
        **_ticket_response(ticket, current_user.email if ticket.user_id == current_user.id else None).model_dump(),
        messages=[
            _message_response(message, message.user.email if message.user else None)
            for message in sorted(ticket.messages, key=lambda item: item.created_at)
        ],
    )


@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=status.HTTP_201_CREATED)
async def add_message(
    ticket_id: UUID,
    body: TicketMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketMessageResponse:
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id, SupportTicket.org_id == current_user.org_id
        )
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    msg = TicketMessage(
        ticket_id=ticket_id,
        user_id=current_user.id,
        message=body.message,
        is_staff=False,
    )
    db.add(msg)

    ticket.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)
    return _message_response(msg, current_user.email)


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID,
    status_value: str = Query(..., alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id, SupportTicket.org_id == current_user.org_id
        )
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    valid_statuses = {"open", "in_progress", "resolved", "closed"}
    if status_value not in valid_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status. Must be one of: {valid_statuses}")

    ticket.status = status_value
    ticket.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ticket)
    return _ticket_response(ticket, current_user.email if ticket.user_id == current_user.id else None)
