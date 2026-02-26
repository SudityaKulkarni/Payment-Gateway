"""Payment processing engine — state machine, fraud rules, and webhook dispatch."""

from __future__ import annotations

import logging
import random
from datetime import datetime, timezone
from decimal import Decimal
from typing import Tuple

import httpx
from sqlalchemy.orm import Session

from ..models.models import Payment, PaymentEvent, PaymentStatus

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

FRAUD_AMOUNT_THRESHOLD = Decimal("10000.00")
SUCCESS_PROBABILITY = 0.70          # 70 % random success rate
MAX_RETRY_COUNT = 3                  # hard limit on retries

# Allowed state transitions: from_status → set of valid to_status
_TRANSITIONS: dict[PaymentStatus, set[PaymentStatus]] = {
    PaymentStatus.CREATED:     {PaymentStatus.PROCESSING},
    PaymentStatus.PROCESSING:  {PaymentStatus.SUCCESS, PaymentStatus.FAILED},
    PaymentStatus.SUCCESS:     {PaymentStatus.REFUNDED},
    PaymentStatus.FAILED:      {PaymentStatus.PROCESSING},
    PaymentStatus.REFUNDED:    set(),
}


# ── State machine helpers ─────────────────────────────────────────────────────


def _can_transition(from_status: PaymentStatus, to_status: PaymentStatus) -> bool:
    return to_status in _TRANSITIONS.get(from_status, set())


def _record_event(
    db: Session,
    payment: Payment,
    from_status: PaymentStatus,
    to_status: PaymentStatus,
    reason: str | None = None,
    payload: dict | None = None,
) -> PaymentEvent:
    event = PaymentEvent(
        payment_id=payment.id,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
        payload=payload,
    )
    db.add(event)
    return event


def _set_status(
    db: Session,
    payment: Payment,
    new_status: PaymentStatus,
    reason: str | None = None,
    payload: dict | None = None,
) -> None:
    """Transition payment to new_status and persist an audit event."""
    old_status = payment.status
    if not _can_transition(old_status, new_status):
        raise ValueError(
            f"Invalid transition: {old_status} → {new_status}"
        )
    _record_event(db, payment, old_status, new_status, reason, payload)
    payment.status = new_status
    now = datetime.now(timezone.utc)
    if new_status == PaymentStatus.PROCESSING:
        payment.processing_started_at = now
    elif new_status in (PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.REFUNDED):
        payment.completed_at = now
    if new_status == PaymentStatus.FAILED and reason:
        payment.failure_reason = reason
    if new_status in (PaymentStatus.SUCCESS, PaymentStatus.REFUNDED):
        payment.failure_reason = None
    db.flush()


# ── Fraud / rule evaluation ───────────────────────────────────────────────────


def evaluate_rules(payment: Payment) -> Tuple[bool, str | None, str | None]:
    """
    Return (should_fail, failure_reason, rule_triggered).
    Rules are evaluated in priority order; first match wins.
    """
    amount = Decimal(str(payment.amount))

    # Rule 1 — Fraud: amount exceeds threshold
    if amount > FRAUD_AMOUNT_THRESHOLD:
        return (
            True,
            f"FRAUD_DETECTED – amount {amount} exceeds threshold of {FRAUD_AMOUNT_THRESHOLD}",
            "FRAUD_HIGH_AMOUNT",
        )

    # Rule 2 — Zero / negative amount (belt-and-suspenders; schema enforces > 0)
    if amount <= Decimal("0"):
        return True, "INVALID_AMOUNT – amount must be positive", "INVALID_AMOUNT"

    # No rules triggered
    return False, None, None


# ── Webhook dispatch ──────────────────────────────────────────────────────────


def fire_webhook(url: str, payload: dict) -> None:
    """Best-effort HTTP POST to the configured webhook URL (synchronous)."""
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            logger.info("Webhook %s → HTTP %s", url, resp.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Webhook delivery failed for %s: %s", url, exc)


# ── Public API ────────────────────────────────────────────────────────────────


def process_payment(payment: Payment, db: Session) -> Payment:
    """
    Run the full processing pipeline:
      CREATED → PROCESSING → SUCCESS | FAILED

    Also fires an optional webhook on completion.
    Raises ValueError for invalid state transitions.
    """
    if payment.status not in (PaymentStatus.CREATED, PaymentStatus.FAILED):
        raise ValueError(
            f"Payment in status '{payment.status}' cannot be processed. "
            "Only CREATED or FAILED payments may be (re-)processed."
        )

    # Move to PROCESSING
    _set_status(db, payment, PaymentStatus.PROCESSING)

    # Evaluate fraud / business rules
    should_fail, failure_reason, rule_triggered = evaluate_rules(payment)

    if should_fail:
        payment.rule_triggered = rule_triggered
        payment.fraud_flag = rule_triggered == "FRAUD_HIGH_AMOUNT"
        _set_status(db, payment, PaymentStatus.FAILED, reason=failure_reason)
    else:
        # Random outcome (time/random-based simulation)
        if random.random() < SUCCESS_PROBABILITY:
            _set_status(db, payment, PaymentStatus.SUCCESS)
        else:
            reason = "PROCESSING_ERROR – random transient failure"
            payment.rule_triggered = "RANDOM_FAILURE"
            _set_status(db, payment, PaymentStatus.FAILED, reason=reason)

    db.commit()
    db.refresh(payment)

    # Fire webhook (best-effort, after commit)
    if payment.webhook_url:
        webhook_payload = {
            "event": "payment.status_changed",
            "payment_id": payment.id,
            "payment_reference": payment.payment_reference,
            "status": payment.status,
            "failure_reason": payment.failure_reason,
            "rule_triggered": payment.rule_triggered,
        }
        fire_webhook(str(payment.webhook_url), webhook_payload)

    return payment


def refund_payment(payment: Payment, db: Session) -> Payment:
    """Transition a SUCCESS payment to REFUNDED."""
    if payment.status != PaymentStatus.SUCCESS:
        raise ValueError(
            f"Only SUCCESS payments can be refunded (current: {payment.status})."
        )
    _set_status(db, payment, PaymentStatus.REFUNDED, reason="Customer-initiated refund")
    db.commit()
    db.refresh(payment)

    if payment.webhook_url:
        fire_webhook(
            str(payment.webhook_url),
            {
                "event": "payment.refunded",
                "payment_id": payment.id,
                "payment_reference": payment.payment_reference,
                "status": payment.status,
            },
        )
    return payment


def retry_payment(payment: Payment, db: Session) -> Payment:
    """Retry a FAILED payment (re-run the processing engine)."""
    if payment.status != PaymentStatus.FAILED:
        raise ValueError(
            f"Only FAILED payments can be retried (current: {payment.status})."
        )
    if payment.retry_count >= MAX_RETRY_COUNT:
        raise ValueError(
            f"Maximum retry count ({MAX_RETRY_COUNT}) reached for this payment."
        )
    payment.retry_count += 1
    db.flush()
    return process_payment(payment, db)
