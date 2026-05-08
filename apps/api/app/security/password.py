"""Password hashing utilities (native ``bcrypt`` — avoids passlib/bcrypt 4.x bugs)."""
from __future__ import annotations

import bcrypt


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode(
        "ascii"
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("ascii"),
    )
