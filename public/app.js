const start_stop_logger_btn = document.getElementById("start-stop-logger-btn");
const review_logs_btn = document.getElementById("review-logs-btn");

let logging = false;

start_stop_logger_btn.addEventListener("click", () => {
    if (logging === false) {
        start_stop_logger_btn.innerText = "Stop logger";
        logging = true;
        fetch("/start-logger", { method: "POST" })
        .then(res => res.text())
        .then(data => console.log("Logger started:", data))
        .catch(err => console.error("Error starting logger:", err));
    } else if (logging === true) {
        start_stop_logger_btn.innerText = "Start logger";
        logging = false;
        fetch("/stop-logger", { method: "POST" })
        .then(res => res.text())
        .then(data => console.log(data))
        .catch(err => console.error("Stop error:", err));
    }
})