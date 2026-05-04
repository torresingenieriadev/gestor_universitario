const state = {
    subjects: [],
    selectedSubject: null,
    selectedSession: null,
    activeTab: "sessions",
};

const api = {
    async get(path) {
        const res = await fetch(path);
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },
    async post(path, body) {
        const res = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },
    async put(path, body) {
        const res = await fetch(path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },
    async del(path) {
        const res = await fetch(path, { method: "DELETE" });
        if (!res.ok) throw new Error(res.statusText);
    },
};

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}

function openModal(html) {
    document.getElementById("modal-box").innerHTML = html;
    document.getElementById("modal-overlay").classList.remove("hidden");
}

document.getElementById("modal-overlay").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
});

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

function pluralize(n, singular, plural) {
    return n === 1 ? singular : plural;
}

async function loadData() {
    const data = await api.get("/api/data");
    state.subjects = data.subjects;
    renderSubjects();
    if (state.subjects.length > 0 && !state.selectedSubject) {
        selectSubject(state.subjects[0].id);
    }
}

function renderSubjects() {
    const list = document.getElementById("subject-list");
    list.innerHTML = state.subjects
        .map(
            (s) => {
                const sessionLabel = s.sessions.length + " " + pluralize(s.sessions.length, "encuentro", "encuentros");
                const isActive = state.selectedSubject && state.selectedSubject.id === s.id;
                return '<li class="' + (isActive ? "active" : "") + '" onclick="selectSubject(\'' + s.id + '\')">' +
                    '<span class="subject-name">' + escapeHtml(s.name) + '</span>' +
                    '<span class="subject-meta">' + sessionLabel + '</span>' +
                    '<span class="subject-actions" onclick="event.stopPropagation()">' +
                    '<button class="btn btn-ghost" onclick="showSubjectModal(\'' + s.id + '\')" title="Editar">&#9998;</button>' +
                    '<button class="btn btn-danger" onclick="deleteSubject(\'' + s.id + '\')" title="Eliminar">&times;</button>' +
                    '</span>' +
                    '</li>';
            }
        )
        .join("");
}

function selectSubject(id) {
    state.selectedSubject = state.subjects.find((s) => s.id === id) || null;
    state.selectedSession = null;
    state.activeTab = "sessions";
    renderSubjects();
    renderSubjectView();
}

function backToSubject() {
    state.selectedSession = null;
    renderSubjectView();
}

function selectSession(sessionId) {
    state.selectedSession = state.selectedSubject.sessions.find((s) => s.id === sessionId);
    renderSubjectView();
}

function renderSubjectView() {
    const welcome = document.getElementById("welcome-state");
    const view = document.getElementById("subject-view");

    if (!state.selectedSubject) {
        welcome.classList.remove("hidden");
        view.classList.add("hidden");
        return;
    }

    welcome.classList.add("hidden");
    view.classList.remove("hidden");

    const subject = state.selectedSubject;

    document.getElementById("subject-view-header").innerHTML =
        '<h1>' +
        '<span>&#128218;</span> ' +
        '<span>' + escapeHtml(subject.name) + '</span>' +
        '<span style="margin-left:auto; display:flex; gap:6px;">' +
        '<button class="btn btn-ghost btn-sm" onclick="showSubjectModal(\'' + subject.id + '\')">&#9998; Renombrar</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteSubject(\'' + subject.id + '\')">&times; Eliminar</button>' +
        '</span>' +
        '</h1>';

    renderTabs();
    renderActiveTab();
}
function switchTab(tab) {
    state.activeTab = tab;
    state.selectedSession = null;
    renderTabs();
    renderActiveTab();
}

function renderTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.tab === state.activeTab);
    });

    const pendingTasks = countPendingTasks();
    const badge = document.getElementById("tasks-badge");
    if (pendingTasks > 0) {
        badge.classList.remove("hidden");
        badge.textContent = pendingTasks;
    } else {
        badge.classList.add("hidden");
    }
}

function countPendingTasks() {
    if (!state.selectedSubject) return 0;
    return (state.selectedSubject.tasks || []).filter((t) => !t.done).length;
}

function renderActiveTab() {
    const container = document.getElementById("tab-content");
    switch (state.activeTab) {
        case "sessions":
            renderSessionsTab(container);
            break;
        case "tasks":
            renderTasksTab(container);
            break;
        case "ai":
            renderAiTab(container);
            break;
        case "export":
            renderExportTab(container);
            break;
    }
}

function getSessionPreview(sess) {
    if (sess.notes) return escapeHtml(sess.notes.substring(0, 120) + (sess.notes.length > 120 ? "..." : ""));
    if (sess.transcript) return "Contiene transcripcion (sin notas)";
    return "Sin contenido aun";
}

function renderSessionsTab(container) {
    const subject = state.selectedSubject;

    if (state.selectedSession) {
        renderSessionDetailView(container);
        return;
    }

    const sessions = subject.sessions || [];
    let html = '<div class="section-header"><h3>Encuentros (' + sessions.length + ')</h3>' +
        '<button class="btn btn-primary btn-sm" onclick="showSessionModal()">+ Nuevo Encuentro</button></div>';

    if (sessions.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">&#128214;</div><p>No hay encuentros en esta materia. Crea uno para empezar.</p></div>';
    } else {
        html += '<div class="session-list">';
        sessions.forEach(function(sess) {
            html += '<div class="card session-card" onclick="selectSession(\'' + sess.id + '\')">' +
                '<div class="session-card-header">' +
                '<h3>' + escapeHtml(sess.title) + '</h3>' +
                '<div class="session-card-actions" onclick="event.stopPropagation()">' +
                '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showSessionModal(\'' + sess.id + '\')" title="Editar">&#9998;</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); copySessionTranscript(\'' + sess.id + '\')" title="Copiar transcripcion">&#128203;</button>' +
                '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteSession(\'' + sess.id + '\')" title="Eliminar">&times;</button>' +
                '</div></div>' +
                '<div class="session-card-preview">' + getSessionPreview(sess) + '</div>' +
                '<div class="session-card-meta">' +
                '<span>&#128221; ' + (sess.notes ? "Tiene notas" : "Sin notas") + '</span>' +
                '<span>&#128195; ' + (sess.transcript ? "Tiene transcripcion" : "Sin transcripcion") + '</span>' +
                '</div></div>';
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

function renderSessionDetailView(container) {
    const sess = state.selectedSession;
    const subject = state.selectedSubject;

    let html = '<div style="max-width:800px; margin:0 auto;">' +
        '<button class="btn btn-ghost btn-sm" onclick="backToSubject()" style="margin-bottom:16px">&larr; Volver a encuentros</button>' +
        '<div class="session-detail-header">' +
        '<h2>' + escapeHtml(sess.title) + '</h2>' +
        '<div style="display:flex; gap:6px; margin-left:auto">' +
        '<button class="btn btn-ghost btn-sm" onclick="showSessionModal(\'' + sess.id + '\')">&#9998; Editar</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="copySessionTranscript(\'' + sess.id + '\')">&#128203; Copiar</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteSession(\'' + sess.id + '\')">&times; Eliminar</button>' +
        '</div></div>' +

        '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-header">' +
        '<h3>Notas Rapidas</h3>' +
        '<button class="btn btn-ghost btn-sm" onclick="saveNotes()">&#128190; Guardar</button>' +
        '</div>' +
        '<div class="card-body">' +
        '<textarea class="notes-textarea" id="notes-textarea" placeholder="Escribe tus notas aqu\u00ED...">' + escapeHtml(sess.notes || "") + '</textarea>' +
        '</div></div>' +

        '<div class="card">' +
        '<div class="card-header">' +
        '<h3>Transcripcion</h3>' +
        '<div style="display:flex; gap:6px">' +
        (sess.transcript ? '<button class="btn btn-ghost btn-sm" onclick="copySessionTranscript(\'' + sess.id + '\')">&#128203; Copiar</button>' : "") +
        '<button class="btn btn-primary btn-sm" onclick="showSessionImportModal()">' + (sess.transcript ? "Reemplazar" : "Importar") + '</button>' +
        '</div></div>' +
        '<div class="card-body">';

    if (sess.transcript) {
        html += '<div class="transcript-view">' + escapeHtml(sess.transcript) + '</div>';
    } else {
        html += '<div class="empty-state"><p>Sin transcripcion. Importa una arrastrando un archivo .txt/.html o pegando texto.</p></div>';
    }

    html += '</div></div></div>';
    container.innerHTML = html;
}

async function copySessionTranscript(sessionId) {
    const subject = state.selectedSubject;
    const sess = subject.sessions.find((s) => s.id === sessionId);
    if (!sess || !sess.transcript) {
        showToast("Este encuentro no tiene transcripcion");
        return;
    }
    await copyToClipboard(sess.transcript);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copiado al portapapeles");
    } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Copiado al portapapeles");
    }
}

async function saveNotes() {
    const ta = document.getElementById("notes-textarea");
    if (!ta || !state.selectedSession) return;
    await api.put(
        "/api/subjects/" + state.selectedSubject.id + "/sessions/" + state.selectedSession.id,
        { title: state.selectedSession.title, notes: ta.value, transcript: state.selectedSession.transcript }
    );
    state.selectedSession.notes = ta.value;
    showToast("Notas guardadas");
}
function renderTasksTab(container) {
    const subject = state.selectedSubject;
    if (!subject.tasks) subject.tasks = [];

    const pending = subject.tasks.filter((t) => !t.done);

    container.innerHTML = '<div class="section-header">' +
        '<h3>Tareas Pendientes</h3>' +
        '<div style="display:flex; gap:6px">' +
        '<span class="task-count-badge">Pendientes: <span>' + pending.length + '</span></span>' +
        '<button class="btn btn-primary btn-sm" onclick="showTaskModal()">+ Nueva Tarea</button>' +
        '</div></div>' +
        '<div id="tasks-list"></div>';

    renderTaskList();
}

function renderTaskList() {
    const container = document.getElementById("tasks-list");
    if (!container) return;
    const subject = state.selectedSubject;
    if (!subject.tasks) subject.tasks = [];

    const pending = subject.tasks.filter((t) => !t.done);
    const done = subject.tasks.filter((t) => t.done);

    let html = "";
    if (pending.length === 0 && done.length === 0) {
        html = '<div class="empty-state"><div class="empty-state-icon">&#9744;</div><p>No hay tareas. Anade una para hacer seguimiento.</p></div>';
    }

    if (pending.length > 0) {
        html += '<div style="margin-bottom:16px">';
        pending.forEach(function(t) {
            html += '<div class="task-item">' +
                '<input type="checkbox" class="task-checkbox" onchange="toggleTask(\'' + t.id + '\')">' +
                '<span class="task-text">' + escapeHtml(t.text) + '</span>' +
                '<span class="task-actions">' +
                '<button class="btn btn-ghost btn-sm" onclick="showTaskModal(\'' + t.id + '\')">&#9998;</button>' +
                '<button class="btn btn-danger btn-sm" onclick="deleteTask(\'' + t.id + '\')">&times;</button>' +
                '</span></div>';
        });
        html += '</div>';
    }

    if (done.length > 0) {
        html += '<details style="margin-top:16px"><summary style="cursor:pointer; font-weight:600; color:var(--text-light); font-size:0.85rem">Completadas (' + done.length + ')</summary><div style="margin-top:8px">';
        done.forEach(function(t) {
            html += '<div class="task-item done">' +
                '<input type="checkbox" class="task-checkbox" checked onchange="toggleTask(\'' + t.id + '\')">' +
                '<span class="task-text">' + escapeHtml(t.text) + '</span>' +
                '<span class="task-actions">' +
                '<button class="btn btn-danger btn-sm" onclick="deleteTask(\'' + t.id + '\')">&times;</button>' +
                '</span></div>';
        });
        html += '</div></details>';
    }

    container.innerHTML = html;
}

function showTaskModal(id) {
    const task = id ? state.selectedSubject.tasks.find((t) => t.id === id) : null;
    openModal(
        '<h3>' + (id ? "Editar" : "Nueva") + ' Tarea</h3>' +
        '<div class="form-group">' +
        '<label>Descripcion</label>' +
        '<textarea id="task-text" placeholder="Que necesitas hacer?">' + escapeHtml(task ? task.text : "") + '</textarea>' +
        '</div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="saveTask(\'' + (id || "") + '\')">' + (id ? "Guardar" : "Crear") + '</button>' +
        '</div>'
    );
    setTimeout(function() { document.getElementById("task-text").focus(); }, 100);
}

async function saveTask(id) {
    const text = document.getElementById("task-text").value.trim();
    if (!text) return;
    const subject = state.selectedSubject;
    if (!subject.tasks) subject.tasks = [];

    if (id) {
        const task = subject.tasks.find((t) => t.id === id);
        if (task) task.text = text;
    } else {
        subject.tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), text: text, done: false });
    }
    await saveDataToServer();
    closeModal();
    renderTaskList();
    renderTabs();
    showToast(id ? "Tarea actualizada" : "Tarea creada");
}

async function toggleTask(id) {
    const task = state.selectedSubject.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    await saveDataToServer();
    renderTaskList();
    renderTabs();
}

async function deleteTask(id) {
    if (!confirm("Eliminar esta tarea?")) return;
    state.selectedSubject.tasks = state.selectedSubject.tasks.filter((t) => t.id !== id);
    await saveDataToServer();
    renderTaskList();
    renderTabs();
    showToast("Tarea eliminada");
}

async function saveDataToServer() {
    const data = { subjects: state.subjects };
    await fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
}

function renderAiTab(container) {
    const subject = state.selectedSubject;
    const sessionsWithTranscript = (subject.sessions || []).filter((s) => s.transcript);

    let html = '<div class="section-header"><h3>Analisis con Inteligencia Artificial</h3></div>' +
        '<div class="card"><div class="card-body">' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px">' +
        'Selecciona una transcripcion para analizar. La IA puede generar resumenes, extraer conceptos clave y detectar temas importantes.' +
        '</p>';

    if (sessionsWithTranscript.length === 0) {
        html += '<div class="empty-state"><p>No hay transcripciones en esta materia. Importa una en la pestana Encuentros primero.</p></div>';
    } else {
        html += '<div class="form-group"><label>Seleccionar transcripcion</label><select id="ai-session-select">';
        sessionsWithTranscript.forEach(function(s) {
            html += '<option value="' + s.id + '">' + escapeHtml(s.title) + '</option>';
        });
        html += '</select></div>' +
            '<div class="form-group"><label>Tipo de analisis</label><select id="ai-analysis-type">' +
            '<option value="summary">Resumen ejecutivo</option>' +
            '<option value="keywords">Extraer conceptos clave</option>' +
            '<option value="questions">Generar preguntas de estudio</option>' +
            '<option value="flashcards">Crear tarjetas de estudio</option>' +
            '</select></div>' +
            '<button class="btn btn-primary" onclick="runAiAnalysis()">&#129302; Analizar</button>' +
            '<div id="ai-result-container"></div>';
    }

    html += '</div></div>';
    container.innerHTML = html;
}

async function runAiAnalysis() {
    const select = document.getElementById("ai-session-select");
    const type = document.getElementById("ai-analysis-type");
    if (!select || !type) return;

    const sessionId = select.value;
    const analysisType = type.value;
    const sess = state.selectedSubject.sessions.find((s) => s.id === sessionId);
    if (!sess) return;

    const resultContainer = document.getElementById("ai-result-container");
    resultContainer.innerHTML =
        '<div style="margin-top:16px; text-align:center; padding:20px">' +
        '<div class="loading-dots"><span></span><span></span><span></span></div>' +
        '<p style="font-size:0.8rem; color:var(--text-light); margin-top:8px">Analizando transcripcion...</p>' +
        '</div>';

    try {
        const res = await api.post("/api/analyze", { transcript: sess.transcript, type: analysisType });
        resultContainer.innerHTML = '<div class="ai-result">' + escapeHtml(res.result) + '</div>';
    } catch {
        resultContainer.innerHTML =
            '<div style="margin-top:16px; padding:20px; background:#fff8f5; border:1px solid #ffd4cc; border-radius:8px; text-align:center">' +
            '<p style="font-size:0.85rem; color:var(--danger); margin-bottom:8px">No se pudo conectar con el servicio de IA.</p>' +
            '<p style="font-size:0.8rem; color:var(--text-light)">Configura tu endpoint de IA en el backend.</p>' +
            '</div>';
    }
}
function renderExportTab(container) {
    const subject = state.selectedSubject;
    const sessions = subject.sessions || [];

    let html = '<div class="section-header"><h3>Exportar Contenido</h3></div>' +
        '<div class="card"><div class="card-body">' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px">Selecciona los encuentros que deseas exportar:</p>' +
        '<div style="display:flex; gap:8px; margin-bottom:16px">' +
        '<button class="btn btn-ghost btn-sm" onclick="selectAllSessions(true)">Seleccionar todos</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="selectAllSessions(false)">Deseleccionar todos</button>' +
        '</div>' +
        '<div id="export-session-list">';

    if (sessions.length === 0) {
        html += '<div class="empty-state"><p>No hay encuentros para exportar.</p></div>';
    } else {
        sessions.forEach(function(s) {
            html += '<div class="checkbox-item">' +
                '<input type="checkbox" id="export-check-' + s.id + '" value="' + s.id + '" checked>' +
                '<label for="export-check-' + s.id + '">' + escapeHtml(s.title) + '</label>' +
                '</div>';
        });

        html += '</div>' +
            '<div class="form-group" style="margin-top:16px">' +
            '<label>Formato de exportacion</label>' +
            '<select id="export-format">' +
            '<option value="json">JSON (datos completos)</option>' +
            '<option value="txt">TXT (solo transcripciones)</option>' +
            '<option value="md">Markdown (notas + transcripciones)</option>' +
            '</select></div>' +
            '<div class="modal-actions" style="justify-content:flex-start">' +
            '<button class="btn btn-primary" onclick="runExport()">&#128190; Exportar</button>' +
            '</div>';
    }

    html += '</div></div>';
    container.innerHTML = html;
}

function selectAllSessions(select) {
    document.querySelectorAll("#export-session-list input[type=checkbox]").forEach(function(cb) {
        cb.checked = select;
    });
}

function runExport() {
    const format = document.getElementById("export-format").value;
    const checked = document.querySelectorAll("#export-session-list input[type=checkbox]:checked");
    const selectedIds = Array.from(checked).map(function(cb) { return cb.value; });

    if (selectedIds.length === 0) {
        showToast("Selecciona al menos un encuentro");
        return;
    }

    const sessions = state.selectedSubject.sessions.filter(function(s) { return selectedIds.includes(s.id); });
    let content = "";
    let filename = "";
    let mime = "";

    if (format === "json") {
        content = JSON.stringify({ subject: state.selectedSubject.name, sessions: sessions }, null, 2);
        filename = state.selectedSubject.name.replace(/\s+/g, "_") + ".json";
        mime = "application/json";
    } else if (format === "txt") {
        content = sessions.map(function(s) {
            return "=== " + s.title + " ===\n\n" + (s.transcript || "(Sin transcripcion)") + "\n";
        }).join("\n---\n\n");
        filename = state.selectedSubject.name.replace(/\s+/g, "_") + ".txt";
        mime = "text/plain";
    } else if (format === "md") {
        content = "# " + state.selectedSubject.name + "\n\n";
        sessions.forEach(function(s) {
            content += "## " + s.title + "\n\n";
            if (s.notes) content += "### Notas\n" + s.notes + "\n\n";
            if (s.transcript) content += "### Transcripcion\n\n" + s.transcript + "\n\n";
            content += "---\n\n";
        });
        filename = state.selectedSubject.name.replace(/\s+/g, "_") + ".md";
        mime = "text/markdown";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exportacion descargada: " + filename);
}

function showExportModal() {
    openModal(
        '<h3>Exportar Todos los Datos</h3>' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px">Descarga todas las materias y encuentros en un solo archivo JSON.</p>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="exportAllData()">&#128190; Descargar JSON completo</button>' +
        '</div>'
    );
}

function exportAllData() {
    const blob = new Blob([JSON.stringify({ subjects: state.subjects }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gestor_universitario_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    closeModal();
    showToast("Backup descargado");
}

function showSubjectModal(id) {
    if (id) {
        const subj = state.subjects.find(function(s) { return s.id === id; });
        if (!subj) return;
        openModal(
            '<h3>Editar Materia</h3>' +
            '<div class="form-group"><label>Nombre</label><input id="modal-subject-name" value="' + escapeHtml(subj.name) + '"></div>' +
            '<div class="modal-actions">' +
            '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
            '<button class="btn btn-primary" onclick="saveSubject(\'' + id + '\')">Guardar</button>' +
            '</div>'
        );
    } else {
        openModal(
            '<h3>Nueva Materia</h3>' +
            '<div class="form-group"><label>Nombre</label><input id="modal-subject-name" placeholder="Ej: Calculo Diferencial"></div>' +
            '<div class="modal-actions">' +
            '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
            '<button class="btn btn-primary" onclick="saveSubject()">Crear</button>' +
            '</div>'
        );
    }
}

async function saveSubject(id) {
    const name = document.getElementById("modal-subject-name").value.trim();
    if (!name) return;
    if (id) {
        const updated = await api.put("/api/subjects/" + id, { name: name });
        const idx = state.subjects.findIndex(function(s) { return s.id === id; });
        if (idx !== -1) {
            updated.tasks = state.subjects[idx].tasks;
            state.subjects[idx] = updated;
        }
    } else {
        const created = await api.post("/api/subjects", { name: name });
        created.tasks = [];
        state.subjects.push(created);
    }
    closeModal();
    renderSubjects();
    if (state.selectedSubject && state.selectedSubject.id === id) {
        state.selectedSubject = state.subjects.find(function(s) { return s.id === id; });
        renderSubjectView();
    }
    showToast(id ? "Materia actualizada" : "Materia creada");
}

async function deleteSubject(id) {
    if (!confirm("Eliminar esta materia y todos sus encuentros y tareas?")) return;
    await api.del("/api/subjects/" + id);
    state.subjects = state.subjects.filter(function(s) { return s.id !== id; });
    if (state.selectedSubject && state.selectedSubject.id === id) {
        state.selectedSubject = state.subjects.length > 0 ? state.subjects[0] : null;
        state.selectedSession = null;
    }
    renderSubjects();
    renderSubjectView();
    showToast("Materia eliminada");
}

function showSessionModal(id) {
    if (id) {
        const sess = state.selectedSubject.sessions.find(function(s) { return s.id === id; });
        if (!sess) return;
        openModal(
            '<h3>Editar Encuentro</h3>' +
            '<div class="form-group"><label>Titulo</label><input id="modal-session-title" value="' + escapeHtml(sess.title) + '"></div>' +
            '<div class="modal-actions">' +
            '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
            '<button class="btn btn-primary" onclick="saveSession(\'' + id + '\')">Guardar</button>' +
            '</div>'
        );
    } else {
        openModal(
            '<h3>Nuevo Encuentro</h3>' +
            '<div class="form-group"><label>Titulo</label><input id="modal-session-title" placeholder="Ej: Clase 1 - Introduccion"></div>' +
            '<div class="modal-actions">' +
            '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
            '<button class="btn btn-primary" onclick="saveSession()">Crear</button>' +
            '</div>'
        );
    }
}

async function saveSession(id) {
    const title = document.getElementById("modal-session-title").value.trim();
    if (!title) return;
    const subjId = state.selectedSubject.id;
    if (id) {
        const sess = state.selectedSubject.sessions.find(function(s) { return s.id === id; });
        const updated = await api.put("/api/subjects/" + subjId + "/sessions/" + id, {
            title: title,
            notes: sess.notes,
            transcript: sess.transcript,
        });
        const idx = state.selectedSubject.sessions.findIndex(function(s) { return s.id === id; });
        if (idx !== -1) state.selectedSubject.sessions[idx] = updated;
        if (state.selectedSession && state.selectedSession.id === id) state.selectedSession = updated;
    } else {
        const created = await api.post("/api/subjects/" + subjId + "/sessions", {
            title: title,
            notes: "",
            transcript: "",
        });
        state.selectedSubject.sessions.push(created);
        state.selectedSession = created;
    }
    closeModal();
    renderSubjectView();
    showToast(id ? "Encuentro actualizado" : "Encuentro creado");
}

async function deleteSession(id) {
    if (!confirm("Eliminar este encuentro?")) return;
    await api.del("/api/subjects/" + state.selectedSubject.id + "/sessions/" + id);
    state.selectedSubject.sessions = state.selectedSubject.sessions.filter(function(s) { return s.id !== id; });
    if (state.selectedSession && state.selectedSession.id === id) {
        state.selectedSession = null;
    }
    renderSubjectView();
    showToast("Encuentro eliminado");
}
function showSessionImportModal() {
    if (!state.selectedSession) return;
    const sessionTitle = escapeHtml(state.selectedSubject.name + " / " + state.selectedSession.title);
    openModal(
        '<h3>Importar Transcripcion</h3>' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px">Destino: <strong>' + sessionTitle + '</strong></p>' +
        '<div class="import-tabs">' +
        '<button class="import-tab active" onclick="switchImportTab(\'file\', this)">Archivo</button>' +
        '<button class="import-tab" onclick="switchImportTab(\'paste\', this)">Pegar Texto</button>' +
        '</div>' +
        '<div id="import-file-tab">' +
        '<label class="file-drop-area" id="file-drop-area">' +
        '<input type="file" id="import-file-input" accept=".txt,.html" style="display:none" onchange="handleFileSelect(event)">' +
        '<p>Arrastra un archivo .txt o .html aqui<br>o haz clic para seleccionar</p>' +
        '</label>' +
        '<div id="import-file-preview" class="hidden"><p id="import-file-name" style="font-size:0.85rem; margin-bottom:8px"></p></div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="importFile()">Limpiar y Previsualizar</button>' +
        '</div></div>' +
        '<div id="import-paste-tab" class="hidden">' +
        '<textarea id="import-paste-text" placeholder="Pega aqui el texto o HTML de la transcripcion..." style="min-height:200px"></textarea>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="importPasted()">Limpiar y Previsualizar</button>' +
        '</div></div>' +
        '<div id="import-result" class="hidden" style="margin-top:16px">' +
        '<div class="section-label">Vista previa del texto limpio</div>' +
        '<textarea id="import-result-text" style="min-height:200px; width:100%; border:1px solid var(--border); border-radius:8px; padding:12px; font-family:inherit; font-size:0.85rem; resize:vertical" readonly></textarea>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="copyImportResult()">&#128203; Copiar</button>' +
        '<button class="btn btn-primary" onclick="saveImportToSession()">Guardar en este encuentro</button>' +
        '</div></div>'
    );
    initFileDrop();
}

let importedFile = null;

function initFileDrop() {
    const area = document.getElementById("file-drop-area");
    if (!area) return;
    const enter = function(e) { e.preventDefault(); area.classList.add("dragover"); };
    const leave = function(e) { e.preventDefault(); area.classList.remove("dragover"); };
    area.addEventListener("dragenter", enter);
    area.addEventListener("dragover", enter);
    area.addEventListener("dragleave", leave);
    area.addEventListener("drop", function(e) {
        e.preventDefault();
        area.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file) setFile(file);
    });
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) setFile(file);
}

function setFile(file) {
    importedFile = file;
    const preview = document.getElementById("import-file-preview");
    const name = document.getElementById("import-file-name");
    if (preview && name) {
        preview.classList.remove("hidden");
        name.textContent = "Archivo: " + file.name + " (" + (file.size / 1024).toFixed(1) + " KB)";
    }
}

async function importFile() {
    if (!importedFile) return;
    const formData = new FormData();
    formData.append("file", importedFile);
    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();
    showImportResult(data.cleaned);
}

async function importPasted() {
    const text = document.getElementById("import-paste-text").value;
    if (!text.trim()) return;
    const data = await api.post("/api/import", { text: text });
    showImportResult(data.cleaned);
}

function showImportResult(cleaned) {
    document.getElementById("import-file-tab").classList.add("hidden");
    document.getElementById("import-paste-tab").classList.add("hidden");
    document.querySelector(".import-tabs").classList.add("hidden");
    const result = document.getElementById("import-result");
    result.classList.remove("hidden");
    document.getElementById("import-result-text").value = cleaned;
}

async function saveImportToSession() {
    const cleaned = document.getElementById("import-result-text").value;
    await api.put(
        "/api/subjects/" + state.selectedSubject.id + "/sessions/" + state.selectedSession.id,
        { title: state.selectedSession.title, notes: state.selectedSession.notes, transcript: cleaned }
    );
    state.selectedSession.transcript = cleaned;
    closeModal();
    renderSubjectView();
    showToast("Transcripcion guardada en el encuentro");
}

function copyImportResult() {
    const ta = document.getElementById("import-result-text");
    ta.select();
    document.execCommand("copy");
    showToast("Texto copiado al portapapeles");
}

function switchImportTab(tab, btn) {
    document.querySelectorAll(".import-tab").forEach(function(t) { t.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("import-file-tab").classList.toggle("hidden", tab !== "file");
    document.getElementById("import-paste-tab").classList.toggle("hidden", tab !== "paste");
    document.getElementById("import-result").classList.add("hidden");
    document.querySelector(".import-tabs").classList.remove("hidden");
    importedFile = null;
}

loadData();
