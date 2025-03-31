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

app.post('/upload-log', upload.fields([
  { name: 'logfile', maxCount: 1 },
]), async (req, res) => {
  try {
    const logFile = req.files['logfile']?.[0]?.path;

    if (!logFile) {
      return res.status(400).send("Missing json file.");
    }

    // Copy uploaded file to server
    await fsPromises.copyFile(logFile, path.join(__dirname, 'activity_logs.json'));
    
    // Read the copied JSON file
    const logFilePath = path.join(__dirname, 'activity_logs.json');
    const logData = JSON.parse(await fsPromises.readFile(logFilePath, 'utf-8'));
    
    if (!logData.logs || !Array.isArray(logData.logs) || logData.logs.length === 0) {
      return res.status(400).send("Invalid or empty log file format.");
    }
    
    // Connect to database
    const client = await pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      const insertQuery = `
        INSERT INTO activity_log (
          timestamp, app, window_title, duration_seconds
        ) VALUES ($1, $2, $3, $4)
      `;
      
      // Insert each log entry
      for (const entry of logData.logs) {
        await client.query(insertQuery, [
          entry.timestamp,
          entry.app,
          entry.window_title,
          entry.duration_seconds
        ]);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      res.send(`✅ Activity log successfully copied to server and database. ${logData.logs.length} entries processed.`);

      try {
        // Run the Python script to generate billing statement
        const { stdout, stderr } = await new Promise((resolve, reject) => {
          exec('python3 generate_billing_statement.py', (error, stdout, stderr) => {
            if (error) {
              reject(error);
              return;
            }
            resolve({ stdout, stderr });
          });
        });
    
        if (stderr) {
          console.error(`Summary stderr: ${stderr}`);
        }
    
        console.log('Billing summary generated.');
        
        const parsed_tasks = JSON.parse(stdout);
    
        // Insert into PostgreSQL
        const client = await pool.connect();
        
        try {
          // Begin transaction
          await client.query('BEGIN');
          
          const insertQuery = `
            INSERT INTO tasks (
              task_descr, client_name, client_number, matter_number, matter_descr, time_billed, date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;
          
          for (const entry of parsed_tasks) {
            await client.query(insertQuery, [
              entry.task_descr,
              entry.client_name,
              entry.client_number,
              entry.matter_number,
              entry.matter_descr,
              entry.time_billed,
              entry.date
            ]);
          }
          
          // Commit transaction
          await client.query('COMMIT');
          
          res.type('text/plain').send(stdout);
        } catch (dbError) {
          // Rollback in case of error
          await client.query('ROLLBACK');
          console.error("❌ Error inserting into database:", dbError);
          res.status(500).send(`Database operation failed: ${dbError.message}`);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error(`Error generating summary: ${error}`);
        res.status(500).send(`Summary generation failed: ${error.message}`);
      }
    } catch (dbError) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      console.error("❌ Error inserting logs into database:", dbError);
      res.status(500).send(`Database operation failed: ${dbError.message}`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Error processing uploaded files:", err);
    res.status(500).send("Error processing files: " + err.message);
  }
});

app.get('/fetch-latest-task-logs', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const query = `
      SELECT task_descr, client_number, client_name, matter_number, matter_descr, time_billed, date
      FROM tasks
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const result = await client.query(query);
    client.release();
    
    const summaries = result.rows.map(row => ({
      task_descr: row.task_descr,
      client_number: row.client_number,
      client_name: row.client_name,
      matter_number: row.matter_number,
      matter_descr: row.matter_descr, 
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
    const query = `SELECT DISTINCT matter_number, matter_descr FROM matters`;
    
    const result = await client.query(query);
    client.release();
    
    const matterMap = {};
    result.rows.forEach(row => {
      matterMap[row.matter_number] = row.matter_descr;
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