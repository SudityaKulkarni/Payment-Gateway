"""Payment routes — full CRUD + processing, refund, retry, and summary."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app import models
from app.db.database import get_db
from app.models.models import Payment, PaymentEvent, PaymentStatus
from app.schemas import schemas
from app.services import payment_engine
from oauth2 import get_current_user

router = APIRouter(prefix="/payments", tags=["Payments"])

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_payment_or_404(identifier: str, user_id: str, db: Session) -> Payment:
    """Fetch a payment by ID or Reference belonging to the current user or raise 404."""
    from sqlalchemy import or_

    payment = (
        db.query(Payment)
        .filter(
            or_(Payment.id == identifier, Payment.payment_reference == identifier),
            Payment.user_id == user_id,
        )
        .first()
    )
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with ID or Reference '{identifier}' not found.",
        )
    return payment


# ── Create ────────────────────────────────────────────────────────────────────


@router.post(
    "/",
    response_model=schemas.PaymentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new payment",
)
def create_payment(
    payload: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Initialise a payment in **CREATED** state.

    Raises **409** if the same `payment_reference` already exists for this user.
    """
    duplicate = (
        db.query(Payment)
        .filter(
            Payment.payment_reference == payload.payment_reference,
            Payment.user_id == current_user.id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Payment reference '{payload.payment_reference}' already exists.",
        )

    webhook_url = str(payload.webhook_url) if payload.webhook_url else None

    payment = Payment(
        amount=payload.amount,
        currency=payload.currency,
        description=payload.description,
        customer_email=payload.customer_email,
        extra_data=payload.extra_data,
        webhook_url=webhook_url,
        payment_reference=payload.payment_reference,
        user_id=current_user.id,
        status=PaymentStatus.CREATED,
    )
    db.add(payment)

    # Record creation event
    event = PaymentEvent(
        payment_id=payment.id,
        from_status=PaymentStatus.CREATED,
        to_status=PaymentStatus.CREATED,
        reason="Payment initialised",
    )
    # We need to flush to get payment.id before adding the event
    db.flush()
    event.payment_id = payment.id
    db.add(event)

    db.commit()
    db.refresh(payment)
    return payment


# ── List ──────────────────────────────────────────────────────────────────────


@router.get(
    "/",
    response_model=List[schemas.PaymentRead],
    summary="List all payments for the current user",
)
def list_payments(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Paginated list of payments owned by the authenticated user."""
    return (
        db.query(Payment)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── Summary ───────────────────────────────────────────────────────────────────


@router.get(
    "/summary",
    response_model=schemas.PaymentSummary,
    summary="Transaction summary for the current user",
)
def get_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Aggregate statistics scoped to the authenticated user.

    Returns total counts per status and a breakdown of failure reasons.
    """
    rows = (
        db.query(Payment.status, func.count(Payment.id))
        .filter(Payment.user_id == current_user.id)
        .group_by(Payment.status)
        .all()
    )
    counts: dict[str, int] = {r[0]: r[1] for r in rows}

    # Failure reason breakdown
    failure_rows = (
        db.query(Payment.failure_reason, func.count(Payment.id))
        .filter(
            Payment.user_id == current_user.id,
            Payment.failure_reason.isnot(None),
        )
        .group_by(Payment.failure_reason)
        .all()
    )
    failure_breakdown = {r[0]: r[1] for r in failure_rows}

    return schemas.PaymentSummary(
        total=sum(counts.values()),
        success=counts.get(PaymentStatus.SUCCESS, 0),
        failed=counts.get(PaymentStatus.FAILED, 0),
        refunded=counts.get(PaymentStatus.REFUNDED, 0),
        processing=counts.get(PaymentStatus.PROCESSING, 0),
        created=counts.get(PaymentStatus.CREATED, 0),
        failure_breakdown=failure_breakdown,
        last_updated=datetime.now(timezone.utc),
    )


# ── Read single ───────────────────────────────────────────────────────────────


@router.get(
    "/{payment_id}",
    response_model=schemas.PaymentRead,
    summary="Check payment status",
)
def get_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retrieve a payment by ID or Reference.

    Response includes the current **status**, **failure_reason** (if any),
    and the full **event history**.
    """
    return _get_payment_or_404(payment_id, current_user.id, db)


# ── Process ───────────────────────────────────────────────────────────────────


@router.post(
    "/{payment_id}/process",
    response_model=schemas.PaymentRead,
    summary="Run the payment processing engine",
)
def process_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Execute the state machine: **CREATED → PROCESSING → SUCCESS | FAILED**.

    Applies fraud rules and a random 70/30 success/failure simulation.
    """
    payment = _get_payment_or_404(payment_id, current_user.id, db)
    try:
        payment = payment_engine.process_payment(payment, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return payment


# ── Refund ────────────────────────────────────────────────────────────────────


@router.post(
    "/{payment_id}/refund",
    response_model=schemas.PaymentRead,
    summary="Refund a successful payment",
)
def refund_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Transition: **SUCCESS → REFUNDED**.

    Raises **400** if the payment is not in SUCCESS state.
    """
    payment = _get_payment_or_404(payment_id, current_user.id, db)
    try:
        payment = payment_engine.refund_payment(payment, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return payment


# ── Retry ─────────────────────────────────────────────────────────────────────


@router.post(
    "/{payment_id}/retry",
    response_model=schemas.PaymentRead,
    summary="Retry a failed payment",
)
def retry_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Retry processing: **FAILED → PROCESSING → SUCCESS | FAILED**.

    Limited to **3 retries**. Raises **400** if the payment is not FAILED or
    the maximum retry count has been reached.
    """
    payment = _get_payment_or_404(payment_id, current_user.id, db)
    try:
        payment = payment_engine.retry_payment(payment, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return payment
