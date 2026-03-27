#!/usr/bin/env python3
"""Local Business Model Canvas editor — zero-dependency Python server."""

import http.server
import json
import os
import re
import stat
import sys
import urllib.request
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

RECENT_FILE = Path.home() / ".bmc-edit-recent.json"
KEY_FILE = Path.home() / ".bmc-edit-key"
PORT = 8470
HOST = "127.0.0.1"
ALLOWED_ORIGIN = f"http://{HOST}:{PORT}"
MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB

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


# ── API key storage (server-side, file with 0600 permissions) ──

def load_api_key() -> str:
    if KEY_FILE.exists():
        try:
            return KEY_FILE.read_text().strip()
        except Exception:
            return ""
    return ""


def save_api_key(key: str):
    KEY_FILE.write_text(key)
    KEY_FILE.chmod(stat.S_IRUSR | stat.S_IWUSR)  # 0600


def delete_api_key():
    if KEY_FILE.exists():
        KEY_FILE.unlink()


# ── File path validation ──

def _validate_json_path(filepath: str) -> str | None:
    """Validate that a path is safe for read/write. Returns resolved path or None."""
    if not filepath:
        return None
    try:
        p = Path(filepath).resolve()
    except (ValueError, OSError):
        return None
    # Must end in .json
    if p.suffix.lower() != ".json":
        return None
    return str(p)


# ── Recent files ──

def load_recent() -> list[dict]:
    if RECENT_FILE.exists():
        try:
            data = json.loads(RECENT_FILE.read_text())
            return [r for r in data if Path(r["path"]).exists()][:12]
        except Exception:
            return []
    return []


def save_recent(entries: list[dict]):
    RECENT_FILE.write_text(json.dumps(entries[:12], indent=2))


def add_recent(filepath: str):
    entries = load_recent()
    entries = [e for e in entries if e["path"] != filepath]
    entries.insert(0, {"path": filepath, "name": Path(filepath).stem})
    save_recent(entries)


# ── File dialogs (macOS osascript) ──

def _pick_file_open() -> str | None:
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


# ── AI ──

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


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _build_context(data: dict, cell_key: str | None) -> str:
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
                clean = _strip_html(it)
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
                for it in items:
                    clean = _strip_html(it)
                    if clean:
                        lines.append(f"- {clean}")
            else:
                lines.append("(empty)")
            lines.append("")
    return "\n".join(lines)


ACTION_INSTRUCTIONS = {
    "challenge": (
        "Your task is to CHALLENGE the founder's assumptions. Ask tough questions, "
        "point out risks, identify weak spots, and highlight contradictions. "
        "Do NOT suggest new ideas or alternatives — only question what is there. "
        "Be concise (max 6 points). If a section is empty, challenge why."
    ),
    "ideate": (
        "Your task is to IDEATE — suggest concrete, actionable ideas. Be specific, "
        "not generic. Tailor suggestions to what's already in the canvas. "
        "Use bullet points with short explanations. Suggest 4–6 ideas. "
        "If the section is empty, suggest starter ideas based on the rest of the canvas."
    ),
    "educate": (
        "Your task is to EDUCATE — explain this section of the Business Model Canvas "
        "to someone who may not be familiar with it. Use plain language with real-world "
        "examples. Avoid jargon. Be encouraging. Keep explanations concise but insightful."
    ),
}

DEFAULT_SYSTEM = (
    "You are an experienced business strategist acting as a Business Model Canvas coach "
    "for early-stage founders."
)


def handle_ai(body: dict) -> dict:
    api_key = load_api_key()
    action = body.get("action", "")
    cell_key = body.get("cell_key")
    canvas_data = body.get("data", {})
    persona_prompt = body.get("persona_prompt", "")

    if not api_key:
        return {"error": "API key not configured"}
    if action not in ("challenge", "ideate", "educate", "ideate_name"):
        return {"error": "Unknown action"}

    context = _build_context(canvas_data, cell_key)
    target = BLOCK_LABELS.get(cell_key, "the entire canvas") if cell_key else "the entire canvas"

    if action == "ideate_name":
        company = canvas_data.get("company_name", "")
        base = persona_prompt or DEFAULT_SYSTEM
        system = (
            f"{base}\n\n"
            "Your task is to suggest 5–8 company/product name ideas. "
            "For each, give the name and a one-line rationale. "
            "Be creative and varied. Use bullet points."
        )
        if company:
            user = f"The current working name is \"{company}\". Suggest alternatives or variations based on this canvas:\n\n{context}"
        else:
            user = f"Suggest company/product name ideas based on this canvas:\n\n{context}"
    else:
        base = persona_prompt or DEFAULT_SYSTEM
        instruction = ACTION_INSTRUCTIONS[action]
        system = f"{base}\n\n{instruction}"
        action_verbs = {"challenge": "Challenge", "ideate": "Generate ideas for", "educate": "Explain"}
        user = f"{action_verbs[action]} {target}:\n\n{context}"

    try:
        result = _call_claude(api_key, system, user)
        return {"result": result, "action": action, "cell_key": cell_key}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        try:
            err_data = json.loads(err_body)
            msg = err_data.get("error", {}).get("message", "API request failed")
        except Exception:
            msg = "API request failed"
        return {"error": msg}
    except Exception:
        return {"error": "AI request failed"}


_PERSONA_GENERATION_PROMPT = r"""You are a product design assistant specializing in AI coach personas.

Your task is to generate a complete BMC Coach Persona for {name}, designed for early-stage founders.

You MUST output ONLY a valid JSON object (no markdown fences, no commentary) with these exact fields:

{{
  "id": "lowercase_surname",
  "name": "Full Name",
  "title": "The [Archetype]",
  "tone": "2-4 word tone description",
  "emoji": "single emoji capturing their energy",
  "tagline": "One punchy sentence — their essence without being reverent",
  "thinkingVerbs": ["6 loading-state verbs ending in '...', reflecting HOW this person thinks"],
  "achievements": ["5 bullet points — real, readable, slightly irreverent, not a dry LinkedIn bio"],
  "vibe": "2-3 sentences in second person telling the user what it feels like to be coached by this person. Be honest about their edges.",
  "systemPrompt": "The full system prompt (see structure below)"
}}

## SYSTEM PROMPT STRUCTURE

The systemPrompt field must contain all of these sections as a single string with \n separators:

**Character & Voice** — Who this person is, what shaped them, how they speak. 3-5 sentences. Include one distinctive speech pattern or verbal habit.

**Coaching Philosophy** — Their core belief about what makes a Business Model Canvas succeed or fail. What they optimize for. What they're allergic to.

**How You Coach Each Block** — For each of these 9 BMC blocks, write one specific coaching prompt in their voice:
- Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams

**Tone Rules** — 8-10 specific behavioral rules. Include what they say vs never say, how they handle vagueness, how they respond to struggle, one unusual quirk.

**What You Never Do** — 4 hard constraints this persona explicitly avoids.

**Signature Phrases** — 4 phrases grounded in their real documented speech patterns, adapted for coaching.

The systemPrompt must start with "You are [Name]..." and be usable as-is in a production app.

## QUALITY CONSTRAINTS

- The thinking verbs must be completely distinct from these already-used sets:
  Chouinard: Questioning, Reflecting, Sitting with this, Tracing back, Unearthing, Weighing
  Burns: Listening, Seeing you, Getting real, Checking in, Pushing through, Connecting
  Hastings: Stress-testing, Falsifying, Modelling, Isolating, Pressure-checking, Deriving
  Nooyi: Mapping dependencies, Probing, Interrogating, Tracing logic, Constructing, Stress-testing
- Every coaching prompt must sound unmistakably like {name} — not generic.
- The profile (tagline, achievements, vibe) should be punchy and human, not an executive bio.
- Do not use: synergy, pivot, disrupt, leverage, empower, unlock (unless in their actual documented speech).

Output ONLY the JSON object. No markdown fences. No explanation."""


def handle_generate_persona(body: dict) -> dict:
    api_key = load_api_key()
    name = body.get("name", "").strip()

    if not api_key:
        return {"error": "API key not configured"}
    if not name:
        return {"error": "Name is required"}

    system = _PERSONA_GENERATION_PROMPT.format(name=name)
    user = f"Create a Business Model Canvas coaching persona for: {name}"

    try:
        result = _call_claude(api_key, system, user)
        # Parse the JSON from the response
        text = result.strip()
        # Handle possible markdown code fences
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```\s*$", "", text)
        persona = json.loads(text)
        return {"persona": persona}
    except json.JSONDecodeError:
        return {"error": "Failed to parse persona — try again"}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        try:
            err_data = json.loads(err_body)
            msg = err_data.get("error", {}).get("message", "API request failed")
        except Exception:
            msg = "API request failed"
        return {"error": msg}
    except Exception:
        return {"error": "Persona generation failed"}


# ── HTTP Handler ──

# Read index.html into memory at startup so we don't serve arbitrary files
_INDEX_HTML = (Path(__file__).parent / "index.html").read_bytes()


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # quiet

    def _check_origin(self) -> bool:
        """Reject requests from other origins (CSRF/local exfiltration protection)."""
        origin = self.headers.get("Origin")
        # Browser requests to same-origin APIs include Origin on POST but not always on GET.
        # If Origin is present, it must match. If absent, allow (same-origin GET or non-browser).
        if origin and origin != ALLOWED_ORIGIN:
            self._json_response({"error": "Forbidden"}, 403)
            return False
        return True

    def _json_response(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict | None:
        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BODY_SIZE:
            self._json_response({"error": "Request too large"}, 413)
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._json_response({"error": "Invalid JSON"}, 400)
            return None

    def do_GET(self):
        if not self._check_origin():
            return

        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(_INDEX_HTML)))
            self.end_headers()
            self.wfile.write(_INDEX_HTML)

        elif parsed.path == "/api/recent":
            self._json_response(load_recent())

        elif parsed.path == "/api/has-key":
            self._json_response({"has_key": bool(load_api_key())})

        else:
            self._json_response({"error": "Not found"}, 404)

    def do_POST(self):
        if not self._check_origin():
            return

        parsed = urlparse(self.path)

        if parsed.path == "/api/open":
            filepath = _pick_file_open()
            if filepath:
                validated = _validate_json_path(filepath)
                if not validated:
                    self._json_response({"error": "Invalid file type"}, 400)
                    return
                try:
                    data = json.loads(Path(validated).read_text())
                    add_recent(validated)
                    self._json_response({"path": validated, "data": data})
                except (json.JSONDecodeError, UnicodeDecodeError):
                    self._json_response({"error": "Invalid JSON file"}, 400)
                except Exception:
                    self._json_response({"error": "Could not read file"}, 400)
            else:
                self._json_response({"cancelled": True})

        elif parsed.path == "/api/open-path":
            body = self._read_body()
            if body is None:
                return
            filepath = _validate_json_path(body.get("path", ""))
            if not filepath or not Path(filepath).exists():
                self._json_response({"error": "File not found"}, 404)
                return
            try:
                data = json.loads(Path(filepath).read_text())
                add_recent(filepath)
                self._json_response({"path": filepath, "data": data})
            except (json.JSONDecodeError, UnicodeDecodeError):
                self._json_response({"error": "Invalid JSON file"}, 400)
            except Exception:
                self._json_response({"error": "Could not read file"}, 400)

        elif parsed.path == "/api/save":
            body = self._read_body()
            if body is None:
                return
            filepath = _validate_json_path(body.get("path", ""))
            data = body.get("data")
            if not filepath:
                self._json_response({"error": "Invalid file path"}, 400)
                return
            if data is None:
                self._json_response({"error": "Missing data"}, 400)
                return
            try:
                Path(filepath).write_text(json.dumps(data, indent=2, ensure_ascii=False))
                add_recent(filepath)
                self._json_response({"ok": True, "path": filepath})
            except Exception:
                self._json_response({"error": "Could not write file"}, 400)

        elif parsed.path == "/api/save-as":
            # Read body first, before blocking on dialog
            body = self._read_body()
            if body is None:
                return
            filepath = _pick_file_save()
            if filepath:
                validated = _validate_json_path(filepath)
                if not validated:
                    self._json_response({"error": "Invalid file type"}, 400)
                    return
                data = body.get("data")
                if data is None:
                    self._json_response({"error": "Missing data"}, 400)
                    return
                try:
                    Path(validated).write_text(
                        json.dumps(data, indent=2, ensure_ascii=False)
                    )
                    add_recent(validated)
                    self._json_response({"ok": True, "path": validated})
                except Exception:
                    self._json_response({"error": "Could not write file"}, 400)
            else:
                self._json_response({"cancelled": True})

        elif parsed.path == "/api/new":
            self._json_response({"data": EMPTY_CANVAS})

        elif parsed.path == "/api/set-key":
            body = self._read_body()
            if body is None:
                return
            key = body.get("key", "").strip()
            if not key:
                self._json_response({"error": "Empty key"}, 400)
                return
            save_api_key(key)
            self._json_response({"ok": True})

        elif parsed.path == "/api/clear-key":
            delete_api_key()
            self._json_response({"ok": True})

        elif parsed.path == "/api/ai":
            body = self._read_body()
            if body is None:
                return
            result = handle_ai(body)
            status = 400 if "error" in result else 200
            self._json_response(result, status)

        elif parsed.path == "/api/generate-persona":
            body = self._read_body()
            if body is None:
                return
            result = handle_generate_persona(body)
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
