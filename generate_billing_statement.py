import psycopg2
import datetime
from collections import defaultdict
from openai import OpenAI
import os
from dotenv import load_dotenv
import sys
import json
import re
from urllib.parse import urlparse

# === Parse DATABASE_URL ===
def parse_database_url(url):
    parsed = urlparse(url)
    return {
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.hostname,
        "port": parsed.port
    }

# === Handle CLI date override ===
if len(sys.argv) > 1:
    date_to_analyze = datetime.datetime.strptime(sys.argv[1], "%Y-%m-%d").date()
else:
    date_to_analyze = datetime.date.today()

# === Initialize OpenAI ===
load_dotenv()
client = OpenAI()

def send_prompt_to_gpt(prompt, model="gpt-4o", max_tokens=1000):
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a billing assistant for a corporate law firm. "
                    "Given logs of activity and a list of client matters, generate a JSON object "
                    "for each discrete task worked on. Your response MUST be a valid JSON array. "
                    "Each task object should contain: client_name, client_number, matter_number, matter_descr, "
                    "task_descr (concise text description of the task in professional legal billing language), "
                    "time_billed (in minutes, one decimal place), and date."
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content

def get_postgres_connection():
    """Create a connection to PostgreSQL database using DATABASE_URL."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not set in environment variables")
    params = parse_database_url(database_url)
    return psycopg2.connect(**params)

def load_logs_for_day(target_date):
    conn = get_postgres_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp, app, window_title, duration
        FROM activity_log
        ORDER BY timestamp ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    logs = []
    for ts, app, window, duration in rows:
        logs.append({
            "timestamp": str(ts),
            "app": app,
            "window": window,
            "duration_min": round(duration / 60, 1)
        })
    return logs

def load_client_and_matter_maps():
    conn = get_postgres_connection()
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

def build_activity_log_text(logs):
    lines = ["\nHere is a full-day log of activity:\n"]
    for log in logs:
        if isinstance(log["timestamp"], str):
            ts = datetime.datetime.strptime(log["timestamp"], "%Y-%m-%d %H:%M:%S")
        else:
            ts = log["timestamp"]
        time_str = ts.strftime("%-I:%M %p")
        lines.append(f"- {time_str} — {log['app']} — {log['window']} — {log['duration_min']} min")
    return "\n".join(lines)

def build_gpt_prompt(date_to_analyze):
    logs = load_logs_for_day(date_to_analyze)
    client_map, matter_map = load_client_and_matter_maps()

    context = build_client_matter_context(client_map, matter_map)
    activity = build_activity_log_text(logs)

    prompt = (
        f"{context}\n\n"
        f"{activity}\n\n"
        'Return ONLY valid JSON in this format:\n\n'
        '[\n'
        '  {\n'
        '    "client_name": "Google",\n'
        '    "client_number": "3467",\n'
        '    "matter_number": "235",\n'
        '    "matter_descr": "Google Antitrust Investigation",\n'
        '    "task_descr": "Drafted motion for summary judgment sections I–III.",\n'
        '    "time_billed": 125.3,\n'
        '    "date": "2025-03-30"'
        '  }\n'
        ']'
    )

    return prompt

def parse_summary_to_json(response):
    cleaned_response = re.sub(r"^```(?:json)?\s*|\s*```$", "", response.strip(), flags=re.IGNORECASE)
    try:
        parsed_summary = json.loads(cleaned_response)
    except Exception as e:
        print("❌ Failed to parse GPT output as JSON.")
        print("--- Raw GPT Output ---\n")
        print(response)
        print("\n--- Cleaned Output ---\n")
        print(cleaned_response)
        parsed_summary = []
    return parsed_summary

# === Run Script ===
if __name__ == "__main__":
    prompt = build_gpt_prompt(date_to_analyze)
    response = send_prompt_to_gpt(prompt)
    parsed_json = parse_summary_to_json(response)

    if not parsed_json:
        print("⚠️ No valid task objects generated. Exiting.")
        sys.exit(1)

    print(json.dumps(parsed_json))
