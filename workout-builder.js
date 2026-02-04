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

let plChartView = 'lifts';
// Funzione per trovare il massimale corrispondente al nome esercizio
// Esempio: Se l'esercizio è "Squat High Bar", trova la chiave "Squat" e restituisce i Kg.
function getReferenceMax(exerciseName) {
    if (!exerciseName) return 0;
    const cleanName = exerciseName.toLowerCase();

    // Cerca se una delle chiavi dei massimali è contenuta nel nome dell'esercizio
    const matchKey = Object.keys(currentMaxes).find(key => cleanName.includes(key.toLowerCase()));
    return matchKey ? currentMaxes[matchKey] : 0;
}

// --- COSTANTI ---
//pl
let isPlMode = false;
let plWeeks = 4;
let plDaysPerWeek = 4;
let currentPlWeek = 1;
let currentPlDay = 1;
let currentMaxes = {};
let selectedPlClientId = null; // Tiene traccia di CHI stiamo modificando
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
        // D. CARICA MASSIMALI SALVATI
        if (userData.savedMaxes) {
            currentMaxes = { ...currentMaxes, ...userData.savedMaxes };
            console.log("Massimali caricati:", currentMaxes);
        }
    }
    // --- PL EXTENSIONS STATE (CORRETTO) ---

    // 1. Funzione Render Lista Massimali
    function renderMaxesModal() {
        const container = document.getElementById('maxes-list-container');
        const modalTitle = document.querySelector('#maxes-modal h3'); // Assicurati di avere un h3 nel modale o usa un ID
        
        if (!container) return;
        container.innerHTML = '';

        // Feedback visivo nel titolo del modale
        if (selectedPlClientId) {
            if(modalTitle) modalTitle.textContent = "Gestione Massimali (CLIENTE)";
            if(modalTitle) modalTitle.style.color = "#0071E3";
        } else {
            if(modalTitle) modalTitle.textContent = "Lista Esercizi Monitorati (TEMPLATE)";
            if(modalTitle) modalTitle.style.color = "#1D1D1F";
        }

        const keys = Object.keys(currentMaxes).sort();

        if (keys.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:15px; color:#999; font-size:12px;">
                ${selectedPlClientId ? "Il cliente non ha massimali salvati." : "La tua lista monitorati è vuota."}<br>
                Usa la ricerca in alto per aggiungere esercizi.
            </div>`;
        }

        keys.forEach(name => {
            const val = currentMaxes[name];
            const row = document.createElement('div');
            row.style.cssText = "display:flex; gap:10px; align-items:center; background:#FAFAFC; padding:8px; border-radius:8px; border:1px solid #E5E5EA; margin-bottom:6px;";

            // Logica Input: Se c'è un cliente, è modificabile. Se siamo in archivio, è disabilitato/nascosto.
            let inputHtml = '';
            if (selectedPlClientId) {
                // Modo Cliente: Input numerico attivo
                inputHtml = `<input type="number" class="max-val-inp" value="${val}" placeholder="Kg" style="width:80px; padding:6px; border:1px solid #D2D2D7; border-radius:6px; text-align:center; font-weight:700;">`;
            } else {
                // Modo Coach/Archivio: Solo testo o input disabilitato
                inputHtml = `<div style="width:80px; text-align:center; font-size:11px; color:#888; background:#eee; padding:6px; border-radius:6px;">Monitorato</div>`;
            }

            row.innerHTML = `
                <div class="max-name-txt" style="flex:2; font-weight:600; font-size:13px; color:#1D1D1F;">${name}</div>
                ${inputHtml}
                <button class="btn-del-max" style="color:#FF3B30; background:white; border:1px solid #E5E5EA; border-radius:6px; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="ph ph-trash"></i></button>
            `;

            // Listener Input (Solo se esiste)
            const input = row.querySelector('.max-val-inp');
            if (input) {
                input.oninput = (e) => {
                    currentMaxes[name] = parseFloat(e.target.value) || 0;
                };
            }

            // Rimuovi dalla lista
            row.querySelector('.btn-del-max').onclick = () => {
                delete currentMaxes[name];
                renderMaxesModal();
            };

            container.appendChild(row);
        });
    }

    // 2. Listener Apertura Modale (Btn Set Maxes)
    const btnSetMaxes = document.getElementById('btn-set-maxes');
    if (btnSetMaxes) {
        btnSetMaxes.addEventListener('click', () => {
            renderMaxesModal();
            document.getElementById('maxes-modal').classList.remove('hidden');

            // Setup Area Aggiunta
            const addArea = document.getElementById('max-add-area');
            if (addArea) {
                addArea.innerHTML = '';
                const onSelectNewMax = (selectedName) => {
                    if (currentMaxes[selectedName] === undefined) {
                        // Se sono coach (no client), aggiungo con valore 0 (placeholder)
                        // Se sono cliente, aggiungo con valore 0 (da compilare)
                        currentMaxes[selectedName] = 0;
                        renderMaxesModal();
                    } else {
                        alert("Esercizio già in lista!");
                    }
                };
                // Qui mostriamo TUTTI gli esercizi per permettere di sceglierli
                const dropdown = createExerciseSmartDropdown("Aggiungi esercizio alla lista...", onSelectNewMax, false);
                dropdown.querySelector('.exercise-trigger').style.background = "#F5F5F7";
                addArea.appendChild(dropdown);
            }
        });
    }

    // 3. Listener Salvataggio (Btn Save Maxes)
    const btnSaveMaxes = document.getElementById('btn-save-maxes');
    if (btnSaveMaxes) {
        // Rimuovi vecchi listener clonando il nodo (trucco rapido)
        const newBtn = btnSaveMaxes.cloneNode(true);
        btnSaveMaxes.parentNode.replaceChild(newBtn, btnSaveMaxes);

        newBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) return;

            // Feedback visivo
            const originalText = newBtn.textContent;
            newBtn.textContent = "Salvataggio...";
            newBtn.disabled = true;

            try {
                if (selectedPlClientId) {
                    // CASO A: Salva sul CLIENTE
                    const clientRef = doc(db, "users", selectedPlClientId);
                    await updateDoc(clientRef, { savedMaxes: currentMaxes });
                    console.log(`Massimali salvati per cliente ${selectedPlClientId}`);
                    alert("Massimali del cliente aggiornati!");
                } else {
                    // CASO B: Salva sul COACH (Solo la lista/struttura)
                    // Pulisci i valori a 0 per sicurezza, lasciando solo le chiavi
                    // (Opzionale: se vuoi mantenere i tuoi massimali personali, togli il map)
                    // Per un archivio "template", meglio avere solo le chiavi.
                    
                    // Nota: Se usi questo sistema anche per tracciare i TUOI massimali personali, 
                    // allora non azzerare. Lascio i valori intatti per flessibilità.
                    const coachRef = doc(db, "users", user.uid);
                    await updateDoc(coachRef, { savedMaxes: currentMaxes });
                    console.log("Lista monitorati Coach aggiornata");
                    alert("Lista template aggiornata!");
                }

                // Chiudi e aggiorna vista
                document.getElementById('maxes-modal').classList.add('hidden');
                if (isPlMode) renderPlDay(); 

            } catch (e) {
                console.error("Errore salvataggio maxes:", e);
                alert("Errore nel salvataggio: " + e.message);
            } finally {
                newBtn.textContent = originalText;
                newBtn.disabled = false;
            }
        });
    }

    // Toggle RPE Widget
    document.getElementById('btn-toggle-rpe').addEventListener('click', () => {
        document.getElementById('rpe-widget').classList.toggle('visible');
    });
    document.getElementById('close-rpe').addEventListener('click', () => {
        document.getElementById('rpe-widget').classList.remove('visible');
    });

    // Toggle Progressione

    // STATO VISUALIZZAZIONE GRAFICO PL
    let plChartView = 'lifts'; // 'lifts' oppure 'muscles'

    // Listener per i bottoni grafico PL
    const btnChartLifts = document.getElementById('btn-chart-lifts');
    const btnChartMuscles = document.getElementById('btn-chart-muscles');

    // Funzione helper per cambiare stile
    function updateChartToggles() {
        if (plChartView === 'lifts') {
            btnChartLifts.style.background = '#1D1D1F'; btnChartLifts.style.color = 'white';
            btnChartMuscles.style.background = 'white'; btnChartMuscles.style.color = '#1D1D1F';
        } else {
            btnChartMuscles.style.background = '#1D1D1F'; btnChartMuscles.style.color = 'white';
            btnChartLifts.style.background = 'white'; btnChartLifts.style.color = '#1D1D1F';
        }
    }

    if (btnChartLifts && btnChartMuscles) {
        btnChartLifts.addEventListener('click', () => {
            plChartView = 'lifts';
            updateChartToggles();
            updateLiveStatsPL(); // Forza ricalcolo immediato
        });

        btnChartMuscles.addEventListener('click', () => {
            plChartView = 'muscles';
            updateChartToggles();
            updateLiveStatsPL(); // Forza ricalcolo immediato
        });
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
                setupPlClientSelector()
                workoutData = {};
                for (let w = 1; w <= plWeeks; w++) {
                    for (let d = 1; d <= plDaysPerWeek; d++) {
                        workoutData[`w${w}_d${d}`] = [];
                    }
                }
                // Se è la prima volta assoluta o vuoto, apri setup
                document.getElementById('pl-setup-modal').classList.remove('hidden');
                document.getElementById('pl-tools').classList.remove('hidden'); // Mostra toolbar
                document.getElementById('pl-chart-controls').classList.remove('hidden');
                document.getElementById('pl-chart-controls').style.display = 'flex';
            } else {
                // Setup Iniziale BB
                document.getElementById('pl-tools').classList.add('hidden');
                document.getElementById('pl-chart-controls').classList.add('hidden');
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
// --- LOAD DATA FUNCTION (AGGIORNATA PER PL) ---
async function loadWorkoutToEdit(id, isCopy = false) {
    try {
        const docRef = doc(db, "workouts", id);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            alert("Scheda non trovata o eliminata.");
            return;
        }

        const data = snap.data();

        // 1. Popola variabili stato base
        workoutData = data.data || {};
        totalDays = data.days || 3;

        // UI Base
        workoutNameEl.textContent = isCopy ? `${data.name} (Copia)` : data.name;
        inputNumDays.value = totalDays;

        // 2. CONTROLLO MODALITÀ (BB vs PL)
        // Leggiamo il flag salvato. Se è undefined, assumiamo falso (vecchie schede BB)
        isPowerliftingMode = !!data.isPlMode;

        // Aggiorniamo lo Switch UI (senza triggerare l'evento 'change' che cancellerebbe i dati)
        if (modeToggle) {
            modeToggle.checked = isPowerliftingMode;
        }

        // Gestione Visibilità UI
        const bbControls = document.getElementById('bb-controls');
        const daysContainer = document.getElementById('days-tabs-container');
        const plNav = document.getElementById('pl-navigation');
        const plTools = document.getElementById('pl-tools');
        const plChartControls = document.getElementById('pl-chart-controls');
        
        // Etichette Toggle
        document.getElementById('lbl-bb').classList.toggle('selected', !isPowerliftingMode);
        document.getElementById('lbl-pl').classList.toggle('selected', isPowerliftingMode);

        if (isPowerliftingMode) {
            // --- MODALITÀ POWERLIFTING ---
            
            // 1. Nascondi controlli BB
            if(bbControls) bbControls.classList.add('hidden');
            if(daysContainer) daysContainer.classList.add('hidden');
            
            // 2. Mostra controlli PL
            if(plNav) plNav.classList.remove('hidden');
            if(plTools) plTools.classList.remove('hidden');
            if(plChartControls) {
                plChartControls.classList.remove('hidden');
                plChartControls.style.display = 'flex';
            }

            // 3. Recupera Metadati PL (Settimane e Giorni)
            plWeeks = data.plWeeks || 4; // Default a 4 se manca
            
            // Calcolo giorni per settimana analizzando le chiavi (es. w1_d4 -> 4 giorni)
            // Questo serve perché forse non abbiamo salvato plDaysPerWeek
            let maxDayFound = 1;
            Object.keys(workoutData).forEach(k => {
                if(k.includes('_d')) {
                    const dPart = parseInt(k.split('_d')[1]);
                    if(dPart > maxDayFound) maxDayFound = dPart;
                }
            });
            plDaysPerWeek = maxDayFound;

            // 4. Renderizza interfaccia PL
            renderPlNav();
            renderPlDay();

        } else {
            // --- MODALITÀ BODYBUILDING ---
            if(bbControls) bbControls.classList.remove('hidden');
            if(daysContainer) daysContainer.classList.remove('hidden');
            if(plNav) plNav.classList.add('hidden');
            if(plTools) plTools.classList.add('hidden');
            if(plChartControls) plChartControls.classList.add('hidden');

            renderTabs();
            renderDay(1);
        }

        // 3. Gestione Assegnazione (Solo se non è copia)
        if (!isCopy) {
            isEditMode = true;
            editingWorkoutId = id;
            originalAssignedTo = data.assignedTo;
            saveMode = data.isTemplate ? 'archive' : 'assign';
            if (data.assignedTo) modalClientSelect.value = data.assignedTo;
        }

        updateLiveStats(); // Aggiorna grafici

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
    setupDragAndDrop(listContainer, workoutData[day]);
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



// --- NUOVA FUNZIONE 1: Organizza esercizi per categoria ---

function organizeExercisesByMuscle(onlySavedMaxes = false) {
    const categorized = {};

    // Crea categorie
    Object.keys(MUSCLE_STRUCTURE).forEach(parentCat => {
        categorized[parentCat] = [];
    });
    categorized["Altro / Custom"] = [];

    // Decidiamo la fonte dati
    let sourceKeys = [];

    if (onlySavedMaxes) {
        // PRENDIAMO SOLO QUELLI CHE HANNO UN MASSIMALE SALVATO
        sourceKeys = Object.keys(currentMaxes);
    } else {
        // PRENDIAMO TUTTO IL DATABASE GLOBALE
        sourceKeys = Object.keys(globalExerciseLibrary);
    }

    sourceKeys.forEach(exName => {
        // Se stiamo filtrando per massimali, dobbiamo recuperare i dettagli dalla libreria globale
        // Se è un nome custom che non esiste nella libreria, lo gestiamo
        const libData = globalExerciseLibrary[exName] || { p: "Altro / Custom" };
        const primaryMuscle = libData.p || "Altro / Custom";

        let foundCategory = "Altro / Custom";

        // Cerca categoria
        for (const [parent, children] of Object.entries(MUSCLE_STRUCTURE)) {
            if (primaryMuscle === parent || children.includes(primaryMuscle)) {
                foundCategory = parent;
                break;
            }
        }

        // Se stiamo visualizzando solo i massimali, mettiamo un dettaglio extra
        const detailTxt = (onlySavedMaxes) ? `1RM: ${currentMaxes[exName]}kg` : (primaryMuscle !== foundCategory ? primaryMuscle : "");

        categorized[foundCategory].push({
            name: exName,
            detail: detailTxt
        });
    });

    // Pulizia categorie vuote e ordinamento
    Object.keys(categorized).forEach(cat => {
        if (categorized[cat].length === 0) delete categorized[cat];
        else categorized[cat].sort((a, b) => a.name.localeCompare(b.name));
    });

    return categorized;
}

// --- NUOVA FUNZIONE 2: Crea Componente Tendina (UI) ---
// --- NUOVA FUNZIONE 2: Crea Componente Tendina (UI) ---
// Aggiunto parametro: showOnlyMaxes (default false)
function createExerciseSmartDropdown(initialValue, onSelect, showOnlyMaxes = false) {
    const container = document.createElement('div');
    container.className = 'exercise-select-wrapper custom-dropdown-wrapper';

    // Trigger
    const trigger = document.createElement('div');
    trigger.className = 'exercise-trigger';
    // Se stiamo filtrando, cambiamo leggermente lo stile o il placeholder
    const placeholder = showOnlyMaxes ? "Scegli un Fondamentale..." : "Seleziona Esercizio...";
    const displayVal = initialValue || placeholder;

    trigger.innerHTML = `<span>${displayVal}</span> <i class="ph ph-caret-down"></i>`;

    // Menu
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.width = '100%';

    // Search Box
    const searchDiv = document.createElement('div');
    searchDiv.className = 'dropdown-search-box';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Cerca...';
    searchInput.onclick = (e) => e.stopPropagation();
    searchDiv.appendChild(searchInput);

    // Lista
    const listContainer = document.createElement('div');
    listContainer.className = 'dropdown-items-container';

    // DATI FILTRATI IN BASE AL PARAMETRO
    const exercisesData = organizeExercisesByMuscle(showOnlyMaxes);

    // Render Function
    const renderList = (filter = "") => {
        listContainer.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        let hasResults = false;

        // Se non ci sono massimali salvati e siamo in modalità filter
        if (showOnlyMaxes && Object.keys(exercisesData).length === 0) {
            listContainer.innerHTML = `
                <div style="padding:15px; text-align:center; color:#888; font-size:12px;">
                    <i class="ph ph-warning-circle" style="font-size:24px; margin-bottom:5px;"></i><br>
                    Nessun massimale impostato.<br>
                    Vai su <b>1RM</b> in alto per aggiungerne uno.
                </div>
            `;
            return;
        }

        Object.entries(exercisesData).forEach(([category, exercises]) => {
            const matchingExercises = exercises.filter(ex =>
                ex.name.toLowerCase().includes(lowerFilter) ||
                category.toLowerCase().includes(lowerFilter)
            );

            if (matchingExercises.length === 0) return;
            hasResults = true;

            const catHeader = document.createElement('div');
            catHeader.className = 'ex-category-header expanded'; // Default aperto per i fondamentali
            catHeader.innerHTML = `<span>${category}</span>`; // Rimosso freccia per pulizia in liste corte

            const catBody = document.createElement('div');
            catBody.className = 'ex-category-body visible'; // Default visibile

            matchingExercises.forEach(ex => {
                const item = document.createElement('div');
                item.className = 'ex-option-item';

                // Stile speciale se è un massimale
                if (showOnlyMaxes) {
                    item.style.borderLeft = "3px solid #FF9500";
                    item.style.background = "#FFFCF5";
                }

                const tagHtml = ex.detail ? `<span class="muscle-tag" style="${showOnlyMaxes ? 'color:#FF9500; border-color:#FF9500;' : ''}">${ex.detail}</span>` : '';
                item.innerHTML = `<span>${ex.name}</span> ${tagHtml}`;

                if (ex.name === initialValue) {
                    item.style.fontWeight = "bold";
                    item.style.color = "#0071E3";
                }

                item.onclick = (e) => {
                    e.stopPropagation();
                    trigger.querySelector('span').textContent = ex.name;
                    menu.classList.remove('open');
                    onSelect(ex.name);
                };
                catBody.appendChild(item);
            });

            listContainer.appendChild(catHeader);
            listContainer.appendChild(catBody);
        });

        // "Usa come nuovo" solo se NON siamo in modalità massimali stretta
        if (!hasResults && filter && !showOnlyMaxes) {
            const newItem = document.createElement('div');
            newItem.className = 'ex-option-item';
            newItem.innerHTML = `Usa "<b>${filter}</b>" come nuovo`;
            newItem.onclick = () => {
                trigger.querySelector('span').textContent = filter;
                menu.classList.remove('open');
                onSelect(filter);
            };
            listContainer.appendChild(newItem);
        }
    };

    renderList();

    // Eventi
    searchInput.addEventListener('input', (e) => renderList(e.target.value));

    trigger.onclick = (e) => {
        document.querySelectorAll('.dropdown-menu.open').forEach(el => {
            if (el !== menu) el.classList.remove('open');
        });
        menu.classList.toggle('open');
        if (menu.classList.contains('open')) {
            setTimeout(() => searchInput.focus(), 50);
            searchInput.value = '';
            renderList();
        }
    };

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) menu.classList.remove('open');
    });

    menu.appendChild(searchDiv);
    menu.appendChild(listContainer);
    container.appendChild(trigger);
    container.appendChild(menu);

    return container;
}


// ============================================================
// === FUNZIONE RIGA STANDARD (BODYBUILDING / COMPLEMENTARI) ===
// ============================================================

function createExerciseRowHTML(container, data, index) {
    const row = document.createElement('div');
    row.className = 'exercise-row';

    // Default sicuri per evitare crash
    if (!data.muscles) data.muscles = [];
    if (!data.technique) data.technique = "Standard";
    if (!data.metricType) data.metricType = "RPE";

    const primaryMuscle = data.muscles.find(m => m.type === 'primary')?.name || "";

    // --- HTML STRUTTURA (CARD UNICA, NIENTE COLONNE LEFT/RIGHT) ---
    row.innerHTML = `
        <!-- ELEMENTI FISSI -->
        <div class="drag-handle"><i class="ph ph-dots-six-vertical"></i></div>
        <button class="btn-remove-row"><i class="ph ph-trash"></i></button>

        <!-- PIANO 1: ESERCIZIO E TECNICA -->
        <div class="er-top-deck">
            <div class="input-wrapper ex-name-wrapper" style="flex-grow: 1;">
                <span class="tiny-label">Esercizio</span>
                <!-- Qui verrà inserita la tendina via JS -->
                <div class="exercise-smart-select-placeholder"></div>
            </div>
            
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
                <div class="input-wrapper">
                     <span class="tiny-label">Target</span>
                     <input type="text" class="input-intensity-val" value="${data.intensityVal || ''}" style="width: 50px; text-align: center; border-color: #FF2D55; font-weight:700;">
                </div>
            </div>
        </div>

        <!-- PIANO 3: MUSCOLI E NOTE -->
        <div class="er-bot-deck">
            <div class="er-col-muscles">
                <span class="tiny-label">Focus Muscolare</span>
                <div class="muscle-dropdown-placeholder"></div>
                <div class="synergists-list"></div>
                <button class="btn-add-synergist"><i class="ph ph-plus"></i> Sinergico</button>
            </div>
            <div class="er-col-notes">
                <span class="tiny-label">Note Tecniche</span>
                <textarea class="input-notes" placeholder="Indicazioni...">${data.notes || ''}</textarea>
            </div>
        </div>
    `;
    container.appendChild(row);

    // --- LOGICA JAVASCRIPT ---

    // 1. TENDINA ESERCIZIO (Smart Dropdown)
    const exSelectContainer = row.querySelector('.exercise-smart-select-placeholder');

    const onExerciseSelected = (selectedName) => {
        data.name = selectedName;

        // Auto-Fill Muscoli
        const searchKey = selectedName.toLowerCase();
        // Sicurezza: controlla che exerciseSearchIndex esista
        const foundExercise = (typeof exerciseSearchIndex !== 'undefined' && exerciseSearchIndex[searchKey])
            ? exerciseSearchIndex[searchKey]
            : (typeof globalExerciseLibrary !== 'undefined' ? globalExerciseLibrary[selectedName] : null);

        if (foundExercise) {
            if (foundExercise.p && row.dropdownComponent) {
                row.dropdownComponent.setValue(foundExercise.p);
                data.muscles = data.muscles.filter(m => m.type !== 'primary');
                data.muscles.unshift({ name: foundExercise.p, type: 'primary' });
            }
            // Reset Sinergici
            data.muscles = data.muscles.filter(m => m.type === 'primary');
            if (foundExercise.s && foundExercise.s.length > 0) {
                foundExercise.s.forEach(item => {
                    if (typeof item === 'string') data.muscles.push({ name: item, type: 'secondary' });
                    else data.muscles.push({ name: item.name, type: item.type });
                });
            }
            if (typeof renderSynergists === 'function') renderSynergists();
        }
        if (typeof updateLiveStats === 'function') updateLiveStats();
    };

    // Creazione Tendina (FALSE = Mostra tutti, non solo massimali)
    if (typeof createExerciseSmartDropdown === 'function') {
        const smartDropdown = createExerciseSmartDropdown(data.name, onExerciseSelected, false);
        exSelectContainer.appendChild(smartDropdown);
    } else {
        // Fallback di emergenza
        exSelectContainer.innerHTML = `<input type="text" value="${data.name}" class="input-ex-name">`;
        exSelectContainer.querySelector('input').oninput = (e) => data.name = e.target.value;
    }


    // 2. GESTIONE SETS/REPS (Dinamica)
    const dynamicArea = row.querySelector('.dynamic-inputs-area');

    const renderCentralInputs = () => {
        dynamicArea.innerHTML = '';

        if (data.technique === "Top set + back-off") {
            dynamicArea.className = 'dynamic-inputs-area special-mode';
            dynamicArea.innerHTML = `
                <div class="special-group"><span class="tiny-label">TOP</span><div style="display:flex; gap:2px; align-items:center;"><span style="font-size:11px; color:#888;">1 x</span><input type="text" class="special-input input-top-reps" value="${data.topReps || ''}" placeholder="Reps"><span style="font-size:11px; color:#888;">@</span><input type="text" class="special-input input-top-int" value="${data.topInt || ''}" placeholder="${data.metricType}"></div></div>
                <div class="special-group"><span class="tiny-label">BACK</span><div style="display:flex; gap:2px; align-items:center;"><input type="text" class="special-input input-back-sets" value="${data.backSets || ''}" placeholder="Sets"><span style="font-size:11px; color:#888;">x</span><input type="text" class="special-input input-back-reps" value="${data.backReps || ''}" placeholder="Reps"></div></div>`;
            const el = row.querySelector('.input-intensity-val'); if (el) el.parentElement.style.display = 'none';
        } else {
            dynamicArea.className = 'dynamic-inputs-area standard-mode';
            const layout = TECHNIQUE_LAYOUTS[data.technique] || TECHNIQUE_LAYOUTS["Standard"];
            dynamicArea.innerHTML = `<div class="input-wrapper"><span class="tiny-label">${layout.label1}</span><input type="text" class="input-sets" value="${data.val1 || ''}"></div><div class="input-wrapper"><span class="tiny-label">${layout.label2}</span><input type="text" class="input-reps" value="${data.val2 || ''}"></div>`;
            const el = row.querySelector('.input-intensity-val'); if (el) el.parentElement.style.display = 'block';
        }

        // Ri-attacca i listener agli input appena creati
        dynamicArea.querySelectorAll('input').forEach(i => i.addEventListener('input', updateData));
    };

    // 3. UPDATE DATA
    const updateData = () => {
        data.technique = row.querySelector('.select-technique').value;
        data.metricType = row.querySelector('.select-metric').value;
        data.notes = row.querySelector('.input-notes').value;
        data.rest = row.querySelector('.input-rest').value;

        const intInput = row.querySelector('.input-intensity-val');
        if (intInput) data.intensityVal = intInput.value;

        if (data.technique === "Top set + back-off") {
            data.topReps = row.querySelector('.input-top-reps')?.value;
            data.topInt = row.querySelector('.input-top-int')?.value;
            data.backSets = row.querySelector('.input-back-sets')?.value;
            data.backReps = row.querySelector('.input-back-reps')?.value;
        } else {
            data.val1 = row.querySelector('.input-sets')?.value;
            data.val2 = row.querySelector('.input-reps')?.value;
        }

        // Aggiorna grafici
        if (typeof isPlMode !== 'undefined' && isPlMode) {
            if (typeof updateLiveStatsPL === 'function') updateLiveStatsPL();
        } else {
            if (typeof updateLiveStats === 'function') updateLiveStats();
        }
    };

    // Avvio Render Inputs
    renderCentralInputs();

    // 4. LISTENERS GLOBALI RIGA
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
        renderCentralInputs();
    });

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        // Logica eliminazione flessibile
        if (typeof isPlMode !== 'undefined' && isPlMode) {
            // Modo PL: usa dayKey se disponibile, altrimenti cerca
            // Per semplicità qui usiamo l'eliminazione diretta dall'array renderPlDay gestisce
            if (confirm("Eliminare?")) {
                // Nota: qui index potrebbe essere desincronizzato, meglio rimuovere dall'array e rirenderizzare
                // Ma per ora lasciamo la gestione al chiamante se possibile o ricarichiamo la pagina
                const currentArr = workoutData[`w${currentPlWeek}_d${currentPlDay}`];
                const realIdx = currentArr.indexOf(data);
                if (realIdx > -1) {
                    currentArr.splice(realIdx, 1);
                    renderPlDay();
                }
            }
        } else {
            // Modo BB
            const currentArr = workoutData[currentDay];
            const realIdx = currentArr.indexOf(data);
            if (realIdx > -1) {
                currentArr.splice(realIdx, 1);
                renderDay(currentDay);
            }
        }
    });

    // 5. MUSCOLO PRIMARIO (Dropdown)
    const muscleContainer = row.querySelector('.muscle-dropdown-placeholder');
    const onMuscleChange = (newValue) => {
        data.muscles = data.muscles.filter(m => m.type !== 'primary');
        if (newValue) data.muscles.unshift({ name: newValue, type: 'primary' });
        updateData();
    };
    if (typeof createMuscleDropdown === 'function') {
        const dropdownEl = createMuscleDropdown(primaryMuscle, onMuscleChange);
        muscleContainer.appendChild(dropdownEl);
        row.dropdownComponent = dropdownEl;
    }

    // 6. SINERGICI
    const synList = row.querySelector('.synergists-list');
    const renderSynergists = () => {
        synList.innerHTML = '';
        const syns = data.muscles.filter(m => m.type !== 'primary');
        syns.forEach((m) => {
            const div = document.createElement('div'); div.className = 'synergist-row';
            const typeSelect = document.createElement('select');
            typeSelect.innerHTML = `<option value="secondary" ${m.type === 'secondary' ? 'selected' : ''}>Secondario</option><option value="tertiary" ${m.type === 'tertiary' ? 'selected' : ''}>Terziario</option>`;
            typeSelect.addEventListener('change', (e) => { m.type = e.target.value; updateData(); });

            const onSynChange = (newVal) => { m.name = newVal; updateData(); };

            if (typeof createMuscleDropdown === 'function') {
                const dd = createMuscleDropdown(m.name, onSynChange);
                const delBtn = document.createElement('i');
                delBtn.className = 'ph ph-x btn-del-syn';
                delBtn.onclick = () => {
                    const realIndex = data.muscles.indexOf(m);
                    if (realIndex > -1) data.muscles.splice(realIndex, 1);
                    renderSynergists(); updateData();
                };
                div.appendChild(typeSelect); div.appendChild(dd); div.appendChild(delBtn);
                synList.appendChild(div);
            }
        });
    };
    renderSynergists();

    row.querySelector('.btn-add-synergist').addEventListener('click', () => {
        data.muscles.push({ name: "", type: "secondary" });
        renderSynergists();
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
                // FIX: Se siamo in PL mode o se non clicco nulla, non fare nulla (evita che scompaia)
                if (isPlMode || elements.length === 0) return;

                const index = elements[0].index;
                const labelClicked = volumeChartInstance.data.labels[index];

                // Se clicco su una categoria Padre (e non sono già dentro)
                if (!currentChartFocus) {
                    currentChartFocus = labelClicked;
                    updateLiveStats(); // Ridisegna focalizzato (Solo BB)
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
    // DEBUG: Apri la console (F12) per vedere cosa sta succedendo
    console.log("Tentativo Salvataggio...");
    console.log("Modalità PL:", isPowerliftingMode);
    console.log("Chiavi in WorkoutData:", Object.keys(workoutData));

    // 1. Validazione UNIVERSALE (Funziona per BB e PL)
    let hasExercises = false;
    
    // Prende TUTTI i valori dentro workoutData (liste di esercizi)
    const allDays = Object.values(workoutData);

    for (const dayList of allDays) {
        // Se è una lista valida e contiene almeno 1 elemento...
        if (Array.isArray(dayList) && dayList.length > 0) {
            hasExercises = true;
            break; // Trovato qualcosa, interrompiamo il ciclo
        }
    }

    if (!hasExercises) {
        console.warn("Nessun esercizio trovato in:", workoutData);
        alert("La scheda è vuota! Aggiungi almeno un esercizio.");
        return;
    }

    // 2. Apri Modale
    modal.classList.remove('hidden');

    // 3. Carica clienti
    if (modalClientSelect.options.length <= 1) {
        await loadClientsForModal();
    }

    // 4. Gestione Stato Modifica
    if (isEditMode) {
        if (originalAssignedTo) {
            optAssign.click();
            modalClientSelect.value = originalAssignedTo;
        } else {
            optArchive.click();
        }
    }
});
btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
optAssign.addEventListener('click', () => { saveMode = 'assign'; optAssign.classList.add('active'); optArchive.classList.remove('active'); modalClientSelect.classList.remove('hidden'); modalTemplateName.classList.add('hidden'); });
optArchive.addEventListener('click', () => { saveMode = 'archive'; optArchive.classList.add('active'); optAssign.classList.remove('active'); modalClientSelect.classList.add('hidden'); modalTemplateName.classList.remove('hidden'); modalTemplateName.value = document.getElementById('workout-name').textContent.trim(); });
optAssign.classList.add('active');

// --- SALVATAGGIO REALE SU FIREBASE (VERSIONE BLINDATA) ---
btnConfirmSave.addEventListener('click', async () => {
    const user = auth.currentUser; 
    if (!user) return;

    // 1. Feedback Visivo
    const originalText = btnConfirmSave.textContent;
    btnConfirmSave.textContent = "Salvataggio..."; 
    btnConfirmSave.disabled = true;

    // ============================================================
    // A. APPRENDIMENTO AUTOMATICO
    // ============================================================
    const newKnowledge = {};
    let hasNewKnowledge = false;
    
    // Usa Object.keys per sicurezza
    const allDayKeys = Object.keys(workoutData); 

    for (const dayKey of allDayKeys) {
        const exercises = workoutData[dayKey];
        if (Array.isArray(exercises)) {
            exercises.forEach(ex => {
                const name = ex.name ? ex.name.trim() : "";
                if (!name || !ex.muscles || ex.muscles.length === 0) return;

                const currentPrimary = ex.muscles.find(m => m.type === 'primary')?.name;
                const currentSynergists = ex.muscles
                    .filter(m => m.type !== 'primary' && m.name)
                    .map(m => ({ name: m.name, type: m.type }));

                if (!currentPrimary) return;

                const known = exerciseSearchIndex[name.toLowerCase()];
                let isDifferent = false;

                if (!known) {
                    isDifferent = true; 
                } else {
                    if (known.p !== currentPrimary) isDifferent = true;
                    if (known.s && currentSynergists.length !== known.s.length) isDifferent = true;
                }

                if (isDifferent) {
                    newKnowledge[name] = { p: currentPrimary, s: currentSynergists };
                    hasNewKnowledge = true;
                }
            });
        }
    }

    if (hasNewKnowledge) {
        try {
            const userRef = doc(db, "users", user.uid);
            const updatePayload = {};
            for (const [key, val] of Object.entries(newKnowledge)) {
                updatePayload[`exerciseLibrary.${key}`] = val;
            }
            updateDoc(userRef, updatePayload).catch(e => console.warn("Errore learning:", e));
        } catch (e) { console.warn(e); }
    }

    // ============================================================
    // B. SALVATAGGIO SCHEDA
    // ============================================================
    try {
        let finalName = document.getElementById('workout-name').textContent.trim();
        let assignedClientId = null;
        let isTemplate = false;

        if (saveMode === 'assign') {
            assignedClientId = modalClientSelect.value;
            // Controllo sicurezza se il valore è vuoto
            if (!assignedClientId || assignedClientId === "undefined") { 
                alert("Seleziona un atleta valido dalla lista!"); 
                btnConfirmSave.disabled = false; 
                btnConfirmSave.textContent = originalText;
                return; 
            }
        } else {
            finalName = modalTemplateName.value.trim() || finalName;
            isTemplate = true;
        }

        // TRUCCO DI PULIZIA: Rimuove tutti gli 'undefined' da workoutData
        // Questo previene l'errore "Unsupported field value: undefined"
        const cleanWorkoutData = JSON.parse(JSON.stringify(workoutData));

        const workoutPayload = {
            coachId: user.uid,
            name: finalName,
            days: totalDays,
            
            // Gestione PL sicura
            isPlMode: isPlMode === true, // Forza booleano
            plWeeks: (isPlMode && plWeeks) ? plWeeks : null, 
            
            // Dati puliti
            data: cleanWorkoutData,       
            
            assignedTo: assignedClientId, // Sarà una stringa o null
            isTemplate: isTemplate,
            volumeSettingsUsed: userVolumeSettings,
            updatedAt: serverTimestamp(),
            isArchived: false
        };

        if (isEditMode && editingWorkoutId) {
            const ref = doc(db, "workouts", editingWorkoutId);
            await updateDoc(ref, workoutPayload);
        } else {
            workoutPayload.createdAt = serverTimestamp();
            const ref = await addDoc(collection(db, "workouts"), workoutPayload);
            editingWorkoutId = ref.id;
            isEditMode = true;
        }

        if (assignedClientId) {
            const clientRef = doc(db, "users", assignedClientId);
            await updateDoc(clientRef, { 
                activeWorkoutId: editingWorkoutId || "pending", 
                lastWorkoutUpdate: serverTimestamp() 
            });
        }

        alert("Salvato e Assegnato con successo!");
        window.location.href = "dashboard-pt.html";

    } catch (error) { 
        console.error("ERRORE SALVATAGGIO:", error); 
        alert("Errore critico salvataggio: " + error.message); 
        btnConfirmSave.disabled = false; 
        btnConfirmSave.textContent = originalText;
    }
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


// --- NUOVA FUNZIONE: SETUP SELETTORE CLIENTE (PL CONTEXT) ---
async function setupPlClientSelector() {
    const toolbar = document.getElementById('pl-tools'); // Assicurati che questo ID esista nel tuo HTML nella barra PL
    if (!toolbar) return;

    // Evita duplicati se la funzione viene richiamata
    if (document.getElementById('pl-client-context-select')) return;

    const container = document.createElement('div');
    container.style.cssText = "display:flex; align-items:center; gap:8px; margin-left:15px; border-left:1px solid #ccc; padding-left:15px;";
    
    container.innerHTML = `
        <span class="tiny-label" style="margin:0;">Riferimento 1RM:</span>
        <select id="pl-client-context-select" style="padding:4px; border-radius:6px; border:1px solid #D2D2D7; font-size:12px; font-weight:600; width:160px;">
            <option value="">Nessuno (Archivio)</option>
            <option disabled>--- Caricamento... ---</option>
        </select>
    `;

    // Inseriamo il selettore nella toolbar (prima dei bottoni grafici)
    toolbar.insertBefore(container, toolbar.firstChild);

    const select = document.getElementById('pl-client-context-select');

    // 1. Carica lista clienti
    const q = query(collection(db, "users"), where("role", "==", "client"));
    const snapshot = await getDocs(q);
    
    // Pulisci e popola
    select.innerHTML = '<option value="">Nessuno (Archivio)</option>';
    snapshot.forEach(doc => {
        const c = doc.data();
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = c.name || c.email;
        select.appendChild(opt);
    });

    // 2. LISTENER AL CAMBIO
    select.addEventListener('change', async (e) => {
        const clientId = e.target.value;
        const feedbackLabel = container.querySelector('.tiny-label');
        selectedPlClientId = clientId || null; 
        if (!clientId) {
            // --- MODALITÀ COACH (Nessuno) ---
            feedbackLabel.textContent = "Riferimento 1RM:";
            feedbackLabel.style.color = "";
            
            // Carica i massimali (struttura) del Coach per averli come base
            // (Assumiamo che userData sia accessibile o lo ricarichiamo)
            const user = auth.currentUser;
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                currentMaxes = userDoc.data().savedMaxes || {};
            } else {
                currentMaxes = {};
            }
            
            renderPlDay(); 
            return;
        }

        // Modalità Cliente
        feedbackLabel.textContent = "Caricamento...";
        try {
            const userRef = doc(db, "users", clientId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                // Sovrascrivi i massimali globali con quelli del cliente
                currentMaxes = data.savedMaxes || {}; 
                
                feedbackLabel.textContent = "✅ Dati caricati";
                feedbackLabel.style.color = "green";
                
                // IMPORTANTE: Aggiorna tutta la vista
                renderPlDay(); 
                
                // Aggiorna anche la tendina salvataggio finale per comodità
                const modalSelect = document.getElementById('modal-client-select');
                if(modalSelect) modalSelect.value = clientId;
            }
        } catch (error) {
            console.error(error);
            alert("Errore caricamento dati cliente");
        }
    });
}


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
        if (exData.isFundamental) {
            createFundamentalRowHTML(listContainer, exData, index, key);
        } else {
            // Crea card standard
            createExerciseRowHTML(listContainer, exData, index);

            // --- FIX DELETE PER COMPLEMENTARI PL ---
            const row = listContainer.lastChild;
            const delBtn = row.querySelector('.btn-remove-row');
            // Clona il bottone per rimuovere i vecchi listener BB
            const newDelBtn = delBtn.cloneNode(true);
            delBtn.parentNode.replaceChild(newDelBtn, delBtn);

            newDelBtn.onclick = () => {
                if (confirm("Eliminare complementare?")) {
                    workoutData[key].splice(index, 1);
                    renderPlDay();
                }
            };

            // Aggiungi tasto copia week
            addCopyToWeeksBtn(row, exData, index, key);
        }
    });

    // BOTTONI AGGIUNTA
    const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex; gap:10px; margin-top:20px;';
    const addFundBtn = document.createElement('button'); addFundBtn.className = 'btn-primary'; addFundBtn.style.cssText = 'flex:1; background:#FF9500;'; addFundBtn.innerHTML = '<i class="ph ph-barbell"></i> + Fondamentale';
    addFundBtn.onclick = () => {
        // MAV FIX: Default sets vuoto ma pronto
        workoutData[key].push({ id: Date.now(), isFundamental: true, excludeVolume: true, variant: "", name: "", trackingMetric: "Kg", sets: [] });
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
        if (!confirm("Copiare TUTTI i complementari?")) return;
        const accs = workoutData[key].filter(e => !e.isFundamental);
        const dayNum = currentPlDay;
        for (let w = 1; w <= plWeeks; w++) {
            if (w === currentPlWeek) continue;
            const targetKey = `w${w}_d${dayNum}`;
            if (!workoutData[targetKey]) workoutData[targetKey] = [];
            accs.forEach(acc => { const clone = JSON.parse(JSON.stringify(acc)); clone.id = Date.now() + Math.random(); workoutData[targetKey].push(clone); });
        }
        alert("Copiato!");
    };
    dayContentArea.appendChild(copyAllBtn);
    
    // *** CORREZIONE QUI SOTTO ***
    // Prima c'era workoutData[day], che causava l'errore. Ora usa workoutData[key].
    setupDragAndDrop(listContainer, workoutData[key]);
    
    updateLiveStatsPL();
}

// ============================================================
// === HELPER FUNCTIONS PER IL CALCOLO LIVE (AGGIUNGERE QUI) ===
// ============================================================

// 1. Cerca di capire che esercizio è dal nome (per sapere quale massimale usare)
function detectLiftType(name) {
    if (!name) return null;
    const n = name.toLowerCase();
    if (n.includes('squat')) return 'squat';
    if (n.includes('panca') || n.includes('bench') || n.includes('press')) return 'bench';
    if (n.includes('stacco') || n.includes('deadlift') || n.includes('terra')) return 'deadlift';
    if (n.includes('military') || n.includes('ohp') || n.includes('lento')) return 'ohp';
    return null;
}

// 2. Calcola i Kg reali basandosi sulla % e sui massimali salvati
function getRealKg(percent, liftType) {
    // currentMaxes è la variabile globale definita all'inizio del file
    if (!liftType || !currentMaxes[liftType]) return null;

    // Accetta sia "80" che "80%"
    const cleanPerc = percent.toString().replace('%', '');
    const p = parseFloat(cleanPerc);

    if (isNaN(p)) return null;

    // Formula: (Massimale * Percentuale) / 100
    return Math.round((currentMaxes[liftType] * p) / 100);
}


// ============================================================
// === FUNZIONE PRINCIPALE FONDAMENTALI (SOSTITUISCE LA VECCHIA) ===
// ============================================================


// ============================================================
// === 10. GENERATORE RIGA FONDAMENTALI (PL VERSION - FINAL FIX) ===
// ============================================================

function createFundamentalRowHTML(container, data, index, dayKey) {
    const row = document.createElement('div');
    row.className = 'exercise-row pl-fund-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 330px';
    row.style.gap = '0';
    row.style.padding = '0';
    row.style.overflow = 'visible';

    // --- 1. DATA SETUP ---
    data.isFundamental = true;

    if (!data.sets || data.sets.length === 0) {
        data.sets = [{ numSets: 1, reps: '', mode: 'PERC', val: '', role: 'normal' }];
    }

    if (!data.progression) data.progression = {
        strategy: 'role_based',
        all: { type: 'linear_kg', val: 2.5 },
        top: { type: 'linear_kg', val: 2.5 },
        backoff: { type: 'linear_perc', val: 2 }
    };

    const hasParam = !!data.variantParamType && data.variantParamType !== 'none';
    let paramLabelText = 'Extra';
    let paramPlaceholder = 'Val';

    if (hasParam) {
        paramLabelText = data.variantParamType.charAt(0).toUpperCase() + data.variantParamType.slice(1);
        if (data.variantParamType === 'time') paramPlaceholder = 'es. 3s';
        else if (data.variantParamType === 'height') paramPlaceholder = 'es. 5cm';
        else if (data.variantParamType === 'angle') paramPlaceholder = 'es. 45°';
    }

    // --- 2. COLONNA SINISTRA ---
    const leftCol = document.createElement('div');
    leftCol.style.padding = '20px';
    leftCol.style.position = 'relative';
    leftCol.style.zIndex = '20';

    leftCol.innerHTML = `
        <div class="drag-handle" style="left:6px; top:20px;"><i class="ph ph-dots-six-vertical"></i></div>
        
        <div style="margin-bottom: 20px; display:flex; gap:15px; align-items:flex-end; padding-left:25px;">
            <div style="flex:1; min-width: 0;" class="smart-select-container">
                <span class="tiny-label" style="margin-bottom:4px; display:block;">Esercizio (Target 1RM)</span>
            </div>
            
            <div style="flex:1; min-width: 0;">
                <span class="tiny-label" style="margin-bottom:4px; display:block;">Variante</span>
                <div class="variant-selector" style="display:flex; justify-content:space-between; align-items:center; background:white; border:1px solid #E5E5EA; padding:0 12px; border-radius:8px; cursor:pointer; height:42px; transition:border 0.2s;">
                    <span class="var-text" style="font-size:13px; font-weight:500; color:#1D1D1F; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.variant || 'Standard'}</span>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <i class="ph ph-x-circle btn-clear-var" style="color:#FF3B30; font-size:16px; display:${data.variant ? 'block' : 'none'};"></i>
                        <i class="ph ph-caret-down" style="color:#86868B;"></i>
                    </div>
                </div>
            </div>

            <div class="var-param-container" style="flex: 0 0 80px; display:${hasParam ? 'block' : 'none'}; margin-left:-5px;">
                <span class="tiny-label" style="margin-bottom:4px; display:block;">${paramLabelText}</span>
                <input type="text" class="var-param-input" value="${data.variantValue || ''}" placeholder="${paramPlaceholder}" 
                    style="width:100%; height:42px; border:1px solid #0071E3; background:#F0F8FF; border-radius:8px; text-align:center; font-weight:600; font-size:13px; color:#0071E3;">
            </div>

            <div class="max-badge-display" style="height:42px; display:flex; align-items:center; padding-left:5px;"></div>
        </div>

        <div style="display:grid; grid-template-columns: 110px 140px 1fr 30px; gap:10px; padding-left:25px; margin-bottom:8px; font-size:10px; color:#86868B; font-weight:700; text-transform:uppercase;">
            <span>Quantità (Sets x Reps)</span>
            <span>Intensità (Mode & Value)</span>
            <span>Ruolo (Tag)</span>
            <span></span>
        </div>
        
        <div class="sets-container" style="display:flex; flex-direction:column; gap:8px; margin-left:25px;"></div>
        
        <button class="btn-add-set-pl" style="font-size:11px; margin-left:25px; width:calc(100% - 25px); margin-top:12px; padding:10px; background:#fff; border:1px dashed #C7C7CC; color:#0071E3; font-weight:600; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:6px; transition:background 0.2s;">
            <i class="ph ph-plus-circle" style="font-size:14px;"></i> Aggiungi Gruppo Set
        </button>

        <textarea class="input-notes" placeholder="Note tecniche per l'atleta..." style="margin-left:25px; width:calc(100% - 25px); margin-top:15px; height:50px; min-height:50px; border:1px solid #E5E5EA; border-radius:8px; padding:10px; font-family:inherit; font-size:12px; resize:vertical;">${data.notes || ''}</textarea>
    `;

    // --- 3. COLONNA DESTRA (Automazione) ---
    const rightCol = document.createElement('div');
    rightCol.style.cssText = "background:#F9F9FB; border-left:1px solid #E5E5EA; padding:20px; display:flex; flex-direction:column; justify-content:flex-start; z-index:10; overflow-y:auto;";

    const createProgControls = (label, configKey) => {
        const cfg = data.progression[configKey];
        return `
            <div class="prog-box" style="background:white; border:1px solid #E5E5EA; border-radius:8px; padding:10px; margin-top:10px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size:10px; font-weight:700; color:#1D1D1F; text-transform:uppercase; margin-bottom:8px;">${label}</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <select class="prog-type" data-key="${configKey}" style="flex:1; height:32px; font-size:11px; border:1px solid #D2D2D7; border-radius:6px; background:white; cursor:pointer;">
                        <option value="linear_kg" ${cfg.type === 'linear_kg' ? 'selected' : ''}>+ Kg (Lineare)</option>
                        <option value="linear_perc" ${cfg.type === 'linear_perc' ? 'selected' : ''}>+ % (Lineare)</option>
                        <option value="rpe_ramp" ${cfg.type === 'rpe_ramp' ? 'selected' : ''}>+ RPE (Ramp)</option>
                        <option value="reps_drop" ${cfg.type === 'reps_drop' ? 'selected' : ''}>- Reps (Peaking)</option>
                        <option value="vol_add" ${cfg.type === 'vol_add' ? 'selected' : ''}>+ 1 Set (Volume)</option>
                    </select>
                    <input type="number" class="prog-val" data-key="${configKey}" value="${cfg.val}" style="width:65px; flex-shrink:0; height:32px; font-size:12px; border:1px solid #D2D2D7; border-radius:6px; text-align:center; font-weight:600; padding:0 2px;">
                </div>
            </div>
        `;
    };

    const renderRightCol = () => {
        const strat = data.progression.strategy;
        rightCol.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <span style="font-size:11px; font-weight:800; color:#86868B; letter-spacing:0.5px;">AUTOMAZIONE</span>
                <button class="btn-remove-row" style="width:28px; height:28px; background:white; border:1px solid #E5E5EA; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="ph ph-trash" style="color:#FF3B30; font-size:16px;"></i></button>
            </div>

            <div style="margin-bottom:5px;">
                <label style="font-size:10px; color:#666; font-weight:600; display:block; margin-bottom:4px;">Applica a:</label>
                <select id="prog-strat-sel" style="width:100%; height:34px; font-size:12px; padding:0 8px; border:1px solid #D2D2D7; border-radius:6px; background:white; cursor:pointer;">
                    <option value="all" ${strat === 'all' ? 'selected' : ''}>Tutto l'Esercizio (Globale)</option>
                    <option value="role_based" ${strat === 'role_based' ? 'selected' : ''}>Per Ruolo (Top vs Backoff)</option>
                </select>
            </div>

            <div id="prog-inputs">
                ${strat === 'all'
                ? createProgControls('Regola Unica', 'all')
                : createProgControls('Top Set 👑', 'top') + createProgControls('Back-off / Normal 📉', 'backoff')
            }
            </div>

            <button class="btn-generate-prog" style="margin-top:20px; width:100%; background:#1D1D1F; color:white; border:none; border-radius:8px; padding:12px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:transform 0.1s;">
                <i class="ph ph-lightning" style="color:#FFD60A; font-size:16px;"></i> Genera Week Future
            </button>
        `;

        rightCol.querySelector('#prog-strat-sel').onchange = (e) => {
            data.progression.strategy = e.target.value;
            renderRightCol();
        };
        rightCol.querySelectorAll('.prog-type').forEach(el => el.onchange = (e) => data.progression[e.target.dataset.key].type = e.target.value);
        rightCol.querySelectorAll('.prog-val').forEach(el => el.oninput = (e) => data.progression[e.target.dataset.key].val = parseFloat(e.target.value) || 0);

        rightCol.querySelector('.btn-generate-prog').onclick = handleGenerateProgression;
        rightCol.querySelector('.btn-remove-row').onclick = () => {
            if (confirm("Eliminare esercizio?")) { workoutData[dayKey].splice(index, 1); if (isPlMode) renderPlDay(); }
        };

        if (window.PhosphorIcons) window.PhosphorIcons.replace();
    };

    row.appendChild(leftCol);
    row.appendChild(rightCol);
    container.appendChild(row);

    // --- 4. LOGICA & UI ---

    const selectContainer = leftCol.querySelector('.smart-select-container');
    const onExerciseSelect = (name) => {
        data.name = name;
        updateMaxBadge();
        renderSets();
    };

    // Dropdown Esercizio
    const exDropdown = createExerciseSmartDropdown(data.name, onExerciseSelect, true);
    const exTrigger = exDropdown.querySelector('.exercise-trigger');
    if (exTrigger) {
        exTrigger.style.height = '42px';
        exTrigger.style.display = 'flex';
        exTrigger.style.alignItems = 'center';
    }
    selectContainer.appendChild(exDropdown);

    // BADGE 1RM (Logica corretta: se currentMaxes è vuoto, ritorna 0 e nasconde)
    const updateMaxBadge = () => {
        const badgeArea = leftCol.querySelector('.max-badge-display');
        const max = getReferenceMax(data.name);
        // MOSTRA SOLO SE IL MASSIMALE ESISTE ED È > 0
        badgeArea.innerHTML = max > 0
            ? `<div style="background:#FFF8E1; color:#F57F17; font-size:11px; font-weight:700; padding:6px 12px; border-radius:6px; border:1px solid #FFD54F; white-space:nowrap;">1RM: ${max}kg</div>`
            : ``;
    };
    updateMaxBadge();

    // VARIANT SELECTOR LOGIC
    const varSelector = leftCol.querySelector('.variant-selector');
    const paramContainer = leftCol.querySelector('.var-param-container');
    const paramLabel = paramContainer.querySelector('.tiny-label');
    const paramInput = paramContainer.querySelector('.var-param-input');

    paramInput.oninput = (e) => data.variantValue = e.target.value;

    varSelector.onclick = (e) => {
        if (e.target.classList.contains('btn-clear-var') || e.target.closest('.btn-clear-var')) return;
        if (typeof openVariantDropdown === 'function') {
            openVariantDropdown(varSelector, (name, section, paramType) => {
                data.variant = name;
                data.variantParamType = paramType;
                data.variantValue = '';
                leftCol.querySelector('.var-text').textContent = name;
                leftCol.querySelector('.btn-clear-var').style.display = 'block';
                if (paramType && paramType !== 'none') {
                    paramContainer.style.display = 'block';
                    paramLabel.textContent = paramType.charAt(0).toUpperCase() + paramType.slice(1);
                    paramInput.value = '';
                    paramInput.placeholder = (paramType === 'time') ? 'es. 3s' : (paramType === 'height') ? 'es. 5cm' : 'Val';
                } else {
                    paramContainer.style.display = 'none';
                }
            });
        }
    };

    leftCol.querySelector('.btn-clear-var').onclick = (e) => {
        e.stopPropagation();
        data.variant = "";
        data.variantParamType = null;
        data.variantValue = "";
        leftCol.querySelector('.var-text').textContent = "Standard";
        leftCol.querySelector('.btn-clear-var').style.display = 'none';
        paramContainer.style.display = 'none';
    };

    // SETS RENDERING
    const setsCont = leftCol.querySelector('.sets-container');
    const renderSets = () => {
        setsCont.innerHTML = '';
        const max = getReferenceMax(data.name); // Qui prende il massimale del cliente se selezionato

        data.sets.forEach((set, sIdx) => {
            const div = document.createElement('div');
            div.style.cssText = "display:grid; grid-template-columns: 110px 140px 1fr 30px; gap:10px; align-items:center; background:white; border:1px solid #E5E5EA; padding:10px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.02); transition:border 0.2s;";

            let hintText = "";
            let inputPlaceholder = "Val";
            let isMav = (set.mode === 'MAV');
            let isSetDisabled = isMav;

            // CALCOLO HINT KG: Solo se abbiamo un massimale > 0 (quindi cliente selezionato)
            if (max > 0 && set.val) {
                if (set.mode === 'PERC') {
                    const kg = Math.round((max * parseFloat(set.val)) / 100);
                    hintText = `${kg}kg`;
                } else if (set.mode === 'KG') {
                    const perc = Math.round((parseFloat(set.val) / max) * 100);
                    hintText = `${perc}%`;
                }
            }
            if (set.mode === 'RPE' || set.mode === 'RIR') inputPlaceholder = "es. 8";

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="number" class="inp-sets" value="${isSetDisabled ? 1 : (set.numSets || 1)}" ${isSetDisabled ? 'disabled' : ''} title="Sets" style="width:38px; height:32px; text-align:center; font-weight:700; border:1px solid #D2D2D7; border-radius:6px; padding:0; ${isSetDisabled ? 'background:#F2F2F7; color:#999;' : ''}">
                    <span style="font-size:11px; color:#888;">x</span>
                    <input type="text" class="inp-reps" value="${set.reps}" title="Reps" style="flex:1; height:32px; text-align:center; font-weight:600; border:1px solid #D2D2D7; border-radius:6px; padding:0;">
                </div>
                <div style="display:flex; border:1px solid #D2D2D7; border-radius:6px; overflow:hidden; height:32px;">
                    <select class="sel-mode" style="border:none; border-right:1px solid #E5E5EA; background:#F9F9FA; font-size:10px; font-weight:700; padding:0 2px; color:#1D1D1F; cursor:pointer; width:50px; text-align:center;">
                        <option value="PERC" ${set.mode === 'PERC' ? 'selected' : ''}>%</option>
                        <option value="KG" ${set.mode === 'KG' ? 'selected' : ''}>Kg</option>
                        <option value="RPE" ${set.mode === 'RPE' ? 'selected' : ''}>RPE</option>
                        <option value="RIR" ${set.mode === 'RIR' ? 'selected' : ''}>RIR</option>
                        <option value="MAV" ${set.mode === 'MAV' ? 'selected' : ''}>MAV</option>
                    </select>
                    <div style="position:relative; flex:1;">
                        <input type="text" class="inp-val" value="${set.val}" placeholder="${isMav ? 'Auto' : inputPlaceholder}" ${isMav ? 'disabled' : ''} style="width:100%; height:100%; border:none; padding:4px; font-size:12px; font-weight:600; text-align:center; ${isMav ? 'background:#FAFAFC;' : ''} outline:none;">
                        ${hintText ? `<div style="position:absolute; right:4px; top:50%; transform:translateY(-50%); font-size:9px; color:#0071E3; font-weight:700; background:rgba(0, 113, 227, 0.1); padding:2px 4px; border-radius:4px; pointer-events:none;">${hintText}</div>` : ''}
                    </div>
                </div>
                <select class="sel-role" style="width:100%; height:32px; font-size:11px; padding:0 8px; border:1px solid ${getRoleColor(set.role)}; color:${getRoleColor(set.role)}; font-weight:700; border-radius:6px; cursor:pointer; background:white;">
                    <option value="normal" ${set.role === 'normal' ? 'selected' : ''}>Normal / Work</option>
                    <option value="top" ${set.role === 'top' ? 'selected' : ''}>Top Set 👑</option>
                    <option value="backoff" ${set.role === 'backoff' ? 'selected' : ''}>Back-off 📉</option>
                    <option value="warmup" ${set.role === 'warmup' ? 'selected' : ''}>Warm-up 🔥</option>
                </select>
                <div class="btn-del-set" style="cursor:pointer; color:#C7C7CC; display:flex; justify-content:center; align-items:center; height:32px;"><i class="ph ph-x" style="font-size:16px;"></i></div>
            `;

            const inpSets = div.querySelector('.inp-sets');
            const inpReps = div.querySelector('.inp-reps');
            const selMode = div.querySelector('.sel-mode');
            const inpVal = div.querySelector('.inp-val');
            const selRole = div.querySelector('.sel-role');
            const delBtn = div.querySelector('.btn-del-set');

            inpSets.oninput = (e) => {
                // Se cancello tutto, metto 0, altrimenti il numero
                const val = e.target.value;
                set.numSets = val === '' ? 0 : (parseInt(val) || 0);
                updateLiveStatsPL(); // <--- QUESTO AGGIORNA IL GRAFICO MENTRE SCRIVI
            };
            inpReps.oninput = (e) => set.reps = e.target.value;
            inpVal.oninput = (e) => {
                set.val = e.target.value;
                if (max > 0 && set.mode !== 'MAV' && set.mode !== 'RPE') renderSets(); // Ricalcola hint live
            };
            selMode.onchange = (e) => {
                set.mode = e.target.value;
                set.val = '';
                if (set.mode === 'MAV') set.numSets = 1;
                renderSets();
            };
            selRole.onchange = (e) => {
                set.role = e.target.value;
                selRole.style.borderColor = getRoleColor(set.role);
                selRole.style.color = getRoleColor(set.role);
            };
            delBtn.onclick = () => {
                data.sets.splice(sIdx, 1);
                renderSets();
                updateLiveStatsPL(); // <--- Aggiorna grafico dopo eliminazione
            };
            div.addEventListener('focusin', () => div.style.borderColor = '#0071E3');
            div.addEventListener('focusout', () => div.style.borderColor = '#E5E5EA');
            setsCont.appendChild(div);
        });
        if (window.PhosphorIcons) window.PhosphorIcons.replace();
    };

    function getRoleColor(role) {
        if (role === 'top') return '#FFD60A';
        if (role === 'backoff') return '#0071E3';
        if (role === 'warmup') return '#FF9500';
        return '#86868B';
    }

    renderRightCol();
    renderSets();

    leftCol.querySelector('.btn-add-set-pl').onclick = () => {
        const last = data.sets[data.sets.length - 1];
        let nextRole = 'normal';
        if (last && last.role === 'top') nextRole = 'backoff';
        if (last && last.role === 'backoff') nextRole = 'backoff';
        data.sets.push({ numSets: 1, reps: last ? last.reps : '5', mode: last ? last.mode : 'PERC', val: '', role: nextRole });
        renderSets();
        updateLiveStatsPL();
    };

    // --- GENERAZIONE AUTOMATICA FIXATA (ORDINAMENTO) ---
    function handleGenerateProgression() {
        if (!confirm(`Generare settimane future per "${data.name}"?`)) return;

        const currentWeekNum = parseInt(dayKey.split('_')[0].replace('w', ''));
        const dayPart = dayKey.split('_')[1];
        const strat = data.progression.strategy;

        for (let w = currentWeekNum + 1; w <= plWeeks; w++) {
            const targetKey = `w${w}_${dayPart}`;
            if (!workoutData[targetKey]) workoutData[targetKey] = [];
            
            // 1. RIMUOVI VECCHIA VERSIONE DELLO STESSO ESERCIZIO (Se esisteva)
            // Nota: Se ci sono due "Squat" diversi nello stesso giorno, questo li rimuove entrambi.
            // Per il PL solitamente va bene, altrimenti servirebbe un ID unico persistente.
            workoutData[targetKey] = workoutData[targetKey].filter(e => !(e.isFundamental && e.name === data.name));

            // 2. CREA CLONE
            const targetEx = JSON.parse(JSON.stringify(data));
            targetEx.id = Date.now() + Math.random(); // Nuovo ID
            const weeksDelta = w - currentWeekNum;

            // 3. APPLICA CALCOLI PROGRESSIONE
            targetEx.sets.forEach((tSet) => {
                let config = data.progression.all;
                if (strat === 'role_based') {
                    if (tSet.role === 'top') config = data.progression.top;
                    else if (tSet.role === 'backoff' || tSet.role === 'normal') config = data.progression.backoff;
                }
                const stepVal = config.val * weeksDelta;
                const pType = config.type;

                if (pType === 'linear_kg' && tSet.mode === 'KG') {
                    const base = parseFloat(tSet.val);
                    if (!isNaN(base)) tSet.val = (base + stepVal).toString();
                }
                else if (pType === 'linear_perc' && tSet.mode === 'PERC') {
                    const base = parseFloat(tSet.val);
                    if (!isNaN(base)) tSet.val = (base + stepVal).toString();
                }
                else if (pType === 'rpe_ramp' && (tSet.mode === 'RPE' || tSet.mode === 'RIR')) {
                    const base = parseFloat(tSet.val);
                    if (!isNaN(base)) tSet.val = Math.min(10, base + stepVal).toString();
                }
                else if (pType === 'reps_drop') {
                    const base = parseFloat(tSet.reps);
                    if (!isNaN(base)) tSet.reps = Math.max(1, base - stepVal).toString();
                }
                else if (pType === 'vol_add') {
                    tSet.numSets = Math.round(tSet.numSets + stepVal);
                }
            });

            // 4. INSERIMENTO NELLA POSIZIONE CORRETTA (FIX!)
            // Usiamo l'indice originale ('index') passato alla funzione principale.
            // Se l'array target è più corto dell'indice, splice lo aggiunge in fondo (corretto).
            // Se l'indice esiste, lo inserisce LÌ e sposta gli altri sotto.
            
            // Caso speciale: se la week target è vuota o l'indice è troppo alto
            if (index >= workoutData[targetKey].length) {
                workoutData[targetKey].push(targetEx);
            } else {
                workoutData[targetKey].splice(index, 0, targetEx);
            }
        }
        alert("Progressione applicata! 🚀");
    }
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

            if (name) {
                if (!VARIANTS_DB[section]) VARIANTS_DB[section] = [];

                // Aggiungiamo la variante con il parametro (es. time)
                VARIANTS_DB[section].push({ name: name, param: paramType, lifts: [] });

                // --- SALVATAGGIO SU FIREBASE ---
                try {
                    const user = auth.currentUser;
                    await updateDoc(doc(db, "users", user.uid), {
                        savedVariants: VARIANTS_DB
                    });
                    console.log("Variante salvata su Cloud");
                } catch (e) { console.error("Err salvataggio variante", e); }
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
    
    // 1. HELPER: Calcola i set reali (ignora vuoti e warmup)
    const getRealSets = (ex) => {
        if (ex.isFundamental) {
            // Fondamentali: Somma i set della tabella
            if (!ex.sets || !Array.isArray(ex.sets)) return 0;
            return ex.sets.reduce((total, s) => {
                if (s.role === 'warmup') return total; // Ignora riscaldamento
                return total + (parseInt(s.numSets) || 0); // Se vuoto o NaN, aggiunge 0
            }, 0);
        } else {
            // Complementari: Logica standard
            // Se i campi sono vuoti, restituisce 0 (fix set fantasma)
            if (ex.technique === "Top set + back-off") {
                const back = ex.backSets === '' ? 0 : (parseFloat(ex.backSets) || 0);
                // Conta 1 (top set) solo se i campi top set sono compilati, altrimenti 0? 
                // Per semplicità: se backSets è > 0 o c'è un top set, contiamo.
                return 1 + back; 
            }
            const val = ex.val1 === '' ? 0 : (parseFloat(ex.val1) || 0);
            return val;
        }
    };

    // 2. RECUPERA DATI SETTIMANA CORRENTE
    const weekPrefix = `w${currentPlWeek}_`;
    const daysInWeek = Object.keys(workoutData).filter(k => k.startsWith(weekPrefix));

    // --- MODO 1: VISTA MUSCOLI (Dettagliata) ---
    if (plChartView === 'muscles') {
        let hierarchyMap = {};
        Object.keys(MUSCLE_STRUCTURE).forEach(cat => hierarchyMap[cat] = { total: 0, children: {} });
        hierarchyMap["Altro"] = { total: 0, children: {} };

        daysInWeek.forEach(dayKey => {
            workoutData[dayKey].forEach(ex => {
                const sets = getRealSets(ex);
                if (sets > 0) {
                    // Se non ha muscoli, va in Altro
                    if (!ex.muscles || ex.muscles.length === 0) {
                        hierarchyMap["Altro"].total += sets;
                    } else {
                        ex.muscles.forEach(m => {
                            let parent = "Altro";
                            // Cerca categoria padre
                            for (const [cat, list] of Object.entries(MUSCLE_STRUCTURE)) {
                                if (list.includes(m.name) || cat === m.name) { parent = cat; break; }
                            }
                            
                            // Logica pesi muscolari (Primario 100%, Secondario 50%)
                            let mult = 1.0;
                            if (m.type === 'secondary') mult = 0.5;
                            
                            const vol = sets * mult;
                            if(hierarchyMap[parent]) {
                                hierarchyMap[parent].total += vol;
                                if (!hierarchyMap[parent].children[m.name]) hierarchyMap[parent].children[m.name] = 0;
                                hierarchyMap[parent].children[m.name] += vol;
                            }
                        });
                    }
                }
            });
        });
        
        // Renderizza usando la UI del BB (Liste + Grafico dettagliato)
        renderStatsUI(hierarchyMap); 
        return; 
    }

    // --- MODO 2: VISTA ALZATE (Sintetica PL) ---
    // Resetta UI BB se presente
    const statsList = document.getElementById('stats-breakdown');
    statsList.innerHTML = ''; 

    let liftStats = { "Squat": 0, "Panca": 0, "Stacco": 0, "Military": 0, "Accessori": 0 };

    daysInWeek.forEach(dayKey => {
        workoutData[dayKey].forEach(ex => {
            const sets = getRealSets(ex);
            if (sets === 0) return; // Salta se 0

            if (ex.isFundamental) {
                const type = detectLiftType(ex.name);
                if (type === 'squat') liftStats["Squat"] += sets;
                else if (type === 'bench') liftStats["Panca"] += sets;
                else if (type === 'deadlift') liftStats["Stacco"] += sets;
                else if (type === 'ohp') liftStats["Military"] += sets;
                else liftStats["Accessori"] += sets; // Fondamentali non standard contano come accessori o propria cat? Mettiamo acc per ora
            } else {
                liftStats["Accessori"] += sets;
            }
        });
    });

    // Aggiorna Grafico
    if (volumeChartInstance) {
        const labels = Object.keys(liftStats);
        const data = Object.values(liftStats);
        const plColors = ['#FF3B30', '#0071E3', '#FF9500', '#AF52DE', '#8E8E93'];

        volumeChartInstance.data.labels = labels;
        volumeChartInstance.data.datasets[0].data = data;
        volumeChartInstance.data.datasets[0].backgroundColor = plColors;
        volumeChartInstance.update();

        // Renderizza Lista Laterale Semplice (Solo per modo PL)
        labels.forEach((label, i) => {
            if (data[i] > 0) {
                const row = document.createElement('div');
                row.className = 'stat-group'; // Usa classi esistenti per layout corretto
                row.style.marginBottom = "5px";
                row.innerHTML = `
                    <div class="stat-parent" style="cursor:default; background:transparent; padding:5px 0; border-bottom:1px solid #f0f0f0;">
                        <span style="color:${plColors[i]}; font-weight:700;">${label}</span>
                        <span class="volume-value">${data[i]} Sets</span>
                    </div>`;
                statsList.appendChild(row);
            }
        });
        
        // Se tutto è vuoto
        if (data.every(v => v === 0)) {
            statsList.innerHTML = '<div style="text-align:center; color:#ccc; font-size:12px; padding:20px;">Nessun dato</div>';
        }
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

// --- FUNZIONE PER ATTIVARE IL DRAG & DROP ---
// ==========================================
// === FUNZIONE GLOBALE DRAG & DROP ===
// ==========================================
function setupDragAndDrop(containerElement, dataArray) {
    // Sicurezza: se la libreria non è caricata o il container non esiste, esci
    if (typeof Sortable === 'undefined' || !containerElement) return;

    // Se c'era già un'istanza attiva su questo container, distruggila per evitare conflitti
    if (containerElement._sortable) containerElement._sortable.destroy();

    // Crea la nuova istanza Sortable
    containerElement._sortable = new Sortable(containerElement, {
        handle: '.drag-handle', // La classe dell'icona da cliccare
        animation: 150,         // Velocità animazione in ms
        ghostClass: 'sortable-ghost', // Classe aggiunta all'elemento mentre lo trascini (opzionale)

        // QUANDO HAI FINITO DI TRASCINARE:
        onEnd: function (evt) {
            // 1. Rimuovi l'elemento dalla vecchia posizione nell'array
            const item = dataArray.splice(evt.oldIndex, 1)[0];
            // 2. Inseriscilo nella nuova posizione
            dataArray.splice(evt.newIndex, 0, item);

            console.log("Nuovo ordine salvato!", dataArray);
        }
    });
}

// ==========================================
// === ESPORTAZIONE EXCEL (STYLING PRO) ===
// ==========================================

document.getElementById('btn-import-excel').addEventListener('click', exportWorkoutToExcel);
// Nota: Ho assunto che il tasto "Importa Excel" che hai nell'HTML
// lo volessi usare per ESPORTARE (visto il nome della tua richiesta).
// Se il tasto ha un altro ID, cambia 'btn-import-excel' con l'ID giusto.

function exportWorkoutToExcel() {
    if (!workoutData || Object.keys(workoutData).length === 0) {
        alert("Nessun dato da esportare!");
        return;
    }

    const workoutName = document.getElementById('workout-name').textContent.trim() || "Scheda Allenamento";
    
    // 1. DEFINIZIONE STILI
    const styles = {
        title: {
            font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1D1D1F" } }, // Nero Apple
            alignment: { horizontal: "center", vertical: "center" }
        },
        dayHeader: {
            font: { bold: true, sz: 14, color: { rgb: "000000" } },
            fill: { fgColor: { rgb: "FFD60A" } }, // Giallo evidenziatore
            alignment: { horizontal: "left", vertical: "center" },
            border: { bottom: { style: "medium", color: { rgb: "000000" } } }
        },
        colHeader: {
            font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "0071E3" } }, // Blu Apple
            alignment: { horizontal: "center", vertical: "center" },
            border: { right: { style: "thin", color: { rgb: "FFFFFF" } } }
        },
        cellNormal: {
            font: { sz: 11 },
            alignment: { wrapText: true, vertical: "top" },
            border: { bottom: { style: "thin", color: { rgb: "E5E5EA" } } }
        },
        cellCenter: {
            font: { sz: 11 },
            alignment: { horizontal: "center", vertical: "top", wrapText: true },
            border: { bottom: { style: "thin", color: { rgb: "E5E5EA" } } }
        }
    };

    // 2. PREPARAZIONE DATI
    // Creiamo un array di righe per Excel
    let wsData = [];
    
    // Titolo Scheda
    wsData.push([{ v: workoutName.toUpperCase(), s: styles.title }]);
    wsData.push([]); // Riga vuota

    // Ordiniamo le chiavi (Giorni o Settimane)
    const sortedKeys = Object.keys(workoutData).sort((a, b) => {
        // Logica sort mista (numeri per BB, stringhe w1_d1 per PL)
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedKeys.forEach(key => {
        const exercises = workoutData[key];
        if (!exercises || exercises.length === 0) return;

        // -- INTESTAZIONE GIORNO --
        let dayTitle = "";
        if (key.includes('w')) {
            // Formato PL: w1_d1 -> Week 1 - Day 1
            const parts = key.split('_');
            dayTitle = `WEEK ${parts[0].replace('w','')} • DAY ${parts[1].replace('d','')}`;
        } else {
            // Formato BB: 1 -> Giorno 1
            dayTitle = `GIORNO ${key}`;
        }

        wsData.push([{ v: dayTitle, s: styles.dayHeader }, null, null, null, null]); // Occupa 5 colonne

        // -- INTESTAZIONE COLONNE --
        const headers = ["ESERCIZIO", "SETS", "REPS", "CARICO / INTENSITÀ", "NOTE / RECUPERO"];
        const headerRow = headers.map(h => ({ v: h, s: styles.colHeader }));
        wsData.push(headerRow);

        // -- RIGHE ESERCIZI --
        exercises.forEach(ex => {
            let name = ex.name;
            if (ex.variant) name += ` (${ex.variant})`;
            
            let setsStr = "";
            let repsStr = "";
            let loadStr = "";
            let notesStr = ex.notes || "";
            if (ex.rest) notesStr += `\nRec: ${ex.rest}`;

            // LOGICA FORMATTAZIONE (BB vs PL)
            if (ex.isFundamental) {
                // PL MODE: Struttura complessa
                ex.sets.forEach(s => {
                    const roleIcon = s.role === 'top' ? '👑' : (s.role === 'backoff' ? '📉' : '•');
                    
                    // Formattazione Sets
                    setsStr += `${roleIcon} ${s.numSets || 1}\n`;
                    
                    // Formattazione Reps
                    repsStr += `${s.reps}\n`;
                    
                    // Formattazione Carico (Smart)
                    let loadLine = "";
                    if (s.mode === 'PERC') loadLine = `${s.val}%`;
                    else if (s.mode === 'KG') loadLine = `${s.val}Kg`;
                    else if (s.mode === 'RPE') loadLine = `@RPE ${s.targetVal || ''}`;
                    else if (s.mode === 'MAV') loadLine = `MAV`;
                    else loadLine = s.val || "-";
                    
                    loadStr += `${loadLine}\n`;
                });
            } else {
                // BB MODE o COMPLEMENTARE PL
                if (ex.technique === 'Top set + back-off') {
                     setsStr = "TOP\nBACK";
                     repsStr = `${ex.topReps || '-'}\n${ex.backReps || '-'}`;
                     loadStr = `${ex.topInt || '-'}\n${ex.backSets || '?'} set`;
                } else {
                    setsStr = ex.val1 || ex.sets || "-"; // val1 nel vecchio sistema BB è i Sets
                    repsStr = ex.val2 || ex.reps || "-";
                    loadStr = `${ex.metricType || ''} ${ex.intensityVal || ''}`;
                }
            }

            // Crea la riga Excel
            const row = [
                { v: name, s: styles.cellNormal },
                { v: setsStr.trim(), s: styles.cellCenter },
                { v: repsStr.trim(), s: styles.cellCenter },
                { v: loadStr.trim(), s: styles.cellCenter },
                { v: notesStr.trim(), s: styles.cellNormal }
            ];
            wsData.push(row);
        });

        wsData.push([]); // Riga vuota tra i giorni
    });

    // 3. CREAZIONE FOGLIO
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge Celle (Titolo e Header Giorni sparsi su 5 colonne)
    ws['!merges'] = [];
    let currentRow = 0;
    wsData.forEach((row, idx) => {
        if (row[0] && row[0].s === styles.title) {
             ws['!merges'].push({ s: { r: idx, c: 0 }, e: { r: idx, c: 4 } });
        }
        if (row[0] && row[0].s === styles.dayHeader) {
             ws['!merges'].push({ s: { r: idx, c: 0 }, e: { r: idx, c: 4 } });
        }
    });

    // Larghezza Colonne
    ws['!cols'] = [
        { wch: 35 }, // Esercizio
        { wch: 8 },  // Sets
        { wch: 10 }, // Reps
        { wch: 20 }, // Carico
        { wch: 30 }  // Note
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Scheda Allenamento");

    // 4. DOWNLOAD
    const fileName = `${workoutName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`;
    XLSX.writeFile(wb, fileName);
}