# stop_and_process_logger.py
import subprocess
import os
import time
import requests

HEROKU_URL = "https://billy-ai-demo-1d85d1d40d53.herokuapp.com"

print("🛑 Stopping smart_logger.py...")

# Kill smart_logger.py by name (macOS only; safe for demo)
subprocess.run(["pkill", "-f", "smart_logger.py"])
time.sleep(1)  # Give it a moment to shut down

script_dir = os.path.dirname(os.path.abspath(__file__))
activity_path = os.path.join(script_dir, "activity_logs.json")

print("📤 Uploading logs to Heroku...")
try:
    with open(activity_path, "rb") as f1:
        files = {
            'logfile': f1,
        }
        res = requests.post(f"{HEROKU_URL}/upload-log", files=files)
        print("Heroku response:", res.text)
        if "✅" not in res.text:
            print("❌ Upload may have failed. Aborting.")
            exit(1)
except FileNotFoundError as e:
    print("❌ Error: Missing database file:", e)
    exit(1)

