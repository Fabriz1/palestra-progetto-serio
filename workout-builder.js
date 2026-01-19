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
const MUSCLES = [
    "Pettorali", "Dorsali", "Quadricipiti", "Femorali", "Glutei", 
    "Polpacci", "Spalle (Ant)", "Spalle (Lat)", "Spalle (Post)", 
    "Bicipiti", "Tricipiti", "Addome", "Lombari", "Trapezio", "Avambracci", "Cardio"
];

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
    
    if(userDoc.exists()) {
        const userData = userDoc.data(); // Definisco userData qui per usarlo dopo

        // A. Volume Settings
        if(userData.volumeSettings) {
            userVolumeSettings = { ...userVolumeSettings, ...userData.volumeSettings };
        }
    
        // B. CARICA LIBRERIA PERSONALIZZATA (CORRETTO)
        if(userData.exerciseLibrary) {
            // Unisce la bibbia standard con le personalizzazioni del coach
            globalExerciseLibrary = { ...defaultExercises, ...userData.exerciseLibrary };
            console.log("Libreria esercizi caricata e aggiornata.");
        }
    }
    
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
            if(data.assignedTo) modalClientSelect.value = data.assignedTo; // Nota: modalClientSelect va popolato
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
    if(existing) existing.remove();

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
            <select class="select-muscle muscle-primary">
                <option value="" disabled ${!primaryMuscle ? 'selected' : ''}>Seleziona</option>
                ${MUSCLES.map(m => `<option value="${m}" ${m === primaryMuscle ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
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
        const pVal = row.querySelector('.muscle-primary').value;
        data.muscles = data.muscles.filter(m => m.type !== 'primary');
        if(pVal) data.muscles.unshift({ name: pVal, type: 'primary' });

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
    row.querySelector('.muscle-primary').addEventListener('change', (e) => { updateData(); updateLiveStats(); });
    row.querySelector('.select-technique').addEventListener('change', (e) => { data.technique = e.target.value; renderCentralInputs(); updateData(); });
    row.querySelector('.select-metric').addEventListener('change', (e) => { 
        data.metricType = e.target.value; 
        const lbl = row.querySelector('.label-metric-val'); if(lbl) lbl.textContent = `@ ${data.metricType}`;
        const inputs = row.querySelectorAll('.special-input'); if(inputs.length > 0) { row.querySelector('.input-top-int').placeholder = data.metricType; row.querySelector('.input-back-int').placeholder = data.metricType; }
    });
    row.querySelector('.btn-remove-row').addEventListener('click', () => { workoutData[currentDay].splice(index, 1); renderDay(currentDay); });

    const synList = row.querySelector('.synergists-list');
    const renderSynergists = () => {
        synList.innerHTML = '';
        const syns = data.muscles.filter(m => m.type !== 'primary');
        syns.forEach((m) => {
            const div = document.createElement('div');
            div.className = 'synergist-row';
            div.style.marginTop = "5px";
            
            // Select Tipo (Secondario, etc)
            const typeSelect = document.createElement('select'); typeSelect.style.width = "100px";
            typeSelect.innerHTML = `<option value="secondary" ${m.type === 'secondary'?'selected':''}>Secondario</option><option value="tertiary" ${m.type === 'tertiary'?'selected':''}>Terziario</option><option value="quaternary" ${m.type === 'quaternary'?'selected':''}>Quaternario</option>`;
            
            // Select Muscolo (FIX APPLICATO QUI)
            const muscSelect = document.createElement('select');
            // Aggiunto check: ${!m.name ? 'selected' : ''} nell'opzione placeholder
            muscSelect.innerHTML = `<option value="" disabled ${!m.name ? 'selected' : ''}>Muscolo</option>` + 
                                   MUSCLES.map(opt => `<option value="${opt}" ${opt === m.name ? 'selected' : ''}>${opt}</option>`).join('');
            
            const delBtn = document.createElement('i'); delBtn.className = 'ph ph-x btn-del-syn'; delBtn.style.cursor="pointer";
            
            typeSelect.addEventListener('change', (e) => { m.type = e.target.value; updateLiveStats(); });
            muscSelect.addEventListener('change', (e) => { m.name = e.target.value; updateLiveStats(); });
            delBtn.addEventListener('click', () => { const realIndex = data.muscles.indexOf(m); if (realIndex > -1) data.muscles.splice(realIndex, 1); renderSynergists(); updateLiveStats(); });
            
            div.appendChild(typeSelect); div.appendChild(muscSelect); div.appendChild(delBtn);
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

        if (globalExerciseLibrary[val]) {
            const libData = globalExerciseLibrary[val];
            
            // 1. Imposta Muscolo Primario
            if (libData.p) {
                row.querySelector('.select-muscle').value = libData.p;
                row.querySelector('.select-muscle').dispatchEvent(new Event('change'));
            }

            // 2. Gestione Sinergici Intelligente
            const currentSyns = data.muscles.filter(m => m.type !== 'primary');
            
            // Popola solo se l'utente non ha già messo mano ai sinergici
            if (currentSyns.length === 0 && libData.s && libData.s.length > 0) {
                // Pulisci
                data.muscles = data.muscles.filter(m => m.type === 'primary');
                
                // Aggiungi i nuovi (Gestisce sia Stringhe che Oggetti)
                libData.s.forEach(item => {
                    if (typeof item === 'string') {
                        // Formato Base (exercise-db.js): Default Secondario
                        data.muscles.push({ name: item, type: 'secondary' });
                    } else {
                        // Formato Imparato (Firebase): Rispetta il tipo (es. tertiary)
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
    let volumeMap = {};
    Object.keys(workoutData).forEach(dayKey => {
        workoutData[dayKey].forEach(ex => {
            let sets = 0;
            if (ex.technique === "Top set + back-off") { const backSets = parseFloat(ex.backSets) || 0; sets = 1 + backSets; } 
            else { sets = parseFloat(ex.val1) || 0; }
            if (sets === 0) return;
            ex.muscles.forEach(m => {
                if (!m.name) return;
                let mult = 0;
                if (m.type === 'primary') mult = 1.0; else if (m.type === 'secondary') mult = userVolumeSettings.secondary; else if (m.type === 'tertiary') mult = userVolumeSettings.tertiary; else if (m.type === 'quaternary') mult = userVolumeSettings.quaternary; else mult = userVolumeSettings.other;
                if (!volumeMap[m.name]) volumeMap[m.name] = 0;
                volumeMap[m.name] += (sets * mult);
            });
        });
    });
    const statsList = document.getElementById('stats-breakdown'); statsList.innerHTML = '';
    const sortedMuscles = Object.entries(volumeMap).sort((a,b) => b[1] - a[1]);
    sortedMuscles.forEach(([muscle, vol]) => {
        const div = document.createElement('div'); div.className = 'stat-item'; div.innerHTML = `<span class="muscle-label">${muscle}</span><span class="volume-value">${vol.toFixed(1)}</span>`; statsList.appendChild(div);
    });
    if (volumeChartInstance) {
        volumeChartInstance.data.labels = sortedMuscles.map(x => x[0]); volumeChartInstance.data.datasets[0].data = sortedMuscles.map(x => x[1]); volumeChartInstance.data.datasets[0].backgroundColor = sortedMuscles.map(() => `hsl(${Math.random() * 360}, 70%, 60%)`); volumeChartInstance.update();
    }
}

function initChart() { const ctx = volumeChartCanvas.getContext('2d'); volumeChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: [], datasets: [{ data: [], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); }
inputNumDays.addEventListener('change', (e) => { totalDays = parseInt(e.target.value); for(let i=1; i<=totalDays; i++) if(!workoutData[i]) workoutData[i] = []; renderTabs(); });
document.getElementById('btn-back').addEventListener('click', () => { if(confirm("Esci senza salvare?")) window.location.href = "dashboard-pt.html"; });

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
    for(let i=1; i<=totalDays; i++) {
        if(workoutData[i] && workoutData[i].length > 0) hasExercises = true;
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

    for(let i=1; i<=totalDays; i++) {
        if(workoutData[i]) {
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

                const known = globalExerciseLibrary[name];
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

                        for(let k=0; k < knownSynergistsNorm.length; k++) {
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
            if (!assignedClientId) { alert("Seleziona un atleta!"); btnConfirmSave.disabled=false; return; }
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