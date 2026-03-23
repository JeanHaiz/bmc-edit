#!/usr/bin/env python3
"""Local Business Model Canvas editor — zero-dependency Python server."""

import http.server
import json
import os
import sys
import urllib.request
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

RECENT_FILE = Path.home() / ".bmc-edit-recent.json"
PORT = 8470
HOST = "127.0.0.1"

EMPTY_CANVAS = {
    "title": "Untitled Canvas",
    "company_name": "",
    "blocks": {
        "key_partners": [],
        "key_activities": [],
        "key_resources": [],
        "value_propositions": [],
        "customer_relationships": [],
        "channels": [],
        "customer_segments": [],
        "cost_structure": [],
        "revenue_streams": [],
    },
}


def load_recent() -> list[dict]:
    if RECENT_FILE.exists():
        try:
            data = json.loads(RECENT_FILE.read_text())
            # Filter out files that no longer exist
            return [r for r in data if Path(r["path"]).exists()][:12]
        except Exception:
            return []
    return []


def save_recent(entries: list[dict]):
    RECENT_FILE.write_text(json.dumps(entries[:12], indent=2))


def add_recent(filepath: str):
    entries = load_recent()
    # Remove if already present
    entries = [e for e in entries if e["path"] != filepath]
    entries.insert(0, {"path": filepath, "name": Path(filepath).stem})
    save_recent(entries)


def _pick_file_open() -> str | None:
    """Use macOS native file dialog via osascript."""
    import subprocess

    try:
        result = subprocess.run(
            [
                "osascript",
                "-e",
                'set theFile to choose file of type {"json", "public.json"} '
                'with prompt "Open Business Model Canvas"',
                "-e",
                "return POSIX path of theFile",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        path = result.stdout.strip()
        return path if path else None
    except Exception:
        return None


def _pick_file_save() -> str | None:
    """Use macOS native save dialog via osascript."""
    import subprocess

    try:
        result = subprocess.run(
            [
                "osascript",
                "-e",
                'set theFile to choose file name default name "canvas.json" '
                'with prompt "Save Business Model Canvas"',
                "-e",
                "return POSIX path of theFile",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        path = result.stdout.strip()
        if path and not path.endswith(".json"):
            path += ".json"
        return path if path else None
    except Exception:
        return None


BLOCK_LABELS = {
    "key_partners": "Key Partners",
    "key_activities": "Key Activities",
    "key_resources": "Key Resources",
    "value_propositions": "Value Propositions",
    "customer_relationships": "Customer Relationships",
    "channels": "Channels",
    "customer_segments": "Customer Segments",
    "cost_structure": "Cost Structure",
    "revenue_streams": "Revenue Streams",
}

BLOCK_DESCRIPTIONS = {
    "key_partners": "Who are the key partners and suppliers needed to make the business model work?",
    "key_activities": "What key activities does the value proposition require?",
    "key_resources": "What key resources does the value proposition require?",
    "value_propositions": "What value does the company deliver to the customer? Which customer needs are being satisfied?",
    "customer_relationships": "What type of relationship does each customer segment expect?",
    "channels": "Through which channels do customer segments want to be reached?",
    "customer_segments": "For whom is the company creating value? Who are the most important customers?",
    "cost_structure": "What are the most important costs inherent in the business model?",
    "revenue_streams": "For what value are customers really willing to pay?",
}


def _call_claude(api_key: str, system_prompt: str, user_prompt: str) -> str:
    """Call Claude API using only stdlib."""
    url = "https://api.anthropic.com/v1/messages"
    payload = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
    return result["content"][0]["text"]


def _build_context(data: dict, cell_key: str | None) -> str:
    """Build a text representation of the canvas or a specific cell."""
    company = data.get("company_name", "")
    title = data.get("title", "Untitled")
    lines = []
    if company:
        lines.append(f"Company: {company}")
    lines.append(f"Canvas: {title}\n")

    if cell_key and cell_key in data.get("blocks", {}):
        label = BLOCK_LABELS.get(cell_key, cell_key)
        desc = BLOCK_DESCRIPTIONS.get(cell_key, "")
        items = data["blocks"][cell_key]
        lines.append(f"## {label}")
        if desc:
            lines.append(f"({desc})")
        if items:
            for it in items:
                # Strip HTML tags for the AI
                import re
                clean = re.sub(r"<[^>]+>", "", it).strip()
                if clean:
                    lines.append(f"- {clean}")
        else:
            lines.append("(empty — no items yet)")
    else:
        for key, label in BLOCK_LABELS.items():
            items = data.get("blocks", {}).get(key, [])
            desc = BLOCK_DESCRIPTIONS.get(key, "")
            lines.append(f"## {label}")
            if desc:
                lines.append(f"({desc})")
            if items:
                import re
                for it in items:
                    clean = re.sub(r"<[^>]+>", "", it).strip()
                    if clean:
                        lines.append(f"- {clean}")
            else:
                lines.append("(empty)")
            lines.append("")
    return "\n".join(lines)


def handle_ai(body: dict) -> dict:
    api_key = body.get("api_key", "")
    action = body.get("action", "")
    cell_key = body.get("cell_key")  # None = whole doc
    canvas_data = body.get("data", {})

    if not api_key:
        return {"error": "API key required"}
    if action not in ("challenge", "ideate", "educate", "ideate_name"):
        return {"error": f"Unknown action: {action}"}

    context = _build_context(canvas_data, cell_key)
    target = BLOCK_LABELS.get(cell_key, "the entire canvas") if cell_key else "the entire canvas"

    if action == "challenge":
        system = (
            "You are a sharp, experienced business strategist reviewing a Business Model Canvas. "
            "Your role is to CHALLENGE assumptions — ask tough questions, point out risks, "
            "identify weak spots, and highlight contradictions. "
            "Do NOT suggest new ideas or alternatives. Only question what is there. "
            "Be direct but constructive. Use bullet points. Keep it concise (max 6 points). "
            "If a section is empty, challenge why it hasn't been filled in yet."
        )
        user = f"Challenge {target}:\n\n{context}"

    elif action == "ideate":
        system = (
            "You are a creative business strategist helping brainstorm for a Business Model Canvas. "
            "Suggest concrete, actionable ideas. Be specific — not generic advice. "
            "Tailor suggestions to what's already in the canvas. "
            "Use bullet points with short explanations. Suggest 4–6 ideas. "
            "If the section is empty, suggest starter ideas based on the rest of the canvas."
        )
        user = f"Generate ideas for {target}:\n\n{context}"

    elif action == "educate":
        system = (
            "You are a friendly business coach explaining the Business Model Canvas to someone "
            "who may not be familiar with it. Explain concepts in plain language with real-world "
            "examples. Avoid jargon. Be encouraging. Keep explanations concise but insightful. "
            "If reviewing a specific section, explain what goes there and why it matters. "
            "If reviewing the whole canvas, give an overview of how the sections connect."
        )
        user = f"Explain {target} to help someone understand what to fill in:\n\n{context}"

    elif action == "ideate_name":
        company = canvas_data.get("company_name", "")
        system = (
            "You are a creative branding expert. Suggest 5–8 company/product name ideas. "
            "For each, give: the name, a one-line rationale. "
            "Be creative and varied — mix styles (descriptive, abstract, compound words, etc). "
            "Use bullet points."
        )
        if company:
            user = f"The current working name is \"{company}\". Suggest alternatives or variations based on this canvas:\n\n{context}"
        else:
            user = f"Suggest company/product name ideas based on this canvas:\n\n{context}"

    try:
        result = _call_claude(api_key, system, user)
        return {"result": result, "action": action, "cell_key": cell_key}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        try:
            err_data = json.loads(err_body)
            msg = err_data.get("error", {}).get("message", str(e))
        except Exception:
            msg = str(e)
        return {"error": msg}
    except Exception as e:
        return {"error": str(e)}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def log_message(self, fmt, *args):
        # Quiet logging
        pass

    def _json_response(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        return json.loads(raw) if raw else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/recent":
            self._json_response(load_recent())
        elif parsed.path == "/":
            self.path = "/index.html"
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/open":
            filepath = _pick_file_open()
            if filepath:
                try:
                    data = json.loads(Path(filepath).read_text())
                    add_recent(filepath)
                    self._json_response({"path": filepath, "data": data})
                except Exception as e:
                    self._json_response({"error": str(e)}, 400)
            else:
                self._json_response({"cancelled": True})

        elif parsed.path == "/api/open-path":
            body = self._read_body()
            filepath = body.get("path", "")
            if filepath and Path(filepath).exists():
                try:
                    data = json.loads(Path(filepath).read_text())
                    add_recent(filepath)
                    self._json_response({"path": filepath, "data": data})
                except Exception as e:
                    self._json_response({"error": str(e)}, 400)
            else:
                self._json_response({"error": "File not found"}, 404)

        elif parsed.path == "/api/save":
            body = self._read_body()
            filepath = body.get("path")
            data = body.get("data")
            if filepath and data is not None:
                try:
                    Path(filepath).write_text(json.dumps(data, indent=2, ensure_ascii=False))
                    add_recent(filepath)
                    self._json_response({"ok": True, "path": filepath})
                except Exception as e:
                    self._json_response({"error": str(e)}, 400)
            else:
                self._json_response({"error": "Missing path or data"}, 400)

        elif parsed.path == "/api/save-as":
            filepath = _pick_file_save()
            if filepath:
                body = self._read_body()
                data = body.get("data")
                if data is not None:
                    try:
                        Path(filepath).write_text(
                            json.dumps(data, indent=2, ensure_ascii=False)
                        )
                        add_recent(filepath)
                        self._json_response({"ok": True, "path": filepath})
                    except Exception as e:
                        self._json_response({"error": str(e)}, 400)
                else:
                    self._json_response({"error": "No data"}, 400)
            else:
                self._json_response({"cancelled": True})

        elif parsed.path == "/api/new":
            self._json_response({"data": EMPTY_CANVAS})

        elif parsed.path == "/api/ai":
            body = self._read_body()
            result = handle_ai(body)
            status = 400 if "error" in result else 200
            self._json_response(result, status)

        else:
            self._json_response({"error": "Not found"}, 404)


def main():
    server = http.server.HTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}"
    print(f"\n  BMC Edit → {url}\n")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.\n")
        server.shutdown()


if __name__ == "__main__":
    main()
