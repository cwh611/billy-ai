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

    fetch(`${app_url}/fetch-latest-task-logs`, { method: "GET" })
    .then(res => res.json())
    .then(data => {
        console.log("Data retrieved:", data);
        render_tasks(data);
    })
    .catch(err => console.error("Error retrieving data:", err));

});

update_logs_btn.addEventListener("click", () => {
    fetch(`${app_url}/fetch-latest-task-logs`, { method: "GET" })
        .then(res => res.json())
        .then(data => {
            console.log("Data retrieved:", data);
            render_tasks(data);
        })
        .catch(err => console.error("Error retrieving data:", err));
});

function render_tasks(tasks) {
    const container = document.getElementById("log-summaries-container");
    container.innerHTML = ""; // Clear old content

    const matter_numbers_worked_on = [];
        
    tasks.forEach((task, index) => {
        if (!matter_numbers_worked_on.includes(task.matter_number)) {
            matter_numbers_worked_on.push(task.matter_number);
            const sub = document.createElement("div");
            sub.className = "matter-summary-subcontainer";
            sub.id = `matter-summary-${index + 1}`;
    
            const viewModeHTML = `
                <div class="view-mode matter-summary">
                    <div class="summary-header-container">
                        <div class="client-name-number-container">
                            <span class="client-name">${task.client_name}</span>
                            <span class="client-number">(${task.client_number})</span>
                        </div>
                        <div class="matter-descr-number-container">
                            <span class="matter-descr">${task.matter_descr}</span>
                            <span class="matter-number">(${task.matter_number})</span>
                        </div>
                    </div>
                    <div class="matter-summary-content-container">
                        <ul class="matter-summary-ul" id="matter-${task.matter_number}-summary-ul-view">
                            <li>${task.task_descr} ${task.time_billed}</li>
                        </ul>
                    </div>
                    <div class="matter-summary-time-billed">
                        <span class="time-billed-label">Total time billed:</span>
                        <span class="time-billed-number" id="matter-${task.matter_number}-total-time-billed-view"></span>
                    </div>
                </div>
            `;
    
            const editModeHTML = `
                <div class="edit-mode matter-summary" style="display: none;">
                    <div class="summary-header-container">
                        <select class="client-select">
                            ${client_options.map(opt => `
                                <option value="${opt.number}" ${opt.number === task.client_number ? "selected" : ""}>
                                    ${opt.name} (${opt.number})
                                </option>
                            `).join("")}
                        </select>
                        <select class="matter-select">
                            ${matter_options.map(opt => `
                                <option value="${opt.number}" ${opt.number === task.matter_number ? "selected" : ""}>
                                    ${opt.descr} (${opt.number})
                                </option>
                            `).join("")}
                        </select>
                    </div>
                    <div contenteditable="true" class="matter-summary-content-container">
                        <ul class="matter-summary-ul" id="matter-${task.matter_number}-summary-ul-edit">
                            <li class="matter-summary-content-li" contenteditable="true">${task.task_descr} ${task.time_billed}</li>
                        </ul>
                    </div>
                    <div class="matter-summary-time-billed">
                        <span class="time-billed-label">Total time billed:</span>
                        <span contenteditable="true" class="time-billed-number" id="matter-${task.matter_number}-total-time-billed-edit"></span>
                    </div>
                </div>
            `;
    
            const controlsHTML = `
                <div class="summary-controls">
                    <button class="edit-save-summary-btn summary-control-btn" data-index="${index}">Edit</button>
                    <button class="delete-summary-btn summary-control-btn" data-index="${index}">Delete</button>
                </div>
            `;
    
            sub.innerHTML = viewModeHTML + editModeHTML + controlsHTML;
            container.appendChild(sub);
        } else if (matter_numbers_worked_on.includes(task.matter_number)) {
            document.getElementById(`matter-${task.matter_number}-summary-ul-view`).innerHTML += 
                `<li class="matter-summary-content-li">${task.task_descr} ${task.time_billed}</li>`;
            document.getElementById(`matter-${task.matter_number}-summary-ul-edit`).innerHTML += 
                `<li class="matter-summary-content-li">${task.task_descr} ${task.time_billed}</li>`;
        } else {
            console.log("Client unable to handle matter_numbers_worked_on matching")
        }

    });

    function formatTimeBilled(minutesFloat) {
        const hours = Math.floor(minutesFloat / 60);
        const remainingMinutes = +(minutesFloat % 60).toFixed(1);
    
        if (hours > 0 && remainingMinutes > 0) {
            return `${hours} hours, ${remainingMinutes} minutes.`;
        } else if (hours > 0) {
            return `${hours} hours.`;
        } else {
            return `${remainingMinutes} minutes.`;
        }
    }

    matter_numbers_worked_on.forEach(matter_number => {
        let total_time_billed_to_matter = 0;
    
        tasks.forEach(task => {
            if (task.matter_number === matter_number) {
                total_time_billed_to_matter += parseFloat(task.time_billed);
            }
        });
    
        const formatted = formatTimeBilled(total_time_billed_to_matter);
        document.getElementById(`matter-${matter_number}-total-time-billed-view`).innerText = formatted;
        document.getElementById(`matter-${matter_number}-total-time-billed-edit`).innerText = formatted;
    });
    
    // Add button behavior after rendering
    document.querySelectorAll(".edit-save-summary-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const index = btn.getAttribute("data-index");
            const container = document.getElementById(`matter-summary-${parseInt(index) + 1}`);
    
            const viewMode = container.querySelector(".view-mode");
            const editMode = container.querySelector(".edit-mode");
    
            const isEditing = editMode.style.display !== "none";
    
            if (isEditing) {
                // Save logic here (optional: sync edits to backend or internal state)
                viewMode.style.display = "flex";
                editMode.style.display = "none";
                btn.innerText = "Edit";
            } else {
                viewMode.style.display = "none";
                editMode.style.display = "flex";
                btn.innerText = "Save";
            }
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
