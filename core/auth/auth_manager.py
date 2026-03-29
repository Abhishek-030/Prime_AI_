"""
AuthManager  —  handles password hashing, JWT creation/validation,
and all Supabase user operations.
"""

import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

SUPABASE_URL     = os.getenv("SUPABASE_URL")
SUPABASE_KEY     = os.getenv("SUPABASE_SERVICE_KEY")
JWT_SECRET       = os.getenv("JWT_SECRET")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", 168))

if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set in your .env file. "
        "Run: python -c \"import secrets; print(secrets.token_hex(64))\""
    )

# Single shared Supabase client (service role — backend only)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Password helpers ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT helpers ──────────────────────────────────────────────────────────────

def create_jwt(user_id: str, email: str) -> str:
    payload = {
        "sub":   user_id,
        "email": email,
        "iat":   datetime.now(timezone.utc),
        "exp":   datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "jti":   str(uuid.uuid4()),        # unique token id
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_jwt(token: str) -> dict:
    """
    Returns decoded payload or raises jwt.ExpiredSignatureError /
    jwt.InvalidTokenError on failure.
    """
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])


# ── User operations ──────────────────────────────────────────────────────────

def register_user(full_name: str, email: str, username: str, password: str) -> dict:
    """
    Creates a new user row. Returns dict with 'user' or 'error' key.
    """
    # Check duplicates
    existing_email = supabase.table("users")\
        .select("id").eq("email", email).execute()
    if existing_email.data:
        return {"error": "Email already registered."}

    existing_uname = supabase.table("users")\
        .select("id").eq("username", username).execute()
    if existing_uname.data:
        return {"error": "Username already taken."}

    pw_hash = hash_password(password)

    result = supabase.table("users").insert({
        "full_name":     full_name,
        "email":         email,
        "username":      username,
        "password_hash": pw_hash,
    }).execute()

    if not result.data:
        return {"error": "Registration failed. Please try again."}

    user = result.data[0]
    token = create_jwt(user["id"], user["email"])
    return {"user": _safe_user(user), "token": token}


def login_user(identifier: str, password: str) -> dict:
    """
    identifier can be email OR username.
    Returns dict with 'user' + 'token' or 'error'.
    """
    # Try email first, then username
    result = supabase.table("users")\
        .select("*")\
        .eq("email", identifier)\
        .execute()

    if not result.data:
        result = supabase.table("users")\
            .select("*")\
            .eq("username", identifier)\
            .execute()

    if not result.data:
        return {"error": "Invalid credentials."}

    user = result.data[0]

    if not verify_password(password, user["password_hash"]):
        return {"error": "Invalid credentials."}

    token = create_jwt(user["id"], user["email"])
    return {"user": _safe_user(user), "token": token}


def get_user_by_id(user_id: str) -> dict | None:
    result = supabase.table("users")\
        .select("id, email, username, full_name, avatar_url, created_at")\
        .eq("id", user_id)\
        .execute()
    return result.data[0] if result.data else None


def _safe_user(user: dict) -> dict:
    """Strip password_hash before sending to client."""
    return {k: v for k, v in user.items() if k != "password_hash"}