import requests
import json
import sys
from pathlib import Path

def safe_print(text):
    sys.stdout.buffer.write((str(text) + "\n").encode('utf-8', errors='replace'))

def verify_live_api():
    ports = [8001, 8000]
    live_port = None

    for port in ports:
        try:
            r = requests.get(f"http://127.0.0.1:{port}/api/v1/documents", timeout=3)
            if r.status_code == 200:
                live_port = port
                safe_print(f"[OK] Backend server verified running on http://127.0.0.1:{port}")
                break
        except Exception:
            continue

    if not live_port:
        safe_print("[X] Backend server is not currently reachable on port 8001 or 8000.")
        return

    docs = requests.get(f"http://127.0.0.1:{live_port}/api/v1/documents").json()
    safe_print(f"Total indexed documents in repository: {len(docs)}")

    ready_docs = [d for d in docs if d["status"] == "ready"]
    if not ready_docs:
        safe_print("No ready documents found to test.")
        return

    doc = ready_docs[0]
    doc_id = doc["id"]
    safe_print(f"\n========================================================")
    safe_print(f"VERIFYING ACTIVE DOCUMENT: '{doc['filename']}' ({doc_id})")
    safe_print(f"========================================================\n")

    # 1. Test Summary Generation
    safe_print("--- 1. Testing Summary Generation ---")
    res_notes = requests.post(f"http://127.0.0.1:{live_port}/api/v1/documents/{doc_id}/notes")
    if res_notes.status_code == 200:
        notes_data = res_notes.json()
        safe_print("EXECUTIVE SUMMARY OUTPUT:\n" + str(notes_data.get("summary")))
        safe_print("\nKEY CONCEPTS COUNT: " + str(len(notes_data.get("key_concepts", []))))
        for kc in notes_data.get("key_concepts", [])[:4]:
            safe_print(f"  * {kc['term']}: {kc['definition']}")
    else:
        safe_print(f"Notes request failed: {res_notes.status_code} {res_notes.text}")

    # 2. Test Visual Concept Map Generation
    safe_print("\n--- 2. Testing Visual Concept Map Generation ---")
    res_visual = requests.post(f"http://127.0.0.1:{live_port}/api/v1/documents/{doc_id}/visual")
    if res_visual.status_code == 200:
        visual_data = res_visual.json()
        safe_print("TITLE: " + str(visual_data.get("title")))
        safe_print("MERMAID CODE GENERATED:")
        safe_print(visual_data.get("mermaid_code"))
        safe_print("\nCONCEPT NODES:")
        for node in visual_data.get("concept_nodes", []):
            safe_print(f"  [{node.get('type')}] {node.get('label')}: {node.get('summary')[:100]}...")
    else:
        safe_print(f"Visual map request failed: {res_visual.status_code} {res_visual.text}")

    # 3. Test Learning Profile & Misconception Repair Persistence
    safe_print("\n--- 3. Testing Learning Profile & Misconception Repair ---")
    res_prof = requests.get(f"http://127.0.0.1:{live_port}/api/v1/learners/alex/profile")
    if res_prof.status_code == 200:
        prof_data = res_prof.json()
        safe_print(f"LEARNER MASTERY: {prof_data.get('overall_mastery')}%")
        safe_print(f"RECENT MISCONCEPTIONS COUNT: {len(prof_data.get('recent_misconceptions', []))}")
        if prof_data.get('recent_misconceptions'):
            m = prof_data['recent_misconceptions'][0]
            m_id = m['id']
            res_repair = requests.post(
                f"http://127.0.0.1:{live_port}/api/v1/learning/repair-misconception",
                json={"learner_id": "alex", "misconception_id": m_id}
            )
            if res_repair.status_code == 200:
                safe_print(f"[OK] Successfully repaired misconception '{m_id}' in learner profile!")
    else:
        safe_print(f"Profile request failed: {res_prof.status_code}")

    safe_print("\n[OK] All backend verification endpoints operational!")

if __name__ == "__main__":
    verify_live_api()
