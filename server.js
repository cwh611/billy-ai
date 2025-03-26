const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

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

app.post('/stop-logger', (req, res) => {
    if (!loggerProcess) {
        return res.status(400).send('Logger is not running.');
      }
    
      loggerProcess.kill('SIGTERM');
      loggerProcess = null;
    
      // Run summary generation as a one-off
      exec('python3 generate_billing_summary.py', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error generating summary: ${error}`);
          return res.status(500).send(`Summary generation failed: ${error.message}`);
        }
        if (stderr) {
          console.error(`Summary stderr: ${stderr}`);
          // optional: you could still send stdout back if it succeeded
        }
    
        console.log('Billing summary generated.');
        res.send(`Logger stopped.\n\nBilling Summary:\n${stdout}`);
      });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
