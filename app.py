"""
Prime AI - Flask API Server
Connects the JS frontend → Engine → IntentDetector → CommandRouter → Executors
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# ─── Path Setup ────────────────────────────────────────────────────────────────
# Allows imports from core/ regardless of where you run the server from
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'core'))

from core.engine import Engine

# ─── App Setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allows requests from your frontend (localhost HTML file)

engine = Engine()


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Main chat endpoint.
    Receives: { "message": "open chrome" }
    Returns:  { "response": "Launching chrome" }

    Connected to sendMessage() in your JS file.
    """
    data = request.get_json()

    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400

    user_message = data['message'].strip()

    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    try:
        result = engine.run(user_message)
        return jsonify({'response': result})

    except Exception as e:
        print(f"[Engine Error] {e}")
        return jsonify({'response': f'Something went wrong: {str(e)}'}), 500


@app.route('/api/health', methods=['GET'])
def health():
    """
    Health check endpoint.
    Useful for confirming the server is running before the frontend connects.
    """
    return jsonify({'status': 'ok', 'message': 'Prime AI backend is running'})


# ─── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 50)
    print("  Prime AI Backend starting...")
    print("  Listening on http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)