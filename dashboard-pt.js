import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, deleteDoc, addDoc, serverTimestamp, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAZIONE
const firebaseConfig = {
    apiKey: "AIzaSyBCZqWbOdM2a89arMX18TMKqZI6BmeSsVQ",
    authDomain: "personal-trainer-fe4cc.firebaseapp.com",
    projectId: "personal-trainer-fe4cc",
    storageBucket: "personal-trainer-fe4cc.firebasestorage.app",
    messagingSenderId: "340774601063",
    appId: "1:340774601063:web:eeb03cd7ce0755b78aefc2",
    measurementId: "G-CEESE7YR9K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================
// 0. DOM GLOBALE & VARIABILI (TUTTO QUI SOPRA)
// =========================================
const ptNameElement = document.getElementById('pt-name');
const ptAvatarElement = document.getElementById('pt-avatar');
const logoutBtn = document.getElementById('logout-btn');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');
const currentDateElement = document.getElementById('current-date');
const displayTrainerCode = document.getElementById('display-trainer-code');
const copyCodeBtn = document.querySelector('.copy-btn');
const pageTitle = document.getElementById('page-title');

// Variabili Gestione Clienti
const clientsGrid = document.getElementById('clients-grid');
const clientPanel = document.getElementById('client-detail-panel');
const btnClosePanel = document.getElementById('btn-close-client');
const toggleBtns = document.querySelectorAll('.toggle-btn');

// Variabili Schede
const tabActive = document.getElementById('tab-active-workouts');
const tabArchive = document.getElementById('tab-archive-workouts');
const viewActive = document.getElementById('view-active-workouts');
const viewArchive = document.getElementById('view-archive-workouts');
const listActive = document.getElementById('list-active-workouts');
const listArchive = document.getElementById('list-archive-workouts');

// Variabili Misure
const viewMeasuresList = document.getElementById('view-measures-list');
const viewMeasureForm = document.getElementById('view-measure-form');
const btnShowAdd = document.getElementById('btn-show-add-measure');
const btnCancelInput = document.getElementById('btn-cancel-input');
const btnSaveFull = document.getElementById('btn-save-full-measure');

// Variabili Chat
const chatListContainer = document.querySelector('.chat-sidebar');
const chatMessagesArea = document.querySelector('.messages-area');
const chatInput = document.querySelector('.message-input-area input');
const btnSend = document.querySelector('.send-btn');

// Variabili Richieste
const requestsList = document.getElementById('requests-list');
const pendingCountEl = document.getElementById('pending-requests-count');
const badgeHome = document.getElementById('requests-badge');

// Variabili Settings
const btnChangePhoto = document.getElementById('btn-change-photo');
const inputPhotoFile = document.getElementById('input-photo-file');
const previewAvatar = document.getElementById('settings-avatar-preview');
const btnSaveAll = document.getElementById('btn-save-settings-all');
const btnCreateWorkout = document.getElementById('btn-create-workout');

// Stato Globale
let currentUserData = null;
let currentSelectedClientId = null;
let allClientsCache = [];
let uniqueTagsCache = new Set();
let newPhotoBase64 = null;
let editingMeasureId = null;
let activeChatId = null;
let unsubscribeMessages = null;

// Stato Analisi
let allClientLogs = [];
let currentAnalysisLogs = [];
let analysisType = 'exercise';
let analysisSort = 'desc';
const activeCharts = {};
let currentWorkoutDays = 7;


// =========================================
// 1. AUTH & INIT
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            if (currentUserData.role !== 'personal_trainer') {
                window.location.href = "login.html"; return;
            }
            initDashboard(user, currentUserData);
        } else {
            window.location.href = "login.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

function initDashboard(user, dbData) {
    const displayName = dbData.customName || dbData.name || user.displayName;
    const displayPhoto = dbData.customPhoto || dbData.photoURL || user.photoURL;

    if(ptNameElement) ptNameElement.textContent = displayName;
    if(ptAvatarElement) ptAvatarElement.src = displayPhoto;

    // Popola Settings
    const settingsName = document.getElementById('settings-name');
    const settingsBio = document.getElementById('settings-bio');
    const settingsAvatar = document.getElementById('settings-avatar-preview');
    if (settingsName) settingsName.value = displayName;
    if (settingsBio) settingsBio.value = dbData.bio || "";
    if (settingsAvatar) settingsAvatar.src = displayPhoto;

    if(currentDateElement) currentDateElement.textContent = new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dbData.trainerCode && displayTrainerCode) displayTrainerCode.textContent = dbData.trainerCode;

    // Popola Volume
    if (dbData.volumeSettings) {
        const v2 = document.getElementById('vol-secondary');
        const v3 = document.getElementById('vol-tertiary');
        const v4 = document.getElementById('vol-quaternary');
        const vO = document.getElementById('vol-other');
        if(v2) v2.value = dbData.volumeSettings.secondary ?? 0.5;
        if(v3) v3.value = dbData.volumeSettings.tertiary ?? 0.3;
        if(v4) v4.value = dbData.volumeSettings.quaternary ?? 0.15;
        if(vO) vO.value = dbData.volumeSettings.other ?? 0.1;
    }

    loadWorkouts(user.uid);
    loadClientsGrid(user.uid);
    initChatSystem(user.uid);
    loadPendingRequests(user.uid);
}

// =========================================
// 2. NAVIGAZIONE
// =========================================

function updatePageTitle(sectionId) {
    switch (sectionId) {
        case 'section-home': pageTitle.textContent = "Home & Notifiche"; break;
        case 'section-stats': pageTitle.textContent = "Panoramica Clienti"; break;
        case 'section-schede': pageTitle.textContent = "Gestione Schede"; break;
        case 'section-chat': pageTitle.textContent = "Messaggi"; break;
        case 'section-settings': pageTitle.textContent = "Impostazioni Profilo"; break;
        default: pageTitle.textContent = "Dashboard";
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        sections.forEach(section => section.classList.add('hidden'));
        const targetId = link.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');

        updatePageTitle(targetId);

        if (targetId === 'section-chat') {
            const badge = document.getElementById('chat-badge');
            if (badge) badge.classList.add('hidden');
        }
    });
});

if(logoutBtn) logoutBtn.addEventListener('click', async () => {
    try { await signOut(auth); window.location.href = "login.html"; }
    catch (error) { console.error("Errore logout:", error); }
});

if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(displayTrainerCode.textContent).then(() => alert("Codice copiato!"));
    });
}

// =========================================
// 3. SETTINGS
// =========================================
if (btnSaveAll) {
    btnSaveAll.addEventListener('click', async () => {
        btnSaveAll.textContent = "Salvataggio...";
        btnSaveAll.disabled = true;

        try {
            const newName = document.getElementById('settings-name').value;
            const newBio = document.getElementById('settings-bio').value;

            const parseLocaleNumber = (val) => {
                if (!val) return 0;
                return parseFloat(val.toString().replace(',', '.')) || 0;
            };

            const volSec = parseLocaleNumber(document.getElementById('vol-secondary').value) || 0.5;
            const volTer = parseLocaleNumber(document.getElementById('vol-tertiary').value) || 0.3;
            const volQuat = parseLocaleNumber(document.getElementById('vol-quaternary').value) || 0.15;
            const volOther = parseLocaleNumber(document.getElementById('vol-other').value) || 0.1;

            const updateData = {
                customName: newName,
                bio: newBio,
                volumeSettings: {
                    secondary: volSec,
                    tertiary: volTer,
                    quaternary: volQuat,
                    other: volOther
                }
            };

            if (newPhotoBase64) updateData.customPhoto = newPhotoBase64;

            await updateDoc(doc(db, "users", currentUserData.uid), updateData);

            if(ptNameElement) ptNameElement.textContent = newName;
            if (newPhotoBase64 && ptAvatarElement) ptAvatarElement.src = newPhotoBase64;
            alert("Salvato!");
        } catch (error) {
            console.error(error);
            alert("Errore: " + error.message);
        } finally {
            btnSaveAll.disabled = false;
            btnSaveAll.textContent = "Salva Modifiche";
        }
    });
}

if (btnChangePhoto) {
    btnChangePhoto.addEventListener('click', () => inputPhotoFile.click());
    inputPhotoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) { alert("File troppo grande (>1MB)"); return; }
            const reader = new FileReader();
            reader.onload = (ev) => { newPhotoBase64 = ev.target.result; previewAvatar.src = newPhotoBase64; };
            reader.readAsDataURL(file);
        }
    });
}

// =========================================
// 4. SCHEDE
// =========================================
if (btnCreateWorkout) {
    btnCreateWorkout.addEventListener('click', () => {
        window.location.href = "workout-builder.html";
    });
}

// =========================================
// 4. SCHEDE
// =========================================
// ... (codice bottone crea scheda) ...

// GESTIONE TAB (Attive vs Archivio)
if (tabActive && tabArchive) {
    // Click su TAB ATTIVE
    tabActive.addEventListener('click', () => {
        console.log("Switch to Active"); // Debug
        tabActive.classList.add('active');
        tabArchive.classList.remove('active');
        
        // Gestione view
        if(viewActive) viewActive.classList.remove('hidden');
        if(viewArchive) viewArchive.classList.add('hidden');
    });

    // Click su TAB ARCHIVIO
    tabArchive.addEventListener('click', () => {
        console.log("Switch to Archive"); // Debug
        tabArchive.classList.add('active');
        tabActive.classList.remove('active');
        
        // Gestione view
        if(viewArchive) viewArchive.classList.remove('hidden');
        if(viewActive) viewActive.classList.add('hidden');
    });
}

async function loadWorkouts(coachId) {
    if(!listActive) return;
    listActive.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Caricamento...</div>';
    listArchive.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Caricamento...</div>';

    try {
        const q = query(collection(db, "workouts"), where("coachId", "==", coachId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const clientNames = await getClientNamesMap(coachId);

        let activeHtml = '';
        let archiveHtml = '';

        snapshot.forEach(doc => {
            const w = doc.data();
            const date = w.createdAt ? new Date(w.createdAt.seconds * 1000).toLocaleDateString() : '-';

            const rowHtml = `
                <div class="row-item">
                    <span class="col-name" style="font-weight:600;">${w.name}</span>
                    <span class="col-${w.isTemplate ? 'days' : 'client'}">${w.isTemplate ? w.days + ' Giorni' : (clientNames[w.assignedTo] || 'Cliente')}</span>
                    <span class="col-date">${date}</span>
                    <div class="col-actions">
                        <button class="btn-action-icon" onclick="editWorkout('${doc.id}')"><i class="ph ph-pencil-simple"></i></button>
                        ${w.isTemplate ? `<button class="btn-action-icon" onclick="useTemplate('${doc.id}')"><i class="ph ph-copy"></i></button>` : ''}
                        <button class="btn-action-icon danger" onclick="deleteWorkout('${doc.id}')"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            `;

            if (w.isTemplate) archiveHtml += rowHtml; else activeHtml += rowHtml;
        });

        listActive.innerHTML = activeHtml || '<div style="padding:40px; text-align:center; color:#888; font-style:italic;">Nessuna scheda attiva.<br><small>Crea una nuova scheda o assegnane una dall\'archivio.</small></div>';
        listArchive.innerHTML = archiveHtml || '<div style="padding:40px; text-align:center; color:#888; font-style:italic;">Archivio vuoto.</div>';

    } catch (e) {
        console.error(e);
        listActive.innerHTML = '<div style="padding:20px;">Errore caricamento.</div>';
    }
}

async function getClientNamesMap(coachId) {
    const map = {};
    const q = query(collection(db, "users"), where("role", "==", "client"));
    const snap = await getDocs(q);
    snap.forEach(doc => { map[doc.id] = doc.data().name || doc.data().email; });
    return map;
}

window.editWorkout = (id) => { localStorage.setItem('editWorkoutId', id); window.location.href = "workout-builder.html"; };
window.useTemplate = (id) => { if (confirm("Creare nuova da questo modello?")) { localStorage.setItem('templateSourceId', id); window.location.href = "workout-builder.html"; } };
window.deleteWorkout = async (id) => { if (confirm("Eliminare?")) { await deleteDoc(doc(db, "workouts", id)); loadWorkouts(currentUserData.uid); } };


// =========================================
// 5. GESTIONE CLIENTI AVANZATA
// =========================================

// 1. CARICAMENTO DATI (Fetch)
async function loadClientsGrid(coachId) {
    if (!clientsGrid) return;
    clientsGrid.innerHTML = '<p style="padding:20px; color:#888;">Caricamento team...</p>';

    const q = query(collection(db, "users"), where("coachId", "==", coachId));
    
    // Listener Real-time per aggiornamenti automatici
    onSnapshot(q, (snap) => {
        allClientsCache = [];
        uniqueTagsCache = new Set();
        
        snap.forEach(doc => {
            const data = doc.data();
            data.id = doc.id; // Salviamo l'ID nel blocco dati
            allClientsCache.push(data);
            
            // Raccogli tag per i filtri e suggerimenti
            if(data.customLabel) uniqueTagsCache.add(data.customLabel.trim());
        });

        updateTagFilterDropdown(); // Aggiorna il dropdown dei filtri
        applyClientFilters(); // Renderizza la griglia
    });
}

// 2. LOGICA FILTRI & RENDER
window.applyClientFilters = () => {
    const searchText = document.getElementById('search-client').value.toLowerCase();
    const colorFilter = document.getElementById('filter-color').value;
    const tagFilter = document.getElementById('filter-tag').value;

    // Filtra l'array locale
    const filtered = allClientsCache.filter(c => {
        // Filtro Nome
        const matchesName = (c.name || '').toLowerCase().includes(searchText);
        
        // Filtro Colore (Gestione codici esadecimali)
        let matchesColor = true;
        if (colorFilter !== 'all') {
            const cColor = (c.labelColor || '').toLowerCase();
            if (colorFilter === 'none') matchesColor = !c.labelColor;
            else if (colorFilter === 'gold') matchesColor = cColor.includes('ffd700');
            else if (colorFilter === 'silver') matchesColor = cColor.includes('c0c0c0');
            else if (colorFilter === 'bronze') matchesColor = cColor.includes('cd7f32');
            else if (colorFilter === 'blue') matchesColor = cColor.includes('0071e3');
            else if (colorFilter === 'red') matchesColor = cColor.includes('ff3b30');
        }

        // Filtro Tag
        let matchesTag = true;
        if (tagFilter !== 'all') {
            matchesTag = (c.customLabel === tagFilter);
        }

        return matchesName && matchesColor && matchesTag;
    });

    renderClients(filtered);
};

// 3. GENERAZIONE HTML (Griglia/Lista)
function renderClients(clients) {
    clientsGrid.innerHTML = '';
    
    if (clients.length === 0) {
        clientsGrid.innerHTML = '<div style="padding:40px; text-align:center; color:#999; grid-column: 1/-1;">Nessun atleta trovato con questi filtri.</div>';
        return;
    }

    // Preparazione Suggerimenti Tag (HTML da riusare)
    const suggestionsHTML = Array.from(uniqueTagsCache).map(tag => 
        `<span class="tag-chip" onclick="fillTagInput(this, '${tag}')">${tag}</span>`
    ).join('');

    clients.forEach(c => {
        const color = c.labelColor || null;
        let styleAttr = '';
        let dataColored = 'false';

        if (color && color !== 'transparent') {
            dataColored = 'true';
            const glowColor = color + '40';
            styleAttr = `style="--card-color: ${color}; --card-glow: ${glowColor};"`;
        }

        const card = document.createElement('div');
        card.className = 'client-card';
        if (color) card.setAttribute('data-colored', dataColored);
        card.setAttribute('style', styleAttr.replace('style="', '').replace('"', ''));

        // HTML del Menu con Input Migliorato
        const menuHtml = `
            <div class="card-dropdown" id="menu-${c.id}" onclick="event.stopPropagation()">
                <div class="dropdown-section">
                    <h6>Evidenzia Card</h6>
                    <div class="colors-row">
                        <div class="color-swatch" style="background:#FFD700" onclick="setClientColor('${c.id}', '#FFD700')" title="Gold"></div>
                        <div class="color-swatch" style="background:#C0C0C0" onclick="setClientColor('${c.id}', '#C0C0C0')" title="Silver"></div>
                        <div class="color-swatch" style="background:#CD7F32" onclick="setClientColor('${c.id}', '#CD7F32')" title="Bronze"></div>
                        <div class="color-swatch" style="background:#0071E3" onclick="setClientColor('${c.id}', '#0071E3')" title="Blue"></div>
                        <div class="color-swatch" style="background:#FF3B30" onclick="setClientColor('${c.id}', '#FF3B30')" title="Red"></div>
                        <div class="color-swatch remove" onclick="setClientColor('${c.id}', null)" title="Rimuovi"><i class="ph ph-prohibit"></i></div>
                    </div>
                </div>
                <div class="dropdown-section">
                    <h6>Etichetta (es. VIP, Agonista)</h6>
                    <div class="tag-input-wrapper">
                        <input type="text" id="label-input-${c.id}" placeholder="Scrivi tag..." value="${c.customLabel || ''}" maxlength="15">
                        <button onclick="setClientLabel('${c.id}')"><i class="ph ph-check"></i></button>
                    </div>
                    <!-- SUGGERIMENTI TAG -->
                    <div class="tag-suggestions-area">
                        ${suggestionsHTML}
                    </div>
                </div>
                <button class="btn-delete-card" onclick="deleteClient('${c.id}')" style="margin-top:10px;">
                    <i class="ph ph-trash" style="margin-right:5px"></i> Elimina dal Team
                </button>
            </div>
        `;

        card.innerHTML = `
            <button class="card-menu-btn" onclick="toggleCardMenu(event, '${c.id}')"><i class="ph ph-dots-three-vertical"></i></button>
            
            <!-- Etichetta visibile sia in griglia che lista -->
            ${c.customLabel ? `<span class="custom-label-badge" style="background:${color || '#1D1D1F'}">${c.customLabel}</span>` : ''}
            
            ${menuHtml}
            
            <div class="client-header">
                <div class="client-avatar">${c.name ? c.name.charAt(0).toUpperCase() : '?'}</div>
                <div>
                    <h4>${c.name || "Senza Nome"}</h4>
                    <span class="status-badge positive">Attivo</span>
                </div>
            </div>
            <div class="mini-chart-area" style="font-size:12px; color:#ccc;">
                <span>Analisi in arrivo...</span>
            </div>
            <button class="btn-details" onclick="openClientDetail('${c.id}')">Scheda Atleta</button>
        `;
        clientsGrid.appendChild(card);
    });
}

// 4. FUNZIONI TAG & SUGGERIMENTI
function updateTagFilterDropdown() {
    const select = document.getElementById('filter-tag');
    if(!select) return;
    
    // Salva selezione corrente per non resettarla
    const currentVal = select.value;
    
    // Ricostruisci opzioni
    select.innerHTML = '<option value="all">🏷️ Tutte le Etichette</option>';
    uniqueTagsCache.forEach(tag => {
        select.innerHTML += `<option value="${tag}">${tag}</option>`;
    });
    
    select.value = currentVal;
}

// Funzione helper per cliccare un suggerimento
window.fillTagInput = (chip, value) => {
    // Trova l'input nel genitore più vicino (dropdown corrente)
    const container = chip.closest('.dropdown-section');
    const input = container.querySelector('input');
    if(input) {
        input.value = value;
    }
};

window.setClientLabel = async (id) => {
    const input = document.getElementById(`label-input-${id}`);
    const text = input.value.trim();
    try {
        await updateDoc(doc(db, "users", id), { customLabel: text || null });
        // Chiudi menu
        document.querySelectorAll('.card-dropdown').forEach(d => d.classList.remove('active'));
    } catch (e) { console.error(e); }
};

// 5. HELPER VIEW (Griglia/Lista)
window.setGridView = () => {
    clientsGrid.classList.remove('list-view-mode');
    document.querySelectorAll('.toggle-btn')[0].classList.add('active');
    document.querySelectorAll('.toggle-btn')[1].classList.remove('active');
};

window.setListView = () => {
    clientsGrid.classList.add('list-view-mode');
    document.querySelectorAll('.toggle-btn')[0].classList.remove('active');
    document.querySelectorAll('.toggle-btn')[1].classList.add('active');
};

// ... Resto funzioni Colore/Elimina restano invariate ...
window.setClientColor = async (id, color) => {
    // Chiudi il menu per pulizia visiva immediata
    document.querySelectorAll('.card-dropdown').forEach(d => d.classList.remove('active'));
    try {
        await updateDoc(doc(db, "users", id), { labelColor: color || null });
    } catch (e) { console.error(e); }
};

window.toggleCardMenu = (e, id) => {
    e.stopPropagation();
    // Chiudi altri menu
    document.querySelectorAll('.card-dropdown').forEach(d => {
        if (d.id !== `menu-${id}`) d.classList.remove('active');
    });
    document.getElementById(`menu-${id}`)?.classList.toggle('active');
};

document.addEventListener('click', (e) => { 
    if (!e.target.closest('.card-dropdown') && !e.target.closest('.card-menu-btn')) {
        document.querySelectorAll('.card-dropdown').forEach(d => d.classList.remove('active'));
    }
});

window.deleteClient = async (id) => { 
    if (confirm("Sei sicuro di voler eliminare questo atleta dal team?")) {
        try {
            await updateDoc(doc(db, "users", id), { coachId: null, pendingCoachId: null, status: null });
            alert("Atleta rimosso dal team.");
        } catch(e) { console.error(e); alert("Errore rimozione."); }
    }
};

// =========================================
// 6. DETTAGLIO & MISURE
// =========================================

window.openClientDetail = async (clientId) => {
    console.log("Apertura dettaglio per:", clientId);
    currentSelectedClientId = clientId;
    
    // Mostra il pannello (se esiste)
    if(clientPanel) clientPanel.classList.remove('hidden');
    
    // 1. SCARICA DATI
    const snap = await getDoc(doc(db, "users", clientId));
    if (!snap.exists()) {
        console.error("Cliente non trovato nel DB");
        return;
    }
    
    const data = snap.data();
    console.log("DATI UTENTE:", data); // Vedi i dati in console

    // --- FUNZIONE DI SICUREZZA (Anti-Crash) ---
    // Se l'HTML non ha l'ID, non rompe tutto ma avvisa in console
    const safeUpdate = (elementId, textValue) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = textValue || "-";
        } else {
            console.warn(`ATTENZIONE: Manca l'elemento HTML con id="${elementId}"`);
        }
    };

    // 2. HEADER PANNELLO
    safeUpdate('detail-client-name', data.name || "Cliente");
    safeUpdate('detail-client-email', data.email);
    safeUpdate('detail-active-workout', data.activeWorkoutId ? "Presente" : "Nessuna");

    // 3. PANORAMICA (Dati Onboarding)
    safeUpdate('ov-age', data.age ? data.age + " Anni" : "-");
    safeUpdate('ov-goals', data.goals);
    safeUpdate('ov-history', data.history);
    safeUpdate('ov-client-notes', data.notes);

    // 4. LOGICA INFORTUNI (Colore Rosso)
    const inj = data.injuries && data.injuries !== "Nessuno" ? data.injuries : null;
    const pos = data.posture && data.posture !== "Normale" ? data.posture : null;
    
    let physText = "✅ Sano / Nessun problema";
    if (inj || pos) {
        physText = "";
        if (inj) physText += `⚠️ INFORTUNI: ${inj}. `;
        if (pos) physText += `ℹ️ POSTURA: ${pos}.`;
    }
    safeUpdate('ov-physical', physText);

    // Gestione Colore Card (Solo se esiste)
    const physCard = document.getElementById('card-physical');
    if (physCard) {
        if (inj || pos) {
            physCard.style.backgroundColor = "#FFF5F5"; // Rosso chiaro
            physCard.style.borderColor = "#FFDADA";
        } else {
            physCard.style.backgroundColor = "#FAFAFC"; // Grigio default
            physCard.style.borderColor = "#E5E5EA";
        }
    }

    // 5. NOTE PRIVATE COACH
    const noteInput = document.getElementById('coach-notes-input');
    if (noteInput) {
        noteInput.value = data.coachPrivateNotes || "";
    }

    // 6. TASTO CHAT
    const btnChat = document.querySelector('.slide-header .btn-primary.small');
    if (btnChat) {
        btnChat.onclick = () => startChatWithClient(clientId, data.name || "Cliente");
    }

    // Carica le altre sezioni (Grafici e Misure)
    // Usiamo try-catch per evitare che un errore qui blocchi tutto il resto
    try { loadClientCharts(clientId); } catch(e) { console.error("Err Grafici", e); }
    try { loadMeasurements(clientId); } catch(e) { console.error("Err Misure", e); }
};
// Listener Salvataggio Note Coach
const btnSaveNotes = document.getElementById('btn-save-coach-notes');
if(btnSaveNotes) {
    btnSaveNotes.onclick = async () => {
        if(!currentSelectedClientId) return;
        const txt = document.getElementById('coach-notes-input').value;
        const status = document.getElementById('coach-notes-status');
        
        btnSaveNotes.textContent = "Salvataggio...";
        await updateDoc(doc(db, "users", currentSelectedClientId), { coachPrivateNotes: txt });
        
        btnSaveNotes.textContent = "Salva Note";
        if(status) { status.style.opacity = '1'; setTimeout(()=> status.style.opacity='0', 2000); }
    };
}

// --- FUNZIONE PER SALVARE NOTE COACH ---
const btnSaveCoachNotes = document.getElementById('btn-save-coach-notes');
if (btnSaveCoachNotes) {
    btnSaveCoachNotes.addEventListener('click', async () => {
        if (!currentSelectedClientId) return;
        
        const noteText = document.getElementById('coach-notes-input').value;
        const statusLabel = document.getElementById('coach-notes-status');
        
        btnSaveCoachNotes.textContent = "Salvataggio...";
        btnSaveCoachNotes.disabled = true;

        try {
            await updateDoc(doc(db, "users", currentSelectedClientId), {
                coachPrivateNotes: noteText
            });
            
            // Feedback Visivo
            btnSaveCoachNotes.textContent = "Salva Note";
            btnSaveCoachNotes.disabled = false;
            if(statusLabel) {
                statusLabel.classList.add('visible');
                setTimeout(() => statusLabel.classList.remove('visible'), 2000);
            }
        } catch (e) {
            console.error(e);
            alert("Errore salvataggio note.");
            btnSaveCoachNotes.textContent = "Salva Note";
            btnSaveCoachNotes.disabled = false;
        }
    });
}

if (btnClosePanel) btnClosePanel.addEventListener('click', () => clientPanel.classList.add('hidden'));

const cTabs = document.querySelectorAll('.c-tab');
cTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        cTabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
        document.querySelectorAll('.c-tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(tab.dataset.tab).classList.remove('hidden');
    });
});

if (btnShowAdd) btnShowAdd.addEventListener('click', () => {
    viewMeasuresList.classList.add('hidden'); viewMeasureForm.classList.remove('hidden');
    document.getElementById('m-date').value = new Date().toISOString().split('T')[0];
    document.querySelector('.form-header h3').textContent = "Nuova Rilevazione";
    clearMeasureInputs();
});
if (btnCancelInput) btnCancelInput.addEventListener('click', () => {
    viewMeasureForm.classList.add('hidden'); viewMeasuresList.classList.remove('hidden');
});

if (btnSaveFull) btnSaveFull.addEventListener('click', async () => {
    if (!currentSelectedClientId) return;
    const measureData = {
        date: document.getElementById('m-date').value,
        createdAt: serverTimestamp(),
        weight: parseFloat(document.getElementById('m-weight').value) || null,
        height: parseFloat(document.getElementById('m-height').value) || null,
        rhr: parseInt(document.getElementById('m-rhr').value) || null,
        hrmax: parseInt(document.getElementById('m-hrmax').value) || null,
        vo2: parseFloat(document.getElementById('m-vo2').value) || null,
        bia: {
            fat: parseFloat(document.getElementById('m-fat-perc').value) || null,
            muscle: parseFloat(document.getElementById('m-muscle-kg').value) || null,
            water: parseFloat(document.getElementById('m-water').value) || null,
            bone: parseFloat(document.getElementById('m-bone').value) || null,
            visceral: parseFloat(document.getElementById('m-visceral').value) || null,
            bmr: parseInt(document.getElementById('m-bmr').value) || null
        },
        folds: {
            chest: parseFloat(document.getElementById('p-chest').value) || null,
            abs: parseFloat(document.getElementById('p-abs').value) || null,
            thigh: parseFloat(document.getElementById('p-thigh').value) || null,
            tricep: parseFloat(document.getElementById('p-tricep').value) || null,
            subscap: parseFloat(document.getElementById('p-subscap').value) || null,
            supra: parseFloat(document.getElementById('p-supra').value) || null,
            midax: parseFloat(document.getElementById('p-midax').value) || null,
            bicep: parseFloat(document.getElementById('p-bicep').value) || null,
            calf: parseFloat(document.getElementById('p-calf').value) || null
        },
        circ: {
            neck: parseFloat(document.getElementById('c-neck').value) || null,
            shoulders: parseFloat(document.getElementById('c-shoulders').value) || null,
            chest: parseFloat(document.getElementById('c-chest').value) || null,
            armRelax: parseFloat(document.getElementById('c-arm-relax').value) || null,
            armFlex: parseFloat(document.getElementById('c-arm-flex').value) || null,
            waist: parseFloat(document.getElementById('c-waist').value) || null,
            hips: parseFloat(document.getElementById('c-hips').value) || null,
            thigh: parseFloat(document.getElementById('c-thigh').value) || null
        }
    };

    if (!measureData.weight) { alert("Peso obbligatorio"); return; }

    try {
        if (editingMeasureId) {
            await updateDoc(doc(db, "users", currentSelectedClientId, "measurements", editingMeasureId), measureData);
        } else {
            await addDoc(collection(db, "users", currentSelectedClientId, "measurements"), measureData);
        }
        viewMeasureForm.classList.add('hidden'); viewMeasuresList.classList.remove('hidden');
        loadMeasurements(currentSelectedClientId);
        editingMeasureId = null;
    } catch (e) { console.error(e); alert("Errore salvataggio."); }
});

function clearMeasureInputs() {
    viewMeasureForm.querySelectorAll('input').forEach(i => i.value = '');
}

window.editMeasure = async (mid) => {
    editingMeasureId = mid;
    const snap = await getDoc(doc(db, "users", currentSelectedClientId, "measurements", mid));
    if (!snap.exists()) return;
    const d = snap.data();
    document.querySelector('.form-header h3').textContent = "Modifica Rilevazione";
    document.getElementById('m-date').value = d.date;
    document.getElementById('m-weight').value = d.weight;
    document.getElementById('m-height').value = d.height;
    if (d.bia) {
        document.getElementById('m-fat-perc').value = d.bia.fat || '';
        document.getElementById('m-muscle-kg').value = d.bia.muscle || '';
    }
    viewMeasuresList.classList.add('hidden'); viewMeasureForm.classList.remove('hidden');
};

async function loadMeasurements(cid) {
    const tbody = document.getElementById('measures-list-body');
    tbody.innerHTML = '<tr><td colspan="6">Caricamento...</td></tr>';
    try {
        const q = query(collection(db, "users", cid, "measurements"), orderBy("date", "desc"));
        const snap = await getDocs(q);
        if (snap.empty) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">Nessuna misurazione.</td></tr>'; return; }

        tbody.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            let sumFolds = 0; if (m.folds) Object.values(m.folds).forEach(v => sumFolds += (v || 0));
            tbody.innerHTML += `
                <tr>
                    <td>${m.date}</td>
                    <td><strong>${m.weight || '-'} kg</strong></td>
                    <td>${m.bia?.fat ? m.bia.fat + '%' : '-'}</td>
                    <td>${m.bia?.muscle ? m.bia.muscle + ' kg' : '-'}</td>
                    <td>${sumFolds > 0 ? sumFolds.toFixed(1) : '-'}</td>
                    <td><button class="btn-action-icon" onclick="editMeasure('${doc.id}')"><i class="ph ph-pencil-simple"></i></button></td>
                </tr>
            `;
        });
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6">Errore.</td></tr>'; }
}

// =========================================
// 7. CHAT & RICHIESTE
// =========================================

function initChatSystem(userUid) {
    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", userUid),
        orderBy("lastMessageTime", "desc")
    );

    onSnapshot(q, (snapshot) => {
        if(chatListContainer) chatListContainer.innerHTML = '';
        
        let globalUnreadCount = 0;
        const readHistory = JSON.parse(localStorage.getItem('chatReadHistory') || '{}');
        const isChatSectionOpen = !document.getElementById('section-chat').classList.contains('hidden');

        if (snapshot.empty && chatListContainer) {
            chatListContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999; font-size:13px;">Nessuna conversazione.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const chat = doc.data();
            
            // LOGICA NOME
            let otherUserName = "Utente";
            if (chat.participants && chat.participantNames) {
                const myIndex = chat.participants.indexOf(userUid);
                const otherIndex = myIndex === 0 ? 1 : 0;
                otherUserName = chat.participantNames[otherIndex] || "Utente";
            }

            const lastMsg = chat.lastMessage || "Inizia a scrivere...";
            let msgTime = 0;
            if (chat.lastMessageTime) {
                msgTime = chat.lastMessageTime.seconds ? chat.lastMessageTime.seconds * 1000 : Date.now();
            }

            // --- DIAGNOSI PALLINO ---
            const lastReadTimeForThisChat = readHistory[doc.id] || 0;
            const isMeSender = chat.lastSenderId === userUid;
            const isUnread = (msgTime > lastReadTimeForThisChat) && !isMeSender;

            // STAMPA IN CONSOLE I DETTAGLI (Premi F12 per vedere)
            console.log(`CHAT: ${otherUserName}`);
            console.log(`- Messaggio del: ${new Date(msgTime).toLocaleString()}`);
            console.log(`- Ultima lettura salvata: ${new Date(lastReadTimeForThisChat).toLocaleString()}`);
            console.log(`- L'ho mandato io? ${isMeSender}`);
            console.log(`- DECISIONE PALLINO: ${isUnread ? "✅ SI" : "❌ NO"}`);
            console.log("--------------------------------");

            if (isUnread) globalUnreadCount++;

            if(chatListContainer) {
                const div = document.createElement('div');
                div.id = `chat-item-${doc.id}`;
                div.className = `chat-list-item ${activeChatId === doc.id ? 'active' : ''}`;
                div.onclick = () => openChat(doc.id, otherUserName);

                const textStyle = isUnread ? 'font-weight:700; color:#000;' : 'color:#86868B;';
                const dotHtml = isUnread ? '<div class="unread-dot"></div>' : '';

                div.innerHTML = `
                    <div class="avatar-small">${otherUserName.charAt(0).toUpperCase()}</div>
                    <div class="chat-preview" style="flex-grow:1;">
                        <h5 style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                            ${otherUserName}
                            ${dotHtml}
                        </h5>
                        <p style="${textStyle}">${lastMsg}</p>
                    </div>
                `;
                chatListContainer.appendChild(div);
            }
        });

        // BADGE SIDEBAR
        const chatBadge = document.getElementById('chat-badge');
        if (chatBadge) {
            if (globalUnreadCount > 0 && !isChatSectionOpen) {
                chatBadge.classList.remove('hidden');
            } else {
                chatBadge.classList.add('hidden');
            }
        }
    });
}

window.openChat = (chatId, chatTitle) => {
    // SAVE READ
    const readHistory = JSON.parse(localStorage.getItem('chatReadHistory') || '{}');
    readHistory[chatId] = Date.now();
    localStorage.setItem('chatReadHistory', JSON.stringify(readHistory));

    // UI UPDATE
    const chatItem = document.getElementById(`chat-item-${chatId}`);
    if (chatItem) {
        const dot = chatItem.querySelector('.unread-dot');
        if (dot) dot.remove();
        const previewText = chatItem.querySelector('.chat-preview p');
        if (previewText) {
            previewText.style.fontWeight = '400';
            previewText.style.color = '#86868B';
        }
    }

    activeChatId = chatId;
    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
    if (chatItem) chatItem.classList.add('active');
    
    chatMessagesArea.innerHTML = '';
    if (unsubscribeMessages) unsubscribeMessages();

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        chatMessagesArea.innerHTML = '';
        if (snapshot.empty) chatMessagesArea.innerHTML = '<p class="system-msg">Inizia la conversazione con ' + chatTitle + '</p>';

        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.senderId === auth.currentUser.uid;
            const bubble = document.createElement('div');
            bubble.style.cssText = `
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
                background: ${isMe ? '#0071E3' : '#E5E5EA'};
                color: ${isMe ? 'white' : 'black'};
                padding: 10px 14px;
                border-radius: 18px;
                border-${isMe ? 'bottom-right' : 'bottom-left'}-radius: 4px;
                max-width: 70%; font-size: 14px; margin-bottom: 4px;
            `;
            bubble.textContent = msg.text;
            chatMessagesArea.appendChild(bubble);
        });
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    });
};

const sendMessage = async () => {
    const text = chatInput.value.trim();
    if (!text || !activeChatId) return;
    chatInput.value = '';
    try {
        await addDoc(collection(db, "chats", activeChatId, "messages"), {
            text: text,
            senderId: auth.currentUser.uid,
            timestamp: serverTimestamp()
        });

        await updateDoc(doc(db, "chats", activeChatId), {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            lastSenderId: auth.currentUser.uid
        });
    } catch (e) { console.error("Errore invio:", e); }
};

if (btnSend) btnSend.addEventListener('click', sendMessage);
if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

window.startChatWithClient = async (clientId, clientName) => {
    const myUid = auth.currentUser.uid;
    const myName = currentUserData.customName || currentUserData.name;
    const chatDocId = [myUid, clientId].sort().join('_');
    const chatRef = doc(db, "chats", chatDocId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
        await setDoc(chatRef, {
            participants: [myUid, clientId],
            participantNames: [myName, clientName],
            lastMessage: "Nuova Chat",
            lastMessageTime: serverTimestamp()
        });
    }
    document.querySelector('[data-target="section-chat"]').click();
    setTimeout(() => openChat(chatDocId, clientName), 500);
};

async function loadPendingRequests(coachId) {
    if (!requestsList) return;
    const q = query(collection(db, "users"), where("pendingCoachId", "==", coachId));

    onSnapshot(q, (snap) => {
        const count = snap.size;
        if (pendingCountEl) pendingCountEl.textContent = count;
        if (badgeHome) { badgeHome.textContent = count; badgeHome.classList.toggle('hidden', count === 0); }
        if (count === 0) { requestsList.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">Nessuna nuova richiesta.</div>'; return; }

        let html = '';
        snap.forEach(doc => {
            const req = doc.data();
            const date = req.updatedAt ? new Date(req.updatedAt).toLocaleDateString() : 'Oggi';
            html += `
                <div class="request-card" style="background:white; padding:16px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; gap:12px; align-items:center;">
                        <img src="${req.photoURL || 'https://via.placeholder.com/50'}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">
                        <div>
                            <h4 style="margin:0; font-size:15px; color:#1D1D1F;">${req.name}</h4>
                            <span style="font-size:12px; color:#86868B;">Obiettivo: ${req.goals || '-'}</span>
                            <div style="font-size:11px; color:#86868B; margin-top:2px;">Richiesta del: ${date}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="acceptRequest('${doc.id}')" style="background:#34C759; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;">Accetta</button>
                        <button onclick="rejectRequest('${doc.id}')" style="background:#FF3B30; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;">Rifiuta</button>
                    </div>
                </div>
            `;
        });
        requestsList.innerHTML = html;
    });
}

window.acceptRequest = async (clientId) => {
    try {
        await updateDoc(doc(db, "users", clientId), { coachId: auth.currentUser.uid, pendingCoachId: null, status: "active" });
        alert("Cliente accettato! Ora lo trovi nella lista Clienti.");
    } catch (e) { console.error(e); alert("Errore durante l'accettazione."); }
};
window.rejectRequest = async (clientId) => {
    if (!confirm("Rifiutare questa richiesta?")) return;
    try { await updateDoc(doc(db, "users", clientId), { pendingCoachId: null, status: null }); } catch (e) { console.error(e); }
};

// =========================================
// 8. ANALISI & LOGS
// =========================================

async function loadClientCharts(clientId) {
    const historyContainer = document.getElementById('workout-history-list');

    document.getElementById('view-history').classList.remove('hidden');
    document.getElementById('view-analysis').classList.add('hidden');
    if (historyContainer) historyContainer.innerHTML = '<p class="empty-msg">Ricerca storico...</p>';

    const clientSnap = await getDoc(doc(db, "users", clientId));
    const activeId = clientSnap.exists() ? clientSnap.data().activeWorkoutId : null;

    const qWorkouts = query(collection(db, "workouts"), where("assignedTo", "==", clientId), orderBy("createdAt", "desc"));
    const snapWorkouts = await getDocs(qWorkouts);

    const qLogs = query(collection(db, "users", clientId, "logs"), orderBy("date", "asc"));
    const snapLogs = await getDocs(qLogs);
    allClientLogs = [];
    snapLogs.forEach(doc => allClientLogs.push(doc.data()));

    if (historyContainer) {
        historyContainer.innerHTML = '';
        if (snapWorkouts.empty) { historyContainer.innerHTML = '<p class="empty-msg">Nessuna scheda assegnata.</p>'; return; }

        snapWorkouts.forEach(doc => {
            const w = doc.data();
            const count = allClientLogs.filter(l => l.workoutId === doc.id).length;
            const dateStr = w.createdAt ? new Date(w.createdAt.seconds * 1000).toLocaleDateString() : '-';
            const isActive = (doc.id === activeId);

            const card = document.createElement('div');
            card.className = 'history-card';
            card.onclick = () => openWorkoutAnalysis(doc.id, w.name, w.days);

            card.innerHTML = `
                <div class="hc-info"><h4>${w.name}</h4><span>Creata: ${dateStr} &bull; ${count} Allenamenti</span></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${isActive ? '<div class="hc-status active">ATTIVA</div>' : '<div class="hc-status archived">ARCHIVIO</div>'}
                    <i class="ph ph-caret-right" style="color:#ccc"></i>
                </div>
            `;
            historyContainer.appendChild(card);
        });
    }
}

window.openWorkoutAnalysis = (workoutId, workoutName, days) => {
    document.getElementById('view-history').classList.add('hidden');
    document.getElementById('view-analysis').classList.remove('hidden');
    document.getElementById('analysis-title').textContent = workoutName;

    currentAnalysisLogs = allClientLogs.filter(l => l.workoutId === workoutId);
    currentWorkoutDays = parseInt(days) || 7; 

    analysisType = 'exercise';
    updateToggleButtons();
    renderAnalysisList();
};

window.closeWorkoutAnalysis = () => {
    document.getElementById('view-analysis').classList.add('hidden');
    document.getElementById('view-history').classList.remove('hidden');
};

window.setAnalysisType = (btnElement, type) => {
    analysisType = type;
    updateToggleButtons();
    renderAnalysisList();
};

function updateToggleButtons() {
    document.querySelectorAll('.toggle-chip').forEach(btn => {
        btn.classList.remove('active');
        if (analysisType === 'exercise' && btn.textContent.includes('Esercizi')) btn.classList.add('active');
        if (analysisType === 'muscle' && btn.textContent.includes('Muscoli')) btn.classList.add('active');
        if (analysisType === 'session' && btn.textContent.includes('Sedute')) btn.classList.add('active');
    });
}

window.toggleSortOrder = () => {
    analysisSort = analysisSort === 'desc' ? 'asc' : 'desc';
    renderAnalysisList();
};

function renderAnalysisList() {
    const container = document.getElementById('analysis-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (!currentAnalysisLogs || currentAnalysisLogs.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nessun allenamento registrato per questa scheda.</p>';
        return;
    }

    let statsMap = {};
    const sortedLogs = [...currentAnalysisLogs].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (analysisType === 'exercise') {
        sortedLogs.forEach(log => {
            if (!log.exercises) return;
            log.exercises.forEach(ex => {
                if (!ex.sets) return;
                let maxKg = 0;
                ex.sets.forEach(s => {
                    const k = parseFloat(s.kg) || 0;
                    if (k > maxKg) maxKg = k;
                });
                if (maxKg > 0) {
                    if (!statsMap[ex.name]) statsMap[ex.name] = { name: ex.name, history: [] };
                    statsMap[ex.name].history.push({
                        date: log.date,
                        val: maxKg,
                        label: new Date(log.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
                    });
                }
            });
        });
    }
    else if (analysisType === 'muscle') {
        let maxDayInLogs = 0;
        sortedLogs.forEach(l => { if (l.dayIndex > maxDayInLogs) maxDayInLogs = l.dayIndex; });
        const limitDays = (typeof currentWorkoutDays !== 'undefined' && currentWorkoutDays > 0) ? currentWorkoutDays : (maxDayInLogs || 7);

        let cycles = [];
        let currentCycle = { id: 1, dayLogs: {} };
        let daysSeenInCycle = new Set();
        let lastDate = null;
        let lastDay = null;

        sortedLogs.forEach(log => {
            const dIndex = parseInt(log.dayIndex) || 1;
            const sDate = new Date(log.date).toDateString();
            const isUpdate = (lastDate === sDate && lastDay === dIndex);

            if (daysSeenInCycle.has(dIndex) && !isUpdate) {
                cycles.push(currentCycle);
                currentCycle = { id: currentCycle.id + 1, dayLogs: {} };
                daysSeenInCycle = new Set();
            }

            if (!isUpdate) daysSeenInCycle.add(dIndex);
            if (!currentCycle.dayLogs[dIndex]) currentCycle.dayLogs[dIndex] = [];
            currentCycle.dayLogs[dIndex].push(log);
            lastDate = sDate;
            lastDay = dIndex;
        });
        cycles.push(currentCycle);

        let memory = {};
        cycles.forEach(cycle => {
            let cycleMuscleStats = {};
            for (let d = 1; d <= limitDays; d++) {
                const logsForDay = cycle.dayLogs[d];
                if (logsForDay && logsForDay.length > 0) {
                    const log = logsForDay[logsForDay.length - 1];
                    if (log.exercises) {
                        log.exercises.forEach(ex => {
                            if (ex.muscles && ex.muscles.length > 0) {
                                const primaryMuscle = ex.muscles[0];
                                let maxSetKg = 0;
                                if (ex.sets) ex.sets.forEach(s => {
                                    const k = parseFloat(s.kg) || 0;
                                    if (k > maxSetKg) maxSetKg = k;
                                });
                                if (maxSetKg > 0) {
                                    if (!cycleMuscleStats[primaryMuscle]) cycleMuscleStats[primaryMuscle] = 0;
                                    cycleMuscleStats[primaryMuscle] += maxSetKg;
                                    if (!memory[primaryMuscle]) memory[primaryMuscle] = {};
                                    memory[primaryMuscle][d] = maxSetKg;
                                }
                            }
                        });
                    }
                } else {
                    Object.keys(memory).forEach(mName => {
                        if (memory[mName][d]) {
                            if (!cycleMuscleStats[mName]) cycleMuscleStats[mName] = 0;
                            cycleMuscleStats[mName] += memory[mName][d];
                        }
                    });
                }
            }
            if (Object.keys(cycleMuscleStats).length > 0) {
                Object.keys(cycleMuscleStats).forEach(mName => {
                    if (!statsMap[mName]) statsMap[mName] = { name: mName, history: [] };
                    statsMap[mName].history.push({
                        date: new Date().toISOString(),
                        val: cycleMuscleStats[mName],
                        label: `Ciclo ${cycle.id}`
                    });
                });
            }
        });
    }
    else if (analysisType === 'session') {
        sortedLogs.forEach(log => {
            if (!log.dayIndex) return;
            let sessionVol = 0;
            if (log.exercises) {
                log.exercises.forEach(ex => {
                    if (ex.sets) {
                        ex.sets.forEach(s => {
                            sessionVol += (parseFloat(s.kg) || 0) * (parseFloat(s.reps) || 0);
                        });
                    }
                });
            }
            let key = `Giorno ${log.dayIndex}`;
            if (sessionVol > 0) {
                if (!statsMap[key]) statsMap[key] = { name: key, history: [] };
                statsMap[key].history.push({
                    date: log.date,
                    val: sessionVol,
                    label: new Date(log.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
                });
            }
        });
    }

    let items = Object.values(statsMap).map(item => {
        const hist = item.history;
        if (!hist || hist.length < 1) return null;
        const startVal = hist[0].val;
        const endVal = hist[hist.length - 1].val;
        const perc = startVal > 0 ? (((endVal - startVal) / startVal) * 100) : 0;
        return { ...item, start: startVal, end: endVal, perc: parseFloat(perc.toFixed(1)) };
    }).filter(x => x !== null);

    items.sort((a, b) => analysisSort === 'desc' ? b.perc - a.perc : a.perc - b.perc);

    const searchVal = document.getElementById('analysis-search')?.value.toLowerCase() || '';
    if (searchVal) items = items.filter(i => i.name.toLowerCase().includes(searchVal));

    if (items.length === 0) {
        let msg = '<p class="empty-msg">Nessun risultato.</p>';
        if (analysisType === 'muscle') msg = '<p class="empty-msg">Dati insufficienti per i microcicli.</p>';
        container.innerHTML = msg;
        return;
    }

    items.forEach(item => {
        let badgeClass = 'flat'; let icon = 'minus';
        if (item.perc >= 2.5) { badgeClass = 'up'; icon = 'trend-up'; }
        else if (item.perc <= -2.5) { badgeClass = 'down'; icon = 'trend-down'; }

        const formatVal = (v) => (analysisType === 'session') ? (v / 1000).toFixed(2) + 't' : v + 'kg';
        const dateLabel = analysisType === 'muscle' ? 'Ciclo' : 'Inizio';

        const card = document.createElement('div');
        card.className = 'analysis-card';
        card.innerHTML = `
            <div class="ac-header" onclick="toggleChart(this, '${item.name.replace(/'/g, "\\'")}')">
                <div class="ac-info"><h4>${item.name}</h4><span>${dateLabel}: ${formatVal(item.start)} &bull; Attuale: ${formatVal(item.end)}</span></div>
                <div class="ac-stats">
                    <div class="badge-perc ${badgeClass}"><i class="ph ph-${icon}"></i> ${item.perc > 0 ? '+' : ''}${item.perc}%</div>
                    <div class="ac-icon"><i class="ph ph-caret-down"></i></div>
                </div>
            </div>
            <div class="ac-body">
                <div class="chart-wrapper-inner"><canvas id="chart-${item.name.replace(/[^a-zA-Z0-9]/g, '')}"></canvas></div>
            </div>
        `;
        container.appendChild(card);
        card.dataset.history = JSON.stringify(item.history);
    });
}

window.toggleChart = (header, name) => {
    const card = header.parentElement;
    const wasOpen = card.classList.contains('open');
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
    const canvasId = `chart-${safeName}`;

    document.querySelectorAll('.analysis-card.open').forEach(c => {
        c.classList.remove('open');
        const oldId = `chart-${c.querySelector('h4').textContent.replace(/[^a-zA-Z0-9]/g, '')}`;
        if (activeCharts[oldId]) { activeCharts[oldId].destroy(); delete activeCharts[oldId]; }
    });

    if (!wasOpen) {
        card.classList.add('open');
        const history = JSON.parse(card.dataset.history);
        setTimeout(() => drawAnalysisChart(canvasId, history, name), 150);
    }
};

function drawAnalysisChart(canvasId, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (activeCharts[canvasId]) { activeCharts[canvasId].destroy(); delete activeCharts[canvasId]; }

    const ctx = canvas.getContext('2d');
    const isVolume = (analysisType === 'session' || analysisType === 'muscle');

    activeCharts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => analysisType === 'muscle' ? d.label : new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })),
            datasets: [{
                label: isVolume ? 'Volume Totale' : 'Max Carico (kg)',
                data: data.map(d => d.val),
                borderColor: '#0071E3',
                backgroundColor: 'rgba(0, 113, 227, 0.1)',
                borderWidth: 3, pointRadius: 5, fill: true, tension: 0.3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, ticks: { callback: (v) => isVolume ? (v / 1000).toFixed(1) + 't' : v + 'kg' } },
                x: { grid: { display: false } }
            }
        }
    });
}

window.openLogHistoryPanel = () => {
    const panel = document.getElementById('log-history-panel');
    const container = document.getElementById('log-history-body');
    if (!panel || !container) {
        console.error("Elementi pannello non trovati nel DOM");
        return;
    }
    panel.classList.remove('hidden'); 
    setTimeout(() => { panel.classList.add('open'); }, 10);
    requestAnimationFrame(() => { panel.classList.add('open'); });

    if (!currentAnalysisLogs || currentAnalysisLogs.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">Nessun registro disponibile.</div>';
        return;
    }

    const logsDesc = [...currentAnalysisLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    let html = '';

    logsDesc.forEach(log => {
        const dateObj = new Date(log.date);
        const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const dayLabel = log.dayIndex ? `Giorno ${log.dayIndex}` : 'Allenamento';

        let exercisesHtml = '';
        if (log.exercises) {
            log.exercises.forEach(ex => {
                let setsHtml = '';
                if (ex.sets) {
                    ex.sets.forEach((s, idx) => {
                        const check = s.done ? '✓' : '';
                        const kg = parseFloat(s.kg) || 0;
                        const reps = parseFloat(s.reps) || 0;
                        setsHtml += `<span class="set-pill">${idx + 1}) <b>${kg}</b>kg x <b>${reps}</b> ${check}</span>`;
                    });
                }
                exercisesHtml += `
                    <div class="log-ex-item">
                        <div class="log-ex-name">${ex.name}</div>
                        <div class="log-sets-row">${setsHtml}</div>
                    </div>
                `;
            });
        }

        html += `
            <div class="log-entry-card">
                <div class="log-date-row">
                    <span class="log-date">${dateStr}</span>
                    <span class="log-day-badge">${dayLabel}</span>
                </div>
                <div class="log-body">
                    ${exercisesHtml || '<i style="font-size:12px">Nessun esercizio registrato</i>'}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
};

window.closeLogHistoryPanel = () => {
    const panel = document.getElementById('log-history-panel');
    panel.classList.remove('open');
    setTimeout(() => { panel.classList.add('hidden'); }, 300);
};

const miniProfileBtn = document.querySelector('.user-mini-profile');
const settingsNavLink = document.querySelector('.nav-link[data-target="section-settings"]');

if (miniProfileBtn && settingsNavLink) {
    miniProfileBtn.addEventListener('click', () => {
        settingsNavLink.click();
    });
}