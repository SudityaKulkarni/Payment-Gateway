from __future__ import annotations

import logging
import random
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models
from app.db.database import get_db
from app.schemas import schemas
from oauth2 import get_current_user


logger = logging.getLogger(__name__)

FRAUD_AMOUNT_THRESHOLD = Decimal("10000.00")
MIN_PROCESSABLE_AMOUNT = Decimal("1.00")
MAX_RETRY_ATTEMPTS = 3
WEBHOOK_TIMEOUT_SECONDS = 3.0


router = APIRouter(prefix="/payments", tags=["Payments"])


@dataclass
class ProcessingDecision:
	status: models.PaymentStatus
	failure_reason: Optional[str]
	rule_triggered: Optional[str]
	fraud_flag: Optional[bool]
	payload: Dict[str, Any]


def _get_payment_for_user(db: Session, payment_id: str, user: models.User) -> models.Payment:
	payment = (
		db.query(models.Payment)
		.filter(models.Payment.id == payment_id, models.Payment.user_id == user.id)
		.first()
	)
	if payment is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
	return payment


def _dispatch_webhook(payment: models.Payment, event: models.PaymentEvent) -> None:
	if not payment.webhook_url:
		return
	try:
		response = httpx.post(
			payment.webhook_url,
			json={
				"payment_id": payment.id,
				"payment_reference": payment.payment_reference,
				"status": event.to_status,
				"from_status": event.from_status,
				"reason": event.reason,
				"payload": event.payload,
				"occurred_at": event.created_at.isoformat() if event.created_at else None,
			},
			timeout=WEBHOOK_TIMEOUT_SECONDS,
		)
		response.raise_for_status()
	except httpx.HTTPError as exc:
		logger.warning("Webhook delivery failed for %s: %s", payment.payment_reference, exc)


def _transition_payment_status(
	db: Session,
	payment: models.Payment,
	new_status: models.PaymentStatus,
	*,
	reason: Optional[str] = None,
	payload: Optional[Dict[str, Any]] = None,
	failure_reason: Optional[str] = None,
	rule_triggered: Optional[str] = None,
	fraud_flag: Optional[bool] = None,
) -> None:
	if payment.status == new_status and failure_reason is None and rule_triggered is None:
		return
	event = models.PaymentEvent(
		payment_id=payment.id,
		from_status=payment.status,
		to_status=new_status,
		reason=reason,
		payload=payload,
	)
	payment.status = new_status
	if new_status == models.PaymentStatus.PROCESSING:
		payment.processing_started_at = datetime.now(timezone.utc)
		payment.completed_at = None
	if new_status in (models.PaymentStatus.SUCCESS, models.PaymentStatus.FAILED, models.PaymentStatus.REFUNDED):
		payment.completed_at = datetime.now(timezone.utc)
	if new_status == models.PaymentStatus.FAILED:
		payment.failure_reason = failure_reason
		payment.rule_triggered = rule_triggered
	elif new_status == models.PaymentStatus.REFUNDED:
		payment.failure_reason = "Refunded"
		payment.rule_triggered = "REFUND"
	else:
		payment.failure_reason = None
		payment.rule_triggered = None
	if fraud_flag is not None:
		payment.fraud_flag = fraud_flag
	payment.events.append(event)
	db.flush()
	_dispatch_webhook(payment, event)


def _simulate_processing_decision(payment: models.Payment) -> ProcessingDecision:
	now = datetime.now(timezone.utc)
	amount = Decimal(payment.amount)
	payload: Dict[str, Any] = {"evaluated_at": now.isoformat()}

	if amount >= FRAUD_AMOUNT_THRESHOLD:
		payload["rule"] = "AMOUNT_THRESHOLD"
		return ProcessingDecision(
			status=models.PaymentStatus.FAILED,
			failure_reason="Amount exceeds the allowed threshold",
			rule_triggered="AMOUNT_THRESHOLD",
			fraud_flag=True,
			payload=payload,
		)

	if amount < MIN_PROCESSABLE_AMOUNT:
		payload["rule"] = "INVALID_AMOUNT"
		return ProcessingDecision(
			status=models.PaymentStatus.FAILED,
			failure_reason="Amount is below the minimum allowed value",
			rule_triggered="INVALID_AMOUNT",
			fraud_flag=False,
			payload=payload,
		)

	if now.second % 17 == 0:
		payload["rule"] = "MAINTENANCE_WINDOW"
		return ProcessingDecision(
			status=models.PaymentStatus.FAILED,
			failure_reason="Processor is unavailable in the current time window",
			rule_triggered="MAINTENANCE_WINDOW",
			fraud_flag=False,
			payload=payload,
		)

	random_factor = random.random()
	payload["random_factor"] = random_factor
	if random_factor < 0.78:
		return ProcessingDecision(
			status=models.PaymentStatus.SUCCESS,
			failure_reason=None,
			rule_triggered=None,
			fraud_flag=False,
			payload=payload,
		)

	return ProcessingDecision(
		status=models.PaymentStatus.FAILED,
		failure_reason="Gateway declined the transaction",
		rule_triggered="RANDOM_FAIL",
		fraud_flag=False,
		payload=payload,
	)


def _run_payment_engine(db: Session, payment: models.Payment, trigger: str) -> models.Payment:
	payment.failure_reason = None
	payment.rule_triggered = None
	_transition_payment_status(
		db,
		payment,
		models.PaymentStatus.PROCESSING,
		reason=f"{trigger} processing started",
		payload={"trigger": trigger},
	)
	decision = _simulate_processing_decision(payment)
	if decision.status == models.PaymentStatus.SUCCESS:
		_transition_payment_status(
			db,
			payment,
			models.PaymentStatus.SUCCESS,
			reason="Payment completed successfully",
			payload=decision.payload,
		)
	else:
		_transition_payment_status(
			db,
			payment,
			models.PaymentStatus.FAILED,
			reason=decision.failure_reason,
			payload=decision.payload,
			failure_reason=decision.failure_reason,
			rule_triggered=decision.rule_triggered,
			fraud_flag=decision.fraud_flag,
		)
	return payment


def _collect_summary(payments: list[models.Payment]) -> schemas.PaymentSummary:
	counts = Counter(payment.status for payment in payments)
	failure_breakdown = Counter(
		(payment.rule_triggered or payment.failure_reason or "UNCLASSIFIED")
		for payment in payments
		if payment.status == models.PaymentStatus.FAILED
	)
	last_updated = max((payment.updated_at for payment in payments), default=datetime.now(timezone.utc))
	return schemas.PaymentSummary(
		total=len(payments),
		success=counts.get(models.PaymentStatus.SUCCESS, 0),
		failed=counts.get(models.PaymentStatus.FAILED, 0),
		refunded=counts.get(models.PaymentStatus.REFUNDED, 0),
		processing=counts.get(models.PaymentStatus.PROCESSING, 0),
		created=counts.get(models.PaymentStatus.CREATED, 0),
		failure_breakdown=dict(failure_breakdown),
		last_updated=last_updated,
	)


@router.get("/", response_model=list[schemas.PaymentRead])
def list_payments(
	status_filter: Optional[models.PaymentStatus] = Query(default=None, alias="status"),
	payment_reference: Optional[str] = Query(default=None),
	customer_email: Optional[str] = Query(default=None),
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	query = db.query(models.Payment).filter(models.Payment.user_id == current_user.id)
	if status_filter:
		query = query.filter(models.Payment.status == status_filter)
	if payment_reference:
		query = query.filter(models.Payment.payment_reference == payment_reference)
	if customer_email:
		query = query.filter(models.Payment.customer_email == customer_email)
	return query.order_by(models.Payment.created_at.desc()).all()


@router.post("/", response_model=schemas.PaymentRead, status_code=status.HTTP_201_CREATED)
def create_payment(
	payload: schemas.PaymentCreate,
	auto_process: bool = Query(default=True, description="Run the processing engine immediately"),
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	existing = (
		db.query(models.Payment)
		.filter(models.Payment.payment_reference == payload.payment_reference)
		.first()
	)
	if existing:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="The payment reference is already in use",
		)

	payment = models.Payment(
		payment_reference=payload.payment_reference,
		amount=payload.amount,
		currency=payload.currency,
		description=payload.description,
		extra_data=payload.extra_data,
		webhook_url=payload.webhook_url,
		status=models.PaymentStatus.CREATED,
		customer_email=payload.customer_email,
		user_id=current_user.id,
	)
	db.add(payment)
	db.flush()

	if auto_process:
		_run_payment_engine(db, payment, trigger="auto")

	db.commit()
	db.refresh(payment)
	return payment


@router.get("/summary", response_model=schemas.PaymentSummary)
def payment_summary(
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	payments = db.query(models.Payment).filter(models.Payment.user_id == current_user.id).all()
	return _collect_summary(payments)


@router.get("/{payment_id}", response_model=schemas.PaymentRead)
def read_payment(
	payment_id: str,
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	return _get_payment_for_user(db, payment_id, current_user)


@router.get("/{payment_id}/events", response_model=list[schemas.PaymentEventRead])
def list_payment_events(
	payment_id: str,
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	payment = _get_payment_for_user(db, payment_id, current_user)
	return payment.events


@router.post("/{payment_id}/process", response_model=schemas.PaymentRead)
def process_payment(
	payment_id: str,
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	payment = _get_payment_for_user(db, payment_id, current_user)
	if payment.status in (models.PaymentStatus.SUCCESS, models.PaymentStatus.REFUNDED):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment is already finalized")
	_run_payment_engine(db, payment, trigger="manual")
	db.commit()
	db.refresh(payment)
	return payment


@router.post("/{payment_id}/retry", response_model=schemas.PaymentRead)
def retry_payment(
	payment_id: str,
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	payment = _get_payment_for_user(db, payment_id, current_user)
	if payment.status != models.PaymentStatus.FAILED:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only failed payments can be retried")
	if payment.retry_count >= MAX_RETRY_ATTEMPTS:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retry limit reached for this payment")
	payment.retry_count += 1
	_run_payment_engine(db, payment, trigger="retry")
	db.commit()
	db.refresh(payment)
	return payment


@router.post("/{payment_id}/refund", response_model=schemas.PaymentRead)
def refund_payment(
	payment_id: str,
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	payment = _get_payment_for_user(db, payment_id, current_user)
	if payment.status != models.PaymentStatus.SUCCESS:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only successful payments can be refunded")
	_transition_payment_status(
		db,
		payment,
		models.PaymentStatus.REFUNDED,
		reason="Refund requested by user",
		payload={"refunded_at": datetime.now(timezone.utc).isoformat()},
	)
	db.commit()
	db.refresh(payment)
	return payment


@router.patch("/{payment_id}/status", response_model=schemas.PaymentRead)
def override_payment_status(
	payment_id: str,
	update: schemas.PaymentStatusUpdate,
	db: Session = Depends(get_db),
	current_user: models.User = Depends(get_current_user),
):
	payment = _get_payment_for_user(db, payment_id, current_user)
	_transition_payment_status(
		db,
		payment,
		update.status,
		reason="Manual status override",
		payload={"rule_triggered": update.rule_triggered, "fraud_flag": update.fraud_flag},
		failure_reason=update.failure_reason,
		rule_triggered=update.rule_triggered,
		fraud_flag=update.fraud_flag,
	)
	db.commit()
	db.refresh(payment)
	return payment
