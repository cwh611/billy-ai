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

        matter_options = Object.entries(matterMap).map(([number, { descr, client_number }]) => ({
            number,
            descr,
            client_number
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
    container.innerHTML = "";

    const matter_numbers_rendered = [];

    tasks.forEach((task, index) => {
        if (!matter_numbers_rendered.includes(task.matter_number)) {
            matter_numbers_rendered.push(task.matter_number);
            const sub = document.createElement("div");
            sub.className = "matter-summary-subcontainer";
            sub.id = `matter-summary-${index + 1}`;

            const matter_tasks = tasks.filter(t => t.matter_number === task.matter_number);

            const matter_descr = matter_options.find(opt => opt.number === task.matter_number)?.descr || "";
            const client_name = client_options.find(opt => opt.number === task.client_number)?.name || "";

            const viewListItems = matter_tasks.map(t => 
                `<li class="matter-summary-content-li">${t.task_descr} ${formatTimeBilled(t.time_billed)}</li>`
            ).join("");

            const editListItems = matter_tasks.map(t => `
                <li class="matter-summary-content-li">
                    <span contenteditable="true" id="task-${t.id}-descr">${t.task_descr}</span>
                    <span id="task-${t.id}-time-billed">
                        <input type="number" class="time-billed-hours" id="task-${t.id}-hours" min="0" step="1" value="${Math.floor(t.time_billed / 60)}" style="width: 50px;"> hours,
                        <input type="number" class="time-billed-minutes" id="task-${t.id}-minutes" min="0" max="59.9" step="0.1" value="${(t.time_billed % 60).toFixed(1)}" style="width: 60px;"> minutes
                    </span>
                </li>
            `).join("");

            const viewModeHTML = `
                <div class="view-mode matter-summary">
                    <div class="summary-header-container">
                        <div class="client-name-number-container">
                            <span class="client-name">${client_name}</span>
                            <span class="client-number">(${task.client_number})</span>
                        </div>
                        <div class="matter-descr-number-container">
                            <span class="matter-descr">${matter_descr}</span>
                            <span class="matter-number">(${task.matter_number})</span>
                        </div>
                    </div>
                    <div class="matter-summary-content-container">
                        <ul class="matter-summary-ul" id="matter-${task.matter_number}-summary-ul-view">
                            ${viewListItems}
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
                        <select class="client-select" id="client-select-${index}" data-index="${index}">
                            ${client_options.map(opt => `
                                <option value="${opt.number}" ${opt.number === task.client_number ? "selected" : ""}>
                                    ${opt.name} (${opt.number})
                                </option>`).join("")}
                        </select>
                        <select class="matter-select" id="matter-select-${index}">
                            ${matter_options
                                .filter(opt => String(opt.client_number) === String(task.client_number))
                                .map(opt => `
                                <option value="${opt.number}" ${opt.number === task.matter_number ? "selected" : ""}>
                                    ${opt.descr} (${opt.number})
                                </option>`).join("")}
                        </select>
                    </div>
                    <div class="matter-summary-content-container">
                        <ul class="matter-summary-ul" id="matter-${task.matter_number}-summary-ul-edit">
                            ${editListItems}
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
        }
    });

    function formatTimeBilled(minutesFloat) {
        const hours = Math.floor(minutesFloat / 60);
        const remainingMinutes = +(minutesFloat % 60).toFixed(1);
        if (hours > 0 && remainingMinutes > 0) return `${hours} hours, ${remainingMinutes} minutes.`;
        if (hours > 0) return `${hours} hours.`;
        return `${remainingMinutes} minutes.`;
    }

    matter_numbers_rendered.forEach(matter_number => {
        const total = tasks
            .filter(task => task.matter_number === matter_number)
            .reduce((sum, task) => sum + parseFloat(task.time_billed), 0);

        const formatted = formatTimeBilled(total);
        document.getElementById(`matter-${matter_number}-total-time-billed-view`).innerText = formatted;
        document.getElementById(`matter-${matter_number}-total-time-billed-edit`).innerText = formatted;
    });

    document.querySelectorAll(".client-select").forEach(clientSelect => {
        clientSelect.addEventListener("change", (e) => {
            const index = clientSelect.dataset.index;
            const selectedClient = clientSelect.value;
            const matterSelect = document.getElementById(`matter-select-${index}`);
            matterSelect.innerHTML = "";
            const relevantMatters = matter_options.filter(opt => String(opt.client_number) === String(selectedClient));
            relevantMatters.forEach(opt => {
                const option = document.createElement("option");
                option.value = opt.number;
                option.textContent = `${opt.descr} (${opt.number})`;
                matterSelect.appendChild(option);
            });
        });
    });

    document.querySelectorAll(".edit-save-summary-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const index = btn.getAttribute("data-index");
            const container = document.getElementById(`matter-summary-${parseInt(index) + 1}`);
            const viewMode = container.querySelector(".view-mode");
            const editMode = container.querySelector(".edit-mode");
            const isEditing = editMode.style.display !== "none";

            if (isEditing) {
                const taskItems = container.querySelectorAll(".matter-summary-content-li");
                const updates = [];

                taskItems.forEach(item => {
                    const descrSpan = item.querySelector("span[id^='task-'][id$='-descr']");
                    if (!descrSpan) return;

                    const taskId = descrSpan.id.split("-")[1];
                    const hoursInput = document.getElementById(`task-${taskId}-hours`);
                    const minutesInput = document.getElementById(`task-${taskId}-minutes`);
                    const clientSelect = container.querySelector(`#client-select-${index}`);
                    const matterSelect = container.querySelector(`#matter-select-${index}`);

                    const newDescr = descrSpan.textContent.trim();
                    const hours = parseInt(hoursInput.value) || 0;
                    const minutes = parseFloat(minutesInput.value) || 0;
                    const totalMinutes = parseFloat((hours * 60 + minutes).toFixed(1));

                    updates.push({
                        id: taskId,
                        task_descr: newDescr,
                        time_billed: totalMinutes,
                        client_number: clientSelect.value,
                        matter_number: matterSelect.value
                    });
                });

                fetch(`${app_url}/update-tasks`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ updates })
                })
                    .then(res => res.json())
                    .then(data => {
                        console.log("Batch update response:", data);
                        // Optional: re-fetch UI here
                    })
                    .catch(err => console.error("Error updating tasks:", err));

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
