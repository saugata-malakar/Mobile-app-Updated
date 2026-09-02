import os
import urllib.request

url = "https://download.pytorch.org/models/efficientnet_b3_rwightman-cf984f9c.pth"
dest_dir = r"C:\Users\Administrator\.cache\torch\hub\checkpoints"
dest_path = os.path.join(dest_dir, "efficientnet_b3_rwightman-cf984f9c.pth")

if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

print(f"Downloading from {url}...")
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as response:
    data = response.read()

print(f"Writing {len(data)} bytes to {dest_path}...")
with open(dest_path, "wb") as f:
    f.write(data)

print("Done!")
