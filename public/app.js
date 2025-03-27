const update_logs_btn = document.getElementById("update-logs-btn");
const review_logs_btn = document.getElementById("review-logs-btn");

const app_url = "https://billy-ai-demo-1d85d1d40d53.herokuapp.com";

update_logs_btn.addEventListener("click", () => {
    fetch(`${app_url}/fetch-latest-summaries`, { method: "GET" })
        .then(res => res.json())
        .then(data => {
            console.log("Data retrieved:", data);
            renderSummaries(data);
        })
        .catch(err => console.error("Error retrieving data:", err));
});

function renderSummaries(summaries) {
    const container = document.getElementById("log-summaries-container");
    container.innerHTML = ""; // Clear old content

    summaries.forEach((entry, index) => {
        const sub = document.createElement("div");
        sub.className = "matter-summary-subcontainer";

        const div = document.createElement("div");
        div.className = "matter-summary";
        div.id = `matter-summary-${index + 1}`;

        div.innerHTML = `
            <div class="summary-header-container">
                <div class="client-name-number-container">
                    <span class="client-name">${entry.client_name}</span>
                    <span class="client-number">(${entry.client_number})</span>
                </div>
                <div class="matter-descr-number-container">
                    <span class="matter-descr">${entry.matter_descr}</span>
                    <span class="matter-number">(${entry.matter_number})</span>
                </div>
            </div>
            <div class="matter-summary-content-container">
                <ul class="matter-summary-ul">
                    ${entry.summary.map((line, i) =>
                        `<li class="matter-summary-content-li">${line}</li>`
                    ).join("")}
                </ul>
            </div>
            <div class="matter-summary-time-billed">
                <span class="time-billed-label">Total time billed:</span>
                <span class="time-billed-number">${entry.time_billed}</span>
            </div>
        `;

        sub.appendChild(div);
        container.appendChild(sub);
    });
}
