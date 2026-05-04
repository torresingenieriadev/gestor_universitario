const STORAGE_KEY = "gestor_universitario_data";

const state = {
    subjects: [],
    selectedSubject: null,
    selectedSession: null,
    activeTab: "sessions",
};

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const data = JSON.parse(stored);
            state.subjects = data.subjects || [];
        } catch {
            state.subjects = [];
        }
    }
    renderSubjects();
    if (state.subjects.length > 0 && !state.selectedSubject) {
        selectSubject(state.subjects[0].id);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ subjects: state.subjects }));
}

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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

function renderSubjects() {
    const list = document.getElementById("subject-list");
    list.innerHTML = state.subjects
        .map(function (s) {
            const sessionLabel = s.sessions.length + " " + pluralize(s.sessions.length, "encuentro", "encuentros");
            const isActive = state.selectedSubject && state.selectedSubject.id === s.id;
            return '<li class="' + (isActive ? "active" : "") + '" onclick="selectSubject(\'' + s.id + '\')">' +
                '<span class="subject-name">' + escapeHtml(s.name) + '</span>' +
                '<span class="subject-meta">' + sessionLabel + '</span>' +
                '<span class="subject-actions" onclick="event.stopPropagation()">' +
                '<button class="btn btn-ghost" onclick="showSubjectModal(\'' + s.id + '\')" title="Editar">&#9998;</button>' +
                '<button class="btn btn-danger" onclick="deleteSubject(\'' + s.id + '\')" title="Eliminar">&times;</button>' +
                '</span></li>';
        }).join("");
}

function selectSubject(id) {
    state.selectedSubject = state.subjects.find(function (s) { return s.id === id; }) || null;
    state.selectedSession = null;
    state.activeTab = "sessions";
    renderSubjects();
    renderSubjectView();
    updateMobileTitle();
    if (window.innerWidth <= 768) toggleSidebar();
}

function backToSubject() {
    state.selectedSession = null;
    renderSubjectView();
}

function selectSession(sessionId) {
    state.selectedSession = state.selectedSubject.sessions.find(function (s) { return s.id === sessionId; });
    renderSubjectView();
}

function renderSubjectView() {
    var welcome = document.getElementById("welcome-state");
    var view = document.getElementById("subject-view");
    if (!state.selectedSubject) {
        welcome.classList.remove("hidden");
        view.classList.add("hidden");
        return;
    }
    welcome.classList.add("hidden");
    view.classList.remove("hidden");

    var subject = state.selectedSubject;
    document.getElementById("subject-view-header").innerHTML =
        "<h1><span>&#128218;</span> <span>" + escapeHtml(subject.name) + "</span>" +
        "<span style=\"margin-left:auto; display:flex; gap:6px;\">" +
        "<button class=\"btn btn-ghost btn-sm\" onclick=\"showSubjectModal('" + subject.id + "')\">&#9998; Renombrar</button>" +
        "<button class=\"btn btn-danger btn-sm\" onclick=\"deleteSubject('" + subject.id + "\")\">&times; Eliminar</button>" +
        "</span></h1>";

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
    document.querySelectorAll(".tab").forEach(function (t) {
        t.classList.toggle("active", t.dataset.tab === state.activeTab);
    });
    var pendingTasks = countPendingTasks();
    var badge = document.getElementById("tasks-badge");
    if (pendingTasks > 0) {
        badge.classList.remove("hidden");
        badge.textContent = pendingTasks;
    } else {
        badge.classList.add("hidden");
    }
}

function countPendingTasks() {
    if (!state.selectedSubject) return 0;
    return (state.selectedSubject.tasks || []).filter(function (t) { return !t.done; }).length;
}

function renderActiveTab() {
    var container = document.getElementById("tab-content");
    switch (state.activeTab) {
        case "sessions": renderSessionsTab(container); break;
        case "tasks": renderTasksTab(container); break;
        case "ai": renderAiTab(container); break;
        case "export": renderExportTab(container); break;
    }
}

function getSessionPreview(sess) {
    if (sess.notes) return escapeHtml(sess.notes.substring(0, 120) + (sess.notes.length > 120 ? "..." : ""));
    if (sess.transcript) return "Contiene transcripcion";
    return "Sin contenido aun";
}

function renderSessionsTab(container) {
    var subject = state.selectedSubject;
    if (state.selectedSession) { renderSessionDetailView(container); return; }

    var sessions = subject.sessions || [];
    var html = '<div class="section-header"><h3>Encuentros (' + sessions.length + ')</h3>' +
        '<button class="btn btn-primary btn-sm" onclick="showSessionModal()">+ Nuevo Encuentro</button></div>';

    if (sessions.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">&#128214;</div><p>No hay encuentros. Crea uno para empezar.</p></div>';
    } else {
        html += '<div class="session-list">';
        sessions.forEach(function (sess) {
            html += '<div class="card session-card" onclick="selectSession(\'' + sess.id + '\')">' +
                '<div class="session-card-header"><h3>' + escapeHtml(sess.title) + '</h3>' +
                '<div class="session-card-actions" onclick="event.stopPropagation()">' +
                '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showSessionModal(\'' + sess.id + '\')" title="Editar">&#9998;</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); copySessionTranscript(\'' + sess.id + '\')" title="Copiar">&#128203;</button>' +
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
    var sess = state.selectedSession;
    var html = '<div style="max-width:800px; margin:0 auto;">' +
        '<button class="btn btn-ghost btn-sm" onclick="backToSubject()" style="margin-bottom:16px">&larr; Volver a encuentros</button>' +
        '<div class="session-detail-header"><h2>' + escapeHtml(sess.title) + '</h2>' +
        '<div style="display:flex; gap:6px; margin-left:auto">' +
        '<button class="btn btn-ghost btn-sm" onclick="showSessionModal(\'' + sess.id + '\')">&#9998; Editar</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="copySessionTranscript(\'' + sess.id + '\')">&#128203; Copiar</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteSession(\'' + sess.id + '\')">&times; Eliminar</button>' +
        '</div></div>' +
        '<div class="card" style="margin-bottom:16px"><div class="card-header">' +
        '<h3>Notas Rapidas</h3><button class="btn btn-ghost btn-sm" onclick="saveNotes()">&#128190; Guardar</button></div>' +
        '<div class="card-body"><textarea class="notes-textarea" id="notes-textarea" placeholder="Escribe tus notas aqui...">' + escapeHtml(sess.notes || "") + '</textarea></div></div>' +
        '<div class="card"><div class="card-header"><h3>Transcripcion</h3><div style="display:flex; gap:6px">' +
        (sess.transcript ? '<button class="btn btn-ghost btn-sm" onclick="copySessionTranscript(\'' + sess.id + '\')">&#128203; Copiar</button>' : '') +
        '<button class="btn btn-primary btn-sm" onclick="showSessionImportModal()">' + (sess.transcript ? "Reemplazar" : "Importar") + '</button>' +
        '</div></div><div class="card-body">' +
        (sess.transcript ? '<div class="transcript-view">' + escapeHtml(sess.transcript) + '</div>' : '<div class="empty-state"><p>Sin transcripcion. Importa una.</p></div>') +
        '</div></div></div>';
    container.innerHTML = html;
}

async function copySessionTranscript(sessionId) {
    var sess = state.selectedSubject.sessions.find(function (s) { return s.id === sessionId; });
    if (!sess || !sess.transcript) { showToast("Sin transcripcion"); return; }
    try {
        await navigator.clipboard.writeText(sess.transcript);
        showToast("Copiado al portapapeles");
    } catch {
        var ta = document.createElement("textarea");
        ta.value = sess.transcript;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Copiado al portapapeles");
    }
}

function saveNotes() {
    var ta = document.getElementById("notes-textarea");
    if (!ta || !state.selectedSession) return;
    state.selectedSession.notes = ta.value;
    saveData();
    showToast("Notas guardadas");
}

function renderTasksTab(container) {
    var subject = state.selectedSubject;
    if (!subject.tasks) subject.tasks = [];
    var pending = subject.tasks.filter(function (t) { return !t.done; });
    container.innerHTML = '<div class="section-header"><h3>Tareas Pendientes</h3>' +
        '<div style="display:flex; gap:6px"><span class="task-count-badge">Pendientes: <span>' + pending.length + '</span></span>' +
        '<button class="btn btn-primary btn-sm" onclick="showTaskModal()">+ Nueva Tarea</button></div></div>' +
        '<div id="tasks-list"></div>';
    renderTaskList();
}

function renderTaskList() {
    var container = document.getElementById("tasks-list");
    if (!container) return;
    var subject = state.selectedSubject;
    if (!subject.tasks) subject.tasks = [];
    var pending = subject.tasks.filter(function (t) { return !t.done; });
    var done = subject.tasks.filter(function (t) { return t.done; });
    var html = "";
    if (pending.length === 0 && done.length === 0) {
        html = '<div class="empty-state"><div class="empty-state-icon">&#9744;</div><p>No hay tareas.</p></div>';
    }
    if (pending.length > 0) {
        html += '<div style="margin-bottom:16px">';
        pending.forEach(function (t) {
            html += '<div class="task-item"><input type="checkbox" class="task-checkbox" onchange="toggleTask(\'' + t.id + '\')">' +
                '<span class="task-text">' + escapeHtml(t.text) + '</span>' +
                '<span class="task-actions"><button class="btn btn-ghost btn-sm" onclick="showTaskModal(\'' + t.id + '\')">&#9998;</button>' +
                '<button class="btn btn-danger btn-sm" onclick="deleteTask(\'' + t.id + '\')">&times;</button></span></div>';
        });
        html += '</div>';
    }
    if (done.length > 0) {
        html += '<details style="margin-top:16px"><summary style="cursor:pointer; font-weight:600; color:var(--text-light); font-size:0.85rem">Completadas (' + done.length + ')</summary><div style="margin-top:8px">';
        done.forEach(function (t) {
            html += '<div class="task-item done"><input type="checkbox" class="task-checkbox" checked onchange="toggleTask(\'' + t.id + '\')">' +
                '<span class="task-text">' + escapeHtml(t.text) + '</span>' +
                '<span class="task-actions"><button class="btn btn-danger btn-sm" onclick="deleteTask(\'' + t.id + '\')">&times;</button></span></div>';
        });
        html += '</div></details>';
    }
    container.innerHTML = html;
}

function showTaskModal(id) {
    var task = id ? state.selectedSubject.tasks.find(function (t) { return t.id === id; }) : null;
    openModal(
        '<h3>' + (id ? "Editar" : "Nueva") + ' Tarea</h3>' +
        '<div class="form-group"><label>Descripcion</label>' +
        '<textarea id="task-text" placeholder="Que necesitas hacer?">' + escapeHtml(task ? task.text : "") + '</textarea></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="saveTask(\'' + (id || "") + '\')">' + (id ? "Guardar" : "Crear") + '</button></div>'
    );
}

function saveTask(id) {
    var text = document.getElementById("task-text").value.trim();
    if (!text) return;
    var subject = state.selectedSubject;
    if (!subject.tasks) subject.tasks = [];
    if (id) {
        var task = subject.tasks.find(function (t) { return t.id === id; });
        if (task) task.text = text;
    } else {
        subject.tasks.push({ id: generateId(), text: text, done: false });
    }
    saveData();
    closeModal();
    renderTaskList();
    renderTabs();
    showToast(id ? "Tarea actualizada" : "Tarea creada");
}

function toggleTask(id) {
    var task = state.selectedSubject.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.done = !task.done;
    saveData();
    renderTaskList();
    renderTabs();
}

function deleteTask(id) {
    if (!confirm("Eliminar esta tarea?")) return;
    state.selectedSubject.tasks = state.selectedSubject.tasks.filter(function (t) { return t.id !== id; });
    saveData();
    renderTaskList();
    renderTabs();
    showToast("Tarea eliminada");
}

function renderAiTab(container) {
    var subject = state.selectedSubject;
    var sessionsWithTranscript = (subject.sessions || []).filter(function (s) { return s.transcript; });
    var html = '<div class="section-header"><h3>Analisis con Inteligencia Artificial</h3></div>' +
        '<div class="card"><div class="card-body">' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px">Selecciona una transcripcion y tipo de analisis. Puedes editar el texto antes de analizar.</p>';
    if (sessionsWithTranscript.length === 0) {
        html += '<div class="empty-state"><p>No hay transcripciones. Importa una en Encuentros.</p></div>';
    } else {
        html += '<div class="form-group"><label>Transcripcion</label><select id="ai-session-select" onchange="updateAiPreview()">';
        sessionsWithTranscript.forEach(function (s) {
            html += '<option value="' + s.id + '">' + escapeHtml(s.title) + '</option>';
        });
        html += '</select></div>' +
            '<div id="ai-transcript-preview-container" style="margin-bottom:16px">' +
            '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px">' +
            '<span style="font-size:0.8rem; font-weight:600; color:var(--text-light)">Vista previa de la transcripcion</span>' +
            '<button class="btn btn-ghost btn-sm" id="ai-edit-toggle" onclick="toggleAiEdit()">&#9998; Editar</button></div>' +
            '<textarea id="ai-transcript-preview" readonly style="width:100%; min-height:120px; max-height:200px; border:1px solid var(--border); border-radius:8px; padding:12px; font-family:inherit; font-size:0.82rem; resize:vertical; background:var(--bg-secondary); color:var(--text-primary)"></textarea></div>' +
            '<div class="form-group"><label>Tipo de analisis</label><select id="ai-analysis-type">' +
            '<option value="summary">Resumen academico</option>' +
            '<option value="keywords">Conceptos clave</option>' +
            '<option value="questions">Preguntas de estudio</option>' +
            '<option value="flashcards">Tarjetas de estudio</option>' +
            '</select></div>' +
            '<button class="btn btn-primary" onclick="runAiAnalysis()">&#129302; Analizar</button>' +
            '<div id="ai-result-container"></div>';
    }
    html += '</div></div>';
    container.innerHTML = html;
    updateAiPreview();
}

function updateAiPreview() {
    var select = document.getElementById("ai-session-select");
    var preview = document.getElementById("ai-transcript-preview");
    if (!select || !preview) return;
    var sessionId = select.value;
    var sess = state.selectedSubject.sessions.find(function (s) { return s.id === sessionId; });
    if (sess) preview.value = sess.transcript || "";
}

var aiEditMode = false;

function toggleAiEdit() {
    aiEditMode = !aiEditMode;
    var preview = document.getElementById("ai-transcript-preview");
    var btn = document.getElementById("ai-edit-toggle");
    if (preview) preview.readOnly = !aiEditMode;
    if (btn) {
        btn.innerHTML = aiEditMode ? "&#128190; Bloquear" : "&#9998; Editar";
        btn.style.color = aiEditMode ? "var(--accent)" : "";
    }
    if (preview) preview.style.background = aiEditMode ? "var(--bg-primary)" : "var(--bg-secondary)";
}

async function runAiAnalysis() {
    var select = document.getElementById("ai-session-select");
    var type = document.getElementById("ai-analysis-type");
    var preview = document.getElementById("ai-transcript-preview");
    if (!select || !type) return;
    var sessionId = select.value;
    var analysisType = type.value;
    var sessionTranscript = preview ? preview.value.trim() : "";
    if (!sessionTranscript) {
        showToast("Sin transcripcion para analizar");
        return;
    }
    var resultContainer = document.getElementById("ai-result-container");
    resultContainer.innerHTML = '<div style="margin-top:16px; text-align:center; padding:20px">' +
        '<div class="loading-dots"><span></span><span></span><span></span></div>' +
        '<p style="font-size:0.8rem; color:var(--text-light); margin-top:8px">Analizando transcripcion...</p></div>';
    try {
        var res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: sessionTranscript, type: analysisType })
        });
        var data = await res.json();
        resultContainer.innerHTML = '<div class="ai-result">' + escapeHtml(data.result) + '</div>';
    } catch {
        resultContainer.innerHTML = '<div style="margin-top:16px; padding:20px; background:#fff8f5; border:1px solid #ffd4cc; border-radius:8px; text-align:center">' +
            '<p style="color:var(--danger); margin-bottom:8px">Error de conexion con el servidor.</p></div>';
    }
}

function renderExportTab(container) {
    var subject = state.selectedSubject;
    var sessions = subject.sessions || [];
    var html = '<div class="section-header"><h3>Exportar Contenido</h3></div><div class="card"><div class="card-body">' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px">Selecciona encuentros y formato:</p>' +
        '<div style="display:flex; gap:8px; margin-bottom:16px">' +
        '<button class="btn btn-ghost btn-sm" onclick="selectAllSessions(true)">Seleccionar todos</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="selectAllSessions(false)">Deseleccionar</button></div>';
    if (sessions.length === 0) {
        html += '<div class="empty-state"><p>No hay encuentros.</p></div>';
    } else {
        html += '<div id="export-session-list">';
        sessions.forEach(function (s) {
            html += '<div class="checkbox-item"><input type="checkbox" id="export-check-' + s.id + '" value="' + s.id + '" checked>' +
                '<label for="export-check-' + s.id + '">' + escapeHtml(s.title) + '</label></div>';
        });
        html += '</div><div class="form-group" style="margin-top:16px"><label>Formato</label>' +
            '<select id="export-format"><option value="json">JSON</option><option value="txt">TXT</option><option value="md">Markdown</option></select></div>' +
            '<div class="modal-actions" style="justify-content:flex-start"><button class="btn btn-primary" onclick="runExport()">&#128190; Exportar</button></div>';
    }
    html += '</div></div>';
    container.innerHTML = html;
}

function selectAllSessions(select) {
    document.querySelectorAll("#export-session-list input[type=checkbox]").forEach(function (cb) { cb.checked = select; });
}

function runExport() {
    var format = document.getElementById("export-format").value;
    var checked = document.querySelectorAll("#export-session-list input[type=checkbox]:checked");
    var selectedIds = Array.from(checked).map(function (cb) { return cb.value; });
    if (selectedIds.length === 0) { showToast("Selecciona al menos un encuentro"); return; }
    var sessions = state.selectedSubject.sessions.filter(function (s) { return selectedIds.includes(s.id); });
    var content, filename, mime;
    if (format === "json") {
        content = JSON.stringify({ subject: state.selectedSubject.name, sessions: sessions }, null, 2);
        filename = state.selectedSubject.name.replace(/\s+/g, "_") + ".json";
        mime = "application/json";
    } else if (format === "txt") {
        content = sessions.map(function (s) { return "=== " + s.title + " ===\n\n" + (s.transcript || "(Sin transcripcion)") + "\n"; }).join("\n---\n\n");
        filename = state.selectedSubject.name.replace(/\s+/g, "_") + ".txt";
        mime = "text/plain";
    } else {
        content = "# " + state.selectedSubject.name + "\n\n";
        sessions.forEach(function (s) { content += "## " + s.title + "\n\n"; if (s.notes) content += "### Notas\n" + s.notes + "\n\n"; if (s.transcript) content += "### Transcripcion\n\n" + s.transcript + "\n\n"; content += "---\n\n"; });
        filename = state.selectedSubject.name.replace(/\s+/g, "_") + ".md";
        mime = "text/markdown";
    }
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast("Exportacion descargada: " + filename);
}

function showExportModal() {
    openModal(
        '<h3>Exportar Todos los Datos</h3>' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px">Descarga todas las materias en JSON.</p>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="exportAllData()">&#128190; Descargar JSON completo</button></div>'
    );
}

function exportAllData() {
    var blob = new Blob([JSON.stringify({ subjects: state.subjects }, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "gestor_universitario_backup.json"; a.click();
    URL.revokeObjectURL(url);
    closeModal();
    showToast("Backup descargado");
}

function showBackupRestoreModal() {
    openModal(
        '<h3>Restaurar Backup</h3>' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px">Selecciona un archivo JSON exportado previamente.</p>' +
        '<label class="file-drop-area" style="cursor:pointer">' +
        '<input type="file" id="backup-file-input" accept=".json" style="display:none" onchange="handleBackupFile(event)">' +
        '<p>&#128194; Arrastra o selecciona un archivo .json de backup</p></label>' +
        '<div id="backup-preview" class="hidden" style="margin-top:12px; padding:12px; background:#f8f9fb; border-radius:8px; font-size:0.85rem"></div>' +
        '<div class="modal-actions" style="margin-top:16px">' +
        '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" id="restore-btn" onclick="restoreBackup()" disabled>Restaurar</button></div>'
    );
}

var backupData = null;

function handleBackupFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
        try {
            var data = JSON.parse(ev.target.result);
            if (!data.subjects) {
                document.getElementById("backup-preview").innerHTML = '<span style="color:var(--danger)">Archivo invalido.</span>';
                return;
            }
            backupData = data;
            var sc = data.subjects.reduce(function (sum, s) { return sum + (s.sessions ? s.sessions.length : 0); }, 0);
            document.getElementById("backup-preview").innerHTML = '<strong>' + data.subjects.length + ' materias</strong> y <strong>' + sc + ' encuentros</strong>.<br><span style="color:var(--text-light)">' + file.name + '</span>';
            document.getElementById("backup-preview").classList.remove("hidden");
            document.getElementById("restore-btn").disabled = false;
        } catch {
            document.getElementById("backup-preview").innerHTML = '<span style="color:var(--danger)">JSON invalido.</span>';
            document.getElementById("backup-preview").classList.remove("hidden");
        }
    };
    reader.readAsText(file);
}

function restoreBackup() {
    if (!backupData) return;
    state.subjects = backupData.subjects;
    state.subjects.forEach(function (s) { s.tasks = s.tasks || []; s.sessions.forEach(function (sess) { sess.notes = sess.notes || ""; sess.transcript = sess.transcript || ""; }); });
    state.selectedSubject = null;
    state.selectedSession = null;
    saveData();
    renderSubjects();
    renderSubjectView();
    closeModal();
    showToast("Backup restaurado: " + state.subjects.length + " materias");
}

function showSubjectModal(id) {
    if (id) {
        var subj = state.subjects.find(function (s) { return s.id === id; });
        if (!subj) return;
        openModal('<h3>Editar Materia</h3><div class="form-group"><label>Nombre</label><input id="modal-subject-name" value="' + escapeHtml(subj.name) + '"></div>' +
            '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveSubject(\'' + id + '\')">Guardar</button></div>');
    } else {
        openModal('<h3>Nueva Materia</h3><div class="form-group"><label>Nombre</label><input id="modal-subject-name" placeholder="Ej: Calculo Diferencial"></div>' +
            '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveSubject()">Crear</button></div>');
    }
}

function saveSubject(id) {
    var name = document.getElementById("modal-subject-name").value.trim();
    if (!name) return;
    if (id) {
        var subj = state.subjects.find(function (s) { return s.id === id; });
        if (subj) subj.name = name;
    } else {
        state.subjects.push({ id: generateId(), name: name, sessions: [], tasks: [] });
    }
    saveData();
    closeModal();
    renderSubjects();
    if (state.selectedSubject && state.selectedSubject.id === id) {
        state.selectedSubject = state.subjects.find(function (s) { return s.id === id; });
        renderSubjectView();
    }
    showToast(id ? "Materia actualizada" : "Materia creada");
}

function deleteSubject(id) {
    if (!confirm("Eliminar esta materia y todos sus datos?")) return;
    state.subjects = state.subjects.filter(function (s) { return s.id !== id; });
    if (state.selectedSubject && state.selectedSubject.id === id) {
        state.selectedSubject = state.subjects.length > 0 ? state.subjects[0] : null;
        state.selectedSession = null;
    }
    saveData();
    renderSubjects();
    renderSubjectView();
    showToast("Materia eliminada");
}

function showSessionModal(id) {
    if (id) {
        var sess = state.selectedSubject.sessions.find(function (s) { return s.id === id; });
        if (!sess) return;
        openModal('<h3>Editar Encuentro</h3><div class="form-group"><label>Titulo</label><input id="modal-session-title" value="' + escapeHtml(sess.title) + '"></div>' +
            '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveSession(\'' + id + '\')">Guardar</button></div>');
    } else {
        openModal('<h3>Nuevo Encuentro</h3><div class="form-group"><label>Titulo</label><input id="modal-session-title" placeholder="Ej: Clase 1 - Introduccion"></div>' +
            '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveSession()">Crear</button></div>');
    }
}

function saveSession(id) {
    var title = document.getElementById("modal-session-title").value.trim();
    if (!title) return;
    if (id) {
        var sess = state.selectedSubject.sessions.find(function (s) { return s.id === id; });
        if (sess) sess.title = title;
        if (state.selectedSession && state.selectedSession.id === id) state.selectedSession.title = title;
    } else {
        var created = { id: generateId(), title: title, notes: "", transcript: "" };
        state.selectedSubject.sessions.push(created);
        state.selectedSession = created;
    }
    saveData();
    closeModal();
    renderSubjectView();
    showToast(id ? "Encuentro actualizado" : "Encuentro creado");
}

function deleteSession(id) {
    if (!confirm("Eliminar este encuentro?")) return;
    state.selectedSubject.sessions = state.selectedSubject.sessions.filter(function (s) { return s.id !== id; });
    if (state.selectedSession && state.selectedSession.id === id) state.selectedSession = null;
    saveData();
    renderSubjectView();
    showToast("Encuentro eliminado");
}

function showSessionImportModal() {
    if (!state.selectedSession) return;
    var sessionTitle = escapeHtml(state.selectedSubject.name + " / " + state.selectedSession.title);
    openModal(
        '<h3>Importar Transcripcion</h3>' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px">Destino: <strong>' + sessionTitle + '</strong></p>' +
        '<div class="import-tabs"><button class="import-tab active" onclick="switchImportTab(\'file\', this)">Archivo</button>' +
        '<button class="import-tab" onclick="switchImportTab(\'paste\', this)">Pegar Texto</button></div>' +
        '<div id="import-file-tab"><label class="file-drop-area" id="file-drop-area">' +
        '<input type="file" id="import-file-input" accept=".txt,.html" style="display:none" onchange="handleFileSelect(event)">' +
        '<p>Arrastra un archivo .txt o .html aqui<br>o haz clic para seleccionar</p></label>' +
        '<div id="import-file-preview" class="hidden"><p id="import-file-name" style="font-size:0.85rem; margin-bottom:8px"></p></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="importFile()">Limpiar y Previsualizar</button></div></div>' +
        '<div id="import-paste-tab" class="hidden">' +
        '<textarea id="import-paste-text" placeholder="Pega aqui el texto o HTML..." style="min-height:200px"></textarea>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="importPasted()">Limpiar y Previsualizar</button></div></div>' +
        '<div id="import-result" class="hidden" style="margin-top:16px">' +
        '<div class="section-label">Vista previa del texto limpio</div>' +
        '<textarea id="import-result-text" style="min-height:200px; width:100%; border:1px solid var(--border); border-radius:8px; padding:12px; font-family:inherit; font-size:0.85rem; resize:vertical" readonly></textarea>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="copyImportResult()">&#128203; Copiar</button>' +
        '<button class="btn btn-primary" onclick="saveImportToSession()">Guardar en este encuentro</button></div></div>'
    );
    initFileDrop();
}

var importedFile = null;

function initFileDrop() {
    var area = document.getElementById("file-drop-area");
    if (!area) return;
    area.addEventListener("dragenter", function (e) { e.preventDefault(); area.classList.add("dragover"); });
    area.addEventListener("dragover", function (e) { e.preventDefault(); area.classList.add("dragover"); });
    area.addEventListener("dragleave", function (e) { e.preventDefault(); area.classList.remove("dragover"); });
    area.addEventListener("drop", function (e) { e.preventDefault(); area.classList.remove("dragover"); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
}

function handleFileSelect(e) { if (e.target.files[0]) setFile(e.target.files[0]); }

function setFile(file) {
    importedFile = file;
    var preview = document.getElementById("import-file-preview");
    var name = document.getElementById("import-file-name");
    if (preview && name) { preview.classList.remove("hidden"); name.textContent = "Archivo: " + file.name + " (" + (file.size / 1024).toFixed(1) + " KB)"; }
}

async function importFile() {
    if (!importedFile) return;
    var formData = new FormData();
    formData.append("file", importedFile);
    var res = await fetch("/api/import", { method: "POST", body: formData });
    var data = await res.json();
    showImportResult(data.cleaned);
}

async function importPasted() {
    var text = document.getElementById("import-paste-text").value;
    if (!text.trim()) return;
    var res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text }) });
    var data = await res.json();
    showImportResult(data.cleaned);
}

function showImportResult(cleaned) {
    document.getElementById("import-file-tab").classList.add("hidden");
    document.getElementById("import-paste-tab").classList.add("hidden");
    document.querySelector(".import-tabs").classList.add("hidden");
    document.getElementById("import-result").classList.remove("hidden");
    document.getElementById("import-result-text").value = cleaned;
}

async function saveImportToSession() {
    var cleaned = document.getElementById("import-result-text").value;
    state.selectedSession.transcript = cleaned;
    saveData();
    closeModal();
    renderSubjectView();
    showToast("Transcripcion guardada");
}

function copyImportResult() {
    var ta = document.getElementById("import-result-text");
    ta.select();
    document.execCommand("copy");
    showToast("Copiado al portapapeles");
}

function switchImportTab(tab, btn) {
    document.querySelectorAll(".import-tab").forEach(function (t) { t.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("import-file-tab").classList.toggle("hidden", tab !== "file");
    document.getElementById("import-paste-tab").classList.toggle("hidden", tab !== "paste");
    document.getElementById("import-result").classList.add("hidden");
    document.querySelector(".import-tabs").classList.remove("hidden");
    importedFile = null;
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebar-overlay").classList.toggle("active");
}

function updateMobileTitle() {
    var title = document.getElementById("mobile-title");
    if (title) {
        title.textContent = state.selectedSubject ? state.selectedSubject.name : "Gestor Universitario";
    }
}

var CLOUD_BIN_ID = localStorage.getItem("gestor_cloud_bin") || "";
var CLOUD_API_KEY = "29d69a6148594daeb37151";

async function cloudSave() {
    if (!CLOUD_API_KEY) { showToast("Configura tu API key de JSONBin.io"); return; }
    var url = CLOUD_BIN_ID
        ? "https://api.jsonbin.io/v3/b/" + CLOUD_BIN_ID
        : "https://api.jsonbin.io/v3/b";
    var method = CLOUD_BIN_ID ? "PUT" : "POST";
    try {
        var res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": "$2a$10$" + CLOUD_API_KEY,
                "X-Bin-Name": "gestor-universitario",
                "X-Bin-Private": "false",
            },
            body: JSON.stringify({ subjects: state.subjects }),
        });
        var data = await res.json();
        if (!CLOUD_BIN_ID && data.metadata && data.metadata.id) {
            CLOUD_BIN_ID = data.metadata.id;
            localStorage.setItem("gestor_cloud_bin", CLOUD_BIN_ID);
        }
        showToast("Datos sincronizados a la nube");
    } catch (e) {
        showToast("Error al sincronizar: " + e.message);
    }
}

async function cloudLoad() {
    if (!CLOUD_BIN_ID || !CLOUD_API_KEY) return false;
    try {
        var res = await fetch("https://api.jsonbin.io/v3/b/" + CLOUD_BIN_ID, {
            headers: { "X-Master-Key": "$2a$10$" + CLOUD_API_KEY },
        });
        var data = await res.json();
        if (data.record && data.record.subjects) {
            state.subjects = data.record.subjects;
            saveData();
            renderSubjects();
            if (state.subjects.length > 0) selectSubject(state.subjects[0].id);
            showToast("Datos cargados desde la nube");
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function showCloudSyncModal() {
    openModal(
        '<h3>Sincronización en la Nube</h3>' +
        '<p style="font-size:0.85rem; color:var(--text-tertiary); margin-bottom:16px">Guarda tus datos en la nube con JSONBin.io (gratis).</p>' +
        '<div class="form-group"><label>Tu API Key (X-Master-Key)</label>' +
        '<input id="cloud-api-key" placeholder="Pega tu API key de JSONBin.io" value="' + (CLOUD_API_KEY ? "****" : "") + '"></div>' +
        '<div class="form-group"><label>ID del Bin (opcional)</label>' +
        '<input id="cloud-bin-id" placeholder="Se genera automáticamente" value="' + (CLOUD_BIN_ID || "") + '"></div>' +
        '<div style="display:flex; gap:8px; margin-top:16px">' +
        '<button class="btn btn-secondary" onclick="cloudSave()" style="flex:1">Guardar en Nube</button>' +
        '<button class="btn btn-primary" onclick="cloudLoadFromModal()" style="flex:1">Cargar desde Nube</button></div>' +
        '<p style="font-size:0.72rem; color:var(--text-muted); margin-top:12px; text-align:center">Crea tu API key gratis en <a href="https://jsonbin.io" target="_blank" style="color:var(--accent)">jsonbin.io</a></p>'
    );
}

async function cloudLoadFromModal() {
    var key = document.getElementById("cloud-api-key").value.trim();
    var binId = document.getElementById("cloud-bin-id").value.trim();
    if (key && key !== "****") { CLOUD_API_KEY = key; localStorage.setItem("gestor_cloud_api_key", key); }
    if (binId) { CLOUD_BIN_ID = binId; localStorage.setItem("gestor_cloud_bin", binId); }
    closeModal();
    await cloudLoad();
}

loadData();
cloudLoad();