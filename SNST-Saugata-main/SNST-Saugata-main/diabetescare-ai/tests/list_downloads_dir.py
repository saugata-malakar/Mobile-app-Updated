import os

path = r"C:\Users\Administrator\Downloads"
if os.path.exists(path):
    print("Contents of", path)
    print(os.listdir(path))
else:
    print(path, "does not exist!")
