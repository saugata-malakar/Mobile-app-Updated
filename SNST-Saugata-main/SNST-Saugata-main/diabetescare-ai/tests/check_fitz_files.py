import os

path = r"C:\Users\Administrator\Downloads\data\finalfitz17k"
if os.path.exists(path):
    files = os.listdir(path)
    print(f"Total files: {len(files)}")
    exts = {}
    samples = []
    for f in files:
        _, ext = os.path.splitext(f)
        ext = ext.lower()
        exts[ext] = exts.get(ext, 0) + 1
        if len(samples) < 10:
            samples.append(f)
    print("Extensions:", exts)
    print("Sample filenames:")
    for s in samples:
        print(s)
else:
    print("Directory does not exist!")
