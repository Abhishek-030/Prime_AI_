"""
ContextBuilder  —  assembles the full 3-tier prompt for every LLM call.

Tier 1  →  Last 15 messages verbatim          (~1,500 tokens)
Tier 2  →  Compressed summary of older msgs   (~300  tokens)
Tier 3  →  Long-term user facts               (~200  tokens)

Total budget stays safely within qwen2.5-coder:1.5b's context window.
"""

from .session_manager import (
    get_recent_messages,
    get_user_facts,
    get_session,
)

# ── Personality system prompts ────────────────────────────────────────────────

PERSONALITY_PROMPTS = {
    "normal": (
        "You are Prime AI, a helpful and intelligent personal assistant. "
        "Be clear, concise, and friendly."
    ),
    "study": (
        "You are Prime AI in Study Mode. Be thorough, structured, and educational. "
        "Break down complex topics step by step. Encourage the user."
    ),
    "chill": (
        "You are Prime AI in Chill Mode. Be relaxed, casual, and conversational. "
        "Keep responses light and easy to read."
    ),
    "strict": (
        "You are Prime AI in Strict Mode. Be direct, precise, and concise. "
        "No filler words. Get straight to the point."
    ),
    "funny": (
        "You are Prime AI in Funny Mode. Be witty, use light humour, "
        "but still give accurate and helpful answers."
    ),
}

DEFAULT_SYSTEM = PERSONALITY_PROMPTS["normal"]


def build_prompt(
    user_message: str,
    session_id:   str | None = None,
    user_id:      str | None = None,
    personality:  str        = "normal",
) -> str:
    """
    Assembles the full context-aware prompt for the LLM.

    If session_id is None (new chat / no auth), returns a simple
    prompt with no history — graceful degradation.
    """

    system_prompt = PERSONALITY_PROMPTS.get(personality, DEFAULT_SYSTEM)

    # ── No session: plain prompt (guest mode / new chat) ─────────────────────
    if not session_id or not user_id:
        return (
            f"{system_prompt}\n\n"
            f"User: {user_message}\n"
            f"Prime AI:"
        )

    # ── Tier 3: User long-term facts ─────────────────────────────────────────
    facts       = get_user_facts(user_id)
    facts_block = ""
    if facts:
        facts_lines  = "\n".join(f"- {f}" for f in facts[:8])   # cap at 8 facts
        facts_block  = f"USER CONTEXT:\n{facts_lines}\n\n"

    # ── Tier 2: Session summary (compressed older context) ───────────────────
    session      = get_session(session_id, user_id)
    summary_block = ""
    if session and session.get("summary"):
        summary_block = (
            f"CONVERSATION SUMMARY (earlier messages):\n"
            f"{session['summary']}\n\n"
        )

    # ── Tier 1: Recent messages verbatim ─────────────────────────────────────
    recent_msgs   = get_recent_messages(session_id, limit=15)
    history_block = ""
    if recent_msgs:
        lines = []
        for msg in recent_msgs:
            label = "User" if msg["role"] == "user" else "Prime AI"
            lines.append(f"{label}: {msg['content']}")
        history_block = "RECENT CONVERSATION:\n" + "\n".join(lines) + "\n\n"

    # ── Assemble full prompt ──────────────────────────────────────────────────
    prompt = (
        f"{system_prompt}\n\n"
        f"{facts_block}"
        f"{summary_block}"
        f"{history_block}"
        f"User: {user_message}\n"
        f"Prime AI:"
    )

    return prompt


def build_summary_prompt(messages: list) -> str:
    """
    Prompt used by the background summarization thread.
    Compresses older messages into 4-5 sentences.
    """
    history = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Prime AI'}: {m['content']}"
        for m in messages
    )
    return (
        "Summarize the following conversation in 4-5 sentences. "
        "Focus on key topics discussed, decisions made, and any important "
        "context that would help continue the conversation. "
        "Be factual and concise. Output ONLY the summary, no preamble.\n\n"
        f"CONVERSATION:\n{history}\n\nSUMMARY:"
    )


def build_title_prompt(first_message: str) -> str:
    """
    Generates a short sidebar title from the user's first message.
    Called once after the very first message in a new session.
    """
    return (
        "Generate a short 3-5 word title for a chat that starts with this message. "
        "Output ONLY the title, no punctuation, no quotes, no explanation.\n\n"
        f"Message: {first_message}\n\nTitle:"
    )