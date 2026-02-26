# Payment Processing Engine

A full-stack payment simulation system built for the NT Hackathon. It models a real-world payment lifecycle using a state machine, exposes a REST API to manage and inspect payments, and provides a React dashboard for live monitoring.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [State Transitions](#state-transitions)
- [Failure Rules](#failure-rules)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Design Assumptions](#design-assumptions)
- [Stretch Goals Implemented](#stretch-goals-implemented)

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 19, Vite 7, Tailwind CSS 4    |
| Backend   | FastAPI (Python)                    |
| Database  | SQLite (via SQLAlchemy ORM)         |
| Env Mgmt  | python-dotenv                       |

---

## Architecture Overview

```
client/          ← React + Vite + Tailwind frontend
server/
  app/
    main.py      ← FastAPI application entry point
    models/      ← SQLAlchemy ORM models
    schemas/     ← Pydantic request/response schemas
    routes/      ← API route handlers
    services/    ← Business logic & state machine
    db/
      database.py ← SQLAlchemy engine + session setup
```

The frontend communicates with the FastAPI backend over REST. The backend persists payment records in SQLite and drives status transitions through a dedicated service layer.

---

## State Transitions

Every payment moves through the following state machine:

```
CREATED ──► PROCESSING ──► SUCCESS
                     │
                     └──► FAILED ──► (REFUNDED*)
```

| Transition              | Trigger                                      |
|-------------------------|----------------------------------------------|
| `CREATED → PROCESSING`  | Payment is accepted and queued               |
| `PROCESSING → SUCCESS`  | Amount is valid, no fraud flags              |
| `PROCESSING → FAILED`   | Rule-based, random, or time-based failure    |
| `SUCCESS → REFUNDED`*   | Explicit refund request (stretch goal)       |

### Transition Mechanisms

- **Time-based** — A background task or scheduled job advances the payment status after a configurable delay, simulating real processing latency.
- **Random** — A configurable probability governs whether a payment succeeds or fails when no deterministic rule applies.
- **Rule-based** — Hard rules are evaluated before the random outcome is computed (see [Failure Rules](#failure-rules)).

---

## Failure Rules

| Rule                        | Condition                          | Failure Reason            |
|-----------------------------|------------------------------------|---------------------------|
| Invalid amount              | `amount <= 0`                      | `INVALID_AMOUNT`          |
| Fraud threshold             | `amount > 10000`                   | `FRAUD_SUSPECTED`*        |
| Missing required fields     | `recipient` or `currency` absent   | `INVALID_REQUEST`         |
| Random failure              | Random draw exceeds success rate   | `PROCESSING_ERROR`        |

> \* Fraud threshold rule is a stretch-goal feature.

---

## API Reference

### Payments

| Method | Endpoint                     | Description                          |
|--------|------------------------------|--------------------------------------|
| POST   | `/payments`                  | Create a new payment                 |
| GET    | `/payments/{payment_id}`     | Get payment status and details       |
| GET    | `/payments`                  | List all payments                    |
| POST   | `/payments/{payment_id}/refund` | Initiate a refund (stretch)       |

### Summary

| Method | Endpoint         | Description                                  |
|--------|------------------|----------------------------------------------|
| GET    | `/summary`       | Aggregated stats: total, success, failed, refunded, failure reason breakdown |

### Sample Request — Create Payment

```json
POST /payments
{
  "amount": 250.00,
  "currency": "USD",
  "recipient": "alice@example.com",
  "description": "Invoice #1042"
}
```

### Sample Response — Payment Status

```json
{
  "payment_id": "a3f1c2d4-...",
  "status": "FAILED",
  "amount": 250.00,
  "currency": "USD",
  "recipient": "alice@example.com",
  "failure_reason": "PROCESSING_ERROR",
  "created_at": "2026-02-26T10:00:00Z",
  "updated_at": "2026-02-26T10:00:05Z"
}
```

### Sample Response — Transaction Summary

```json
{
  "total": 120,
  "success": 87,
  "failed": 30,
  "refunded": 3,
  "failure_reasons": {
    "PROCESSING_ERROR": 18,
    "INVALID_AMOUNT": 7,
    "FRAUD_SUSPECTED": 5
  }
}
```

---

## Project Structure

```
NT_hackathon/
├── README.md
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── assets/
└── server/
    ├── app/
    │   ├── main.py          # FastAPI app, CORS, router registration
    │   ├── __init__.py
    │   ├── db/
    │   │   └── database.py  # Engine, session factory, Base
    │   ├── models/
    │   │   └── models.py    # Payment ORM model
    │   ├── schemas/
    │   │   └── schemas.py   # Pydantic create/response schemas
    │   ├── routes/
    │   │   └── payments.py  # Route handlers
    │   └── services/
    │       └── payment_service.py  # State machine & business logic
    └── context.txt
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+

### Backend

```bash
cd server

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install fastapi uvicorn sqlalchemy python-dotenv

# (Optional) Set a custom database URL
# Create a .env file: SQLALCHEMY_DATABASE_URL=sqlite:///./payments.db

# Run the development server
uvicorn app.main:app --reload --port 8000
```

API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`.

---

## Design Assumptions

1. **SQLite for persistence** — Chosen for zero-config local development. The `SQLALCHEMY_DATABASE_URL` environment variable can point to any SQLAlchemy-compatible database (e.g., PostgreSQL) without code changes.
2. **Synchronous state transitions** — Status is advanced inside the same request/response cycle using a short simulated delay, keeping the implementation self-contained without requiring a task queue.
3. **Payment IDs** — UUIDs are generated server-side to ensure global uniqueness.
4. **No authentication** — Auth is out of scope for this hackathon; all endpoints are publicly accessible.
5. **Single currency per payment** — Each payment record carries its own currency field; no conversion is performed.
6. **Fraud threshold is configurable** — The default limit is `10,000` units of the payment currency; this can be adjusted via an environment variable.
7. **Failure probability** — Default random failure rate is 20 %; configurable via `FAILURE_RATE` env var.
8. **CORS** — The backend allows all origins in development to simplify frontend integration.

---

## Stretch Goals Implemented

- **Refund flow** — `SUCCESS → REFUNDED` via `POST /payments/{id}/refund`
- **Fraud rule** — Payments exceeding the fraud threshold are automatically failed with reason `FRAUD_SUSPECTED`
- **Simulated webhook callback** — On every status change, the service fires an async HTTP POST to a configurable `WEBHOOK_URL` with the updated payment payload
- **Retry logic** — `FAILED` payments with reason `PROCESSING_ERROR` can be retried up to a configurable `MAX_RETRIES` limit via `POST /payments/{id}/retry`
