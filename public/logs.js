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

    fetch(`${app_url}/fetch-task-logs`, { method: "GET" })
    .then(res => res.json())
    .then(data => {
        console.log("Data retrieved:", data);
        render_tasks(data);
    })
    .catch(err => console.error("Error retrieving data:", err));

});

function render_tasks(tasks) {
    // Group tasks by date
    const tasksByDate = tasks.reduce((acc, task) => {
        const date = task.date || new Date().toISOString().slice(0, 10);
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(task);
        return acc;
    }, {});

    // Get the main container
    const mainContainer = document.getElementById("main-container");
    mainContainer.innerHTML = "";

    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(tasksByDate).sort((a, b) => b.localeCompare(a));

    // Create containers for each date
    sortedDates.forEach(date => {
        // Create and add the date header
        const dateHeader = document.createElement("div");
        dateHeader.className = "daily-log-summaries-container-header";
        const localDate = new Date(date);
        dateHeader.textContent = localDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });
        mainContainer.appendChild(dateHeader);

        // Create the container for the day's tasks
        const dateContainer = document.createElement("div");
        dateContainer.className = "daily-log-summaries-container";

        const matter_numbers_rendered = [];
        const dateTasks = tasksByDate[date];

        dateTasks.forEach((task, index) => {
            if (!matter_numbers_rendered.includes(task.matter_number)) {
                matter_numbers_rendered.push(task.matter_number);
                const sub = document.createElement("div");
                sub.className = "matter-summary";
                sub.id = `matter-summary-${date}-${index + 1}`;

                const matter_tasks = dateTasks.filter(t => t.matter_number === task.matter_number);

                const matter_descr = matter_options.find(opt => opt.number === task.matter_number)?.descr || "";
                const client_name = client_options.find(opt => opt.number === task.client_number)?.name || "";

                const viewListItems = matter_tasks.map(t => 
                    `<li class="matter-summary-content-li">${t.task_descr} ${formatTimeBilled(t.time_billed)}</li>`
                ).join("");

                const editListItems = matter_tasks.map(t => `
                    <li class="matter-summary-content-li" data-task-id="${t.id}">
                      <span contenteditable="true" id="task-${t.id}-descr">${t.task_descr}</span>
                      <span id="task-${t.id}-time-billed">
                          <input type="number" class="time-billed-hours" id="task-${t.id}-hours" value="${Math.floor(t.time_billed / 60)}"><strong> hours</strong>,
                          <input type="number" class="time-billed-minutes" id="task-${t.id}-minutes" value="${(t.time_billed % 60).toFixed(1)}"><strong> minutes</strong>.
                      </span>
                      <button class="delete-task-btn" data-task-id="${t.id}">Delete</button>
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
                        <div class="summary-controls">
                            <button class="edit-save-summary-btn summary-control-btn" data-date="${date}" data-index="${index}">Edit</button>
                            <button class="delete-summary-btn summary-control-btn" data-date="${date}" data-index="${index}">Delete</button>
                        </div>
                    </div>
                `;

                const editModeHTML = `
                    <div class="edit-mode matter-summary" style="display: none;">
                        <div class="summary-header-container">
                            <select class="client-select" id="client-select-${date}-${index}" data-date="${date}" data-index="${index}">
                                ${client_options.map(opt => `
                                    <option value="${opt.number}" ${opt.number === task.client_number ? "selected" : ""}>
                                        ${opt.name} (${opt.number})
                                    </option>`).join("")}
                            </select>
                            <select class="matter-select" id="matter-select-${date}-${index}">
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
                            <button class="add-task-btn" data-matter-number="${task.matter_number}" data-date="${date}" data-index="${index}">Add task</button>
                        </div>
                        <div class="matter-summary-time-billed">
                            <span class="time-billed-label">Total time billed:</span>
                            <span contenteditable="true" class="time-billed-number" id="matter-${task.matter_number}-total-time-billed-edit"></span>
                        </div>
                        <div class="summary-controls">
                            <button class="edit-save-summary-btn summary-control-btn" data-date="${date}" data-index="${index}">Edit</button>
                            <button class="delete-summary-btn summary-control-btn" data-date="${date}" data-index="${index}">Delete</button>
                        </div>
                    </div>
                `;

                sub.innerHTML = viewModeHTML + editModeHTML;
                dateContainer.appendChild(sub);
            }
        });

        mainContainer.appendChild(dateContainer);
    });

    function formatTimeBilled(minutesFloat) {
        const hours = Math.floor(minutesFloat / 60);
        const remainingMinutes = +(minutesFloat % 60).toFixed(1);
        if (hours > 0 && remainingMinutes > 0) return `${hours} hours, ${remainingMinutes} minutes.`;
        if (hours > 0) return `${hours} hours.`;
        return `${remainingMinutes} minutes.`;
    }

    // Update total time billed for each matter
    Object.entries(tasksByDate).forEach(([date, dateTasks]) => {
        const matter_numbers = [...new Set(dateTasks.map(task => task.matter_number))];
        matter_numbers.forEach(matter_number => {
            const total = dateTasks
                .filter(task => task.matter_number === matter_number)
                .reduce((sum, task) => sum + parseFloat(task.time_billed), 0);

            const formatted = formatTimeBilled(total);
            const viewElement = document.getElementById(`matter-${matter_number}-total-time-billed-view`);
            const editElement = document.getElementById(`matter-${matter_number}-total-time-billed-edit`);
            
            if (viewElement) viewElement.innerText = formatted;
            if (editElement) editElement.innerText = formatted;
        });
    });

    // Update event listeners for client selects
    document.querySelectorAll(".client-select").forEach(clientSelect => {
        clientSelect.addEventListener("change", (e) => {
            const date = clientSelect.dataset.date;
            const index = clientSelect.dataset.index;
            const selectedClient = clientSelect.value;
            const matterSelect = document.getElementById(`matter-select-${date}-${index}`);
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

    // Update event listeners for edit/save buttons
    document.querySelectorAll(".edit-save-summary-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const date = btn.getAttribute("data-date");
            const index = btn.getAttribute("data-index");
            const container = document.getElementById(`matter-summary-${date}-${parseInt(index) + 1}`);
            const viewMode = container.querySelector(".view-mode");
            const editMode = container.querySelector(".edit-mode");
            const isEditing = editMode.style.display !== "none";

            if (isEditing) {
                const taskItems = container.querySelectorAll(".matter-summary-content-li");
                const updates = [];

                taskItems.forEach(item => {
                    const descrSpan = item.querySelector("span[id^='task-'][id$='-descr']");
                    if (!descrSpan) return;

                    const match = descrSpan.id.match(/^task-(.+)-descr$/);
                    if (!match) return;
                    const taskId = match[1];

                    const hoursInput = document.getElementById(`task-${taskId}-hours`);
                    const minutesInput = document.getElementById(`task-${taskId}-minutes`);
                    
                    if (!hoursInput || !minutesInput) {
                        console.warn(`Missing time inputs for task-${taskId}`);
                        return;
                    }
                    
                    const clientSelect = container.querySelector(`#client-select-${date}-${index}`);
                    const matterSelect = container.querySelector(`#matter-select-${date}-${index}`);

                    const newDescr = descrSpan.textContent.trim();
                    const hours = parseInt(hoursInput.value) || 0;
                    const minutes = parseFloat(minutesInput.value) || 0;
                    const totalMinutes = parseFloat((hours * 60 + minutes).toFixed(1));

                    if (taskId.startsWith("new-")) {
                        updates.push({
                            _type: "new",
                            task_descr: newDescr,
                            time_billed: totalMinutes,
                            client_number: clientSelect.value,
                            matter_number: matterSelect.value,
                            date: date
                        });
                    } else {
                        updates.push({
                            _type: "update",
                            id: taskId,
                            task_descr: newDescr,
                            time_billed: totalMinutes,
                            client_number: clientSelect.value,
                            matter_number: matterSelect.value
                        });
                    }                    
                });

                const updatesToPatch = updates.filter(u => u._type === "update");
                const updatesToPost = updates.filter(u => u._type === "new");

                Promise.all([
                    updatesToPatch.length > 0
                        ? fetch(`${app_url}/update-tasks`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ updates: updatesToPatch })
                        }).then(res => res.json())
                        : Promise.resolve({ message: "No updates" }),
                
                    updatesToPost.length > 0
                        ? fetch(`${app_url}/create-tasks`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tasks: updatesToPost })
                        }).then(res => res.json())
                        : Promise.resolve({ message: "No new tasks" })
                ])
                .then(([patchResult, postResult]) => {
                    console.log("Patch result:", patchResult);
                    console.log("Post result:", postResult);
                    return fetch(`${app_url}/fetch-task-logs`);
                })
                .then(res => res.json())
                .then(freshData => {
                    console.log("Re-rendering with fresh data:", freshData);
                    render_tasks(freshData);
                })
                .catch(err => console.error("Error during update or refresh:", err));                             

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

    // Update event listeners for delete summary buttons
    document.querySelectorAll(".delete-summary-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const date = btn.getAttribute("data-date");
            const index = btn.getAttribute("data-index");
            const container = document.getElementById(`matter-summary-${date}-${parseInt(index) + 1}`);
            const matterNumberSpan = container.querySelector(".matter-number");
            const matterNumberMatch = matterNumberSpan?.innerText.match(/\(([^)]+)\)/);
            const matterNumber = matterNumberMatch ? matterNumberMatch[1] : null;
    
            if (!matterNumber) return;
    
            fetch(`${app_url}/delete-matter-tasks/${matterNumber}`, {
                method: "DELETE"
            })
            .then(res => res.json())
            .then(() => {
                return fetch(`${app_url}/fetch-task-logs`);
            })
            .then(res => res.json())
            .then(data => {
                render_tasks(data);
            })
            .catch(err => console.error("Failed to delete matter's tasks:", err));
        });
    });    

    // Update event listeners for delete task buttons
    document.querySelectorAll(".delete-task-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const taskId = btn.getAttribute("data-task-id");
            const isNew = taskId.startsWith("new-");
            if (isNew) {
                const taskEl = document.querySelector(`li[data-task-id="${taskId}"]`);
                if (taskEl) taskEl.remove();
            } else {
                fetch(`${app_url}/delete-task/${taskId}`, {
                    method: "DELETE"
                })
                .then(res => res.json())
                .then(() => {
                    return fetch(`${app_url}/fetch-task-logs`);
                })
                .then(res => res.json())
                .then(data => {
                    render_tasks(data);
                })
                .catch(err => console.error("Failed to delete task:", err));
            }
        });
    });    

    // Update event listeners for add task buttons
    document.querySelectorAll(".add-task-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const matterNumber = btn.dataset.matterNumber;
            const date = btn.dataset.date;
            const index = btn.dataset.index;

            const ul = document.getElementById(`matter-${matterNumber}-summary-ul-edit`);
            const newId = `new-${Date.now()}`;

            const li = document.createElement("li");
            li.className = "matter-summary-content-li";
            li.dataset.taskId = newId;
            li.innerHTML = `
                <span contenteditable="true" id="task-${newId}-descr">New task.</span>
                <span id="task-${newId}-time-billed">
                    <input type="number" class="time-billed-hours" id="task-${newId}-hours" value="0" style="width: 50px;"> hours,
                    <input type="number" class="time-billed-minutes" id="task-${newId}-minutes" value="0.0" style="width: 60px;"> minutes
                </span>
                <button class="delete-task-btn" data-task-id="${newId}">🗑</button>
            `;
            ul.appendChild(li);

            li.querySelector(".delete-task-btn").addEventListener("click", () => li.remove());
        });
    });
}

document.getElementById("logs").addEventListener("click", () => {
    
    document.getElementById("logs").addEventListener("click", () => {
        window.location.href = `${app_url}/logs`;
    });

})