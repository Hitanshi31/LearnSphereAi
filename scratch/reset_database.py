import json
import shutil
from pathlib import Path

def reset_database():
    root = Path(__file__).resolve().parents[1]
    backend_data = root / "backend" / "data"
    root_data = root / "data"

    data_dirs = [backend_data, root_data]

    for data_dir in data_dirs:
        if not data_dir.exists():
            continue

        print(f"Clearing data in: {data_dir}")

        # 1. Reset documents.json
        docs_file = data_dir / "documents.json"
        docs_file.write_text(json.dumps({"documents": [], "files": {}}, indent=2), encoding="utf-8")
        print(f"  - Reset {docs_file}")

        # 2. Reset profiles.json
        profiles_file = data_dir / "profiles.json"
        profiles_file.write_text(json.dumps({}, indent=2), encoding="utf-8")
        print(f"  - Reset {profiles_file}")

        # 3. Clear uploads directory
        uploads_dir = data_dir / "uploads"
        if uploads_dir.exists():
            for item in uploads_dir.iterdir():
                if item.is_file():
                    try:
                        item.unlink()
                        print(f"  - Deleted upload file: {item.name}")
                    except Exception as e:
                        print(f"  - Could not delete {item.name}: {e}")
                elif item.is_dir():
                    shutil.rmtree(item, ignore_errors=True)
                    print(f"  - Deleted upload dir: {item.name}")

        # 4. Clear Chroma collection using client API
        chroma_dir = data_dir / "chroma"
        if chroma_dir.exists():
            try:
                import chromadb
                client = chromadb.PersistentClient(path=str(chroma_dir))
                try:
                    client.delete_collection("learnsphere_chunks")
                    print("  - Deleted Chroma collection 'learnsphere_chunks'")
                except Exception as e:
                    print(f"  - Chroma delete_collection notice: {e}")
            except Exception as e:
                print(f"  - Chroma client notice: {e}")

    print("\nDatabase and materials successfully reset!")

if __name__ == "__main__":
    reset_database()
