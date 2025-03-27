const update_logs_btn = document.getElementById("update-logs-btn");
const review_logs_btn = document.getElementById("review-logs-btn");

const app_url = "https://billy-ai-demo-1d85d1d40d53.herokuapp.com"

update_logs_btn.addEventListener("click", () => {
    fetch(`${app_url}/fetch-latest-summaries`, { method: "GET" })
    .then(res => res.json())
    .then(data => console.log("Data retrieved:", data))
    .catch(err => console.error("Error retrieving data:", err));
})