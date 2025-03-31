import time
import datetime
import os
import json
import subprocess

from Quartz import (
    CGWindowListCopyWindowInfo,
    kCGWindowListOptionOnScreenOnly,
    kCGNullWindowID
)
from AppKit import NSWorkspace


def get_application_window_title():
    try:
        script = '''
        tell application "System Events"
            set frontApp to name of first application process whose frontmost is true
        end tell

        if frontApp is "Google Chrome" then
            tell application "Google Chrome"
                set windowTitle to title of active tab of front window
            end tell
        else if frontApp is "Safari" then
            tell application "Safari"
                set windowTitle to name of front document
            end tell
        else if frontApp is "Microsoft Word" then
            tell application "Microsoft Word"
                if not (exists active document) then
                    set windowTitle to "(No document open)"
                else
                    set windowTitle to name of active document
                end if
            end tell
        else if frontApp is "Preview" then
            tell application "Preview"
                if not (exists front document) then
                    set windowTitle to "(No document open)"
                else
                    set windowTitle to name of front document
                end if
            end tell
        else
            set windowTitle to ""
        end if

        return frontApp & "|" & windowTitle
        '''
        result = subprocess.check_output(["osascript", "-e", script])
        result = result.decode("utf-8").strip()
        app, title = result.split("|", 1)
        return app, title if title else "(No window title)"
    except Exception as e:
        print(f"[AppleScript Error] {e}")
        return "(Unknown)", "(No window title)"


def get_frontmost_app_and_title():
    owner, title = get_application_window_title()
    return owner, title


def load_json_logs():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "activity_logs.json")
    
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("Error reading JSON file. Creating new log.")
    
    # Return empty log structure if file doesn't exist or has errors
    return {"logs": []}


def save_json_logs(logs):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "activity_logs.json")
    
    with open(json_path, 'w') as f:
        json.dump(logs, f, indent=2)


def log_active_windows(interval=5):
    # Load existing JSON logs or create new structure
    logs_data = load_json_logs()

    last_owner = None
    last_title = None
    start_time = time.time()

    print("Logging active windows... Press Ctrl+C to stop.\n")

    try:
        while True:
            owner, title = get_frontmost_app_and_title()
            if (owner, title) != (last_owner, last_title):
                end_time = time.time()
                if last_owner:
                    time_spent = round(end_time - start_time, 2)
                    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                    # Add to JSON logs
                    log_entry = {
                        "timestamp": timestamp,
                        "app": last_owner,
                        "window_title": last_title,
                        "duration_seconds": time_spent
                    }
                    logs_data["logs"].append(log_entry)
                    
                    # Save JSON file after each entry
                    save_json_logs(logs_data)

                    print(f"{timestamp} | App: {last_owner} | Window: {last_title} | Time: {time_spent} sec")

                last_owner = owner
                last_title = title
                start_time = time.time()

            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nStopped logging.")


if __name__ == "__main__":
    log_active_windows()
