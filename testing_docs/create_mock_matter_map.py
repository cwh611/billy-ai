import sqlite3

conn = sqlite3.connect("matter_map.db")
cursor = conn.cursor()

# Create tables
cursor.execute('''
    CREATE TABLE IF NOT EXISTS clients (
        client_number TEXT PRIMARY KEY,
        client_name TEXT
    )
''')

cursor.execute('''
    CREATE TABLE IF NOT EXISTS matters (
        matter_number TEXT PRIMARY KEY,
        client_number TEXT,
        matter_descr TEXT,
        FOREIGN KEY (client_number) REFERENCES clients(client_number)
    )
''')

# Insert mock data
cursor.executemany('INSERT OR REPLACE INTO clients VALUES (?, ?)', [
    ("4211", "Microsoft"),
    ("4365", "VMWare")
])

cursor.executemany('INSERT OR REPLACE INTO matters VALUES (?, ?, ?)', [
    ("488", "4211", "Derivative Securities Litigation"),
    ("011", "4365", "Splunk Acquisition")
])

conn.commit()
conn.close()

print("matter_map.db created.")
