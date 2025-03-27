# run_local_smart_logger.py
import subprocess
import os

print("🚀 Starting smart_logger.py...")

script_dir = os.path.dirname(os.path.abspath(__file__))
smart_logger_path = os.path.join(script_dir, "smart_logger.py")

# Start the logger process
subprocess.Popen(["python3", smart_logger_path])
print("✅ Logger started in background.")
