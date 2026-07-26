import requests
import json

BASE = "http://127.0.0.1:8001/api/v1"

def test_endpoints():
    print("Testing GET /documents...")
    try:
        r = requests.get(f"{BASE}/documents", timeout=5)
        print("Documents list status:", r.status_code)
        docs = r.json()
        print(f"Found {len(docs)} documents.")

        if docs:
            # Pick a ready document
            ready_docs = [d for d in docs if d["status"] == "ready"]
            doc = ready_docs[0] if ready_docs else docs[0]
            doc_id = doc["id"]
            print(f"\nTesting AI endpoints for active document '{doc_id}' ({doc['filename']}):")

            print("\n1. POST /documents/{doc_id}/notes...")
            rn = requests.post(f"{BASE}/documents/{doc_id}/notes", timeout=30)
            print("Notes status:", rn.status_code)
            if rn.status_code == 200:
                data = rn.json()
                print("Executive Summary:\n", data.get("summary"))
                print("\nKey concepts count:", len(data.get("key_concepts", [])))
                for kc in data.get("key_concepts", [])[:3]:
                    print(f"  • {kc['term']}: {kc['definition']}")

            print("\n2. POST /documents/{doc_id}/quiz...")
            rq = requests.post(f"{BASE}/documents/{doc_id}/quiz", timeout=30)
            print("Quiz status:", rq.status_code)
            if rq.status_code == 200:
                qdata = rq.json()
                questions = qdata.get("questions", [])
                print("Quiz questions count:", len(questions))
                for i, q in enumerate(questions[:2], 1):
                    print(f"  Q{i}: {q['question']}")
                    print(f"      Choices: {q['choices']}")
                    print(f"      Explanation: {q['explanation'][:100]}...")

            print("\n3. POST /documents/{doc_id}/visual...")
            rv = requests.post(f"{BASE}/documents/{doc_id}/visual", timeout=30)
            print("Visual status:", rv.status_code)
            if rv.status_code == 200:
                vdata = rv.json()
                print("Visual title:", vdata.get("title"))
                print("Mermaid diagram:")
                print(vdata.get("mermaid_code"))

    except Exception as err:
        print("API test error:", err)

if __name__ == "__main__":
    test_endpoints()
