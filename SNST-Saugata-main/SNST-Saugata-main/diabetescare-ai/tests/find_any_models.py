import os

search_dir = r"C:\Users\Administrator\Downloads"
targets = ["dataset.py", "model.py", "train.py", "test_fitzpatrick_pipeline.py"]
found = []

for root, dirs, files in os.walk(search_dir):
    # Modify dirs in-place to avoid traversing venv/node_modules
    dirs[:] = [d for d in dirs if d not in ["venv", ".venv", "node_modules", ".git", "__pycache__", ".pytest_cache"]]
    for f in files:
        if f in targets:
            found.append(os.path.join(root, f))

print(f"Found {len(found)} target files:")
for path in found:
    print(path)
