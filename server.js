const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const fsPromises = require('fs/promises');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

let loggerProcess = null;

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

// Upload handler
app.post('/upload-log', upload.fields([{ name: 'logfile', maxCount: 1 }]), async (req, res) => {
  const logFile = req.files['logfile']?.[0]?.path;
  if (!logFile) return res.status(400).send("Missing json file.");

  try {
    const logFilePath = path.join(__dirname, 'activity_logs.json');
    await fsPromises.copyFile(logFile, logFilePath);
    const logData = JSON.parse(await fsPromises.readFile(logFilePath, 'utf-8'));

    if (!logData.logs?.length) return res.status(400).send("Invalid or empty log file format.");

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertQuery = `INSERT INTO activity_log (timestamp, app, window_title, duration) VALUES ($1, $2, $3, $4)`;
      for (const entry of logData.logs) {
        await client.query(insertQuery, [
          entry.timestamp,
          entry.app,
          entry.window_title,
          entry.duration_seconds
        ]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error("Failed to insert logs: " + err.message);
    } finally {
      client.release();
    }

    // 🔥 Only run this *after* logs successfully inserted
    const { stdout } = await new Promise((resolve, reject) => {
      exec('python3 generate_billing_statement.py', (error, stdout, stderr) => {
        if (error) return reject(error);
        if (stderr) console.error(`Summary stderr: ${stderr}`);
        resolve({ stdout });
      });
    });

    const parsed_tasks = JSON.parse(stdout);

    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      const insertTaskQuery = `
        INSERT INTO tasks (task_descr, client_number, matter_number, time_billed, date)
        VALUES ($1, $2, $3, $4, $5)
      `;
      for (const task of parsed_tasks) {
        await client2.query(insertTaskQuery, [
          task.task_descr,
          task.client_number,
          task.matter_number,
          task.time_billed,
          task.date
        ]);
      }
      await client2.query('COMMIT');
    } catch (err) {
      await client2.query('ROLLBACK');
      throw new Error("Failed to insert tasks: " + err.message);
    } finally {
      client2.release();
    }

    res.type('text/plain').send(stdout);

  } catch (err) {
    console.error("❌ Upload error:", err);
    if (!res.headersSent) {
      res.status(500).send("Server error: " + err.message);
    }
  }
});

app.get('/fetch-latest-task-logs', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const query = `
      SELECT task_descr, client_number, matter_number, time_billed, date
      FROM tasks
    `;
    
    const result = await client.query(query);
    client.release();
    
    const summaries = result.rows.map(row => ({
      task_descr: row.task_descr,
      client_number: row.client_number,
      matter_number: row.matter_number,
      time_billed: row.time_billed,
      date: row.date
    }));
    
    res.json(summaries);
  } catch (err) {
    console.error("❌ Error fetching from PostgreSQL:", err);
    res.status(500).send("Summary not available.");
  }
});

// GET /get-client-map
app.get('/get-client-map', async (req, res) => {
  try {
    const client = await pool.connect();
    const query = `SELECT DISTINCT client_number, client_name FROM clients`;
    
    const result = await client.query(query);
    client.release();
    
    const clientMap = {};
    result.rows.forEach(row => {
      clientMap[row.client_number] = row.client_name;
    });
    
    console.log(clientMap);
    res.json(clientMap);
  } catch (err) {
    console.error("❌ Error fetching client map:", err);
    res.status(500).json({ error: "Failed to fetch client map" });
  }
});

// GET /get-matter-map
app.get('/get-matter-map', async (req, res) => {
  try {
    const client = await pool.connect();
    const query = `SELECT DISTINCT matter_number, matter_descr, client_number FROM matters`;
    
    const result = await client.query(query);
    client.release();
    
    const matterMap = {};
    result.rows.forEach(row => {
      matterMap[row.matter_number] = {
        descr: row.matter_descr,
        client_number: row.client_number
      }
    });

    console.log(matterMap);
    res.json(matterMap);
  } catch (err) {
    console.error("❌ Error fetching matter map:", err);
    res.status(500).json({ error: "Failed to fetch matter map" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});