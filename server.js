const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');

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

    await fsPromises.rename(logFile, path.join(__dirname, 'activity_log.db'));
    console.log("✅ Saved activity_log.db to:", path.join(__dirname, 'activity_log.db'));
    
    await fsPromises.rename(matterFile, path.join(__dirname, 'matter_map.db'));
    console.log("✅ Saved matter_map.db to:", path.join(__dirname, 'matter_map.db'));

    res.send("✅ Both databases uploaded.");
  } catch (err) {
    console.error("❌ Error saving uploaded files:", err);
    res.status(500).send("Error saving files.");
  }
});

app.get('/fetch-latest-summaries', (req, res) => {
    const summary_path = path.join(__dirname, 'latest_summary.json');
    fs.readFile(summary_path, 'utf8', (err, data) => {
      if (err) {
        console.error("Error reading summary:", err);
        return res.status(500).send("Summary not available.");
      }
      res.type('application/json').send(data);
    });
  });

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
