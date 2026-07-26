import json
import os
import sys
import urllib.request
from urllib.error import HTTPError

API_KEY = os.getenv("LEARN_SPHERE_GEMINI_API_KEY", "")
MODEL = os.getenv("LEARN_SPHERE_GEMINI_MODEL", "gemini-2.5-flash")

if not API_KEY:
    print("[SKIP] LEARN_SPHERE_GEMINI_API_KEY environment variable not set.")
    sys.exit(0)

endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
payload = json.dumps({
    "contents": [{"parts": [{"text": "Say hello in one word"}]}],
    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 50}
}).encode("utf-8")

req = urllib.request.Request(
    endpoint, data=payload,
    headers={"Content-Type": "application/json"}, method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    sys.stdout.buffer.write(b"[PASS] Gemini API key is VALID!\n")
    sys.stdout.buffer.write(f"   Response: {text}\n".encode())
except HTTPError as e:
    body = e.read().decode("utf-8")
    sys.stdout.buffer.write(f"[FAIL] HTTP {e.code}\n".encode())
    try:
        err = json.loads(body)
        sys.stdout.buffer.write(f"   {err.get('error',{}).get('message','unknown')}\n".encode())
    except Exception:
        sys.stdout.buffer.write(body[:300].encode())
except Exception as e:
    sys.stdout.buffer.write(f"[FAIL] {e}\n".encode())
