"""
@require_auth decorator — validates httpOnly JWT cookie on protected routes.
Injects g.user_id and g.user_email into Flask's request context.
"""

from functools import wraps
from flask import request, jsonify, g
import jwt as pyjwt
from .auth_manager import decode_jwt

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Read from Authorization: Bearer <token>
        auth_header = request.headers.get("Authorization", "")
        token = None

        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

        if not token:
            return jsonify({"error": "Not authenticated."}), 401

        try:
            payload      = decode_jwt(token)
            g.user_id    = payload["sub"]
            g.user_email = payload["email"]
        except pyjwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please sign in again."}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({"error": "Invalid session. Please sign in again."}), 401

        return f(*args, **kwargs)
    return decorated