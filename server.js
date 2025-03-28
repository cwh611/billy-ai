const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const matterDbPath = path.join(__dirname, 'matter_map.db');
const billing_summaries_db_path = path.join(__dirname, "billing_summaries.db")

let loggerProcess = null;

let latest_billing_summaries = ""

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  });

app.post('/start-logger', (req, res) => {
  if (loggerProcess) {
    return res.status(400).send('Logger is already running.');
  }     

  loggerProcess = spawn('python3', ['smart_logger.py']);

  loggerProcess.stdout.on('data', (data) => {
    console.log(`[logger stdout]: ${data}`);
  });

  loggerProcess.stderr.on('data', (data) => {
    console.error(`[logger stderr]: ${data}`);
  });

  loggerProcess.on('close', (code) => {
    console.log(`Logger process exited with code ${code}`);
    loggerProcess = null;
  });

  res.send('Logger started.');
});

app.post('/stop-logger', (req, res) => {
    // assume log file was uploaded
    exec('python3 generate_billing_statement.py', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error generating summary: ${error}`);
        return res.status(500).send(`Summary generation failed: ${error.message}`);
      }
  
      if (stderr) {
        console.error(`Summary stderr: ${stderr}`);
      }
  
      console.log('Billing summary generated.');
      latest_billing_summary = stdout
      res.type('text/plain').send(stdout);

      const parsedSummaries = JSON.parse(stdout);

      // Insert into SQLite
      const db = new sqlite3.Database(billing_summaries_db_path);
      const insertStmt = db.prepare(`
        INSERT INTO billing_summary (
          client_name, client_number, matter_number, matter_descr, work_summary, time_billed
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
  
      for (const entry of parsedSummaries) {
        insertStmt.run(
          entry.client_name,
          entry.client_number,
          entry.matter_number,
          entry.matter_descr,
          JSON.stringify(entry.work_summary), // stringify array
          entry.time_billed
        );
      }
  
      insertStmt.finalize();
      db.close();

    });
  });

const fsPromises = require('fs/promises');

app.post('/upload-log', upload.fields([
  { name: 'logfile', maxCount: 1 },
  { name: 'matterfile', maxCount: 1 }
]), async (req, res) => {
  try {
    const logFile = req.files['logfile']?.[0]?.path;
    const matterFile = req.files['matterfile']?.[0]?.path;

    if (!logFile || !matterFile) {
      return res.status(400).send("Missing one or both files.");
    }

    const logDest = path.join(__dirname, 'activity_log.db');
    const matterDest = path.join(__dirname, 'matter_map.db');

    // Overwrite both files (safely)
    await fsPromises.copyFile(logFile, logDest);
    await fsPromises.copyFile(matterFile, matterDest);

    // Log file sizes to verify
    const logStats = await fsPromises.stat(logDest);
    const matterStats = await fsPromises.stat(matterDest);
    console.log(`✅ Saved activity_log.db (${logStats.size} bytes)`);
    console.log(`✅ Saved matter_map.db (${matterStats.size} bytes)`);

    res.send("✅ Both databases uploaded.");
  } catch (err) {
    console.error("❌ Error saving uploaded files:", err);
    res.status(500).send("Error saving files.");
  }
});

app.get('/debug-db', (req, res) => {
  const db = new sqlite3.Database(path.join(__dirname, 'matter_map.db'));
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ tables: rows.map(r => r.name) });
  });
});

app.get('/fetch-latest-summaries', (req, res) => {
  const db = new sqlite3.Database(billing_summaries_db_path);

  const sql = `
    SELECT client_name, client_number, matter_number, matter_descr, work_summary, time_billed
    FROM billing_summary
    ORDER BY created_at DESC
    LIMIT 50
  `;

  db.all(sql, [], (err, rows) => {
    db.close();

    if (err) {
      console.error("❌ Error reading from billing_summaries.db:", err);
      return res.status(500).send("Summary not available.");
    }

    const summaries = rows.map(row => ({
      client_name: row.client_name,
      client_number: row.client_number,
      matter_number: row.matter_number,
      matter_descr: row.matter_descr,
      work_summary: JSON.parse(row.work_summary), // parse stringified array
      time_billed: row.time_billed
    }));

    res.json(summaries);
  });
});

// GET /get-client-map
app.get('/get-client-map', (req, res) => {
    const db = new sqlite3.Database(matterDbPath);
    const sql = `SELECT DISTINCT client_number, client_name FROM clients`;
  
    db.all(sql, [], (err, rows) => {
      db.close();
      if (err) {
        console.error("❌ Error fetching client map:", err);
        return res.status(500).json({ error: "Failed to fetch client map" });
      }
  
      const clientMap = {};
      rows.forEach(row => {
        clientMap[row.client_number] = row.client_name;
      });
      console.log(clientMap)
      res.json(clientMap);
    });
  });
  
  // GET /get-matter-map
  app.get('/get-matter-map', (req, res) => {
    const db = new sqlite3.Database(matterDbPath);
    const sql = `SELECT DISTINCT matter_number, matter_descr FROM matters`;
  
    db.all(sql, [], (err, rows) => {
      db.close();
      if (err) {
        console.error("❌ Error fetching matter map:", err);
        return res.status(500).json({ error: "Failed to fetch matter map" });
      }
  
      const matterMap = {};
      rows.forEach(row => {
        matterMap[row.matter_number] = row.matter_descr;
      });
      console.log(matterMap)
      res.json(matterMap);
    });
  });
  

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
