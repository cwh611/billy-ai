import csv
import sqlite3
import datetime
from collections import defaultdict
from openai import OpenAI
import os
from dotenv import load_dotenv
import sys

if len(sys.argv) > 1:
    date_to_analyze = datetime.datetime.strptime(sys.argv[1], "%Y-%m-%d").date()
else:
    date_to_analyze = datetime.date.today()

# Load your API key from .env
load_dotenv()
client = OpenAI() 

def send_prompt_to_gpt(prompt, model="gpt-4o", max_tokens=800):
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a billing assistant for a corporate law firm. Given logs of activity and a list of client matters, generate a billing summary for each matter."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content

# === Load mapping files ===
def load_csv_map(path, key_field):
    mapping = {}
    with open(path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalize headers and values
            row = {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items()}
            key = row[key_field].lower()
            mapping[key] = row
    return mapping

# === Load logs for a specific day ===
def load_logs_for_day(db_path, target_date):

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    start_dt = datetime.datetime.combine(target_date, datetime.time.min)
    end_dt = datetime.datetime.combine(target_date, datetime.time.max)

    cursor.execute("""
        SELECT timestamp, app, window, duration_seconds
        FROM activity_logs
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
    """, (start_dt.strftime("%Y-%m-%d %H:%M:%S"), end_dt.strftime("%Y-%m-%d %H:%M:%S")))
    
    rows = cursor.fetchall()
    conn.close()

    logs = []

    for ts, app, window, duration in rows:
        logs.append({
            "timestamp": ts,
            "app": app,
            "window": window,
            "duration_min": round(duration / 60, 1)
        })
    print("LOGS:", logs)
    return logs

# === Format known clients and matters for GPT ===
def build_client_matter_context(client_map, matter_map):
    grouped = defaultdict(list)
    for _, matter in matter_map.items():
        client_number = matter["client_number"]
        matter_number = matter["matter_number"]
        matter_descr = matter["matter_descr"]
        client_name = client_map.get(client_number, {}).get("client_name", f"Client {client_number}")
        grouped[(client_name, client_number)].append((matter_number, matter_descr))

    lines = ["Here is a list of clients and their matters:\n"]
    for (client_name, client_number), matters in grouped.items():
        lines.append(f"- {client_name} ({client_number}):")
        for matter_number, descr in matters:
            lines.append(f"  - {matter_number}: {descr}")
    return "\n".join(lines)

# === Format the activity log for GPT ===
def build_activity_log_text(logs):
    lines = ["\nHere is a full-day log of activity:\n"]
    for log in logs:
        ts = datetime.datetime.strptime(log["timestamp"], "%Y-%m-%d %H:%M:%S")
        time_str = ts.strftime("%-I:%M %p")
        lines.append(f"- {time_str} — {log['app']} — {log['window']} — {log['duration_min']} min")
    return "\n".join(lines)

def load_client_and_matter_maps(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Load clients
    cursor.execute("SELECT client_number, client_name FROM clients")
    clients = {row[0]: {"client_number": row[0], "client_name": row[1]} for row in cursor.fetchall()}

    # Load matters
    cursor.execute("SELECT matter_number, client_number, matter_descr FROM matters")
    matters = {}
    for row in cursor.fetchall():
        matter_number, client_number, descr = row
        key = descr.lower()
        matters[key] = {
            "matter_number": matter_number,
            "client_number": client_number,
            "matter_descr": descr
        }

    conn.close()
    return clients, matters

# === Combine into final GPT prompt ===
def build_gpt_prompt(db_path, matter_db, date_to_analyze):

    logs = load_logs_for_day(db_path, date_to_analyze)

    client_map, matter_map = load_client_and_matter_maps(matter_db)

    context = build_client_matter_context(client_map, matter_map)
    activity = build_activity_log_text(logs)

    prompt = (
        f"{context}\n\n"
        f"{activity}\n\n"
        "Please analyze the activity log and assign each entry to the most likely client and matter from the list above. "
        "Group your response by matter. For each matter, estimate the total time spent and provide a billing summary "
        "in professional legal billing language."
    )

    return prompt

# === Example usage ===
if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))

    db_path = os.path.join(script_dir, "activity_log.db")
    matter_db = os.path.join(script_dir, "matter_map.db")

    prompt = build_gpt_prompt(db_path, matter_db, date_to_analyze)

    print("\n--- GPT Prompt ---\n")
    print(prompt[:1000])  # Preview

    response = send_prompt_to_gpt(prompt)
    print("\n--- GPT Billing Summary ---\n")
    print(response)
