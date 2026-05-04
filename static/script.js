const STORAGE_KEY = "gestor_universitario_data";

const state = {
    subjects: [],
    selectedSubject: null,
    selectedSession: null,
    activeTab: "sessions",
    flashcards: [],
    reviewIndex: 0,
    reviewFlipped: false,
};

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const data = JSON.parse(stored);
            state.subjects = data.subjects || [];
            state.flashcards = data.flashcards || [];
        } catch {
            state.subjects = [];
            state.flashcards = [];
        }
    }
    state.flashcards.forEach(function (fc) {
        if (!fc.ef) fc.ef = 2.5;
        if (!fc.interval) fc.interval = 0;
        if (!fc.repetition) fc.repetition = 0;
    });
    renderSubjects();
    updateWelcomeStats();
    if (state.subjects.length > 0 && !state.selectedSubject) {
        selectSubject(state.subjects[0].id);
    }
}

function updateWelcomeStats() {
    var totalSessions = state.subjects.reduce(function (sum, s) { return sum + (s.sessions ? s.sessions.length : 0); }, 0);
    var totalTasks = state.subjects.reduce(function (sum, s) { return sum + (s.tasks ? s.tasks.length : 0); }, 0);
    var elSub = document.getElementById("stat-subjects");
    var elSes = document.getElementById("stat-sessions");
    var elFc  = document.getElementById("stat-flashcards");
    var elTsk = document.getElementById("stat-tasks");
    if (elSub) elSub.textContent = state.subjects.length;
    if (elSes) elSes.textContent = totalSessions;
    if (elFc)  elFc.textContent  = state.flashcards.length;
    if (elTsk) elTsk.textContent = totalTasks;
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ subjects: state.subjects, flashcards: state.flashcards }));
    updateWelcomeStats();
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
        case "flashcards": renderFlashcardsTab(container); break;
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

function getDueFlashcards() {
    var today = new Date().toISOString().split("T")[0];
    return state.flashcards.filter(function (fc) { return !fc.dueDate || fc.dueDate <= today; });
}

function sm2Update(card, quality) {
    if (quality < 3) {
        card.repetition = 0;
        card.interval = 1;
    } else {
        if (card.repetition === 0) card.interval = 1;
        else if (card.repetition === 1) card.interval = 6;
        else card.interval = Math.round(card.interval * card.ef);
        card.repetition += 1;
    }
    card.ef = card.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (card.ef < 1.3) card.ef = 1.3;
    var next = new Date();
    next.setDate(next.getDate() + card.interval);
    card.dueDate = next.toISOString().split("T")[0];
    card.lastReview = new Date().toISOString();
}

function renderFlashcardsTab(container) {
    var subject = state.selectedSubject;
    var subjectCards = state.flashcards.filter(function (fc) { return fc.subjectId === subject.id; });
    var dueCards = getDueFlashcards().filter(function (fc) { return fc.subjectId === subject.id; });
    var totalReviews = subjectCards.reduce(function (sum, fc) { return sum + (fc.repetition || 0); }, 0);

    var html = '<div class="section-header"><h3>Flashcards - Repeticion Espaciada</h3>' +
        '<button class="btn btn-primary btn-sm" onclick="showAddFlashcardModal()">&#10010; Nueva Tarjeta</button></div>' +
        '<div style="display:flex; gap:12px; margin-bottom:16px">' +
        '<div class="card" style="flex:1; text-align:center; padding:12px">' +
        '<div style="font-size:1.5rem; font-weight:700; color:var(--accent)">' + dueCards.length + '</div>' +
        '<div style="font-size:0.75rem; color:var(--text-tertiary)">Pendientes hoy</div></div>' +
        '<div class="card" style="flex:1; text-align:center; padding:12px">' +
        '<div style="font-size:1.5rem; font-weight:700; color:var(--success)">' + subjectCards.length + '</div>' +
        '<div style="font-size:0.75rem; color:var(--text-tertiary)">Total tarjetas</div></div>' +
        '<div class="card" style="flex:1; text-align:center; padding:12px">' +
        '<div style="font-size:1.5rem; font-weight:700; color:var(--text-primary)">' + totalReviews + '</div>' +
        '<div style="font-size:0.75rem; color:var(--text-tertiary)">Repasos</div></div></div>';

    if (subjectCards.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">&#128196;</div>' +
            '<p>No hay flashcards. Crea una o genera desde IA en el tab Analisis.</p></div>';
    } else if (dueCards.length > 0) {
        html += '<div style="text-align:center; margin-bottom:16px">' +
            '<button class="btn btn-primary" onclick="startReviewSession()">&#127919; Iniciar Sesion de Repaso (' + dueCards.length + ' tarjetas)</button></div>';
    }

    html += '<div class="section-header" style="margin-top:20px"><h3>Todas las Tarjetas</h3></div><div id="flashcard-list">';
    subjectCards.forEach(function (fc) {
        var isDue = !fc.dueDate || fc.dueDate <= new Date().toISOString().split("T")[0];
        var dueLabel = isDue ? '<span style="color:var(--accent); font-size:0.75rem">&#9889; Pendiente</span>' :
            '<span style="color:var(--text-tertiary); font-size:0.75rem">' + fc.dueDate + '</span>';
        html += '<div class="card" style="margin-bottom:8px; padding:12px">' +
            '<div style="display:flex; justify-content:space-between; align-items:flex-start">' +
            '<div style="flex:1"><strong style="font-size:0.85rem">' + escapeHtml(fc.front) + '</strong>' +
            '<div style="font-size:0.78rem; color:var(--text-tertiary); margin-top:4px">' + escapeHtml(fc.back.substring(0, 80)) + (fc.back.length > 80 ? '...' : '') + '</div></div>' +
            '<div style="display:flex; gap:4px; align-items:center">' + dueLabel +
            '<button class="btn btn-ghost btn-sm" onclick="showEditFlashcardModal(\'' + fc.id + '\')" title="Editar">&#9998;</button>' +
            '<button class="btn btn-danger btn-sm" onclick="deleteFlashcard(\'' + fc.id + '\')" title="Eliminar">&times;</button></div></div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function startReviewSession() {
    var dueCards = getDueFlashcards().filter(function (fc) { return fc.subjectId === state.selectedSubject.id; });
    if (dueCards.length === 0) { showToast("No hay tarjetas pendientes"); return; }
    state.reviewCards = dueCards;
    state.reviewIndex = 0;
    state.reviewFlipped = false;
    renderReviewCard();
}

function renderReviewCard() {
    var container = document.getElementById("tab-content");
    if (!state.reviewCards || state.reviewIndex >= state.reviewCards.length) {
        container.innerHTML = '<div class="section-header"><h3>Flashcards</h3></div>' +
            '<div class="empty-state"><div class="empty-state-icon">&#127881;</div>' +
            '<p style="font-size:1.1rem; font-weight:600; color:var(--success)">Sesion completada!</p>' +
            '<p style="color:var(--text-tertiary)">Vuelve manana para repasar las tarjetas programadas.</p>' +
            '<button class="btn btn-primary" style="margin-top:16px" onclick="renderActiveTab()">&#8592; Volver</button></div>';
        return;
    }
    var card = state.reviewCards[state.reviewIndex];
    var progress = ((state.reviewIndex + 1) / state.reviewCards.length * 100).toFixed(0);
    var html = '<div class="section-header"><h3>Repaso - Tarjeta ' + (state.reviewIndex + 1) + ' de ' + state.reviewCards.length + '</h3></div>' +
        '<div style="background:var(--bg-surface); border-radius:8px; height:4px; margin-bottom:20px; overflow:hidden">' +
        '<div style="background:var(--accent); height:100%; width:' + progress + '%; transition:width 0.3s"></div></div>' +
        '<div class="flashcard-container" onclick="flipReviewCard()">' +
        '<div class="flashcard-inner' + (state.reviewFlipped ? ' flipped' : '') + '">' +
        '<div class="flashcard-front"><div class="flashcard-label">FRENTE</div>' +
        '<div class="flashcard-text">' + escapeHtml(card.front) + '</div>' +
        '<div class="flashcard-hint">Clic para ver respuesta</div></div>' +
        '<div class="flashcard-back"><div class="flashcard-label">REVERSO</div>' +
        '<div class="flashcard-text">' + escapeHtml(card.back) + '</div></div></div></div>';
    if (state.reviewFlipped) {
        html += '<div style="display:flex; gap:8px; margin-top:20px; justify-content:center">' +
            '<button class="btn btn-danger" style="flex:1" onclick="rateCard(0)">&#128260; Otra vez</button>' +
            '<button class="btn" style="flex:1; background:#f59e0b; color:#000" onclick="rateCard(3)">&#128531; Difícil</button>' +
            '<button class="btn" style="flex:1; background:var(--success); color:#000" onclick="rateCard(4)">&#128522; Bien</button>' +
            '<button class="btn" style="flex:1; background:var(--accent); color:#000" onclick="rateCard(5)">&#129297; Fácil</button></div>';
    }
    container.innerHTML = html;
}

function flipReviewCard() {
    state.reviewFlipped = !state.reviewFlipped;
    renderReviewCard();
}

function rateCard(quality) {
    var card = state.reviewCards[state.reviewIndex];
    var fc = state.flashcards.find(function (f) { return f.id === card.id; });
    if (fc) sm2Update(fc, quality);
    saveData();
    state.reviewIndex++;
    state.reviewFlipped = false;
    renderReviewCard();
}

function showAddFlashcardModal() {
    openModal(
        '<h3>Nueva Flashcard</h3>' +
        '<div class="form-group"><label>Frente (pregunta/concepto)</label>' +
        '<textarea id="fc-front" placeholder="Ej: ¿Qué es un límite?"></textarea></div>' +
        '<div class="form-group"><label>Reverso (respuesta/definicion)</label>' +
        '<textarea id="fc-back" placeholder="Ej: Valor al que se acerca una función..."></textarea></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="saveFlashcard()">Crear</button></div>'
    );
}

function showEditFlashcardModal(id) {
    var fc = state.flashcards.find(function (f) { return f.id === id; });
    if (!fc) return;
    openModal(
        '<h3>Editar Flashcard</h3>' +
        '<div class="form-group"><label>Frente</label>' +
        '<textarea id="fc-front">' + escapeHtml(fc.front) + '</textarea></div>' +
        '<div class="form-group"><label>Reverso</label>' +
        '<textarea id="fc-back">' + escapeHtml(fc.back) + '</textarea></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="saveFlashcard(\'' + id + '\')">Guardar</button></div>'
    );
}

function saveFlashcard(id) {
    var front = document.getElementById("fc-front").value.trim();
    var back = document.getElementById("fc-back").value.trim();
    if (!front || !back) return;
    if (id) {
        var fc = state.flashcards.find(function (f) { return f.id === id; });
        if (fc) { fc.front = front; fc.back = back; }
    } else {
        state.flashcards.push({
            id: generateId(),
            subjectId: state.selectedSubject.id,
            front: front,
            back: back,
            interval: 0,
            repetition: 0,
            ef: 2.5,
            dueDate: new Date().toISOString().split("T")[0],
            createdAt: new Date().toISOString(),
        });
    }
    saveData();
    closeModal();
    renderActiveTab();
    showToast(id ? "Tarjeta actualizada" : "Tarjeta creada");
}

function deleteFlashcard(id) {
    if (!confirm("Eliminar esta flashcard?")) return;
    state.flashcards = state.flashcards.filter(function (f) { return f.id !== id; });
    saveData();
    renderActiveTab();
    showToast("Tarjeta eliminada");
}

function importFlashcardsFromAi(result) {
    var lines = result.split("\n").filter(function (l) { return l.trim(); });
    var count = 0;
    lines.forEach(function (line) {
        var match = line.match(/FRENTE:\s*(.+?)\s*\|\s*REVERSO:\s*(.+)/i);
        if (match) {
            state.flashcards.push({
                id: generateId(),
                subjectId: state.selectedSubject.id,
                front: match[1].trim(),
                back: match[2].trim(),
                interval: 0, repetition: 0, ef: 2.5,
                dueDate: new Date().toISOString().split("T")[0],
                createdAt: new Date().toISOString(),
            });
            count++;
        }
    });
    if (count > 0) {
        saveData();
        showToast(count + " flashcards importadas");
    } else {
        showToast("No se encontraron tarjetas en el formato FRENTE: ... | REVERSO: ...");
    }
}

function renderAiTab(container) {
    var subject = state.selectedSubject;
    var sessionsWithTranscript = (subject.sessions || []).filter(function (s) { return s.transcript; });
    var html = '<div class="section-header"><h3>Analisis con Inteligencia Artificial</h3>' +
        '<button class="btn btn-ghost btn-sm" onclick="showAiSettingsModal()">&#9881; Ajustes IA</button></div>' +
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
            '<option value="flashcards">Flashcards (tarjetas)</option>' +
            '<option value="study_plan">Plan de estudio (3 días)</option>' +
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
        var importBtn = analysisType === "flashcards" ?
            '<button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="importFlashcardsFromAi(\'' + escapeHtml(data.result).replace(/'/g, "\\'") + '\')">&#128190; Importar como Flashcards</button>' : '';
        resultContainer.innerHTML = '<div class="ai-result">' + escapeHtml(data.result) + '</div>' + importBtn;
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
    var meetScript = [
        '(function() {',
        '    var segments = document.querySelectorAll(\'.JnEIr, [jsname="Eqn5fb"]\');',
        '    if (segments.length === 0) { console.error(\'No se encontraron segmentos. Asegurate de que la transcripcion este visible.\'); return; }',
        '    var lines = [];',
        '    segments.forEach(function(seg) {',
        '        var textEl = seg.querySelector(\'.wyBDIb\');',
        '        if (textEl) { var t = textEl.textContent.trim(); if (t) lines.push(t); }',
        '    });',
        '    if (lines.length === 0) { console.error(\'Sin texto. Haz scroll en la transcripcion para cargar mas.\'); return; }',
        '    var result = lines.join(\'\\n\');',
        '    navigator.clipboard.writeText(result).then(function() {',
        '        console.log(\'✅ Transcripcion extraida: \' + lines.length + \' segmentos, \' + result.length + \' caracteres.\');',
        '    }).catch(function() { console.log(\'⚠️ Copia manual:\'); console.log(result); });',
        '})();'
    ].join('\n');
    openModal(
        '<h3>Importar Transcripcion</h3>' +
        '<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px">Destino: <strong>' + sessionTitle + '</strong></p>' +
        '<div class="import-tabs"><button class="import-tab active" onclick="switchImportTab(\'file\', this)">Archivo</button>' +
        '<button class="import-tab" onclick="switchImportTab(\'paste\', this)">Pegar Texto</button>' +
        '<button class="import-tab" onclick="switchImportTab(\'script\', this)">Script Consola</button></div>' +
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
        '<div id="import-script-tab" class="hidden">' +
        '<div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:12px">' +
        '<p style="font-size:0.8rem; font-weight:600; margin-bottom:8px">Instrucciones:</p>' +
        '<ol style="font-size:0.78rem; color:var(--text-light); line-height:1.8; padding-left:18px; margin:0">' +
        '<li>En Google Meet, haz <strong>scroll completo</strong> en la transcripcion para cargar todo</li>' +
        '<li>Abre la consola: <strong>F12 → Console</strong></li>' +
        '<li>Si ves un warning rojo, escribe <code style="background:var(--bg-elevated); padding:2px 6px; border-radius:4px">allow pasting</code> y Enter</li>' +
        '<li>Pega el script de abajo y presiona Enter</li>' +
        '<li>El texto se copiara al portapapeles automaticamente</li>' +
        '</ol></div>' +
        '<textarea id="import-script-text" readonly style="min-height:140px; width:100%; border:1px solid var(--border); border-radius:8px; padding:12px; font-family:monospace; font-size:0.78rem; resize:vertical; background:var(--bg-surface); color:var(--text-primary)">' + escapeHtml(meetScript) + '</textarea>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="copyScriptCode()">&#128203; Copiar Script</button></div></div>' +
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
    document.getElementById("import-script-tab").classList.toggle("hidden", tab !== "script");
    document.getElementById("import-result").classList.add("hidden");
    document.querySelector(".import-tabs").classList.remove("hidden");
    importedFile = null;
}

function copyScriptCode() {
    var ta = document.getElementById("import-script-text");
    if (!ta) return;
    ta.select();
    document.execCommand("copy");
    showToast("Script copiado. Pegalo en la consola del navegador (F12).");
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

async function showAiSettingsModal() {
    var providers = [];
    try {
        var res = await fetch("/api/ai-settings");
        var data = await res.json();
        providers = data.providers || [];
    } catch { /* ignore */ }

    var providerOptions = providers.map(function (p) {
        return '<option value="' + p.id + '">' + p.name + (p.free ? ' (Gratis)' : '') + '</option>';
    }).join("");

    openModal(
        '<h3>&#9881; Configuracion de IA</h3>' +
        '<div class="form-group"><label>Proveedor</label><select id="ai-provider-select">' + providerOptions + '</select></div>' +
        '<div class="form-group"><label>API Key</label>' +
        '<input id="ai-api-key" type="password" placeholder="Pega tu API key aqui"></div>' +
        '<div id="ai-settings-status" style="font-size:0.8rem; margin-bottom:12px"></div>' +
        '<div style="display:flex; gap:8px; margin-bottom:16px">' +
        '<button class="btn btn-ghost" onclick="testAiConnection()" style="flex:1">&#128269; Probar Conexion</button>' +
        '<button class="btn btn-primary" onclick="saveAiSettings()" style="flex:1">&#128190; Guardar</button></div>' +
        '<div style="font-size:0.75rem; color:var(--text-tertiary); line-height:1.6">' +
        '<strong>Proveedores gratuitos:</strong><br>' +
        providers.map(function (p) {
            return '&#8226; <a href="' + p.url + '" target="_blank" style="color:var(--accent)">' + p.name + '</a>' + (p.free ? ' - Gratis' : '');
        }).join('<br>') +
        '</div>'
    );

    try {
        var res = await fetch("/api/ai-settings");
        var data = await res.json();
        var sel = document.getElementById("ai-provider-select");
        if (sel) sel.value = data.provider || "local";
    } catch { /* ignore */ }
}

async function testAiConnection() {
    var provider = document.getElementById("ai-provider-select").value;
    var apiKey = document.getElementById("ai-api-key").value.trim();
    var status = document.getElementById("ai-settings-status");
    status.innerHTML = '<span style="color:var(--text-tertiary)">Probando conexion...</span>';
    try {
        var res = await fetch("/api/ai-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: provider, api_key: apiKey })
        });
        var data = await res.json();
        if (data.ok) {
            status.innerHTML = '<span style="color:var(--success)">&#9989; Conexion exitosa!</span>';
        } else {
            status.innerHTML = '<span style="color:var(--danger)">&#10060; Error: ' + escapeHtml(data.error || "Desconocido") + '</span>';
        }
    } catch {
        status.innerHTML = '<span style="color:var(--danger)">&#10060; Error de conexion al servidor</span>';
    }
}

async function saveAiSettings() {
    var provider = document.getElementById("ai-provider-select").value;
    var apiKey = document.getElementById("ai-api-key").value.trim();
    try {
        await fetch("/api/ai-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: provider, api_key: apiKey })
        });
        closeModal();
        showToast("Configuracion de IA guardada");
    } catch {
        showToast("Error al guardar configuracion");
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