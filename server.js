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

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/logs', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'logs.html'))
})

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

app.get('/fetch-todays-task-logs', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    console.log("today:", today);    
    const query = `
      SELECT id, task_descr, client_number, matter_number, time_billed, date
      FROM tasks
      WHERE date = $1
    `;
    
    const result = await client.query(query, [today]);
    client.release();
    
    const summaries = result.rows.map(row => ({
      id: row.id,
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

app.get('/fetch-task-logs', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const query = `
      SELECT id, task_descr, client_number, matter_number, time_billed, date
      FROM tasks
    `;
    
    const result = await client.query(query);
    client.release();
    
    const summaries = result.rows.map(row => ({
      id: row.id,
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

app.patch("/update-tasks", async (req, res) => {
  console.log("req.headers:", req.headers);
  console.log("req.body raw?", req.body);
  
  if (!req.body) {
    return res.status(400).json({ error: "No body received" });
  }

  const { updates } = req.body;

  if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "Invalid format" });
  }

  try {
      const client = await pool.connect(); 

      for (const task of updates) {
          await client.query(
              `UPDATE tasks
               SET task_descr = $1,
                   time_billed = $2,
                   client_number = $3,
                   matter_number = $4
               WHERE id = $5`,
              [task.task_descr, task.time_billed, task.client_number, task.matter_number, task.id]
          );
      }

      client.release();
      res.json({ success: true, updated_count: updates.length });
  } catch (err) {
      console.error("Error updating tasks:", err);
      res.status(500).json({ error: "Failed to update tasks" });
  }
});

app.post("/create-tasks", async (req, res) => {
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "Invalid task array" });
  }

  try {
    const inserted = [];

    for (const task of tasks) {
      const result = await pool.query(
        `INSERT INTO tasks (task_descr, time_billed, client_number, matter_number, date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [task.task_descr, task.time_billed, task.client_number, task.matter_number, task.date]
      );

      inserted.push(result.rows[0]);
    }

    res.json({ success: true, inserted });
  } catch (err) {
    console.error("Error creating tasks:", err);
    res.status(500).json({ error: "Failed to create tasks" });
  }
});

app.delete("/delete-task/:id", async (req, res) => {
  const taskId = req.params.id;
  try {
    await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

app.delete("/delete-matter-tasks/:matter_number", async (req, res) => {
  const matterNumber = req.params.matter_number;
  try {
    await pool.query("DELETE FROM tasks WHERE matter_number = $1", [matterNumber]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting tasks by matter:", err);
    res.status(500).json({ error: "Failed to delete matter's tasks" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});