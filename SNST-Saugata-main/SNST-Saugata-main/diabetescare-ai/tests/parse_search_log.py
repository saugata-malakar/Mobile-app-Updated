import re

log_path = r"C:\Users\Administrator\.gemini\antigravity\brain\62d6aee7-3e9b-45f0-a503-30b5770bb068\.system_generated\tasks\task-560.log"
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# Find directories and files
dir_blocks = re.split(r"Directory:\s*", content)
found = []
for block in dir_blocks:
    lines = block.splitlines()
    if not lines:
        continue
    dir_path = lines[0].strip()
    for line in lines[1:]:
        if any(ext in line.lower() for ext in [".csv", ".xlsx", ".tsv", ".txt"]):
            parts = line.split()
            if len(parts) >= 4:
                filename = " ".join(parts[3:])
                found.append(f"{dir_path}\\{filename}")

print(f"Total matching files: {len(found)}")
print("All found files:")
for f in found:
    if "venv" not in f.lower() and "node_modules" not in f.lower():
        print(f)
