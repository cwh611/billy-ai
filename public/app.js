const update_logs_btn = document.getElementById("update-logs-btn");
const review_logs_btn = document.getElementById("review-logs-btn");

const app_url = "https://billy-ai-demo-1d85d1d40d53.herokuapp.com";

let client_options = [];
let matter_options = [];

window.addEventListener("DOMContentLoaded", () => {
    Promise.all([
        fetch(`${app_url}/get-client-map`).then(res => res.json()),
        fetch(`${app_url}/get-matter-map`).then(res => res.json())
    ])
    .then(([clientMap, matterMap]) => {
        client_options = Object.entries(clientMap).map(([number, name]) => ({
            number,
            name
        }));

        matter_options = Object.entries(matterMap).map(([number, descr]) => ({
            number,
            descr
        }));
    })
    .catch(err => {
        console.error("Error loading client/matter maps:", err);
    });
});

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
        sub.id = `matter-summary-${index + 1}`;

        const viewModeHTML = `
            <div class="view-mode">
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
                        ${entry.work_summary.map(task => `
                            <li class="matter-summary-content-li" contenteditable="true">${task}</li>
                        `).join("")}
                    </ul>
                </div>
                <div class="matter-summary-time-billed">
                    <span class="time-billed-label">Total time billed:</span>
                    <span class="time-billed-number">${entry.time_billed}</span>
                </div>
            </div>
        `;

        const editModeHTML = `
            <div class="edit-mode" style="display: none;">
                <div class="summary-header-container">
                    <select class="client-select">
                        ${client_options.map(opt => `
                            <option value="${opt.number}" ${opt.number === entry.client_number ? "selected" : ""}>
                                ${opt.name} (${opt.number})
                            </option>
                        `).join("")}
                    </select>
                    <select class="matter-select">
                        ${matter_options.map(opt => `
                            <option value="${opt.number}" ${opt.number === entry.matter_number ? "selected" : ""}>
                                ${opt.descr} (${opt.number})
                            </option>
                        `).join("")}
                    </select>
                </div>
                <div class="matter-summary-time-billed">
                    <span class="time-billed-label">Total time billed:</span>
                    <span contenteditable="true" class="time-billed-number">${entry.time_billed}</span>
                </div>
            </div>
        `;

        const controlsHTML = `
            <div class="summary-controls">
                <button class="edit-summary-btn" data-index="${index}">✏️ Edit</button>
                <button class="delete-summary-btn" data-index="${index}">🗑 Delete</button>
            </div>
        `;

        sub.innerHTML = controlsHTML + viewModeHTML + editModeHTML;
        container.appendChild(sub);
    });

    // Add button behavior after rendering
    document.querySelectorAll(".edit-summary-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const index = btn.getAttribute("data-index");
            const container = document.getElementById(`matter-summary-${parseInt(index) + 1}`);
            container.querySelector(".view-mode").style.display = "none";
            container.querySelector(".edit-mode").style.display = "block";
        });
    });

    document.querySelectorAll(".delete-summary-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const index = btn.getAttribute("data-index");
            const container = document.getElementById(`matter-summary-${parseInt(index) + 1}`);
            container.remove();
            // Optionally send DELETE to backend here
        });
    });
}
