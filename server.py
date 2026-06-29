"""
Crown of Ashes — Backend Server
Run: python server.py
Requires: pip install flask flask-cors
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3, os, datetime

app = Flask(__name__)
CORS(app)   # allow the frontend (any origin) to call this API

DB_PATH = os.path.join(os.path.dirname(__file__), "scores.db")

# ── Database setup ─────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                name      TEXT    NOT NULL,
                score     INTEGER NOT NULL DEFAULT 0,
                wave      INTEGER NOT NULL DEFAULT 1,
                weapon    TEXT    NOT NULL DEFAULT 'longbow',
                mode      TEXT    NOT NULL DEFAULT 'classic',
                kills     INTEGER NOT NULL DEFAULT 0,
                played_at TEXT    NOT NULL
            )
        """)
        conn.commit()

# ── Routes ─────────────────────────────────────────────────────
@app.route("/api/score", methods=["POST"])
def post_score():
    """Save a new score entry."""
    data = request.get_json(force=True)

    name   = str(data.get("name",   "Anonymous"))[:30]
    score  = int(data.get("score",  0))
    wave   = int(data.get("wave",   1))
    weapon = str(data.get("weapon", "longbow"))[:20]
    mode   = str(data.get("mode",   "classic"))[:10]
    kills  = int(data.get("kills",  0))
    now    = datetime.datetime.utcnow().isoformat()

    with get_db() as conn:
        conn.execute(
            "INSERT INTO scores (name,score,wave,weapon,mode,kills,played_at) VALUES (?,?,?,?,?,?,?)",
            (name, score, wave, weapon, mode, kills, now)
        )
        conn.commit()

    return jsonify({"ok": True}), 201


@app.route("/api/scores", methods=["GET"])
def get_scores():
    """Return top scores, optionally filtered by mode."""
    mode  = request.args.get("mode", "endless")
    limit = min(int(request.args.get("limit", 20)), 100)

    with get_db() as conn:
        rows = conn.execute(
            "SELECT name,score,wave,weapon,mode,kills,played_at FROM scores "
            "WHERE mode=? ORDER BY score DESC LIMIT ?",
            (mode, limit)
        ).fetchall()

    scores = [dict(r) for r in rows]
    return jsonify({"scores": scores})


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Quick stats for the hall of knights."""
    with get_db() as conn:
        total   = conn.execute("SELECT COUNT(*) FROM scores").fetchone()[0]
        top     = conn.execute("SELECT name,score FROM scores ORDER BY score DESC LIMIT 1").fetchone()
        avg_sc  = conn.execute("SELECT AVG(score) FROM scores").fetchone()[0] or 0
    return jsonify({
        "total_games": total,
        "top_player":  dict(top) if top else None,
        "average_score": round(avg_sc, 1)
    })


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "Crown of Ashes backend running!"})


# ── Start ──────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    print("=" * 50)
    print("  Crown of Ashes — Backend Server")
    print("  Running at http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=False)
