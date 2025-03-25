import time
import datetime
import csv
import os
import sqlite3
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


def setup_database():
    conn = sqlite3.connect('activity_log.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            app TEXT,
            window TEXT,
            duration_seconds REAL
        )
    ''')
    conn.commit()
    return conn


def log_active_windows(interval=5):
    log_file = "activity_log.csv"
    file_exists = os.path.isfile(log_file)
    db_conn = setup_database()
    db_cursor = db_conn.cursor()

    with open(log_file, mode='a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        if not file_exists:
            writer.writerow(["Timestamp", "App", "Window", "Time (seconds)"])

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

                        # Write to CSV
                        writer.writerow([timestamp, last_owner, last_title, time_spent])
                        csvfile.flush()

                        # Write to SQLite
                        db_cursor.execute('''
                            INSERT INTO activity_logs (timestamp, app, window, duration_seconds)
                            VALUES (?, ?, ?, ?)
                        ''', (timestamp, last_owner, last_title, time_spent))
                        db_conn.commit()

                        print(f"{timestamp} | App: {last_owner} | Window: {last_title} | Time: {time_spent} sec")

                    last_owner = owner
                    last_title = title
                    start_time = time.time()

                time.sleep(interval)
        except KeyboardInterrupt:
            print("\nStopped logging.")
        finally:
            db_conn.close()


if __name__ == "__main__":
    log_active_windows()
