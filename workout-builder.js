import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { defaultExercises } from './exercise-db.js';

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

// --- COSTANTI ---
// --- COSTANTI ---
//pl
let isPlMode = false;
let plWeeks = 4;
let plDaysPerWeek = 4;
let currentPlWeek = 1;
let currentPlDay = 1;
// Database Varianti (Hardcoded + Estensibile)
let VARIANTS_DB = {
    "Gara (Comp)": [
        { name: "Squat (Comp)", lifts: ["Squat"] }, { name: "Panca Piana (Comp)", lifts: ["Panca"] }, { name: "Stacco Sumo (Comp)", lifts: ["Stacco"] }, { name: "Stacco Classico (Comp)", lifts: ["Stacco"] }
    ],
    "Fermi (Pause)": [
        { name: "Fermo in buca (2s)", lifts: ["Squat"] }, { name: "Fermo al petto (1s)", lifts: ["Panca"] }, { name: "Fermo al ginocchio", lifts: ["Stacco"] }
    ],
    "Tempi (Isocinetica)": [
        { name: "Discesa Lenta (3s)", lifts: ["Squat", "Panca"] }, { name: "Salita Lenta (3s)", lifts: ["Squat", "Panca"] }
    ],
    "ROM Aumentato": [
        { name: "Deficit Deadlift", lifts: ["Stacco"] }, { name: "Larsen Press", lifts: ["Panca"] }
    ],
    "ROM Ridotto": [
        { name: "Pin Squat", lifts: ["Squat"] }, { name: "Board Press", lifts: ["Panca"] }, { name: "Block Pull", lifts: ["Stacco"] }
    ]
};

//fine pl



// --- COSTANTI AGGIORNATE ---

const MUSCLE_STRUCTURE = {
    // --- SPINTA (PETTO & SPALLE) ---
    "Pettorali": [
        "Gran Pettorale (Generale)", "Pettorale Alto (Clavicolare)", "Pettorale Basso (Sternocostale)", "Piccolo Pettorale", "Dentato Anteriore"
    ],
    "Deltoidi Anteriori": [
        "Deltoide Anteriore"
    ],
    "Deltoidi Laterali": [
        "Deltoide Laterale"
    ],
    "Deltoidi Posteriori": [
        "Deltoide Posteriore"
    ],
    "Cuffia dei Rotatori": [
        "Sovraspinato", "Sottospinato", "Piccolo Rotondo", "Sottoscapolare"
    ],

    // --- TIRATA (SCHIENA) ---
    "Schiena (Alta/Spessore)": [
        "Trapezio (Superiore)", "Trapezio (Medio)", "Trapezio (Inferiore)", "Romboidi", "Grande Rotondo"
    ],
    "Schiena (Ampiezza/Lats)": [
        "Gran Dorsale (Lats)", "Dorso (Generale)"
    ],
    "Schiena (Bassa/Lombari)": [
        "Erettori Spinali", "Quadrato dei Lombi", "Multifido", "Lombari (Generale)"
    ],

    // --- BRACCIA ---
    "Bicipiti": [
        "Bicipite Brachiale (Capo Lungo)", "Bicipite Brachiale (Capo Breve)", "Brachiale"
    ],
    "Tricipiti": [
        "Tricipite (Capo Lungo)", "Tricipite (Capo Laterale)", "Tricipite (Capo Mediale)", "Anconeo"
    ],
    "Avambracci": [
        "Brachioradiale", "Flessori del Polso", "Estensori del Polso"
    ],

    // --- GAMBE (PARTI ALTE) ---
    "Quadricipiti": [
        "Retto Femorale", "Vasto Laterale", "Vasto Mediale", "Vasto Intermedio", "Quadricipiti (Generale)"
    ],
    "Femorali (Ischiocrurali)": [
        "Bicipite Femorale (Capo Lungo)", "Bicipite Femorale (Capo Breve)", "Semitendinoso", "Semimembranoso"
    ],
    "Glutei": [
        "Grande Gluteo", "Medio Gluteo", "Piccolo Gluteo", "Piriforme"
    ],
    "Adduttori (Interno Coscia)": [
        "Grande Adduttore", "Adduttore Lungo/Breve", "Gracile", "Pettineo"
    ],
    "Abduttori (Esterno Coscia)": [
        "Tensore Fascia Lata (TFL)", "Sartorio"
    ],

    // --- GAMBE (PARTI BASSE) ---
    "Polpacci": [
        "Gastrocnemio (Gemelli)", "Soleo"
    ],
    "Tibiali": [
        "Tibiale Anteriore"
    ],

    // --- CORE & ALTRO ---
    "Addominali": [
        "Retto dell'Addome", "Obliqui Esterni", "Obliqui Interni", "Trasverso"
    ],
    "Accessori & Cardio": [
        "Collo (Sternocleidomastoideo)", "Cardio", "Full Body"
    ]
};

// ... mantieni le altre costanti (TECHNIQUES, etc.) ...

const TECHNIQUES = [
    "Standard", "Top set + back-off",
    "Drop Set", "Double Drop Set", "Triple Drop Set", "Strip Set",
    "Rest-pause", "Myo-reps", "Cluster set", "Widowmaker set", "AMRAP set",
    "Density training", "Escalating density", "Time under tension", "Extended set",
    "Back-off set", "Mechanical drop set", "Running the rack",
    "Descending sets", "Ascending sets", "Failure sets",
    "EMOM", "Tabata", "Circuit"
];

const INTENSITY_METRICS = [
    "RPE", "RIR", "%1RM", "Kg", "Velocity", "Reps@Load"
];

const TECHNIQUE_LAYOUTS = {
    "EMOM": { label1: "Minuti", label2: "Lavoro/Min" },
    "AMRAP set": { label1: "Tempo", label2: "Target Reps" },
    "Tabata": { label1: "Round", label2: "Sec ON/OFF" },
    "Time under tension": { label1: "Sets", label2: "TUT (sec)" },
    "Standard": { label1: "Sets", label2: "Reps" }
};

// --- STATO ---
let currentDay = 1;
let totalDays = 3;
let userVolumeSettings = { secondary: 0.5, tertiary: 0.3, quaternary: 0.15, other: 0.1 };
let volumeChartInstance = null;
let workoutData = { 1: [], 2: [], 3: [] };

// EDIT MODE STATE
let isPowerliftingMode = false;
let isEditMode = false;
let editingWorkoutId = null;
let originalAssignedTo = null; // Per gestire cambi assegnazione
let globalExerciseLibrary = { ...defaultExercises };
let exerciseSearchIndex = {}; // NUOVO: Indice per la ricerca (nome + alias)

// NUOVA FUNZIONE: Costruisce l'indice di ricerca
function rebuildSearchIndex() {
    exerciseSearchIndex = {};
    Object.entries(globalExerciseLibrary).forEach(([key, data]) => {
        // 1. Aggiungi il nome ufficiale (lowercase)
        exerciseSearchIndex[key.toLowerCase()] = { ...data, canonicalName: key };

        // 2. Aggiungi tutti gli alias
        if (data.aliases && Array.isArray(data.aliases)) {
            data.aliases.forEach(alias => {
                exerciseSearchIndex[alias.toLowerCase()] = { ...data, canonicalName: key };
            });
        }
    });
    console.log("Indice di ricerca ricostruito con alias.");
}
// DOM
const daysTabsContainer = document.getElementById('days-tabs-container');
const dayContentArea = document.getElementById('day-content-area');
const inputNumDays = document.getElementById('num-days');
const volumeChartCanvas = document.getElementById('volumeChart');
const workoutNameEl = document.getElementById('workout-name');
const modeToggle = document.getElementById('mode-toggle');
// --- INIT ---
// --- INIT ---
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "login.html"; return; }

    // 1. CARICA SETTINGS E LIBRERIA COACH
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
        const userData = userDoc.data(); // Definisco userData qui per usarlo dopo

        // A. Volume Settings
        if (userData.volumeSettings) {
            userVolumeSettings = { ...userVolumeSettings, ...userData.volumeSettings };
        }

        // B. CARICA LIBRERIA PERSONALIZZATA (CORRETTO)
        if (userData.exerciseLibrary) {
            // Unisce la bibbia standard con le personalizzazioni del coach
            globalExerciseLibrary = { ...defaultExercises, ...userData.exerciseLibrary };
            console.log("Libreria esercizi caricata e aggiornata.");

        }
        // C. CARICA VARIANTI PERSONALIZZATE
        if (userData.savedVariants) {
            // Uniamo le custom a quelle di base
            VARIANTS_DB = { ...VARIANTS_DB, ...userData.savedVariants };
            console.log("Varianti caricate dal DB.");
        }
    }
    rebuildSearchIndex();
    initChart();
    setupDatalist();




    //sezione pl2
    // Aggiungi questo nel blocco onAuthStateChanged o init


    if (modeToggle) {
        modeToggle.addEventListener('change', (e) => {
            // CONTROLLO SICUREZZA DATI
            // Se c'è qualcosa in workoutData, chiedi conferma
            let hasData = false;
            Object.values(workoutData).forEach(arr => { if (arr.length > 0) hasData = true; });

            if (hasData) {
                const confirmSwitch = confirm("ATTENZIONE: Cambiando modalità cancellerai TUTTA la scheda corrente.\nSei sicuro di voler procedere?");
                if (!confirmSwitch) {
                    e.target.checked = !e.target.checked; // Annulla click
                    return; // Esci
                }
                workoutData = {}; // Resetta i dati
            }

            isPlMode = e.target.checked;

            // Aggiorna UI
            document.getElementById('bb-controls').classList.toggle('hidden', isPlMode);
            document.getElementById('days-tabs-container').classList.toggle('hidden', isPlMode);
            document.getElementById('pl-navigation').classList.toggle('hidden', !isPlMode);
            document.getElementById('lbl-bb').classList.toggle('selected', !isPlMode);
            document.getElementById('lbl-pl').classList.toggle('selected', isPlMode);

            if (isPlMode) {
                // Setup Iniziale PL
                workoutData = {};
                for (let w = 1; w <= plWeeks; w++) {
                    for (let d = 1; d <= plDaysPerWeek; d++) {
                        workoutData[`w${w}_d${d}`] = [];
                    }
                }
                // Se è la prima volta assoluta o vuoto, apri setup
                document.getElementById('pl-setup-modal').classList.remove('hidden');
            } else {
                // Setup Iniziale BB
                workoutData = { 1: [], 2: [], 3: [] }; // Reset default BB
                renderTabs();
                renderDay(currentDay);
            }
        });
    }

    // SETUP MODAL LOGIC
    document.getElementById('btn-confirm-pl-setup').addEventListener('click', () => {
        plWeeks = parseInt(document.getElementById('pl-setup-weeks').value);
        plDaysPerWeek = parseInt(document.getElementById('pl-setup-days').value);

        // Inizializza struttura dati vuota per PL
        workoutData = {}; // Reset per pulizia (o gestisci merge se preferisci)
        for (let w = 1; w <= plWeeks; w++) {
            for (let d = 1; d <= plDaysPerWeek; d++) {
                workoutData[`w${w}_d${d}`] = [];
            }
        }

        document.getElementById('pl-setup-modal').classList.add('hidden');
        renderPlNav();
        renderPlDay();
    });
    //fine sezione pl2




    // 2. CONTROLLA SE SIAMO IN EDIT MODE
    const editId = localStorage.getItem('editWorkoutId');
    const templateId = localStorage.getItem('templateSourceId');

    if (editId) {
        await loadWorkoutToEdit(editId);
        localStorage.removeItem('editWorkoutId');
    } else if (templateId) {
        await loadWorkoutToEdit(templateId, true);
        localStorage.removeItem('templateSourceId');
    } else {
        renderTabs();
        renderDay(1);
    }
});

// --- LOAD DATA FUNCTION ---
async function loadWorkoutToEdit(id, isCopy = false) {
    try {
        const docRef = doc(db, "workouts", id);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            alert("Scheda non trovata o eliminata.");
            return;
        }

        const data = snap.data();

        // Popola variabili stato
        workoutData = data.data || {};
        totalDays = data.days || 3;

        // UI
        workoutNameEl.textContent = isCopy ? `${data.name} (Copia)` : data.name;
        inputNumDays.value = totalDays;

        if (!isCopy) {
            isEditMode = true;
            editingWorkoutId = id;
            originalAssignedTo = data.assignedTo;
            // Pre-imposta modalità salvataggio
            saveMode = data.isTemplate ? 'archive' : 'assign';
            if (data.assignedTo) modalClientSelect.value = data.assignedTo; // Nota: modalClientSelect va popolato
        }

        // Renderizza
        renderTabs();
        renderDay(1);
        updateLiveStats();

    } catch (e) {
        console.error("Errore caricamento edit:", e);
        alert("Errore nel caricamento della scheda.");
    }
}

// --- RENDER FUNCTIONS ---
function renderTabs() {
    daysTabsContainer.innerHTML = '';
    for (let i = 1; i <= totalDays; i++) {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${i === currentDay ? 'active' : ''}`;
        btn.textContent = `Giorno ${i}`;
        btn.onclick = () => { currentDay = i; renderTabs(); renderDay(i); };
        daysTabsContainer.appendChild(btn);
    }
}

function setupDatalist() {
    // Rimuovi se esiste già
    const existing = document.getElementById('exercise-suggestions');
    if (existing) existing.remove();

    const datalist = document.createElement('datalist');
    datalist.id = 'exercise-suggestions';

    // Ordina alfabeticamente
    const sortedKeys = Object.keys(globalExerciseLibrary).sort();

    sortedKeys.forEach(exName => {
        const opt = document.createElement('option');
        opt.value = exName;
        datalist.appendChild(opt);
    });

    document.body.appendChild(datalist);
}


// Cerca la funzione renderDay esistente e modificala così:
function renderDay(day) {
    dayContentArea.innerHTML = '';
    const listContainer = document.createElement('div');
    listContainer.className = 'exercises-list';
    dayContentArea.appendChild(listContainer);

    const exercises = workoutData[day] || [];
    exercises.forEach((exData, index) => {
        // --- BIVIO LOGICO ---
        if (isPowerliftingMode) {
            createPowerliftingRowHTML(listContainer, exData, index);
        } else {
            createExerciseRowHTML(listContainer, exData, index);
        }
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-exercise';
    addBtn.innerHTML = isPowerliftingMode ? '<i class="ph ph-barbell"></i> Aggiungi Lift (PL)' : '<i class="ph ph-plus-circle"></i> Aggiungi Esercizio';
    addBtn.onclick = () => {
        // Dati di default
        const newEx = {
            id: Date.now(), name: "",
            // Dati standard
            technique: "Standard", metricType: "RPE", val1: "", val2: "", intensityVal: "", notes: "", rest: "", muscles: [],
            // Dati PL Nuovi
            plType: "T1", // Tier 1
            plTargetSets: "1", plTargetReps: "1", plTargetRPE: "8",
            plBackoffSets: "3", plBackoffReps: "5",
            plBackoffLogic: "percent_top", // percent_top, percent_1rm, fixed_drop
            plBackoffVal: "-10%"
        };
        workoutData[day].push(newEx);

        // Renderizza la riga giusta
        if (isPowerliftingMode) createPowerliftingRowHTML(listContainer, newEx, workoutData[day].length - 1);
        else createExerciseRowHTML(listContainer, newEx, workoutData[day].length - 1);

        updateLiveStats();
    };
    dayContentArea.appendChild(addBtn);
    updateLiveStats();
}


// --- FUNZIONE HELPER PER CREARE IL CUSTOM DROPDOWN ---
function createMuscleDropdown(initialValue, onSelectCallback) {
    const container = document.createElement('div');
    container.className = 'custom-dropdown-wrapper';

    // 1. Trigger (quello che vedi chiuso)
    const trigger = document.createElement('div');
    trigger.className = 'dropdown-trigger';
    trigger.innerHTML = `<span>${initialValue || "Seleziona"}</span> <i class="ph ph-caret-down"></i>`;

    // 2. Menu (nascosto)
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';

    // 3. Search Box
    const searchDiv = document.createElement('div');
    searchDiv.className = 'dropdown-search-box';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Cerca muscolo...';
    searchDiv.appendChild(searchInput);

    // 4. Container Lista
    const listContainer = document.createElement('div');
    listContainer.className = 'dropdown-items-container';

    // Funzione interna per renderizzare la lista (usata anche dal search)
    const renderList = (filterText = "") => {
        listContainer.innerHTML = "";
        const lowerFilter = filterText.toLowerCase();

        Object.entries(MUSCLE_STRUCTURE).forEach(([parent, children]) => {
            // Se c'è filtro, vediamo se matcha il padre o i figli
            const matchesParent = parent.toLowerCase().includes(lowerFilter);
            const matchingChildren = children.filter(c => c.toLowerCase().includes(lowerFilter));

            // Se stiamo filtrando e non c'è match, saltiamo
            if (filterText && !matchesParent && matchingChildren.length === 0) return;

            // -- Creazione Riga Padre --
            const parentDiv = document.createElement('div');
            parentDiv.className = 'group-header';
            parentDiv.innerHTML = `<span>${parent}</span> <i class="ph ph-caret-right arrow-icon"></i>`;

            // -- Creazione Container Figli --
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'group-children';

            // Logica click su Padre: SELEZIONA il padre (come categoria generale)
            // MA se clicchi sulla freccia, espande solo
            parentDiv.addEventListener('click', (e) => {
                // Se clicco sulla freccia (o vicino), espando
                if (e.target.classList.contains('arrow-icon') || e.target.closest('.arrow-icon')) {
                    e.stopPropagation();
                    childrenContainer.classList.toggle('visible');
                    parentDiv.classList.toggle('expanded');
                } else {
                    // Altrimenti seleziono il valore del Padre
                    selectValue(parent); // Il padre vale come "Generale"
                }
            });

            // Se stiamo cercando, espandi tutto automatico
            if (filterText) {
                childrenContainer.classList.add('visible');
                parentDiv.classList.add('expanded');
            }

            // -- Creazione Righe Figli --
            const childrenToShow = filterText ? matchingChildren : children;

            childrenToShow.forEach(child => {
                const childDiv = document.createElement('div');
                childDiv.className = 'child-item';
                childDiv.textContent = child;
                if (child === initialValue) childDiv.classList.add('selected');

                childDiv.onclick = (e) => {
                    e.stopPropagation();
                    selectValue(child);
                };
                childrenContainer.appendChild(childDiv);
            });

            listContainer.appendChild(parentDiv);
            listContainer.appendChild(childrenContainer);
        });
    };

    // Azione di selezione
    const selectValue = (val) => {
        trigger.querySelector('span').textContent = val;
        menu.classList.remove('open');
        if (onSelectCallback) onSelectCallback(val);
    };

    // Events
    trigger.onclick = (e) => {
        // Chiudi altri dropdown aperti (opzionale ma consigliato)
        document.querySelectorAll('.dropdown-menu.open').forEach(el => {
            if (el !== menu) el.classList.remove('open');
        });
        menu.classList.toggle('open');
        if (menu.classList.contains('open')) {
            searchInput.value = '';
            renderList();
            searchInput.focus();
        }
    };

    // Search Event
    searchInput.addEventListener('input', (e) => renderList(e.target.value));

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            menu.classList.remove('open');
        }
    });

    renderList(); // Render iniziale

    menu.appendChild(searchDiv);
    menu.appendChild(listContainer);
    container.appendChild(trigger);
    container.appendChild(menu);

    // Espone un metodo per aggiornare valore programticamente (utile per l'autofill)
    container.setValue = (val) => {
        trigger.querySelector('span').textContent = val;
        // Non triggeriamo callback qui per evitare loop infiniti se necessario
    };

    return container;
}



function createExerciseRowHTML(container, data, index) {
    const row = document.createElement('div');
    row.className = 'exercise-row';
    const primaryMuscle = data.muscles.find(m => m.type === 'primary')?.name || "";

    // --- NUOVA STRUTTURA A 3 LIVELLI ---
    row.innerHTML = `
        <!-- ELEMENTI FISSI (Drag & Drop + Cestino) -->
        <div class="drag-handle"><i class="ph ph-dots-six-vertical"></i></div>
        <button class="btn-remove-row"><i class="ph ph-trash"></i></button>

        <!-- PIANO 1: ESERCIZIO E VOLUMI -->
        <div class="er-top-deck">
            <div class="input-wrapper ex-name-wrapper">
                <span class="tiny-label">Esercizio</span>
                <input type="text" class="input-ex-name" value="${data.name}" placeholder="Nome Esercizio" list="exercise-suggestions" autocomplete="off">
            </div>
            
            <!-- Area Dinamica (Sets/Reps) -->
            <div class="dynamic-inputs-area"></div>

            <div class="input-wrapper tech-wrapper">
                <span class="tiny-label">Tecnica</span>
                <select class="select-technique">
                    ${TECHNIQUES.map(t => `<option value="${t}" ${t === data.technique ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
        </div>

        <!-- PIANO 2: RECUPERO E INTENSITÀ -->
        <div class="er-mid-deck">
            <div class="input-wrapper rest-wrapper">
                <span class="tiny-label">Recupero</span>
                <input type="text" class="input-rest" value="${data.rest || ''}" placeholder="es. 90''">
            </div>

            <div class="intensity-group">
                <div class="input-wrapper">
                    <span class="tiny-label">Parametro</span>
                    <select class="select-metric">
                        ${INTENSITY_METRICS.map(m => `<option value="${m}" ${m === data.metricType ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
                <!-- Il valore (es. @8) verrà iniettato qui dalla logica dinamica o sotto -->
                <div class="input-wrapper">
                     <span class="tiny-label">Target</span>
                     <input type="text" class="input-intensity-val" value="${data.intensityVal || ''}" style="width: 50px; text-align: center; border-color: #FF2D55; font-weight:700;">
                </div>
            </div>
        </div>

        <!-- PIANO 3: MUSCOLI E NOTE -->
        <div class="er-bot-deck">
            <!-- Colonna Sinistra: Muscoli -->
            <div class="er-col-muscles">
                <span class="tiny-label">Focus Muscolare</span>
                <div class="muscle-dropdown-placeholder"></div> <!-- Qui va il Custom Dropdown -->
                
                <div class="synergists-list"></div>
                <button class="btn-add-synergist"><i class="ph ph-plus"></i> Sinergico</button>
            </div>

            <!-- Colonna Destra: Note -->
            <div class="er-col-notes">
                <span class="tiny-label">Note Tecniche per il Cliente</span>
                <textarea class="input-notes" placeholder="Scrivi indicazioni sull'esecuzione...">${data.notes || ''}</textarea>
            </div>
        </div>
    `;
    container.appendChild(row);

    // --- LOGICA JAVASCRIPT (Aggiornata ai nuovi selettori) ---

    // 1. Gestione Sets/Reps Dinamici
    const dynamicArea = row.querySelector('.dynamic-inputs-area');

    const renderCentralInputs = () => {
        dynamicArea.innerHTML = '';

        if (data.technique === "Top set + back-off") {
            // Layout Speciale Top Set
            dynamicArea.className = 'dynamic-inputs-area special-mode';
            dynamicArea.innerHTML = `
                <div class="special-group">
                    <span class="tiny-label">TOP</span>
                    <div style="display:flex; gap:2px; align-items:center;">
                        <span style="font-size:11px; color:#888;">1 x</span>
                        <input type="text" class="special-input input-top-reps" value="${data.topReps || ''}" placeholder="Reps">
                        <span style="font-size:11px; color:#888;">@</span>
                        <input type="text" class="special-input input-top-int" value="${data.topInt || ''}" placeholder="${data.metricType}">
                    </div>
                </div>
                <div class="special-group">
                    <span class="tiny-label">BACK</span>
                    <div style="display:flex; gap:2px; align-items:center;">
                        <input type="text" class="special-input input-back-sets" value="${data.backSets || ''}" placeholder="Sets">
                        <span style="font-size:11px; color:#888;">x</span>
                        <input type="text" class="special-input input-back-reps" value="${data.backReps || ''}" placeholder="Reps">
                    </div>
                </div>`;
            // Nascondi input intensità standard se siamo in top set (opzionale)
            row.querySelector('.input-intensity-val').parentElement.style.display = 'none';

        } else {
            // Layout Standard
            dynamicArea.className = 'dynamic-inputs-area standard-mode';
            const layout = TECHNIQUE_LAYOUTS[data.technique] || TECHNIQUE_LAYOUTS["Standard"];

            dynamicArea.innerHTML = `
                <div class="input-wrapper">
                    <span class="tiny-label">${layout.label1}</span>
                    <input type="text" class="input-sets" value="${data.val1 || ''}">
                </div>
                <div class="input-wrapper">
                    <span class="tiny-label">${layout.label2}</span>
                    <input type="text" class="input-reps" value="${data.val2 || ''}">
                </div>
            `;
            // Mostra input intensità standard
            const intValContainer = row.querySelector('.input-intensity-val').parentElement;
            if (intValContainer) intValContainer.style.display = 'block';
        }

        // Riattacca listeners agli input dinamici
        dynamicArea.querySelectorAll('input').forEach(i => i.addEventListener('input', updateData));
    };

    // 2. Funzione Update Data
    const updateData = () => {
        data.name = row.querySelector('.input-ex-name').value;
        data.technique = row.querySelector('.select-technique').value;
        data.metricType = row.querySelector('.select-metric').value;
        data.notes = row.querySelector('.input-notes').value;
        data.rest = row.querySelector('.input-rest').value;

        // Input intensità standard (potrebbe essere nascosto in Top Set)
        const intInput = row.querySelector('.input-intensity-val');
        if (intInput) data.intensityVal = intInput.value;

        if (data.technique === "Top set + back-off") {
            data.topReps = row.querySelector('.input-top-reps')?.value;
            data.topInt = row.querySelector('.input-top-int')?.value;
            data.backSets = row.querySelector('.input-back-sets')?.value;
            data.backReps = row.querySelector('.input-back-reps')?.value;
            data.backInt = row.querySelector('.input-back-int')?.value; // (se c'è)
            data.val1 = "";
        } else {
            data.val1 = row.querySelector('.input-sets')?.value;
            data.val2 = row.querySelector('.input-reps')?.value;
        }
        updateLiveStats();
    };

    renderCentralInputs();

    // 3. Event Listeners Generali
    row.querySelector('.input-ex-name').addEventListener('input', updateData);
    row.querySelector('.input-notes').addEventListener('input', updateData);
    row.querySelector('.input-rest').addEventListener('input', updateData);
    row.querySelector('.input-intensity-val').addEventListener('input', updateData);

    row.querySelector('.select-technique').addEventListener('change', (e) => {
        data.technique = e.target.value;
        renderCentralInputs();
        updateData();
    });

    row.querySelector('.select-metric').addEventListener('change', (e) => {
        data.metricType = e.target.value;
        // Aggiorna placeholder input speciali se esistono
        const topInt = row.querySelector('.input-top-int');
        if (topInt) topInt.placeholder = data.metricType;
    });

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        workoutData[currentDay].splice(index, 1);
        renderDay(currentDay);
    });

    // 4. Inizializzazione Custom Dropdown (Muscolo Primario)
    const muscleContainer = row.querySelector('.muscle-dropdown-placeholder');
    const onMuscleChange = (newValue) => {
        data.muscles = data.muscles.filter(m => m.type !== 'primary');
        if (newValue) data.muscles.unshift({ name: newValue, type: 'primary' });
        updateData();
        updateLiveStats();
    };
    const dropdownEl = createMuscleDropdown(primaryMuscle, onMuscleChange);
    muscleContainer.appendChild(dropdownEl);
    row.dropdownComponent = dropdownEl;

    // 5. Gestione Sinergici
    const synList = row.querySelector('.synergists-list');
    const renderSynergists = () => {
        synList.innerHTML = '';
        const syns = data.muscles.filter(m => m.type !== 'primary');
        syns.forEach((m) => {
            const div = document.createElement('div');
            div.className = 'synergist-row';

            // Select Tipo
            const typeSelect = document.createElement('select');
            typeSelect.innerHTML = `
                <option value="secondary" ${m.type === 'secondary' ? 'selected' : ''}>Secondario</option>
                <option value="tertiary" ${m.type === 'tertiary' ? 'selected' : ''}>Terziario</option>
            `;
            typeSelect.addEventListener('change', (e) => { m.type = e.target.value; updateLiveStats(); });

            // Dropdown Muscolo Sinergico
            const onSynChange = (newVal) => { m.name = newVal; updateLiveStats(); };
            const dd = createMuscleDropdown(m.name, onSynChange);

            // Delete Btn
            const delBtn = document.createElement('i');
            delBtn.className = 'ph ph-x btn-del-syn';
            delBtn.onclick = () => {
                const realIndex = data.muscles.indexOf(m);
                if (realIndex > -1) data.muscles.splice(realIndex, 1);
                renderSynergists();
                updateLiveStats();
            };

            div.appendChild(typeSelect);
            div.appendChild(dd);
            div.appendChild(delBtn);
            synList.appendChild(div);
        });
    };
    renderSynergists();
    row.querySelector('.btn-add-synergist').addEventListener('click', () => {
        data.muscles.push({ name: "", type: "secondary" });
        renderSynergists();
    });

    // 6. Auto-Fill (Logica Ricerca)
    const nameInput = row.querySelector('.input-ex-name');
    nameInput.addEventListener('input', (e) => {
        const val = e.target.value;
        updateData();
        if (val.endsWith(' ')) return;

        const searchKey = val.trim().toLowerCase();
        const foundExercise = exerciseSearchIndex[searchKey];

        if (foundExercise) {
            if (foundExercise.p && row.dropdownComponent) {
                row.dropdownComponent.setValue(foundExercise.p);
                data.muscles = data.muscles.filter(m => m.type !== 'primary');
                data.muscles.unshift({ name: foundExercise.p, type: 'primary' });
            }

            const currentSyns = data.muscles.filter(m => m.type !== 'primary');
            if (currentSyns.length === 0 && foundExercise.s && foundExercise.s.length > 0) {
                data.muscles = data.muscles.filter(m => m.type === 'primary');
                foundExercise.s.forEach(item => {
                    if (typeof item === 'string') data.muscles.push({ name: item, type: 'secondary' });
                    else data.muscles.push({ name: item.name, type: item.type });
                });
                renderSynergists();
            }
            updateLiveStats();
        }
    });
}

function updateLiveStats() {
    // 1. Struttura dati annidata: { "Schiena": { total: 0, children: { "Gran Dorsale": 0 } } }
    let hierarchyMap = {};

    // Inizializza categorie vuote
    Object.keys(MUSCLE_STRUCTURE).forEach(cat => {
        hierarchyMap[cat] = { total: 0, children: {} };
    });

    // 2. Calcolo Volumi
    Object.keys(workoutData).forEach(dayKey => {

        workoutData[dayKey].forEach(ex => {
            if (ex.isFundamental && ex.excludeVolume) return;
            let sets = 0;
            if (ex.technique === "Top set + back-off") {
                const backSets = parseFloat(ex.backSets) || 0;
                sets = 1 + backSets;
            } else {
                sets = parseFloat(ex.val1) || 0;
            }
            if (sets === 0) return;

            ex.muscles.forEach(m => {
                if (!m.name) return;

                // Moltiplicatori
                let mult = 0;
                if (m.type === 'primary') mult = 1.0;
                else if (m.type === 'secondary') mult = userVolumeSettings.secondary;
                else if (m.type === 'tertiary') mult = userVolumeSettings.tertiary;
                else if (m.type === 'quaternary') mult = userVolumeSettings.quaternary;
                else mult = userVolumeSettings.other;

                const volume = sets * mult;

                // Trova Padre
                let parent = "Altro";
                for (const [cat, list] of Object.entries(MUSCLE_STRUCTURE)) {
                    if (list.includes(m.name) || cat === m.name) {
                        parent = cat;
                        break;
                    }
                }
                if (!hierarchyMap[parent]) hierarchyMap[parent] = { total: 0, children: {} };

                // Aggiorna Totale Padre
                hierarchyMap[parent].total += volume;

                // Aggiorna Dettaglio Figlio
                const childName = m.name;
                if (!hierarchyMap[parent].children[childName]) hierarchyMap[parent].children[childName] = 0;
                hierarchyMap[parent].children[childName] += volume;
            });
        });
    });

    renderStatsUI(hierarchyMap)
}

// Helper per generare colori costanti per le stringhe
function getStringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}







let currentChartFocus = null;
function initChart() {
    const ctx = volumeChartCanvas.getContext('2d');

    volumeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return ` ${context.label}: ${context.raw.toFixed(1)} Sets`;
                        }
                    }
                }
            },
            // GESTIONE CLICK SULLE FETTE
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const labelClicked = volumeChartInstance.data.labels[index];

                    // Se clicco su una categoria Padre (e non sono già dentro)
                    if (!currentChartFocus) {
                        currentChartFocus = labelClicked;
                        updateLiveStats(); // Ridisegna focalizzato
                    }
                }
            }
        }
    });

    // Gestione Bottone Indietro
    document.getElementById('btn-chart-back').addEventListener('click', () => {
        currentChartFocus = null;
        updateLiveStats();
    });
}



inputNumDays.addEventListener('change', (e) => { totalDays = parseInt(e.target.value); for (let i = 1; i <= totalDays; i++) if (!workoutData[i]) workoutData[i] = []; renderTabs(); });
document.getElementById('btn-back').addEventListener('click', () => { if (confirm("Esci senza salvare?")) window.location.href = "dashboard-pt.html"; });

// --- MODALE E SAVE ---
const modal = document.getElementById('save-modal');
const btnOpenSave = document.getElementById('btn-save-workout');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnConfirmSave = document.getElementById('btn-confirm-save');
const optAssign = document.getElementById('opt-assign'); const optArchive = document.getElementById('opt-archive');
const modalClientSelect = document.getElementById('modal-client-select'); const modalTemplateName = document.getElementById('modal-template-name');
let saveMode = 'assign';

// --- CORREZIONE DEL LISTENER APERTURA MODALE ---

btnOpenSave.addEventListener('click', async () => {
    // 1. Validazione
    let hasExercises = false;
    for (let i = 1; i <= totalDays; i++) {
        if (workoutData[i] && workoutData[i].length > 0) hasExercises = true;
    }

    if (!hasExercises) {
        alert("La scheda è vuota! Aggiungi almeno un esercizio.");
        return;
    }

    // 2. Apri Modale
    modal.classList.remove('hidden');

    // 3. CARICA SEMPRE I CLIENTI SE LA LISTA È VUOTA (Fix del bug)
    if (modalClientSelect.options.length <= 1) {
        await loadClientsForModal();
    }

    // 4. Gestione Stato Modifica (Pre-selezione)
    if (isEditMode) {
        // Se la scheda era già assegnata a qualcuno, pre-selezionalo
        if (originalAssignedTo) {
            // Assicuriamoci che l'opzione "Assegna" sia attiva visivamente
            optAssign.click();
            modalClientSelect.value = originalAssignedTo;
        } else {
            // Se era in archivio, mantieni la selezione "Archivio" ma la lista clienti è pronta se cambi idea
            optArchive.click();
        }
    }
});
btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
optAssign.addEventListener('click', () => { saveMode = 'assign'; optAssign.classList.add('active'); optArchive.classList.remove('active'); modalClientSelect.classList.remove('hidden'); modalTemplateName.classList.add('hidden'); });
optArchive.addEventListener('click', () => { saveMode = 'archive'; optArchive.classList.add('active'); optAssign.classList.remove('active'); modalClientSelect.classList.add('hidden'); modalTemplateName.classList.remove('hidden'); modalTemplateName.value = document.getElementById('workout-name').textContent.trim(); });
optAssign.classList.add('active');

btnConfirmSave.addEventListener('click', async () => {
    const user = auth.currentUser; if (!user) return;
    btnConfirmSave.textContent = "Salvataggio..."; btnConfirmSave.disabled = true;
    // ... dentro btnConfirmSave ... prima del try ...

    // --- APPRENDIMENTO AUTOMATICO AVANZATO (Con Tipi) ---
    const newKnowledge = {};
    let hasNewKnowledge = false;

    for (let i = 1; i <= totalDays; i++) {
        if (workoutData[i]) {
            workoutData[i].forEach(ex => {
                const name = ex.name.trim();
                if (!name) return;

                // Dati Attuali della Scheda
                const currentPrimary = ex.muscles.find(m => m.type === 'primary')?.name;
                // Prendiamo l'oggetto completo {name, type} per i sinergici, escludendo nomi vuoti
                const currentSynergists = ex.muscles
                    .filter(m => m.type !== 'primary' && m.name)
                    .map(m => ({ name: m.name, type: m.type }));

                if (!currentPrimary) return;

                const known = exerciseSearchIndex[name.toLowerCase()];
                let isDifferent = false;

                if (!known) {
                    isDifferent = true; // Nuovo esercizio
                } else {
                    // 1. Confronta Primario
                    if (known.p !== currentPrimary) isDifferent = true;

                    // 2. Confronta Sinergici (Normalizziamo il DB per il confronto)
                    // Il DB base ha stringhe ["Tri"], noi abbiamo [{name:"Tri", type:"sec"}]
                    // Dobbiamo convertire il DB base in formato oggetto per confrontare mele con mele.

                    let knownSynergistsNorm = [];
                    if (known.s) {
                        knownSynergistsNorm = known.s.map(item => {
                            if (typeof item === 'string') return { name: item, type: 'secondary' };
                            return { name: item.name, type: item.type };
                        });
                    }

                    // Logica di confronto array profonda
                    if (knownSynergistsNorm.length !== currentSynergists.length) {
                        isDifferent = true;
                    } else {
                        // Ordiniamo per nome per confrontare
                        const sortFn = (a, b) => a.name.localeCompare(b.name);
                        knownSynergistsNorm.sort(sortFn);
                        const currentSynsSorted = [...currentSynergists].sort(sortFn);

                        for (let k = 0; k < knownSynergistsNorm.length; k++) {
                            // Se cambia il NOME o cambia il TIPO -> È diverso
                            if (knownSynergistsNorm[k].name !== currentSynsSorted[k].name ||
                                knownSynergistsNorm[k].type !== currentSynsSorted[k].type) {
                                isDifferent = true;
                                break;
                            }
                        }
                    }
                }

                if (isDifferent) {
                    // SALVA LA DEFINIZIONE COMPLETA (Con i tipi!)
                    newKnowledge[name] = {
                        p: currentPrimary,
                        s: currentSynergists // Salva array di oggetti: [{name:'...', type:'tertiary'}]
                    };
                    hasNewKnowledge = true;
                }
            });
        }
    }

    if (hasNewKnowledge) {
        try {
            const userRef = doc(db, "users", user.uid);
            const updatePayload = {};
            // Usa la dot notation per aggiornare chiavi specifiche nella mappa
            for (const [key, val] of Object.entries(newKnowledge)) {
                updatePayload[`exerciseLibrary.${key}`] = val;
            }
            // Salvataggio silenzioso
            updateDoc(userRef, updatePayload).catch(e => console.warn("Errore learning:", e));
            console.log("🧠 Appreso nuove definizioni:", newKnowledge);
        } catch (e) { console.warn(e); }
    }
    try {
        let finalName = document.getElementById('workout-name').textContent.trim();
        let assignedClientId = null;
        let isTemplate = false;

        if (saveMode === 'assign') {
            assignedClientId = modalClientSelect.value;
            if (!assignedClientId) { alert("Seleziona un atleta!"); btnConfirmSave.disabled = false; return; }
        } else {
            finalName = modalTemplateName.value.trim() || finalName;
            isTemplate = true;
        }

        const workoutPayload = {
            coachId: user.uid, name: finalName, days: totalDays, data: workoutData,
            assignedTo: assignedClientId, isTemplate: isTemplate, volumeSettingsUsed: userVolumeSettings,
            updatedAt: serverTimestamp(), isArchived: false
        };

        if (isEditMode && editingWorkoutId) {
            // UPDATE ESISTENTE
            const ref = doc(db, "workouts", editingWorkoutId);
            await updateDoc(ref, workoutPayload);
        } else {
            // CREATE NUOVO
            workoutPayload.createdAt = serverTimestamp();
            const ref = await addDoc(collection(db, "workouts"), workoutPayload);
            editingWorkoutId = ref.id; // Così se clicco ancora salva aggiorna
            isEditMode = true;
        }

        if (assignedClientId) {
            const clientRef = doc(db, "users", assignedClientId);
            await updateDoc(clientRef, { activeWorkoutId: editingWorkoutId || "pending", lastWorkoutUpdate: serverTimestamp() });
        }

        alert("Salvato con successo!");
        window.location.href = "dashboard-pt.html";

    } catch (error) { console.error(error); alert("Errore: " + error.message); btnConfirmSave.disabled = false; }
});

async function loadClientsForModal() {
    modalClientSelect.innerHTML = '<option value="" disabled selected>Scegli Atleta...</option>';
    const q = query(collection(db, "users"), where("role", "==", "client"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        const client = doc.data();
        const option = document.createElement('option');
        option.value = client.uid;
        option.textContent = client.name || client.email;
        modalClientSelect.appendChild(option);
    });
}


//sezione powerlifting
// =========================================
// 8. GENERATORE RIGA POWERLIFTING (Nuova Funzione)
// =========================================
function createPowerliftingRowHTML(container, data, index) {
    const row = document.createElement('div');
    row.className = 'exercise-row pl-row'; // Classe specifica

    // Valori default se mancanti
    if (!data.plBackoffLogic) data.plBackoffLogic = "percent_top";

    row.innerHTML = `
        <div class="drag-handle"><i class="ph ph-dots-six-vertical"></i></div>
        <button class="btn-remove-row"><i class="ph ph-trash"></i></button>

        <!-- HEADER RIGA: Nome e Tier -->
        <div class="pl-header">
            <span class="tier-badge">${data.plType || 'T1'}</span>
            <input type="text" class="input-ex-name" value="${data.name}" placeholder="Nome Main Lift (es. Squat)" list="exercise-suggestions" style="font-weight:700; font-size:16px; border:none; padding:0;">
        </div>

        <!-- GRIGLIA LOGICA PL -->
        <div class="pl-logic-grid">
            
            <!-- 1. TOP SET / TARGET -->
            <div class="pl-section">
                <div class="pl-section-title">🎯 Top Set / Target</div>
                <div class="pl-inputs-row">
                    <input type="text" class="pl-input-mini input-top-sets" value="${data.plTargetSets || 1}" placeholder="Sets">
                    <span class="pl-text-fixed">x</span>
                    <input type="text" class="pl-input-mini input-top-reps" value="${data.plTargetReps || ''}" placeholder="Reps">
                    <span class="pl-text-fixed">@</span>
                    <input type="text" class="pl-input-mini input-top-rpe inp-rpe" value="${data.plTargetRPE || ''}" placeholder="RPE">
                </div>
            </div>

            <!-- 2. BACK-OFF LOGIC -->
            <div class="pl-section">
                <div class="pl-section-title">📉 Back-off Work</div>
                
                <!-- Riga 1: Volume -->
                <div class="pl-inputs-row" style="margin-bottom:6px;">
                    <input type="text" class="pl-input-mini input-back-sets" value="${data.plBackoffSets || ''}" placeholder="Sets">
                    <span class="pl-text-fixed">x</span>
                    <input type="text" class="pl-input-mini input-back-reps" value="${data.plBackoffReps || ''}" placeholder="Reps">
                </div>

                <!-- Riga 2: Intensità (Il cuore della richiesta) -->
                <div class="pl-inputs-row">
                    <input type="text" class="pl-input-mini input-back-val inp-perc" value="${data.plBackoffVal || ''}" placeholder="%/kg">
                    <select class="pl-select-logic input-back-logic">
                        <option value="percent_top" ${data.plBackoffLogic === 'percent_top' ? 'selected' : ''}>su Top Set (Load drop)</option>
                        <option value="percent_1rm" ${data.plBackoffLogic === 'percent_1rm' ? 'selected' : ''}>su 1RM (Percentuale)</option>
                        <option value="rpe_static" ${data.plBackoffLogic === 'rpe_static' ? 'selected' : ''}>RPE Fisso</option>
                        <option value="kg_static" ${data.plBackoffLogic === 'kg_static' ? 'selected' : ''}>Carico Fisso (Kg)</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- MUSCOLI (Semplificato per PL) -->
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="muscle-dropdown-placeholder" style="width:200px;"></div>
            <input type="text" class="input-rest" value="${data.rest || ''}" placeholder="Rec. (es. 3-5')" style="width:100px;">
        </div>
    `;

    container.appendChild(row);

    // --- LOGICA LISTENER ---
    const updateData = () => {
        data.name = row.querySelector('.input-ex-name').value;
        data.plTargetSets = row.querySelector('.input-top-sets').value;
        data.plTargetReps = row.querySelector('.input-top-reps').value;
        data.plTargetRPE = row.querySelector('.input-top-rpe').value;

        data.plBackoffSets = row.querySelector('.input-back-sets').value;
        data.plBackoffReps = row.querySelector('.input-back-reps').value;
        data.plBackoffVal = row.querySelector('.input-back-val').value;
        data.plBackoffLogic = row.querySelector('.input-back-logic').value;

        data.rest = row.querySelector('.input-rest').value;

        // Mappatura sui vecchi campi per compatibilità Grafico Volume
        // Consideriamo il volume totale PL come (Set Top + Set Backoff)
        const tS = parseFloat(data.plTargetSets) || 0;
        const bS = parseFloat(data.plBackoffSets) || 0;
        data.val1 = tS + bS; // Sets Totali

        updateLiveStats();
    };

    // Attach Listeners
    row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateData));

    // Delete
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        workoutData[currentDay].splice(index, 1);
        renderDay(currentDay);
    });

    // Auto-fill e Muscoli (Riutilizziamo la logica esistente)
    const primaryMuscle = data.muscles.find(m => m.type === 'primary')?.name || "";
    const onMuscleChange = (newValue) => {
        data.muscles = data.muscles.filter(m => m.type !== 'primary');
        if (newValue) data.muscles.unshift({ name: newValue, type: 'primary' });
        updateData();
    };
    const dropdownEl = createMuscleDropdown(primaryMuscle, onMuscleChange);
    row.querySelector('.muscle-dropdown-placeholder').appendChild(dropdownEl);
    row.dropdownComponent = dropdownEl;

    // Search logic (Copiata e adattata)
    const nameInput = row.querySelector('.input-ex-name');
    nameInput.addEventListener('input', (e) => {
        const val = e.target.value; updateData();
        if (val.endsWith(' ')) return;
        const searchKey = val.trim().toLowerCase();
        const foundExercise = exerciseSearchIndex[searchKey];
        if (foundExercise && row.dropdownComponent) {
            row.dropdownComponent.setValue(foundExercise.p);
            data.muscles = [{ name: foundExercise.p, type: 'primary' }];
            updateLiveStats();
        }
    });
}


//sezione pl2


// =========================================
// === FUNZIONI POWERLIFTING / S&C MODE ===
// =========================================

// --- RENDER NAVIGAZIONE (Week 1, Day 1...) ---
function renderPlNav() {
    const wCont = document.getElementById('pl-weeks-container');
    const dCont = document.getElementById('pl-days-container');

    // Sicurezza: se gli elementi non esistono (es. siamo in BB mode caricata male), esci
    if (!wCont || !dCont) return;

    wCont.innerHTML = '';
    dCont.innerHTML = '';

    // Render Weeks Buttons
    for (let w = 1; w <= plWeeks; w++) {
        const btn = document.createElement('button');
        btn.className = `btn-week ${w === currentPlWeek ? 'active' : ''}`;
        btn.textContent = `Week ${w}`;
        btn.onclick = () => { currentPlWeek = w; renderPlNav(); renderPlDay(); };
        wCont.appendChild(btn);
    }

    // Render Days Buttons
    for (let d = 1; d <= plDaysPerWeek; d++) {
        const btn = document.createElement('button');
        btn.className = `btn-day ${d === currentPlDay ? 'active' : ''}`;
        btn.textContent = `Day ${d}`;
        btn.onclick = () => { currentPlDay = d; renderPlNav(); renderPlDay(); };
        dCont.appendChild(btn);
    }
}

// --- RENDER GIORNO CORRENTE (PL) ---
function renderPlDay() {
    const key = `w${currentPlWeek}_d${currentPlDay}`;
    dayContentArea.innerHTML = '';
    const listContainer = document.createElement('div');
    listContainer.className = 'exercises-list';
    dayContentArea.appendChild(listContainer);

    if (!workoutData[key]) workoutData[key] = [];
    const exercises = workoutData[key];

    exercises.forEach((exData, index) => {
        if(exData.isFundamental) {
            createFundamentalRowHTML(listContainer, exData, index, key);
        } else {
            // Crea card standard
            createExerciseRowHTML(listContainer, exData, index);
            
            // --- FIX DELETE PER COMPLEMENTARI PL ---
            // Sovrascriviamo l'onclick del cestino appena creato
            const row = listContainer.lastChild;
            const delBtn = row.querySelector('.btn-remove-row');
            // Clona il bottone per rimuovere i vecchi listener BB
            const newDelBtn = delBtn.cloneNode(true);
            delBtn.parentNode.replaceChild(newDelBtn, delBtn);
            
            newDelBtn.onclick = () => {
                if(confirm("Eliminare complementare?")) {
                    workoutData[key].splice(index, 1);
                    renderPlDay();
                }
            };
            
            // Aggiungi tasto copia week
            addCopyToWeeksBtn(row, exData, index, key);
        }
    });

    // ... (Il resto dei bottoni aggiungi rimane uguale) ...
    // ... Copia qui sotto i bottoni "Aggiungi Fondamentale/Complementare" e "Copia Tutto" dal codice precedente ...
    // (Se non vuoi ricopiarli dimmelo, ma è meglio avere la funzione pulita)
    
    // CODICE BOTTONI (Riassunto per brevità, assicurati di averlo):
    const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex; gap:10px; margin-top:20px;';
    const addFundBtn = document.createElement('button'); addFundBtn.className = 'btn-primary'; addFundBtn.style.cssText = 'flex:1; background:#FF9500;'; addFundBtn.innerHTML = '<i class="ph ph-barbell"></i> + Fondamentale';
    addFundBtn.onclick = () => {
        workoutData[key].push({ id: Date.now(), isFundamental: true, excludeVolume: true, variant: "Seleziona...", trackingMetric: "Kg", sets: [] });
        renderPlDay();
    };
    const addAccBtn = document.createElement('button'); addAccBtn.className = 'btn-secondary'; addAccBtn.style.flex = '1'; addAccBtn.innerHTML = '<i class="ph ph-plus"></i> + Complementare';
    addAccBtn.onclick = () => {
        workoutData[key].push({ id: Date.now(), name: "", technique: "Standard", muscles: [], isFundamental: false });
        renderPlDay();
    };
    btnRow.append(addFundBtn, addAccBtn); dayContentArea.appendChild(btnRow);

    const copyAllBtn = document.createElement('button'); copyAllBtn.className = 'btn-secondary'; copyAllBtn.style.cssText = 'width:100%; margin-top:15px; border-style:dashed; color:#0071E3;';
    copyAllBtn.innerHTML = `<i class="ph ph-copy-simple"></i> Copia tutti i complementari su Week 2-${plWeeks}`;
    copyAllBtn.onclick = () => {
        if(!confirm("Copiare TUTTI i complementari?")) return;
        const accs = workoutData[key].filter(e => !e.isFundamental);
        const dayNum = currentPlDay;
        for(let w=1; w<=plWeeks; w++) {
            if(w === currentPlWeek) continue;
            const targetKey = `w${w}_d${dayNum}`;
            if(!workoutData[targetKey]) workoutData[targetKey] = [];
            accs.forEach(acc => { const clone = JSON.parse(JSON.stringify(acc)); clone.id = Date.now() + Math.random(); workoutData[targetKey].push(clone); });
        }
        alert("Copiato!");
    };
    dayContentArea.appendChild(copyAllBtn);
    
    updateLiveStatsPL();
}

// --- CREAZIONE CARD FONDAMENTALE (Arancione) ---
function createFundamentalRowHTML(container, data, index, dayKey) {
    const row = document.createElement('div');
    row.className = 'exercise-row pl-fund-row';

    if (!data.sets || data.sets.length === 0) data.sets = [{ reps: 5, perc: '', target: '' }];

    row.innerHTML = `
        <div class="drag-handle"><i class="ph ph-dots-six-vertical"></i></div>
        <button class="btn-remove-row"><i class="ph ph-trash"></i></button>

        <div style="margin-bottom: 12px; display:flex; gap:10px; align-items:flex-end;">
            <div style="flex:1;">
                <span class="tiny-label">Esercizio Base</span>
                <input type="text" class="input-ex-name" value="${data.name}" placeholder="es. Squat" list="exercise-suggestions" style="font-weight:700; font-size:15px;">
            </div>
            <div style="flex:1;">
                <span class="tiny-label">Variante</span>
                <div class="variant-selector">
                    <span>${data.variant || 'Nessuna'}</span>
                    <i class="ph ph-caret-down"></i>
                </div>
            </div>
            
            <!-- CAMPO EXTRA DINAMICO (Tempo/Altezza) -->
            <div class="extra-param-wrapper" style="display:${data.variantParam && data.variantParam !== 'none' ? 'block' : 'none'};">
                <span class="tiny-label" id="lbl-extra-param">${data.variantParam === 'time' ? 'Secondi' : 'Param'}</span>
                <input type="text" class="pl-param-extra" value="${data.variantValue || ''}" placeholder="...">
            </div>
        </div>

        <!-- TRACKING SETTINGS -->
        <div class="pl-tracking-row">
            <div style="display:flex; flex-direction:column;">
                <span class="tiny-label" style="margin-bottom:2px;">Progressione:</span>
                <select class="input-tracking" style="padding:4px; font-size:12px;">
                    <option value="Kg" ${data.trackingMetric === 'Kg' ? 'selected' : ''}>Kg (Carico)</option>
                    <option value="RPE" ${data.trackingMetric === 'RPE' ? 'selected' : ''}>RPE (Sforzo)</option>
                    <option value="Reps" ${data.trackingMetric === 'Reps' ? 'selected' : ''}>Reps (Volume)</option>
                    <option value="Tech" ${data.trackingMetric === 'Tech' ? 'selected' : ''}>Tecnica (Voto)</option>
                </select>
            </div>
            
            <label class="vol-exclude-wrapper">
                <input type="checkbox" class="chk-vol" ${!data.excludeVolume ? 'checked' : ''}>
                Conta Vol.
            </label>
        </div>

        <!-- SETS -->
        <div class="sets-header" style="display:flex; gap:8px; margin-top:10px; padding-left:20px; font-size:10px; color:#888;">
            <span style="width:50px;">REPS</span>
            <span style="width:50px;">% 1RM</span>
            <span style="flex:1;">TARGET</span>
        </div>
        <div class="sets-container" style="display:flex; flex-direction:column; gap:6px;"></div>
        <button class="btn-add-set-pl" style="font-size:11px; width:100%; margin-top:8px; padding:6px; background:#fff; border:1px dashed #ccc; cursor:pointer;">+ Set</button>

        <!-- NOTE -->
        <textarea class="input-notes" placeholder="Note Tecniche..." style="margin-top:10px; height:50px; width:100%;">${data.notes || ''}</textarea>
    `;

    container.appendChild(row);

    // LOGICA INTERNA

    // 1. Nome Esercizio
    row.querySelector('.input-ex-name').oninput = (e) => data.name = e.target.value;

    // 2. Logica Variante
    const varSelector = row.querySelector('.variant-selector');
    varSelector.onclick = (e) => {
        e.stopPropagation();
        openVariantDropdown(varSelector, (name, section, param) => {
            data.variant = name;
            data.variantSection = section;
            data.variantParam = param; // Salva il tipo di parametro (es. 'time')
            
            varSelector.querySelector('span').textContent = name;
            
            // Gestione Visibilità Input Extra
            const extraWrap = row.querySelector('.extra-param-wrapper');
            const extraInput = row.querySelector('.pl-param-extra');
            const extraLbl = row.querySelector('#lbl-extra-param');
            
            if (param && param !== 'none') {
                extraWrap.style.display = 'block';
                if (param === 'time') { extraLbl.textContent = 'Tempo (sec)'; extraInput.placeholder = 'es. 3-0-3'; }
                else if (param === 'height') { extraLbl.textContent = 'Altezza (cm)'; extraInput.placeholder = 'es. 10cm'; }
            } else {
                extraWrap.style.display = 'none';
                data.variantValue = ""; // Reset valore
            }
        });
    };

    // Listener Input Extra
    const extraInput = row.querySelector('.pl-param-extra');
    if(extraInput) extraInput.oninput = (e) => data.variantValue = e.target.value;

    // 3. Render Sets
    const setsCont = row.querySelector('.sets-container');
    const renderSets = () => {
        setsCont.innerHTML = '';
        data.sets.forEach((set, sIdx) => {
            const div = document.createElement('div');
            div.style.display = 'flex'; div.style.gap = '8px'; div.style.alignItems = 'center';
            div.innerHTML = `
                <span style="font-size:11px; font-weight:bold; width:15px; text-align:right;">${sIdx + 1}</span>
                <input type="text" placeholder="Reps" value="${set.reps || ''}" class="pl-inp-reps" style="width:50px; text-align:center;">
                <input type="text" placeholder="%" value="${set.perc || ''}" class="pl-inp-perc" style="width:50px; text-align:center;">
                <input type="text" placeholder="Target" value="${set.target || ''}" class="pl-inp-target" style="flex:1;">
                <i class="ph ph-x btn-del-set" style="cursor:pointer; color:#FF3B30;"></i>
            `;
            // Bindings
            div.querySelector('.pl-inp-reps').oninput = (e) => set.reps = e.target.value;
            div.querySelector('.pl-inp-perc').oninput = (e) => set.perc = e.target.value;
            div.querySelector('.pl-inp-target').oninput = (e) => set.target = e.target.value;
            div.querySelector('.btn-del-set').onclick = () => {
                data.sets.splice(sIdx, 1);
                renderSets();
                updateLiveStatsPL();
            };
            setsCont.appendChild(div);
        });
    };
    renderSets();
    row.querySelector('.btn-add-set-pl').onclick = () => {
        const last = data.sets[data.sets.length - 1];
        data.sets.push(last ? { ...last } : { reps: 5, perc: '', target: '' });
        renderSets();
        updateLiveStatsPL();
    };

    // 4. Listeners
    row.querySelector('.input-tracking').onchange = (e) => { data.trackingMetric = e.target.value; };
    row.querySelector('.chk-vol').onchange = (e) => { data.excludeVolume = !e.target.checked; updateLiveStatsPL(); };
    row.querySelector('.input-notes').oninput = (e) => { data.notes = e.target.value; };

    // 5. FIX ERRORE DELETE (Il punto cruciale)
    row.querySelector('.btn-remove-row').onclick = () => {
        if (confirm("Eliminare?")) {
            // USIAMO dayKey, NON currentDay
            workoutData[dayKey].splice(index, 1);
            renderPlDay(); // Ricarica la vista corretta
        }
    };
}

// --- LOGICA COPIA AUTOMATICA COMPLEMENTARI ---
function addCopyToWeeksBtn(rowElement, data, index, currentKey) {
    const btn = document.createElement('button');
    btn.className = 'btn-copy-series'; // Classe CSS definita prima
    btn.style.marginTop = '10px';
    btn.style.width = '100%';
    btn.style.justifyContent = 'center';
    btn.innerHTML = '<i class="ph ph-copy"></i> Copia su tutte le settimane';

    btn.onclick = () => {
        if (!confirm(`Copiare "${data.name}" su tutte le settimane del Giorno ${currentKey.split('_')[1].replace('d', '')}?`)) return;

        // currentKey è tipo "w1_d2". Estraiamo "d2".
        const dayPart = currentKey.split('_')[1];

        for (let w = 1; w <= plWeeks; w++) {
            const targetKey = `w${w}_${dayPart}`;
            if (targetKey === currentKey) continue; // Salta se stesso

            // Assicurati che l'array target esista
            if (!workoutData[targetKey]) workoutData[targetKey] = [];

            // Clona oggetto (deep copy brutale ma efficace)
            const clone = JSON.parse(JSON.stringify(data));
            clone.id = Date.now() + Math.random(); // Nuovo ID univoco

            workoutData[targetKey].push(clone);
        }
        alert("Copiato con successo!");
    };

    // Inserisci il bottone alla fine della card
    rowElement.appendChild(btn);
}

// --- MENU DROPDOWN VARIANTI (Dinamico) ---
function openVariantDropdown(targetElement, onSelect) {
    document.querySelectorAll('.variant-dropdown-menu').forEach(e => e.remove());

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu variant-dropdown-menu open';
    // Posizionamento
    const rect = targetElement.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = '100%';
    menu.style.left = '0';
    menu.style.zIndex = '9999';

    // Container Griglia
    const gridLayout = document.createElement('div');
    gridLayout.className = 'variant-grid-layout'; // Definito nel CSS

    Object.keys(VARIANTS_DB).forEach(cat => {
        const group = document.createElement('div');
        group.className = 'variant-group'; // Definito nel CSS

        const title = document.createElement('h4');
        title.textContent = cat;
        group.appendChild(title);

        VARIANTS_DB[cat].forEach(variant => {
            const item = document.createElement('div');
            item.className = 'child-item';
            item.textContent = variant.name;
            item.onclick = () => {
                onSelect(variant.name, cat);
                menu.remove();
            };
            group.appendChild(item);
        });
        gridLayout.appendChild(group);
    });

    // Scorrimento se troppo alto
    const scrollContainer = document.createElement('div');
    scrollContainer.style.maxHeight = '400px';
    scrollContainer.style.overflowY = 'auto';
    scrollContainer.appendChild(gridLayout);
    menu.appendChild(scrollContainer);

    // Tasto Nuova Variante (Footer)
    const createBtn = document.createElement('div');
    createBtn.style.padding = '10px';
    createBtn.style.borderTop = '1px solid #eee';
    createBtn.style.color = '#0071E3';
    createBtn.style.cursor = 'pointer';
    createBtn.style.textAlign = 'center';
    createBtn.style.fontWeight = 'bold';
    createBtn.innerHTML = '<i class="ph ph-plus-circle"></i> Crea Nuova Variante Custom...';
    createBtn.onclick = () => {
        menu.remove();
        document.getElementById('pl-variant-modal').classList.remove('hidden');
        // (Logica salvataggio identica a prima...)
        document.getElementById('btn-save-variant').onclick = async () => {
            const name = document.getElementById('new-var-name').value;
            const section = document.getElementById('new-var-section').value || "Custom";
            const paramType = document.getElementById('new-var-param').value; // 'time', 'height', 'none'

            if(name) {
                if(!VARIANTS_DB[section]) VARIANTS_DB[section] = [];
                
                // Aggiungiamo la variante con il parametro (es. time)
                VARIANTS_DB[section].push({ name: name, param: paramType, lifts: [] });
                
                // --- SALVATAGGIO SU FIREBASE ---
                try {
                    const user = auth.currentUser;
                    await updateDoc(doc(db, "users", user.uid), {
                        savedVariants: VARIANTS_DB
                    });
                    console.log("Variante salvata su Cloud");
                } catch(e) { console.error("Err salvataggio variante", e); }
                // -------------------------------

                onSelect(name, section, paramType);
                document.getElementById('pl-variant-modal').classList.add('hidden');
            }
        };
    };
    menu.appendChild(createBtn);

    targetElement.parentElement.style.position = 'relative';
    targetElement.parentElement.appendChild(menu);

    // Close handler
    const closeHandler = (e) => {
        if (!menu.contains(e.target) && !targetElement.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 100);
}
//fine sezione pl2




// =========================================
// 9. CALCOLO VOLUME POWERLIFTING (Safety Version)
// =========================================

function updateLiveStatsPL() {
    console.log(`Calcolo Volume PL per Week ${currentPlWeek}...`);
    
    let hierarchyMap = {};
    Object.keys(MUSCLE_STRUCTURE).forEach(cat => {
        hierarchyMap[cat] = { total: 0, children: {} };
    });

    // 1. FILTRO: Prendi solo i giorni della SETTIMANA CORRENTE
    // Le chiavi sono tipo "w1_d1", "w2_d1". Noi vogliamo solo quelle che iniziano con "w{currentPlWeek}_"
    const weekPrefix = `w${currentPlWeek}_`;
    const weeklyKeys = Object.keys(workoutData).filter(k => k.startsWith(weekPrefix));

    weeklyKeys.forEach(dayKey => {
        if (!workoutData[dayKey]) return;

        workoutData[dayKey].forEach(ex => {
            // A. CHECK ESCLUSIONE
            if (ex.isFundamental && ex.excludeVolume === true) return;

            // B. CALCOLO SETS
            let sets = 0;
            if (ex.isFundamental) {
                // Conta quanti oggetti ci sono nell'array 'sets'
                sets = (ex.sets && Array.isArray(ex.sets)) ? ex.sets.length : 0;
            } else {
                // Complementari
                if (ex.technique === "Top set + back-off") {
                    sets = 1 + (parseFloat(ex.backSets) || 0);
                } else {
                    sets = parseFloat(ex.val1) || 0;
                }
            }

            if (sets === 0) return;

            // C. DISTRIBUZIONE MUSCOLI
            if (ex.muscles && Array.isArray(ex.muscles)) {
                ex.muscles.forEach(m => {
                    if (!m.name) return;
                    
                    let mult = 0;
                    if (m.type === 'primary') mult = 1.0; 
                    else if (m.type === 'secondary') mult = userVolumeSettings.secondary; 
                    else if (m.type === 'tertiary') mult = userVolumeSettings.tertiary; 
                    else mult = userVolumeSettings.other;

                    const volume = sets * mult;

                    let parent = "Altro";
                    for (const [cat, list] of Object.entries(MUSCLE_STRUCTURE)) {
                        if (list.includes(m.name) || cat === m.name) {
                            parent = cat;
                            break;
                        }
                    }
                    
                    if (!hierarchyMap[parent]) hierarchyMap[parent] = { total: 0, children: {} };
                    hierarchyMap[parent].total += volume;

                    const childName = m.name;
                    if (!hierarchyMap[parent].children[childName]) hierarchyMap[parent].children[childName] = 0;
                    hierarchyMap[parent].children[childName] += volume;
                });
            }
        });
    });

    // Usa la funzione comune per disegnare
    if (typeof renderStatsUI === "function") {
        renderStatsUI(hierarchyMap);
    } else {
        console.warn("Manca renderStatsUI, impossibile aggiornare grafico.");
    }
}
//ancora pl fino a quiì




//qui gestico i grafici bb e pl insieme


function renderStatsUI(hierarchyMap) {
// 3. RENDER LISTA (Sempre Completa con Accordion)
    const statsList = document.getElementById('stats-breakdown');
    statsList.innerHTML = '';

    // Ordina padri per volume totale decrescente
    const sortedParents = Object.entries(hierarchyMap)
        .filter(([_, data]) => data.total > 0)
        .sort((a, b) => b[1].total - a[1].total);

    sortedParents.forEach(([parentName, data]) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'stat-group';

        // Riga Padre
        const parentDiv = document.createElement('div');
        parentDiv.className = 'stat-parent';
        parentDiv.innerHTML = `
            <span>${parentName}</span>
            <div style="display:flex; align-items:center;">
                <span class="volume-value">${data.total.toFixed(1)}</span>
                <i class="ph ph-caret-right stat-arrow"></i>
            </div>
        `;

        // Container Figli
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'stat-children';

        // Ordina figli
        const sortedChildren = Object.entries(data.children).sort((a, b) => b[1] - a[1]);
        sortedChildren.forEach(([childName, vol]) => {
            const row = document.createElement('div');
            row.className = 'child-stat';
            row.innerHTML = `<span>${childName}</span><span>${vol.toFixed(1)}</span>`;
            childrenDiv.appendChild(row);
        });

        // Click Event per aprire/chiudere
        parentDiv.onclick = () => {
            parentDiv.classList.toggle('active');
            childrenDiv.classList.toggle('visible');
        };

        groupDiv.appendChild(parentDiv);
        groupDiv.appendChild(childrenDiv);
        statsList.appendChild(groupDiv);
    });

    // 4. RENDER GRAFICO (Dipende dallo Zoom)
    if (volumeChartInstance) {
        let labels = [];
        let dataValues = [];
        let colors = [];

        const btnBack = document.getElementById('btn-chart-back');

        // MAPPA COLORI PADRI (Tonalità HSL)
        // Definiamo un colore distintivo per ogni categoria
        // MAPPA COLORI PADRI (Gradi HSL: 0-360)
        // MAPPA COLORI PADRI (Gradi HSL: 0-360)
        // Logica: Muscoli sinergici hanno colori opposti nella ruota cromatica
        const CATEGORY_HUES = {
            // --- GRUPPO SPINTA (Push) ---
            "Pettorali": 355,           // Rosso Vivo
            "Deltoidi Anteriori": 180,  // Ciano/Turchese (Opposto al rosso)
            "Tricipiti": 140,           // Verde Prato (Ben distinto da entrambi)

            // --- GRUPPO SPALLE (Isolamento) ---
            "Deltoidi Laterali": 270,   // Viola
            "Deltoidi Posteriori": 50,  // Giallo Oro (Per staccare dalla schiena blu)
            "Cuffia dei Rotatori": 300, // Fuchsia

            // --- GRUPPO TIRATA (Pull) ---
            "Schiena (Ampiezza/Lats)": 215, // Blu Reale
            "Schiena (Alta/Spessore)": 30,  // Arancione (Opposto al blu)
            "Schiena (Bassa/Lombari)": 320, // Rosa Shocking (Ben visibile)
            "Bicipiti": 60,             // Giallo Limone (Stacca forte sul blu)
            "Avambracci": 0,            // Grigio Scuro (Neutro)

            // --- GRUPPO GAMBE (Legs) ---
            "Quadricipiti": 240,        // Blu Indaco/Notte
            "Femorali (Ischiocrurali)": 15, // Rosso Ruggine (Opposto all'indaco)
            "Glutei": 160,              // Verde Acqua/Menta
            "Adduttori (Interno Coscia)": 290, // Lilla
            "Abduttori (Esterno Coscia)": 200, // Azzurro Cielo

            // --- PICCOLI GRUPPI ---
            "Polpacci": 90,             // Verde Lime
            "Tibiali": 110,             // Verde Smeraldo

            "Addominali": 25,           // Arancione Scuro
            "Accessori & Cardio": 200   // Grigio/Azzurrino (Bassa saturazione nel codice)
        };

        if (currentChartFocus && hierarchyMap[currentChartFocus]) {
            // --- VISTA DETTAGLIO (Figli) ---
            // Qui usiamo sfumature dello stesso colore del padre
            btnBack.style.display = 'block';

            const focusData = hierarchyMap[currentChartFocus].children;
            const sortedFocus = Object.entries(focusData).sort((a, b) => b[1] - a[1]);

            labels = sortedFocus.map(x => x[0]);
            dataValues = sortedFocus.map(x => x[1]);

            // Recupera il colore base del padre
            const baseHue = CATEGORY_HUES[currentChartFocus] !== undefined ? CATEGORY_HUES[currentChartFocus] : 0;
            const isGray = baseHue === 0 && currentChartFocus === "Altro";

            // Genera gradazioni (dal più scuro al più chiaro o viceversa)
            colors = dataValues.map((_, i) => {
                // Calcola luminosità progressiva: parte da 50% e sale
                const lightness = 45 + (i * 10);
                const saturation = isGray ? 0 : 75;
                return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
            });

        } else {
            // --- VISTA TOTALE (Padri) ---
            // Qui usiamo i colori distinti definiti nella mappa
            btnBack.style.display = 'none';
            currentChartFocus = null;

            labels = sortedParents.map(x => x[0]);
            dataValues = sortedParents.map(x => x[1].total);

            colors = labels.map(label => {
                const hue = CATEGORY_HUES[label] !== undefined ? CATEGORY_HUES[label] : 0; // Default a 0 se non trovato
                const saturation = (hue === 0 && label === "Altro") ? 0 : 70; // Grigio per "Altro", colore vivo per il resto
                return `hsl(${hue}, ${saturation}%, 55%)`; // Luminosità media fissa
            });
        }

        volumeChartInstance.data.labels = labels;
        volumeChartInstance.data.datasets[0].data = dataValues;
        volumeChartInstance.data.datasets[0].backgroundColor = colors;
        volumeChartInstance.update();
    }
}