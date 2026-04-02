"""
Prime AI - Flask API Server
Connects the JS frontend → Engine → IntentDetector → CommandRouter → Executors
"""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")
from flask import Flask, request, jsonify, Response, stream_with_context, make_response, g
from core.auth import register_user, login_user, get_user_by_id, decode_jwt, supabase
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

engine = Engine()


# ─── Helper: increment weekly_stats column ─────────────────────────────────────

def _increment_weekly_stat(user_id: str, column: str, amount: int = 1) -> None:
    from datetime import date, timedelta
    today      = date.today()
    week_start = (today - timedelta(days=today.weekday())).isoformat()
    try:
        existing = supabase.table('weekly_stats') \
            .select('id, ' + column) \
            .eq('user_id',    user_id) \
            .eq('week_start', week_start) \
            .execute()
        if existing.data:
            row = existing.data[0]
            supabase.table('weekly_stats') \
                .update({column: (row.get(column) or 0) + amount}) \
                .eq('id', row['id']) \
                .execute()
        else:
            supabase.table('weekly_stats').insert({
                'user_id':    user_id,
                'week_start': week_start,
                column:       amount,
            }).execute()
    except Exception as e:
        print(f'[WeeklyStat Error] {e}')


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
@require_auth
def chat():
    """
    Session-aware streaming chat endpoint.
    """
    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "No message provided."}), 400

    user_message = data["message"].strip()
    if not user_message:
        return jsonify({"error": "Empty message."}), 400

    session_id  = data.get("session_id")
    personality = data.get("personality", "normal")
    user_id     = g.user_id

    # ── 1. Resolve session ────────────────────────────────────────────────────
    is_new_session = False

    if session_id:
        session = get_session(session_id, user_id)
        if not session:
            return jsonify({"error": "Session not found."}), 404
    else:
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

            assistant_reply = "".join(full_response).strip()
            if assistant_reply:
                save_message(session_id, "assistant", assistant_reply)
                _increment_weekly_stat(user_id, "messages_sent")

                if is_new_session:
                    threading.Thread(
                        target=_generate_and_save_title,
                        args=(session_id, user_message),
                        daemon=True,
                    ).start()

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
    response.headers["X-Session-Id"]      = session_id
    return response

def _generate_and_save_title(session_id: str, first_message: str) -> None:
    try:
        prompt = build_title_prompt(first_message)
        import requests as req, json
        resp = req.post(
            "http://localhost:11434/api/generate",
            json={"model": "qwen2.5-coder:1.5b", "prompt": prompt, "stream": False},
            timeout=30,
        )
        raw = resp.json().get("response", "").strip()
        title = raw.split("\n")[0].strip('"\'').strip()[:80]
        if title:
            update_session_title(session_id, title)
            print(f"[Title] Session {session_id[:8]}… → '{title}'")
    except Exception as e:
        print(f"[Title Error] {e}")


def _summarize_old_messages(session_id: str) -> None:
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

# ─── GET /api/sessions ─────────────────────────────────────────────────────────

@app.route('/api/stats/weekly/summary-prompt', methods=['GET'])
@require_auth
def weekly_summary_prompt():
    """
    Returns a pre-built prompt string with real stats injected,
    ready to be sent to the LLM for a weekly summary chat response.
    """
    from datetime import date, timedelta
    user_id = g.user_id

    today      = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end   = week_start + timedelta(days=7)

    sessions_res = supabase.table('chat_sessions') \
        .select('id, title, created_at') \
        .eq('user_id', user_id) \
        .execute()
    session_ids = [s['id'] for s in (sessions_res.data or [])]

    messages_sent  = 0
    code_generated = 0
    daily_activity = [0] * 7

    if session_ids:
        msgs_res = supabase.table('messages') \
            .select('role, content, created_at') \
            .in_('session_id', session_ids) \
            .gte('created_at', week_start.isoformat()) \
            .lt('created_at',  week_end.isoformat()) \
            .execute()

        for msg in (msgs_res.data or []):
            if msg['role'] == 'user':
                messages_sent += 1
                d = date.fromisoformat(msg['created_at'][:10])
                daily_activity[d.weekday()] += 1
            elif msg['role'] == 'assistant' and '```' in (msg.get('content') or ''):
                code_generated += 1

    stat_res = supabase.table('weekly_stats') \
        .select('*') \
        .eq('user_id',    user_id) \
        .eq('week_start', week_start.isoformat()) \
        .execute()
    stat_row = stat_res.data[0] if stat_res.data else {}

    week_sessions = [
        s for s in (sessions_res.data or [])
        if s.get('created_at', '')[:10] >= week_start.isoformat()
    ]
    topics = list({
        s['title'] for s in week_sessions
        if s.get('title') and s['title'] != 'New Chat'
    })[:6]

    focus_mins = stat_row.get('total_focus_minutes', 0)

    context = (
        f"Here is the user's actual Prime AI usage data for this week "
        f"(Mon {week_start} to today {today}):\n"
        f"- Messages sent: {messages_sent}\n"
        f"- Code generations: {code_generated}\n"
        f"- Focus minutes logged: {focus_mins}\n"
        f"- Topics discussed: {', '.join(topics) if topics else 'various topics'}\n"
        f"- Daily activity (Mon-Sun message counts): {daily_activity}\n\n"
        f"Based ONLY on this real data, write a friendly weekly summary for the user "
        f"and give 3 specific productivity tips tailored to their usage patterns. "
        f"Be encouraging and specific. Do not make up data."
    )

    return jsonify({'prompt': context})

@app.route("/api/sessions", methods=["GET"])
@require_auth
def list_sessions():
    sessions = get_user_sessions(g.user_id)
    return jsonify({"sessions": sessions}), 200


# ─── GET /api/sessions/<id>/messages ──────────────────────────────────────────
@app.route("/api/sessions/<session_id>/messages", methods=["GET"])
@require_auth
def get_session_messages(session_id):
    session = get_session(session_id, g.user_id)
    if not session:
        return jsonify({"error": "Session not found."}), 404
    messages = get_all_messages(session_id)
    return jsonify({"session": session, "messages": messages}), 200


# ─── DELETE /api/sessions/<id> ────────────────────────────────────────────────
@app.route("/api/sessions/<session_id>", methods=["DELETE"])
@require_auth
def remove_session(session_id):
    deleted = delete_session(session_id, g.user_id)
    if not deleted:
        return jsonify({"error": "Session not found."}), 404
    return jsonify({"message": "Session deleted."}), 200


@app.route('/api/reply', methods=['POST'])
def reply():
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

    response = Response(stream_with_context(generate_sse()), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response


# ─── /api/code  ── SESSION-AWARE (FIXED) ──────────────────────────────────────
@app.route('/api/code', methods=['POST'])
@require_auth
def code_generate():
    """
    Code generation endpoint — now session-aware.
    Saves user prompt + generated code to Supabase so history persists.
    """
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400

    user_message = data['message'].strip()
    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    session_id = data.get('session_id')
    user_id    = g.user_id
    is_new_session = False

    # ── Resolve session ───────────────────────────────────────────────────────
    if session_id:
        session = get_session(session_id, user_id)
        if not session:
            return jsonify({'error': 'Session not found.'}), 404
    else:
        session        = create_session(user_id)
        session_id     = session['id']
        is_new_session = True

    # Save user message
    save_message(session_id, 'user', user_message)

    def generate_sse():
        full_code = []
        try:
            for chunk in engine.generate_code(user_message):
                full_code.append(chunk)
                escaped = chunk.replace('\n', '\\n')
                yield f"data: {escaped}\n\n"
        except Exception as e:
            print(f"[Code SSE Error] {e}")
            yield f"data: \\n# Error generating code: {e}\\n\n\n"
        finally:
            yield "data: [DONE]\n\n"

            assistant_code = ''.join(full_code).strip()
            if assistant_code:
                # Store with fences so renderMessageContent() renders a code block
                save_message(session_id, 'assistant', f'```\n{assistant_code}\n```')
                _increment_weekly_stat(user_id, 'code_generated')

                if is_new_session:
                    threading.Thread(
                        target=_generate_and_save_title,
                        args=(session_id, user_message),
                        daemon=True,
                    ).start()

    response = Response(stream_with_context(generate_sse()), mimetype='text/event-stream')
    response.headers['Cache-Control']     = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers['X-Session-Id']      = session_id  # ← frontend stores this
    return response


# ─── System Health Monitor ────────────────────────────────────────────────────
@app.route('/api/system/health', methods=['GET'])
def system_health():
    try:
        import psutil

        cpu_percent  = psutil.cpu_percent(interval=0.3)
        cpu_per_core = psutil.cpu_percent(interval=0, percpu=True)
        cpu_freq     = psutil.cpu_freq()
        cpu_count    = psutil.cpu_count(logical=True)

        ram = psutil.virtual_memory()
        ram_used_gb  = round(ram.used  / (1024 ** 3), 2)
        ram_total_gb = round(ram.total / (1024 ** 3), 2)

        disk_path = "C:\\" if __import__('platform').system() == "Windows" else "/"
        disk = psutil.disk_usage(disk_path)
        disk_used_gb  = round(disk.used  / (1024 ** 3), 1)
        disk_total_gb = round(disk.total / (1024 ** 3), 1)

        net = psutil.net_io_counters()
        net_sent_mb = round(net.bytes_sent / (1024 ** 2), 1)
        net_recv_mb = round(net.bytes_recv / (1024 ** 2), 1)

        processes = []
        for proc in sorted(
            psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']),
            key=lambda p: p.info['cpu_percent'] or 0,
            reverse=True
        )[:5]:
            try:
                processes.append({
                    'pid':    proc.info['pid'],
                    'name':   proc.info['name'],
                    'cpu':    round(proc.info['cpu_percent'] or 0, 1),
                    'memory': round(proc.info['memory_percent'] or 0, 1),
                })
            except Exception:
                pass

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

        def status(pct):
            if pct < 60:  return 'good'
            if pct < 85:  return 'warning'
            return 'critical'

        return jsonify({
            'cpu':     {'percent': cpu_percent, 'per_core': cpu_per_core, 'count': cpu_count, 'freq_mhz': round(cpu_freq.current, 0) if cpu_freq else None, 'status': status(cpu_percent)},
            'ram':     {'percent': ram.percent,  'used_gb': ram_used_gb,  'total_gb': ram_total_gb,  'status': status(ram.percent)},
            'disk':    {'percent': disk.percent, 'used_gb': disk_used_gb, 'total_gb': disk_total_gb, 'status': status(disk.percent)},
            'network': {'sent_mb': net_sent_mb,  'recv_mb': net_recv_mb},
            'battery': battery_info,
            'processes': processes,
        })

    except ImportError:
        return jsonify({'error': 'psutil not installed', 'cpu': {'percent': 0, 'status': 'unknown'}, 'ram': {'percent': 0, 'status': 'unknown'}, 'disk': {'percent': 0, 'status': 'unknown'}}), 200
    except Exception as e:
        print(f"[System Health Error] {e}")
        return jsonify({'error': str(e)}), 500


# ─── TTS Voice Presets ─────────────────────────────────────────────────────────
@app.route('/api/tts/voices', methods=['GET'])
def tts_voices():
    voices = [
        {'id': 'male_default',  'name': 'Alex',   'gender': 'male',   'accent': 'American',   'lang': 'en-US'},
        {'id': 'male_uk',       'name': 'James',  'gender': 'male',   'accent': 'British',    'lang': 'en-GB'},
        {'id': 'male_au',       'name': 'Jack',   'gender': 'male',   'accent': 'Australian', 'lang': 'en-AU'},
        {'id': 'female_default','name': 'Aria',   'gender': 'female', 'accent': 'American',   'lang': 'en-US'},
        {'id': 'female_uk',     'name': 'Sophie', 'gender': 'female', 'accent': 'British',    'lang': 'en-GB'},
        {'id': 'female_in',     'name': 'Priya',  'gender': 'female', 'accent': 'Indian',     'lang': 'en-IN'},
        {'id': 'female_au',     'name': 'Emma',   'gender': 'female', 'accent': 'Australian', 'lang': 'en-AU'},
    ]
    return jsonify({'voices': voices})


# ─── Weekly Activity Summary (FIXED — real data) ───────────────────────────────
@app.route('/api/stats/weekly', methods=['GET'])
@require_auth
def weekly_stats():
    """Returns real weekly usage stats from Supabase."""
    from datetime import date, timedelta
    user_id = g.user_id

    today      = date.today()
    week_start = today - timedelta(days=today.weekday())   # Monday
    week_end   = week_start + timedelta(days=7)

    # ── Fetch all sessions for this user ──────────────────────────────────────
    sessions_res = supabase.table('chat_sessions') \
        .select('id, title, created_at') \
        .eq('user_id', user_id) \
        .execute()
    session_ids = [s['id'] for s in (sessions_res.data or [])]

    messages_sent  = 0
    code_generated = 0
    daily_activity = [0] * 7   # Mon(0) … Sun(6)

    if session_ids:
        msgs_res = supabase.table('messages') \
            .select('role, content, created_at') \
            .in_('session_id', session_ids) \
            .gte('created_at', week_start.isoformat()) \
            .lt('created_at',  week_end.isoformat()) \
            .execute()

        for msg in (msgs_res.data or []):
            if msg['role'] == 'user':
                messages_sent += 1
                d   = date.fromisoformat(msg['created_at'][:10])
                dow = d.weekday()        # Mon=0 … Sun=6
                daily_activity[dow] += 1
            elif msg['role'] == 'assistant' and '```' in (msg.get('content') or ''):
                code_generated += 1

    # ── Fetch stored weekly_stats row for focus minutes / files ───────────────
    stat_res = supabase.table('weekly_stats') \
        .select('*') \
        .eq('user_id',    user_id) \
        .eq('week_start', week_start.isoformat()) \
        .execute()
    stat_row = stat_res.data[0] if stat_res.data else {}

    total_focus_minutes = stat_row.get('total_focus_minutes', 0)
    files_managed       = stat_row.get('files_managed',       0)

    # ── Top topics from session titles this week ──────────────────────────────
    week_sessions = [
        s for s in (sessions_res.data or [])
        if s.get('created_at', '')[:10] >= week_start.isoformat()
    ]
    top_topics = list({
        s['title'] for s in week_sessions
        if s.get('title') and s['title'] != 'New Chat'
    })[:5]
    if not top_topics:
        top_topics = ['Chat', 'Code', 'Study']

    return jsonify({
        'messages_sent':       messages_sent,
        'code_generated':      code_generated,
        'files_managed':       files_managed,
        'total_focus_minutes': total_focus_minutes,
        'daily_activity':      daily_activity,
        'top_topics':          top_topics,
    })


# ─── Health Check ──────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Prime AI backend is running'})


# ─── Auth routes ───────────────────────────────────────────────────────────────
COOKIE_NAME     = "prime_token"
COOKIE_MAX_AGE  = 60 * 60 * int(os.getenv("JWT_EXPIRE_HOURS", 168))
IS_DEV          = os.getenv("FLASK_ENV") == "development"


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

    return jsonify({"message": "Registered successfully.", "user": result["user"], "token": result["token"]}), 201


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

    return jsonify({"message": "Logged in successfully.", "user": result["user"], "token": result["token"]}), 200


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    return jsonify({"message": "Logged out."}), 200


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def auth_me():
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