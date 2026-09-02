import os
import urllib.request

url = "https://raw.githubusercontent.com/mattgroh/fitzpatrick17k/main/fitzpatrick17k.csv"
dest_dir = r"C:\Users\Administrator\Downloads\data"
dest_path = os.path.join(dest_dir, "fitzpatrick17k.csv")

if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

print(f"Downloading from {url}...")
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as response:
        content = response.read()
    
    print(f"Writing {len(content)} bytes to {dest_path}...")
    with open(dest_path, "wb") as f:
        f.write(content)
        
    print("Download completed successfully!")
    
    # Read first 5 lines
    with open(dest_path, "r", encoding="utf-8") as f:
        lines = [f.readline().strip() for _ in range(5)]
    print("First 5 lines:")
    for line in lines:
        print(line)
except Exception as e:
    print("Download failed:", e)
