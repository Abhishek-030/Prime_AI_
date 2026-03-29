"""
Prime AI - Flask API Server
Connects the JS frontend → Engine → IntentDetector → CommandRouter → Executors
"""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")
from flask import Flask, request, jsonify, Response, stream_with_context, make_response, g
from core.auth import register_user, login_user, get_user_by_id, decode_jwt
from core.auth.decorators import require_auth
from flask_cors import CORS
from core.engine import Engine
import os
import threading
from core.chat import (
    create_session, get_session, get_user_sessions,
    update_session_title, update_session_summary,
    delete_session, save_message, get_all_messages,
    get_message_count, get_messages_for_summary,
    build_prompt, build_summary_prompt, build_title_prompt,
)



# ─── App Setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app,
     supports_credentials=True,
     origins=[
         "http://localhost:5500",
         "http://127.0.0.1:5500",
     ]
)
# CORS(app, supports_credentials=True, origins=["http://localhost:5500","http://127.0.0.1:5500", "http://localhost:3000", "null"]) # Allows requests from your frontend (localhost HTML file)

engine = Engine()


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
@require_auth
def chat():
    """
    Session-aware streaming chat endpoint.

    Request body:
        {
            "message":     "...",
            "session_id":  "uuid or null",   ← null = create new session
            "personality": "normal"           ← optional
        }

    Response headers include X-Session-Id so the frontend
    can store the session_id after a new chat is created.
    """
    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "No message provided."}), 400

    user_message = data["message"].strip()
    if not user_message:
        return jsonify({"error": "Empty message."}), 400

    session_id  = data.get("session_id")        # None for brand new chats
    personality = data.get("personality", "normal")
    user_id     = g.user_id

    # ── 1. Resolve session ────────────────────────────────────────────────────
    is_new_session = False

    if session_id:
        # Verify this session belongs to the authenticated user
        session = get_session(session_id, user_id)
        if not session:
            return jsonify({"error": "Session not found."}), 404
    else:
        # Create a new session — title will be set after first reply
        session      = create_session(user_id)
        session_id   = session["id"]
        is_new_session = True

    # ── 2. Save user message immediately ─────────────────────────────────────
    save_message(session_id, "user", user_message)

    # ── 3. Build the full context-aware prompt ────────────────────────────────
    prompt = build_prompt(
        user_message = user_message,
        session_id   = session_id,
        user_id      = user_id,
        personality  = personality,
    )

    # ── 4. Stream response ────────────────────────────────────────────────────
    def generate_sse():
        full_response = []

        try:
            # Directly call the Ollama streaming client with our built prompt
            # We bypass stream_reply's internal prefix since build_prompt
            # already includes the full system + history context
            import requests as req
            import json

            with req.post(
                "http://localhost:11434/api/generate",
                json={
                    "model":  "qwen2.5-coder:1.5b",
                    "prompt": prompt,
                    "stream": True,
                    "options": {
                        "temperature":    0.9,
                        "top_p":          0.95,
                        "repeat_penalty": 1.3,
                    },
                },
                stream=True,
                timeout=120,
            ) as resp:
                resp.raise_for_status()
                for raw_line in resp.iter_lines():
                    if raw_line:
                        try:
                            chunk = json.loads(raw_line.decode("utf-8"))
                            token = chunk.get("response", "")
                            if token:
                                full_response.append(token)
                                escaped = token.replace("\n", "\\n")
                                yield f"data: {escaped}\n\n"
                            if chunk.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue

        except Exception as e:
            print(f"[Chat SSE Error] {e}")
            yield f"data: Sorry, something went wrong: {e}\n\n"

        finally:
            yield "data: [DONE]\n\n"

            # ── 5. Post-stream: save reply + background tasks ─────────────────
            assistant_reply = "".join(full_response).strip()
            if assistant_reply:
                save_message(session_id, "assistant", assistant_reply)

                # Generate title from first message (runs in background)
                if is_new_session:
                    threading.Thread(
                        target=_generate_and_save_title,
                        args=(session_id, user_message),
                        daemon=True,
                    ).start()

                # Trigger summarization if session is getting long
                msg_count = get_message_count(session_id)
                if msg_count > 20 and msg_count % 20 == 0:
                    threading.Thread(
                        target=_summarize_old_messages,
                        args=(session_id,),
                        daemon=True,
                    ).start()

    response = Response(
        stream_with_context(generate_sse()),
        mimetype="text/event-stream",
    )
    response.headers["Cache-Control"]     = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["X-Session-Id"]      = session_id   # ← frontend reads this
    return response

def _generate_and_save_title(session_id: str, first_message: str) -> None:
    """
    Background thread: asks LLM for a short title, saves to Supabase.
    Fires once after the very first message in a new session.
    """
    try:
        prompt = build_title_prompt(first_message)
        result = engine.intent_detector.llm.generate(prompt)
        # generate() returns a dict — we want raw text here so call Ollama directly
        import requests as req, json
        resp = req.post(
            "http://localhost:11434/api/generate",
            json={"model": "qwen2.5-coder:1.5b", "prompt": prompt, "stream": False},
            timeout=30,
        )
        raw = resp.json().get("response", "").strip()
        # Clean up any stray quotes or newlines the model might add
        title = raw.split("\n")[0].strip('"\'').strip()[:80]
        if title:
            update_session_title(session_id, title)
            print(f"[Title] Session {session_id[:8]}… → '{title}'")
    except Exception as e:
        print(f"[Title Error] {e}")


def _summarize_old_messages(session_id: str) -> None:
    """
    Background thread: compresses older messages into a 4-5 sentence summary.
    Fires every 20 messages beyond the first 15 (which stay verbatim).
    """
    try:
        old_messages = get_messages_for_summary(session_id, skip_last=15)
        if not old_messages:
            return

        prompt = build_summary_prompt(old_messages)

        import requests as req, json
        resp = req.post(
            "http://localhost:11434/api/generate",
            json={"model": "qwen2.5-coder:1.5b", "prompt": prompt, "stream": False},
            timeout=60,
        )
        summary = resp.json().get("response", "").strip()
        if summary:
            update_session_summary(session_id, summary)
            print(f"[Summary] Session {session_id[:8]}… updated.")
    except Exception as e:
        print(f"[Summary Error] {e}")

# ─── GET /api/sessions  —  populate sidebar on page load ──────────────────────
@app.route("/api/sessions", methods=["GET"])
@require_auth
def list_sessions():
    """Returns all sessions for the logged-in user, newest first."""
    sessions = get_user_sessions(g.user_id)
    return jsonify({"sessions": sessions}), 200


# ─── GET /api/sessions/<id>/messages  —  load a past chat ─────────────────────
@app.route("/api/sessions/<session_id>/messages", methods=["GET"])
@require_auth
def get_session_messages(session_id):
    """
    Returns the full message history for a session.
    Called when user clicks a past chat in the sidebar.
    """
    session = get_session(session_id, g.user_id)
    if not session:
        return jsonify({"error": "Session not found."}), 404

    messages = get_all_messages(session_id)
    return jsonify({
        "session":  session,
        "messages": messages,
    }), 200


# ─── DELETE /api/sessions/<id>  —  delete from sidebar ───────────────────────
@app.route("/api/sessions/<session_id>", methods=["DELETE"])
@require_auth
def remove_session(session_id):
    """Deletes a session and all its messages (cascade)."""
    deleted = delete_session(session_id, g.user_id)
    if not deleted:
        return jsonify({"error": "Session not found."}), 404
    return jsonify({"message": "Session deleted."}), 200


@app.route('/api/reply', methods=['POST'])
def reply():
    """
    Direct streaming reply — NO intent detection.
    Used for pure conversation (hello, questions, etc.) for minimum latency.
    """
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400

    user_message = data['message'].strip()
    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    def generate_sse():
        try:
            for chunk in engine.code_client.stream_reply(user_message):
                escaped = chunk.replace('\n', '\\n')
                yield f"data: {escaped}\n\n"
        except Exception as e:
            print(f"[Reply SSE Error] {e}")
            yield f"data: Sorry, something went wrong.\n\n"
        finally:
            yield "data: [DONE]\n\n"

    response = Response(
        stream_with_context(generate_sse()),
        mimetype='text/event-stream'
    )
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response


@app.route('/api/code', methods=['POST'])
def code_generate():
    """
    Code generation endpoint — streams tokens via Server-Sent Events (SSE).
    """
    data = request.get_json()

    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400

    user_message = data['message'].strip()

    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    def generate_sse():
        try:
            for chunk in engine.generate_code(user_message):
                escaped = chunk.replace('\n', '\\n')
                yield f"data: {escaped}\n\n"
        except Exception as e:
            print(f"[Code SSE Error] {e}")
            yield f"data: \\n# Error generating code: {e}\\n\n\n"
        finally:
            yield "data: [DONE]\n\n"

    response = Response(
        stream_with_context(generate_sse()),
        mimetype='text/event-stream'
    )
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response


# ─── NEW: System Health Monitor ────────────────────────────────────────────────

@app.route('/api/system/health', methods=['GET'])
def system_health():
    """
    Returns real-time system stats using psutil.
    Install dependency: pip install psutil
    Returns: CPU%, RAM%, Disk%, per-core CPU, top processes
    """
    try:
        import psutil

        # CPU
        cpu_percent     = psutil.cpu_percent(interval=0.3)
        cpu_per_core    = psutil.cpu_percent(interval=0, percpu=True)
        cpu_freq        = psutil.cpu_freq()
        cpu_count       = psutil.cpu_count(logical=True)

        # RAM
        ram = psutil.virtual_memory()
        ram_used_gb  = round(ram.used  / (1024 ** 3), 2)
        ram_total_gb = round(ram.total / (1024 ** 3), 2)

        # Disk (primary drive)
        disk = psutil.disk_usage('/')
        disk_used_gb  = round(disk.used  / (1024 ** 3), 1)
        disk_total_gb = round(disk.total / (1024 ** 3), 1)

        # Network
        net = psutil.net_io_counters()
        net_sent_mb = round(net.bytes_sent / (1024 ** 2), 1)
        net_recv_mb = round(net.bytes_recv / (1024 ** 2), 1)

        # Top 5 CPU-consuming processes
        processes = []
        for proc in sorted(
            psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']),
            key=lambda p: p.info['cpu_percent'] or 0,
            reverse=True
        )[:5]:
            try:
                processes.append({
                    'pid':     proc.info['pid'],
                    'name':    proc.info['name'],
                    'cpu':     round(proc.info['cpu_percent'] or 0, 1),
                    'memory':  round(proc.info['memory_percent'] or 0, 1),
                })
            except Exception:
                pass

        # Battery (if available)
        battery_info = None
        try:
            battery = psutil.sensors_battery()
            if battery:
                battery_info = {
                    'percent':   round(battery.percent, 1),
                    'plugged_in': battery.power_plugged,
                    'time_left':  battery.secsleft if battery.secsleft > 0 else None,
                }
        except Exception:
            pass

        # Health status levels
        def status(pct):
            if pct < 60:   return 'good'
            if pct < 85:   return 'warning'
            return 'critical'

        return jsonify({
            'cpu': {
                'percent':   cpu_percent,
                'per_core':  cpu_per_core,
                'count':     cpu_count,
                'freq_mhz':  round(cpu_freq.current, 0) if cpu_freq else None,
                'status':    status(cpu_percent),
            },
            'ram': {
                'percent':   ram.percent,
                'used_gb':   ram_used_gb,
                'total_gb':  ram_total_gb,
                'status':    status(ram.percent),
            },
            'disk': {
                'percent':   disk.percent,
                'used_gb':   disk_used_gb,
                'total_gb':  disk_total_gb,
                'status':    status(disk.percent),
            },
            'network': {
                'sent_mb':  net_sent_mb,
                'recv_mb':  net_recv_mb,
            },
            'battery':   battery_info,
            'processes': processes,
        })

    except ImportError:
        return jsonify({
            'error': 'psutil not installed. Run: pip install psutil',
            'cpu':   {'percent': 0, 'status': 'unknown'},
            'ram':   {'percent': 0, 'status': 'unknown'},
            'disk':  {'percent': 0, 'status': 'unknown'},
        }), 200

    except Exception as e:
        print(f"[System Health Error] {e}")
        return jsonify({'error': str(e)}), 500


# ─── NEW: TTS Voice Presets ─────────────────────────────────────────────────────

@app.route('/api/tts/voices', methods=['GET'])
def tts_voices():
    """
    Returns available TTS voice presets for frontend selection.
    These map to Web Speech API voice names when possible.
    """
    voices = [
        # Male voices
        {'id': 'male_default',  'name': 'Alex',   'gender': 'male',   'accent': 'American',  'lang': 'en-US', 'preview': 'Hello! I am Alex, your Prime AI assistant.'},
        {'id': 'male_uk',       'name': 'James',  'gender': 'male',   'accent': 'British',   'lang': 'en-GB', 'preview': 'Hello! I am James, your Prime AI assistant.'},
        {'id': 'male_au',       'name': 'Jack',   'gender': 'male',   'accent': 'Australian','lang': 'en-AU', 'preview': 'Hello! I am Jack, your Prime AI assistant.'},
        # Female voices
        {'id': 'female_default','name': 'Aria',   'gender': 'female', 'accent': 'American',  'lang': 'en-US', 'preview': 'Hello! I am Aria, your Prime AI assistant.'},
        {'id': 'female_uk',     'name': 'Sophie', 'gender': 'female', 'accent': 'British',   'lang': 'en-GB', 'preview': 'Hello! I am Sophie, your Prime AI assistant.'},
        {'id': 'female_in',     'name': 'Priya',  'gender': 'female', 'accent': 'Indian',    'lang': 'en-IN', 'preview': 'Hello! I am Priya, your Prime AI assistant.'},
        {'id': 'female_au',     'name': 'Emma',   'gender': 'female', 'accent': 'Australian','lang': 'en-AU', 'preview': 'Hello! I am Emma, your Prime AI assistant.'},
    ]
    return jsonify({'voices': voices})


# ─── NEW: Weekly Activity Summary ──────────────────────────────────────────────

@app.route('/api/stats/weekly', methods=['GET'])
def weekly_stats():
    """
    Returns weekly usage statistics.
    In production these would be pulled from a local DB.
    Returning mock data structure for now.
    """
    return jsonify({
        'messages_sent':       42,
        'code_generated':       7,
        'files_managed':        3,
        'study_sessions':       5,
        'total_focus_minutes': 125,
        'system_alerts':        2,
        'top_topics': ['Python debugging', 'File organization', 'Study plans'],
        'daily_activity': [4, 8, 3, 7, 9, 6, 5],  # Sun–Sat
    })

# ─── Health Check ──────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    """
    Health check endpoint.
    """
    return jsonify({'status': 'ok', 'message': 'Prime AI backend is running'})

# ─── Auth: Cookie config ───────────────────────────────────────────────────────
COOKIE_NAME     = "prime_token"
COOKIE_MAX_AGE  = 60 * 60 * int(os.getenv("JWT_EXPIRE_HOURS", 168))  # seconds
IS_DEV          = os.getenv("FLASK_ENV") == "development"


# def _set_auth_cookie(response, token: str):
#     """Attach the JWT as an httpOnly, SameSite=Lax cookie."""
#     response.set_cookie(
#         COOKIE_NAME,
#         token,
#         max_age=COOKIE_MAX_AGE,
#         httponly=True,          # JS cannot read this — XSS protection
#         samesite="None",
#         # samesite="Lax",
#         secure=False,      # HTTPS only in production
#         # secure=not IS_DEV,      # HTTPS only in production
#         path="/",
#     )
#     return response


# ─── POST /api/auth/register ───────────────────────────────────────────────────
# DELETE the entire _set_auth_cookie function and COOKIE_NAME / COOKIE_MAX_AGE / IS_DEV constants
# Replace both auth routes' cookie calls with direct JSON:

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided."}), 400

    full_name = data.get("full_name", "").strip()
    email     = data.get("email", "").strip().lower()
    username  = data.get("username", "").strip().lower()
    password  = data.get("password", "")

    if not all([full_name, email, username, password]):
        return jsonify({"error": "All fields are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    result = register_user(full_name, email, username, password)
    if "error" in result:
        return jsonify(result), 409

    # Return token in body — frontend stores in localStorage
    return jsonify({
        "message": "Registered successfully.",
        "user":    result["user"],
        "token":   result["token"],        # ← token in body now
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided."}), 400

    identifier = data.get("identifier", "").strip()
    password   = data.get("password", "")

    if not identifier or not password:
        return jsonify({"error": "Username/email and password are required."}), 400

    result = login_user(identifier, password)
    if "error" in result:
        return jsonify(result), 401

    return jsonify({
        "message": "Logged in successfully.",
        "user":    result["user"],
        "token":   result["token"],        # ← token in body now
    }), 200


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    # Nothing to clear server-side — client drops the token
    return jsonify({"message": "Logged out."}), 200


# ─── GET /api/auth/me  (used on page load to restore session) ─────────────────
@app.route("/api/auth/me", methods=["GET"])
@require_auth
def auth_me():
    """
    Frontend calls this on every page load.
    If the cookie is valid → returns user object.
    If expired/missing → 401 → frontend shows sign-in prompt.
    """
    user = get_user_by_id(g.user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user}), 200


# ─── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 50)
    print("  Prime AI Backend starting...")
    print("  Listening on http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)