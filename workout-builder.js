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
    }
    rebuildSearchIndex();
    initChart();
    setupDatalist();

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


function renderDay(day) {
    dayContentArea.innerHTML = '';
    const listContainer = document.createElement('div');
    listContainer.className = 'exercises-list';
    dayContentArea.appendChild(listContainer);

    const exercises = workoutData[day] || [];
    exercises.forEach((exData, index) => {
        createExerciseRowHTML(listContainer, exData, index);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-exercise';
    addBtn.innerHTML = '<i class="ph ph-plus-circle"></i> Aggiungi Esercizio';
    addBtn.onclick = () => {
        const newEx = {
            id: Date.now(), name: "", technique: "Standard", metricType: "RPE",
            val1: "", val2: "", intensityVal: "",
            topReps: "", topInt: "", backSets: "", backReps: "", backInt: "",
            notes: "", rest: "", muscles: []
        };
        workoutData[day].push(newEx);
        createExerciseRowHTML(listContainer, newEx, workoutData[day].length - 1);
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

    row.innerHTML = `
        <div class="drag-handle"><i class="ph ph-dots-six-vertical"></i></div>
        <div class="input-group-col" style="flex-grow: 2; min-width: 150px;">
            <span class="input-label">Esercizio</span>
            <input type="text" class="input-ex-name" value="${data.name}" placeholder="Nome Esercizio" list="exercise-suggestions" autocomplete="off">
        </div>
        <div class="dynamic-inputs-area" style="display:flex; gap:10px; align-items:center;"></div>
        <div class="input-group-col">
            <span class="input-label">Tecnica</span>
            <select class="select-technique" style="width: 110px;">
                ${TECHNIQUES.map(t => `<option value="${t}" ${t === data.technique ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </div>
        <div class="input-group-col">
            <span class="input-label">Intensità</span>
            <select class="select-metric">
                ${INTENSITY_METRICS.map(m => `<option value="${m}" ${m === data.metricType ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
        </div>


        <div class="input-group-col">
            <span class="input-label">Muscolo</span>
            <div class="muscle-dropdown-placeholder"></div> <!-- Placeholder per il nostro componente -->
        </div>


        <button class="btn-remove-row"><i class="ph ph-trash"></i></button>
        <div class="row-extras" style="width: 100%; display: flex; flex-direction: column;">
            <div class="synergists-wrapper"><div class="synergists-list"></div><button class="btn-add-synergist" style="margin-top:5px;"><i class="ph ph-plus"></i> Sinergico</button></div>
            <div style="display: flex; gap: 10px; margin-top: 10px; width: 100%;">
                <input type="text" class="input-notes" value="${data.notes || ''}" placeholder="Note tecniche" style="flex-grow: 1;">
                <input type="text" class="input-rest" value="${data.rest || ''}" placeholder="Recupero" style="width: 100px;">
            </div>
        </div>
    `;
    container.appendChild(row);



    // ... container.appendChild(row);

    // --- INIZIALIZZA CUSTOM DROPDOWN ---
    const muscleContainer = row.querySelector('.muscle-dropdown-placeholder');

    // Callback: cosa succede quando seleziono un muscolo?
    const onMuscleChange = (newValue) => {
        // Aggiorna l'array muscles (rimuovi il vecchio primary e metti il nuovo)
        data.muscles = data.muscles.filter(m => m.type !== 'primary');
        if (newValue) data.muscles.unshift({ name: newValue, type: 'primary' });

        updateData(); // Salva nello stato
        updateLiveStats(); // Aggiorna grafici (anche se per ora userà logica vecchia, non rompe nulla)
    };

    // Crea componente
    const dropdownEl = createMuscleDropdown(primaryMuscle, onMuscleChange);
    muscleContainer.appendChild(dropdownEl);

    // Riferimento per l'autofill (quando scrivi il nome esercizio)
    // Salviamo il riferimento al componente DOM per poter chiamare .setValue() dopo
    row.dataset.dropdownId = Math.random().toString(36).substr(2, 9); // ID temporaneo se serve, ma meglio:
    row.dropdownComponent = dropdownEl; // Attacchiamo l'oggetto direttamente al DOM element della riga



    const dynamicArea = row.querySelector('.dynamic-inputs-area');

    const renderCentralInputs = () => {
        dynamicArea.innerHTML = '';
        if (data.technique === "Top set + back-off") {
            dynamicArea.innerHTML = `
                <div class="special-layout-container">
                    <div class="special-row">
                        <span class="special-label">TOP SET</span>
                        <input type="text" disabled value="1" class="special-input" style="width:30px; background:#e0e0e0;" title="1 Set">
                        <span>x</span>
                        <input type="text" class="special-input input-top-reps" value="${data.topReps || ''}" placeholder="Reps" style="width:50px;">
                        <span>@</span>
                        <input type="text" class="special-input input-top-int" value="${data.topInt || ''}" placeholder="${data.metricType}" style="width:50px;">
                    </div>
                    <div class="special-row">
                        <span class="special-label">BACK-OFF</span>
                        <input type="text" class="special-input input-back-sets" value="${data.backSets || ''}" placeholder="Sets" style="width:30px;">
                        <span>x</span>
                        <input type="text" class="special-input input-back-reps" value="${data.backReps || ''}" placeholder="Reps" style="width:50px;">
                        <span>@</span>
                        <input type="text" class="special-input input-back-int" value="${data.backInt || ''}" placeholder="${data.metricType}" style="width:50px;">
                    </div>
                </div>`;
        } else {
            const layout = TECHNIQUE_LAYOUTS[data.technique] || TECHNIQUE_LAYOUTS["Standard"];
            dynamicArea.innerHTML = `
                <div class="input-group-col">
                    <span class="input-label label-v1">${layout.label1}</span>
                    <input type="text" class="input-sets" value="${data.val1 || ''}" style="width: 50px; text-align: center;">
                </div>
                <div class="input-group-col">
                    <span class="input-label label-v2">${layout.label2}</span>
                    <input type="text" class="input-reps" value="${data.val2 || ''}" style="width: 60px; text-align: center;">
                </div>
                <div class="input-group-col">
                    <span class="input-label label-metric-val">@ ${data.metricType}</span>
                    <input type="text" class="input-intensity-val" value="${data.intensityVal || ''}" style="width: 50px; text-align: center; border-color: #FF2D55;">
                </div>`;
        }
        dynamicArea.querySelectorAll('input').forEach(i => i.addEventListener('input', updateData));
    };

    const updateData = () => {
        data.name = row.querySelector('.input-ex-name').value;
        data.technique = row.querySelector('.select-technique').value;
        data.metricType = row.querySelector('.select-metric').value;
        data.notes = row.querySelector('.input-notes').value;
        data.rest = row.querySelector('.input-rest').value;
        /* const pVal = row.querySelector('.muscle-primary').value;
        data.muscles = data.muscles.filter(m => m.type !== 'primary');
        if (pVal) data.muscles.unshift({ name: pVal, type: 'primary' });
        */

        if (data.technique === "Top set + back-off") {
            data.topReps = row.querySelector('.input-top-reps')?.value;
            data.topInt = row.querySelector('.input-top-int')?.value;
            data.backSets = row.querySelector('.input-back-sets')?.value;
            data.backReps = row.querySelector('.input-back-reps')?.value;
            data.backInt = row.querySelector('.input-back-int')?.value;
            data.val1 = "";
        } else {
            data.val1 = row.querySelector('.input-sets')?.value;
            data.val2 = row.querySelector('.input-reps')?.value;
            data.intensityVal = row.querySelector('.input-intensity-val')?.value;
        }
        updateLiveStats();
    };

    renderCentralInputs();

    row.querySelector('.input-ex-name').addEventListener('input', updateData);
    row.querySelector('.input-notes').addEventListener('input', updateData);
    row.querySelector('.input-rest').addEventListener('input', updateData);
    //row.querySelector('.muscle-primary').addEventListener('change', (e) => { updateData(); updateLiveStats(); });
    row.querySelector('.select-technique').addEventListener('change', (e) => { data.technique = e.target.value; renderCentralInputs(); updateData(); });
    row.querySelector('.select-metric').addEventListener('change', (e) => {
        data.metricType = e.target.value;
        const lbl = row.querySelector('.label-metric-val'); if (lbl) lbl.textContent = `@ ${data.metricType}`;
        const inputs = row.querySelectorAll('.special-input'); if (inputs.length > 0) { row.querySelector('.input-top-int').placeholder = data.metricType; row.querySelector('.input-back-int').placeholder = data.metricType; }
    });
    row.querySelector('.btn-remove-row').addEventListener('click', () => { workoutData[currentDay].splice(index, 1); renderDay(currentDay); });

    const synList = row.querySelector('.synergists-list');



    const renderSynergists = () => {
        synList.innerHTML = '';
        // Filtra solo i secondari/terziari (escludi primario)
        const syns = data.muscles.filter(m => m.type !== 'primary');
        
        syns.forEach((m) => {
            const div = document.createElement('div');
            div.className = 'synergist-row';
            div.style.marginTop = "5px";
            div.style.alignItems = "flex-start"; // Allinea in alto perché il dropdown è alto
            
            // 1. SELECT TIPO (Secondario, Terziario...) - Questa resta uguale
            const typeSelect = document.createElement('select'); 
            typeSelect.style.width = "100px";
            typeSelect.style.marginRight = "10px";
            typeSelect.style.padding = "10px"; // Match stile dropdown
            typeSelect.style.borderRadius = "8px";
            typeSelect.style.border = "1px solid #E5E5EA";
            
            typeSelect.innerHTML = `
                <option value="secondary" ${m.type === 'secondary'?'selected':''}>Secondario</option>
                <option value="tertiary" ${m.type === 'tertiary'?'selected':''}>Terziario</option>
                <option value="quaternary" ${m.type === 'quaternary'?'selected':''}>Quaternario</option>
            `;
            
            // 2. NUOVO DROPDOWN MUSCOLO (Invece della vecchia select)
            // Callback: quando cambi muscolo qui, aggiorna l'oggetto 'm' e ricalcola stats
            const onSynChange = (newVal) => {
                m.name = newVal;
                updateLiveStats();
            };

            const dropdownEl = createMuscleDropdown(m.name, onSynChange);
            
            // Aggiustamenti CSS specifici per i sinergici (più compatti)
            dropdownEl.style.width = "200px"; 
            dropdownEl.style.flexGrow = "1";

            // 3. BOTTONE ELIMINA
            const delBtn = document.createElement('i'); 
            delBtn.className = 'ph ph-x btn-del-syn'; 
            delBtn.style.cursor="pointer";
            delBtn.style.padding = "12px"; // Centrato col dropdown
            
            // EVENTI
            typeSelect.addEventListener('change', (e) => { m.type = e.target.value; updateLiveStats(); });
            
            delBtn.addEventListener('click', () => { 
                // Trova l'indice corretto nell'array originale data.muscles
                const realIndex = data.muscles.indexOf(m); 
                if (realIndex > -1) data.muscles.splice(realIndex, 1); 
                renderSynergists(); 
                updateLiveStats(); 
            });
            
            div.appendChild(typeSelect); 
            div.appendChild(dropdownEl); // Inseriamo il dropdown invece della select
            div.appendChild(delBtn);
            synList.appendChild(div);
        });
    };




    renderSynergists();
    row.querySelector('.btn-add-synergist').addEventListener('click', () => { data.muscles.push({ name: "", type: "secondary" }); renderSynergists(); });
    // ... dentro createExerciseRowHTML ...


    const nameInput = row.querySelector('.input-ex-name');
    nameInput.addEventListener('input', (e) => {
        const val = e.target.value;
        updateData();
        if (val.endsWith(' ')) return; // Piccola ottimizzazione

        // MODIFICA QUI: Uso l'indice di ricerca lowercase
        const searchKey = val.trim().toLowerCase();
        const foundExercise = exerciseSearchIndex[searchKey];

        if (foundExercise) {
            // Se trovato tramite Alias, opzionalmente puoi sostituire il nome con quello ufficiale
            // if (foundExercise.canonicalName !== val) { nameInput.value = foundExercise.canonicalName; data.name = foundExercise.canonicalName; }

            // 1. Imposta Muscolo Primario
            if (foundExercise.p) {
                // Usa il metodo setValue che abbiamo aggiunto all'elemento nel passo 3
                if (row.dropdownComponent && row.dropdownComponent.setValue) {
                    row.dropdownComponent.setValue(foundExercise.p);

                    // Dobbiamo aggiornare i dati manualmente perché setValue non lancia callback
                    data.muscles = data.muscles.filter(m => m.type !== 'primary');
                    data.muscles.unshift({ name: foundExercise.p, type: 'primary' });
                    updateLiveStats();
                }
            }

            // 2. Gestione Sinergici Intelligente
            const currentSyns = data.muscles.filter(m => m.type !== 'primary');

            if (currentSyns.length === 0 && foundExercise.s && foundExercise.s.length > 0) {
                data.muscles = data.muscles.filter(m => m.type === 'primary');

                foundExercise.s.forEach(item => {
                    if (typeof item === 'string') {
                        data.muscles.push({ name: item, type: 'secondary' });
                    } else {
                        data.muscles.push({ name: item.name, type: item.type });
                    }
                });
                renderSynergists();
                updateLiveStats();
            }
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

    // 3. RENDER LISTA (Sempre Completa con Accordion)
    const statsList = document.getElementById('stats-breakdown'); 
    statsList.innerHTML = '';
    
    // Ordina padri per volume totale decrescente
    const sortedParents = Object.entries(hierarchyMap)
        .filter(([_, data]) => data.total > 0)
        .sort((a,b) => b[1].total - a[1].total);

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
        const sortedChildren = Object.entries(data.children).sort((a,b) => b[1] - a[1]);
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
        const CATEGORY_HUES = {
            "Pettorali": 350,           // Rosso
            "Deltoidi Anteriori": 10,   // Rosso Arancio
            "Deltoidi Laterali": 30,    // Arancione
            "Deltoidi Posteriori": 45,  // Giallo Oro
            "Cuffia dei Rotatori": 60,  // Giallo
            
            "Schiena (Ampiezza/Lats)": 200, // Blu Classico
            "Schiena (Alta/Spessore)": 220, // Blu Scuro
            "Schiena (Bassa/Lombari)": 240, // Indaco
            
            "Quadricipiti": 120,        // Verde
            "Femorali (Ischiocrurali)": 25, // Marrone/Arancio Scuro
            "Glutei": 320,              // Rosa/Magenta
            "Adduttori (Interno Coscia)": 150, // Verde Acqua
            "Abduttori (Esterno Coscia)": 170, // Turchese Scuro
            
            "Polpacci": 80,             // Verde Lime
            "Tibiali": 100,             // Verde Prato
            
            "Bicipiti": 180,            // Ciano
            "Tricipiti": 270,           // Viola
            "Avambracci": 300,          // Fuchsia
            
            "Addominali": 50,           // Oro
            "Accessori & Cardio": 0     // Grigio
        };

        if (currentChartFocus && hierarchyMap[currentChartFocus]) {
            // --- VISTA DETTAGLIO (Figli) ---
            // Qui usiamo sfumature dello stesso colore del padre
            btnBack.style.display = 'block'; 
            
            const focusData = hierarchyMap[currentChartFocus].children;
            const sortedFocus = Object.entries(focusData).sort((a,b) => b[1] - a[1]);
            
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
                        label: function(context) {
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