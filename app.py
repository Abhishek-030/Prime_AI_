"""
Prime AI - Flask API Server
Connects the JS frontend → Engine → IntentDetector → CommandRouter → Executors
"""

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import os

from core.engine import Engine

# ─── App Setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allows requests from your frontend (localhost HTML file)

engine = Engine()


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Main chat endpoint — now fully streaming via SSE.
    Receives: { "message": "open chrome" / "hello" / ... }
    Returns:  text/event-stream  (data: <token>\\n\\n ... data: [DONE]\\n\\n)
    """
    data = request.get_json()

    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400

    user_message = data['message'].strip()

    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    def generate_sse():
        try:
            for chunk in engine.stream_run(user_message):
                escaped = chunk.replace('\n', '\\n')
                yield f"data: {escaped}\n\n"
        except Exception as e:
            print(f"[Chat SSE Error] {e}")
            yield f"data: Sorry, something went wrong: {e}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    response = Response(
        stream_with_context(generate_sse()),
        mimetype='text/event-stream'
    )
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response


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


# ─── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 50)
    print("  Prime AI Backend starting...")
    print("  Listening on http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)
