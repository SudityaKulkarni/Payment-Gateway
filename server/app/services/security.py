"""Password hashing helpers using bcrypt."""

from __future__ import annotations

import bcrypt


def hash_password(password: str) -> str:
    """Generate a salted bcrypt hash for the provided password."""
    if not password:
        raise ValueError("Password must be non-empty")

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, encoded_hash: str) -> bool:
    """Constant-time verification of a password against its stored bcrypt hash."""
    if not password or not encoded_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), encoded_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False
