"""
SessionManager  —  all Supabase CRUD for chat sessions and messages.
Handles creation, retrieval, title generation, and summarization triggers.
"""

from core.auth import supabase


# ── Session operations ───────────────────────────────────────────────────────

def create_session(user_id: str, title: str = "New Chat") -> dict:
    """Create a new chat session row and return it."""
    result = supabase.table("chat_sessions").insert({
        "user_id": user_id,
        "title":   title,
    }).execute()
    return result.data[0] if result.data else None


def get_session(session_id: str, user_id: str) -> dict | None:
    """
    Fetch a session only if it belongs to this user.
    Prevents users from accessing each other's sessions.
    """
    result = supabase.table("chat_sessions")\
        .select("*")\
        .eq("id",      session_id)\
        .eq("user_id", user_id)\
        .execute()
    return result.data[0] if result.data else None


def get_user_sessions(user_id: str) -> list:
    """
    Return all sessions for a user, newest first.
    Used to populate the sidebar chat history.
    """
    result = supabase.table("chat_sessions")\
        .select("id, title, summary, created_at, updated_at")\
        .eq("user_id", user_id)\
        .order("updated_at", desc=True)\
        .execute()
    return result.data or []


def update_session_title(session_id: str, title: str) -> None:
    """Update the human-readable title shown in the sidebar."""
    supabase.table("chat_sessions")\
        .update({"title": title[:80]})\
        .eq("id", session_id)\
        .execute()


def update_session_summary(session_id: str, summary: str) -> None:
    """Store the compressed Tier 2 summary for a session."""
    supabase.table("chat_sessions")\
        .update({"summary": summary})\
        .eq("id", session_id)\
        .execute()


def delete_session(session_id: str, user_id: str) -> bool:
    """
    Delete a session + all its messages (cascade handles messages).
    Returns True if something was actually deleted.
    """
    result = supabase.table("chat_sessions")\
        .delete()\
        .eq("id",      session_id)\
        .eq("user_id", user_id)\
        .execute()
    return bool(result.data)


# ── Message operations ───────────────────────────────────────────────────────

def save_message(session_id: str, role: str, content: str) -> dict:
    """
    Persist a single message. role must be 'user' or 'assistant'.
    The trg_touch_session trigger automatically updates session.updated_at.
    """
    result = supabase.table("messages").insert({
        "session_id": session_id,
        "role":       role,
        "content":    content,
    }).execute()
    return result.data[0] if result.data else None


def get_recent_messages(session_id: str, limit: int = 15) -> list:
    """
    Fetch the most recent `limit` messages for Tier 1 context.
    Returns them in chronological order (oldest first).
    """
    result = supabase.table("messages")\
        .select("role, content, created_at")\
        .eq("session_id", session_id)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()

    # Reverse so oldest is first (chronological for prompt building)
    messages = result.data or []
    return list(reversed(messages))


def get_all_messages(session_id: str) -> list:
    """
    Fetch every message in a session (used for full history display
    when a user clicks a past chat in the sidebar).
    """
    result = supabase.table("messages")\
        .select("role, content, created_at")\
        .eq("session_id", session_id)\
        .order("created_at", desc=True)\
        .execute()
    return list(reversed(result.data or []))


def get_message_count(session_id: str) -> int:
    """Fast count — used to decide when to trigger summarization."""
    result = supabase.table("messages")\
        .select("id", count="exact")\
        .eq("session_id", session_id)\
        .execute()
    return result.count or 0


def get_messages_for_summary(session_id: str, skip_last: int = 15) -> list:
    """
    Returns older messages that are NOT in the recent Tier 1 window.
    These are the messages that get compressed into a summary.
    """
    all_msgs = get_all_messages(session_id)
    # Exclude the last `skip_last` messages — those stay verbatim in Tier 1
    if len(all_msgs) <= skip_last:
        return []
    return all_msgs[:-skip_last]


# ── User facts (Tier 3 long-term memory) ────────────────────────────────────

def get_user_facts(user_id: str) -> list[str]:
    """Return a list of fact strings for this user."""
    result = supabase.table("user_facts")\
        .select("fact")\
        .eq("user_id", user_id)\
        .order("created_at", desc=False)\
        .execute()
    return [row["fact"] for row in (result.data or [])]


def save_user_fact(user_id: str, fact: str) -> None:
    """Store a new long-term fact about this user."""
    supabase.table("user_facts").insert({
        "user_id": user_id,
        "fact":    fact[:500],
    }).execute()