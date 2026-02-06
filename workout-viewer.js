import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
     
    query, where, orderBy, limit, getDocs // <--- AGGIUNTI QUESTI
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

// DOM
const listContainer = document.getElementById('exercises-list');
const dayTitle = document.getElementById('day-title');
const btnBack = document.getElementById('btn-back');

// SLIDER DOM
const btnFinish = document.getElementById('btn-finish');
const slideKnob = btnFinish.querySelector('.slide-knob');
const slideText = btnFinish.querySelector('.slide-text');

// TIMER DOM
const restOverlay = document.getElementById('rest-overlay');
const timerCircle = document.getElementById('timer-circle');
const timerText = document.getElementById('rest-countdown');
const btnSkip = document.getElementById('btn-skip-rest');
const btnAdd30 = document.getElementById('btn-add-30');

// STATE
let currentWorkoutId = localStorage.getItem('currentWorkoutId');
let currentDay = localStorage.getItem('currentDay');
let workoutData = null;
let timerInterval = null;
let secondsLeft = 0;
let totalTime = 90;

// SEMAFORO PER EVITARE SOVRASCRITTURE
let isRestoring = false; 

const STORAGE_KEY = `workout_session_${currentWorkoutId}_day_${currentDay}`;
const TIMER_KEY = `workout_timer_start_${currentWorkoutId}_day_${currentDay}`;

// 1. INIT & PAGE SHOW (Fix per navigazione Back/Forward)
window.addEventListener('pageshow', async (event) => {
    // Se la pagina viene caricata dalla cache (bfcache), ricarichiamo i dati
    if (event.persisted && auth.currentUser) {
        console.log("Ripristino da cache rilevato...");
        await loadData();
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) window.location.href = "login.html";
    // Caricamento iniziale
    await loadData();
    initSlideToFinish();
});

// Variabile globale per tenere i pesi vecchi



// Funzione "Segugio" per trovare il massimale
function findBestMaxMatch(exerciseName) {
    if (!exerciseName || !userMaxes) return 0;
    
    // 1. Pulizia nome esercizio scheda (es. "Squat (Comp)" -> "squat")
    const cleanEx = exerciseName.toLowerCase()
        .replace('(comp)', '')
        .replace('pl', '')
        .trim();

    // 2. Cerca nelle chiavi dei massimali salvati (es. "Squat", "Panca")
    const maxKeys = Object.keys(userMaxes);
    
    // Tentativo 1: La chiave del massimale è contenuta nel nome esercizio?
    // Es. Esercizio: "Panca Piana Manubri" -> Key: "Panca" -> Match!
    let match = maxKeys.find(k => cleanEx.includes(k.toLowerCase()));
    
    // Tentativo 2: Il nome esercizio è contenuto nella chiave?
    // Es. Esercizio: "Squat" -> Key: "Squat High Bar" -> Match!
    if (!match) {
        match = maxKeys.find(k => k.toLowerCase().includes(cleanEx));
    }

    return match ? userMaxes[match] : 0;
}





let historyMap = {}; 

// Aggiungi questa variabile GLOBALE all'inizio del file, sotto le altre variabili let








let userMaxes = {}; 

async function loadData() {
    try {
        // 1. Carica la Scheda dal Database
        const docRef = doc(db, "workouts", currentWorkoutId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            alert("Errore caricamento scheda");
            window.location.href = "dashboard-client.html";
            return;
        }

        const docData = snap.data();
        workoutData = docData; // Salva in variabile globale

        // 2. RECUPERA MASSIMALI UTENTE (Per calcoli PL % e 1RM)
        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                userMaxes = userDoc.data().savedMaxes || {}; 
            }
        }

        // ============================================================
        // 3. TRADUZIONE CHIAVE GIORNO (IL FIX FONDAMENTALE)
        // ============================================================
        // Il Dashboard passa numeri (es. "1", "5"), ma il PL usa chiavi (es. "w1_d1", "w2_d1").
        
        let targetKey = currentDay; // Partiamo assumendo sia "1" o "w1_d1" esatto
        let exercises = [];

        // Se l'accesso diretto fallisce (es. cerco "1" ma esiste solo "w1_d1")
        if (!workoutData.data[targetKey]) {
            
            // Recuperiamo tutte le chiavi che sembrano giorni PL (iniziano con 'w')
            const plKeys = Object.keys(workoutData.data).filter(k => k.startsWith('w'));
            
            if (plKeys.length > 0) {
                // Li ordiniamo logicamente: w1_d1, w1_d2 ... w2_d1 ...
                plKeys.sort((a, b) => {
                    // Estrae i numeri dalla stringa (es. w1_d2 -> [1, 2])
                    const numsA = a.match(/\d+/g).map(Number);
                    const numsB = b.match(/\d+/g).map(Number);
                    
                    // Confronta Settimana
                    if (numsA[0] !== numsB[0]) return numsA[0] - numsB[0];
                    // Se settimana uguale, confronta Giorno
                    return numsA[1] - numsB[1];
                });

                // Convertiamo il currentDay (es. "1") in indice array (0)
                const index = parseInt(currentDay) - 1;
                
                // Se esiste una chiave a quell'indice, usiamo quella!
                if (plKeys[index]) {
                    targetKey = plKeys[index];
                    console.log(`🔀 Mapping PL attivo: Giorno ${currentDay} -> Chiave ${targetKey}`);
                }
            }
        }

        // Ora recuperiamo gli esercizi con la chiave corretta
        exercises = workoutData.data[targetKey] || [];

        // ============================================================
        // 4. GESTIONE TITOLO
        // ============================================================
        let displayTitle = `Giorno ${currentDay}`;
        
        // Se la chiave finale è in formato PL (wX_dY), creiamo un titolo bello
        if (targetKey.includes('w') && targetKey.includes('d')) {
            const parts = targetKey.split('_'); 
            const weekNum = parts[0].replace('w', '');
            const dayNum = parts[1].replace('d', '');
            displayTitle = `Week ${weekNum} • Day ${dayNum}`;
        }
        
        dayTitle.textContent = displayTitle;

        // --- CARICA STORICO (PREVIOUS LIFTS) ---
        // Nota: Per lo storico usiamo il `dayIndex` numerico originale (currentDay)
        // perché è così che viene salvato nei log.
        try {
            const logsRef = collection(db, "users", auth.currentUser.uid, "logs");
            const q = query(
                logsRef, 
                where("workoutId", "==", currentWorkoutId),
                where("dayIndex", "==", parseInt(currentDay)), 
                orderBy("date", "desc"),
                limit(1)
            );
            
            const logSnap = await getDocs(q);
            if (!logSnap.empty) {
                const lastLog = logSnap.docs[0].data();
                if (lastLog.exercises) {
                    lastLog.exercises.forEach(ex => {
                        historyMap[ex.name] = ex.sets.map(s => s.kg);
                    });
                }
            }
        } catch (err) { console.log("Nessun storico trovato:", err); }
        window.currentExercisesList = exercises; 
        // Renderizza la lista
        renderList(exercises);
        
        // Ripristina input se c'erano
        restoreSession(); 

    } catch (e) { console.error("Errore critico loadData:", e); }
}

// 2. RENDER ACCORDION LIST
// Funzione "Vigile Urbano"
function renderList(exercises) {
    listContainer.innerHTML = '';

    if (!exercises || exercises.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#888;">Riposo! 💤</div>';
        return;
    }

    exercises.forEach((ex, idx) => {
        // IL BIVIO CRUCIALE:
        if (ex.isFundamental) {
            // Chiama la funzione PL che hai già scritto/incollato (Punto C)
            renderFundamentalCard(ex, idx);
        } else {
            // Chiama la funzione BB Standard (scritta qui sotto)
            renderStandardCard(ex, idx);
        }
    });
}

// Funzione estratta per renderizzare le card "vecchio stile" (Complementari)
function renderStandardCard(ex, idx) {
    const card = document.createElement('div');
    card.className = 'ex-card';
    card.dataset.idx = idx;

    // --- CALCOLO SUMMARY ---
    let summaryText = "";
    if (ex.technique === "Top set + back-off") {
        summaryText = `Top Set + ${ex.backSets || 2} Backoff`;
    } else if (ex.technique === "Myo-reps") {
        summaryText = "Activation + Myo Series";
    } else {
        const s = parseInt(ex.val1) || 3;
        const r = ex.val2 || "10";
        summaryText = `${s} Serie x ${r} Reps`;
    }

    // HTML IDENTICO A PRIMA
    let summaryHtml = `
        <div class="ex-summary" onclick="window.toggleCard(this, event)">
            <div class="ex-info">
                <h3>${ex.name}</h3>
                <div class="ex-meta">
                    <span class="badge-info">${summaryText}</span>
                    ${ex.muscles && ex.muscles[0]?.name ? `<span>${ex.muscles[0].name}</span>` : ''}
                </div>
            </div>
            <div class="icon-ring"><i class="ph ph-caret-down"></i></div>
        </div>
    `;

    let detailsHtml = `<div class="ex-details"><div class="details-content">`;
    if (ex.notes) detailsHtml += `<div class="coach-tip">💡 ${ex.notes}</div>`;
    
    // Usa la vecchia funzione generateInputRows (che immagino sia rimasta nel tuo file)
    detailsHtml += generateInputRows(ex);

    const setsCount = parseInt(ex.val1) || (ex.backSets ? parseInt(ex.backSets) + 1 : 0);
    if (setsCount > 1) {
        detailsHtml += `
            <button class="btn-copy" onclick="smartCopy(this)">
                <i class="ph ph-copy"></i> Copia peso su tutti i set
            </button>
        `;
    }
    detailsHtml += `</div></div>`;

    card.innerHTML = summaryHtml + detailsHtml;
    listContainer.appendChild(card);
}

window.toggleCard = (header, event) => {
    // 1. Ferma ogni propagazione (evita che il click passi sotto o sopra)
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // 2. Trova la card genitore
    const card = header.closest('.ex-card');
    if (!card) return;

    // 3. Toggle classe
    card.classList.toggle('active');
};

function generateInputRows(ex) {
    let html = '';
    const rest = ex.rest || 90;
    
    // Recuperiamo lo storico per questo esercizio specifico (se esiste)
    const historySets = historyMap[ex.name] || [];

    if (ex.technique === "Top set + back-off") {
        // Passiamo l'indice 0 per il primo set, 1 per il secondo, ecc...
        html += createRow("TOP", ex.topReps, rest, historySets[0]); 
        const backs = parseInt(ex.backSets) || 2;
        for (let i = 0; i < backs; i++) {
            html += createRow("BACK", ex.backReps, rest, historySets[i + 1]);
        }
    }
    else if (ex.technique === "Myo-reps") {
        html += createRow("ACT", "12-15", rest, historySets[0]);
        for (let i = 1; i <= 5; i++) {
            html += createRow("MYO", "3-5", 15, historySets[i]);
        }
    }
    else {
        const sets = parseInt(ex.val1) || 3;
        const reps = ex.val2 || "10";
        for (let i = 1; i <= sets; i++) {
            // L'indice dell'array parte da 0, quindi usiamo i-1
            html += createRow(i, reps, rest, historySets[i - 1]);
        }
    }
    return html;
}

// Aggiunto parametro 'prevVal'
function createRow(label, targetReps, rest, prevVal) {
    const isSpecial = (String(label).length > 2);
    
    // Se c'è un valore precedente, crea l'HTML, altrimenti stringa vuota
    const prevHtml = prevVal ? `<div class="prev-val">${prevVal}kg</div>` : '';

    return `
        <div class="set-row" data-rest="${rest}" data-reps="${targetReps}">
            <div class="set-info">
                <div class="set-idx ${isSpecial ? 'special' : ''}">${label}</div>
                <span class="set-target">${targetReps} reps</span>
            </div>
            <div class="set-input-area">
                <input type="number" class="input-kg" placeholder="Kg" oninput="window.autoSaveSession()">
                ${prevHtml} <!-- INSERITO QUI SOTTO L'INPUT -->
            </div>
            <button class="btn-check" onclick="toggleSet(this)"><i class="ph ph-check"></i></button>
        </div>
    `;
}

// LOGICA INTERATTIVA
window.toggleSet = (btn) => {
    // FIX: Cerca sia la classe vecchia (.set-row) che quella nuova (.pl-set-row)
    const row = btn.closest('.set-row, .pl-set-row'); 
    
    if (!row) {
        console.error("Errore: Riga non trovata per il bottone", btn);
        return;
    }

    btn.classList.toggle('done');
    
    // Se è done, vibra e parte timer
    if (btn.classList.contains('done')) {
        // Se c'è un tempo di recupero salvato nel dataset, usalo, altrimenti 90s
        const restTime = row.dataset.rest || 90;
        startTimer(restTime);
        if (navigator.vibrate) navigator.vibrate(50);
    }
    
    // Salva stato
    window.autoSaveSession();
};

window.smartCopy = (btn) => {
    const card = btn.closest('.ex-card');
    const inputs = card.querySelectorAll('.input-kg');
    const firstVal = inputs[0].value;
    if (firstVal) {
        inputs.forEach((inp, i) => { 
            // Copia solo se vuoto
            if (i > 0 && !inp.value) {
                inp.value = firstVal; 
            }
        });
        
        // Feedback visivo
        btn.innerHTML = `<i class="ph ph-check"></i> Fatto!`;
        setTimeout(() => btn.innerHTML = `<i class="ph ph-copy"></i> Copia peso su tutti i set`, 1500);
        
        // Forza salvataggio
        window.autoSaveSession();
    }
};

// TIMER DI RECUPERO
function startTimer(seconds) {
    totalTime = parseInt(seconds) || 90;
    secondsLeft = totalTime;
    restOverlay.classList.remove('hidden');
    updateCircle();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsLeft--;
        updateCircle();
        if (secondsLeft <= 0) {
            clearInterval(timerInterval);
            restOverlay.classList.add('hidden');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
}

function updateCircle() {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    timerText.textContent = `${m}:${s < 10 ? '0' + s : s}`;
    const dashOffset = 283 - (283 * secondsLeft) / totalTime;
    timerCircle.style.strokeDashoffset = dashOffset;
}

btnSkip.addEventListener('click', () => { clearInterval(timerInterval); restOverlay.classList.add('hidden'); });
btnAdd30.addEventListener('click', () => { secondsLeft += 30; totalTime += 30; updateCircle(); });

// =========================================
// AUTO-SAVE & RESTORE SYSTEM (Fixato)
// =========================================

function autoSaveSession() {
    // 1. IL SEMAFORO: Se stiamo ripristinando, NON salvare
    if (isRestoring) return;

    // --- NUOVO: AVVIO TIMER AL PRIMO TOCCO ---
    if (!localStorage.getItem(TIMER_KEY)) {
        const now = Date.now();
        localStorage.setItem(TIMER_KEY, now);
        sessionStartTime = now; // Aggiorna la variabile globale del timer
    }
    // -----------------------------------------

    const sessionState = {};

    document.querySelectorAll('.ex-card').forEach(card => {
        const idx = card.dataset.idx;
        const inputs = card.querySelectorAll('.input-kg');
        const checks = card.querySelectorAll('.btn-check');

        sessionState[idx] = { sets: [] };

        inputs.forEach((inp, setIndex) => {
            sessionState[idx].sets.push({
                kg: inp.value,
                done: checks[setIndex].classList.contains('done')
            });
        });
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionState));
    
    // Salva metadati per la dashboard
    localStorage.setItem('active_workout_status', 'running');
    localStorage.setItem('active_workout_meta', JSON.stringify({
        name: workoutData?.name || 'Allenamento',
        day: currentDay,
        id: currentWorkoutId
    }));
}

function restoreSession() {
    const saved = localStorage.getItem(STORAGE_KEY);
    
    // NOTA: Ho rimosso l'avvio forzato del timer qui. 
    // Ora il timer parte solo se c'è già nel localStorage o se l'utente scrive.

    if (!saved) return;

    // ATTIVA SEMAFORO
    isRestoring = true;

    try {
        const state = JSON.parse(saved);

        document.querySelectorAll('.ex-card').forEach(card => {
            const idx = card.dataset.idx;
            if (state[idx]) {
                const inputs = card.querySelectorAll('.input-kg');
                const checks = card.querySelectorAll('.btn-check');

                state[idx].sets.forEach((set, i) => {
                    if (inputs[i] && set.kg) inputs[i].value = set.kg;
                    if (checks[i] && set.done) checks[i].classList.add('done');
                });
            }
        });
        console.log("Sessione ripristinata.");
    } catch (e) {
        console.error("Errore ripristino:", e);
    } finally {
        isRestoring = false;
    }
}

// =========================================
// SLIDE TO FINISH (Logica Touch)
// =========================================
function initSlideToFinish() {
    let isDragging = false;
    let startX = 0;
    let containerWidth = 0;
    let maxDrag = 0;

    const startDrag = (clientX) => {
        isDragging = true;
        startX = clientX;
        containerWidth = btnFinish.offsetWidth;
        maxDrag = containerWidth - 60; 
        slideText.style.opacity = 0.5;
    };

    const moveDrag = (clientX) => {
        if (!isDragging) return;
        let moveX = clientX - startX;
        if (moveX < 0) moveX = 0;
        if (moveX > maxDrag) moveX = maxDrag;
        slideKnob.style.transform = `translateX(${moveX}px)`;
        slideText.style.opacity = 1 - (moveX / maxDrag);
    };

    const endDrag = async (clientX) => {
        if (!isDragging) return;
        isDragging = false;
        let moveX = clientX - startX;
        
        if (moveX >= maxDrag - 10) {
            slideKnob.style.transform = `translateX(${maxDrag}px)`;
            slideText.textContent = "SALVATAGGIO...";
            await saveWorkout();
        } else {
            slideKnob.style.transform = `translateX(0px)`;
            slideText.style.opacity = 1;
        }
    };

    slideKnob.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientX));
    document.addEventListener('touchmove', (e) => moveDrag(e.touches[0].clientX));
    document.addEventListener('touchend', (e) => endDrag(e.changedTouches[0].clientX));
    
    // Mouse fallback
    slideKnob.addEventListener('mousedown', (e) => startDrag(e.clientX));
    document.addEventListener('mousemove', (e) => moveDrag(e.clientX));
    document.addEventListener('mouseup', (e) => endDrag(e.clientX));
}

// =========================================
// SALVATAGGIO ROBUSTO (BB + PL)
// =========================================
async function saveWorkout() {
    // Feedback visivo immediato sullo slider
    if(slideText) slideText.textContent = "SALVATAGGIO...";

    const sessionLog = {
        workoutId: currentWorkoutId,
        workoutName: workoutData.name,
        dayIndex: currentDay, // Mantiene l'ID originale (es. "1" o "w1_d1")
        date: new Date().toISOString(),
        exercises: []
    };

    // Recupera la struttura originale per i muscoli
    // Gestione chiave complessa (w1_d1) o semplice (1)
    let originalExercises = [];
    if (workoutData.data[currentDay]) {
        originalExercises = workoutData.data[currentDay];
    } else {
        // Fallback se ci sono problemi di indici
        originalExercises = window.currentExercisesList || [];
    }

    document.querySelectorAll('.ex-card').forEach(card => {
        const idx = card.dataset.idx;
        const originalEx = originalExercises[idx];
        const name = card.querySelector('h3').textContent;
        const sets = [];

        // SELEZIONE RIGHE: Cerca sia le vecchie (.set-row) che le nuove (.pl-set-row)
        const rows = card.querySelectorAll('.set-row, .pl-set-row');

        rows.forEach(row => {
            // 1. Recupera KG
            const kgInput = row.querySelector('.input-kg');
            const kg = kgInput ? parseFloat(kgInput.value) : 0;

            // 2. Recupera Check (Fatto/Non fatto)
            const checkBtn = row.querySelector('.btn-check');
            const done = checkBtn ? checkBtn.classList.contains('done') : false;

            // 3. Recupera REPS (Target)
            let repsVal = row.dataset.reps;
            let repsNum = parseFloat(repsVal);
            // Gestione range (es. "8-10" -> salva 8)
            if (isNaN(repsNum) && repsVal && repsVal.includes('-')) {
                repsNum = parseFloat(repsVal.split('-')[0]);
            }

            // 4. (Opzionale) Recupera RPE se presente
            const rpeInput = row.querySelector('.pl-rpe-input');
            let rpeVal = rpeInput ? rpeInput.value : null;

            // SALVA SOLO SE: C'è un peso inserito OPPURE è stato spuntato come fatto
            if (kg > 0 || done) {
                const setObj = { 
                    kg: kg, 
                    reps: repsNum || 0, 
                    done: done 
                };
                if(rpeVal) setObj.rpe = rpeVal; // Salva RPE se c'è
                sets.push(setObj);
            }
        });

        // Aggiungi esercizio al log solo se ha dei set validi
        if (sets.length > 0) {
            sessionLog.exercises.push({
                name: name,
                sets: sets,
                // Mantieni i metadati muscolari per i grafici
                muscles: originalEx?.muscles ? originalEx.muscles : []
            });
        }
    });

    try {
        // Scrive su Firestore
        await addDoc(collection(db, "users", auth.currentUser.uid, "logs"), sessionLog);
        
        // PULIZIA
        clearSessionData();
        
        // Redirect
        window.location.href = "dashboard-client.html";
    } catch (e) {
        console.error("Errore salvataggio:", e);
        alert("Errore durante il salvataggio. Controlla la connessione.");
        
        // Reset Slider in caso di errore
        const knob = document.querySelector('.slide-knob');
        if (knob) knob.style.transform = `translateX(0px)`;
        if(slideText) {
            slideText.textContent = "SCORRI PER FINIRE";
            slideText.style.opacity = 1;
        }
    }
}

// CESTINO (ANNULLA)
document.getElementById('btn-trash').addEventListener('click', () => {
    if(confirm("Vuoi annullare l'allenamento? I dati inseriti oggi andranno persi.")) {
        clearSessionData();
        window.location.href = "dashboard-client.html";
    }
});

function clearSessionData() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TIMER_KEY);
    localStorage.removeItem('active_workout_status');
    localStorage.removeItem('active_workout_meta');
}

// BACK BUTTON
btnBack.addEventListener('click', () => {
    // Tornando indietro, i dati restano nel localStorage.
    // La Dashboard rileverà 'active_workout_status' e mostrerà la Dynamic Island.
    window.location.href = "dashboard-client.html";
});

// TIMER GLOBALE DURATA (Visualizzazione)
const sessionTimerEl = document.getElementById('session-timer');
const sessionBox = document.getElementById('session-timer-box');

// Recupera data inizio (può essere null se non ancora iniziato)
let sessionStartTime = localStorage.getItem(TIMER_KEY); 
if(sessionStartTime) sessionStartTime = parseInt(sessionStartTime);

function animateTimer() {
    // SE NON E' ANCORA INIZIATO (Nessun input inserito)
    if (!sessionStartTime) {
        if (sessionTimerEl) sessionTimerEl.textContent = "0m";
        requestAnimationFrame(animateTimer);
        return;
    }

    const now = Date.now();
    const diff = now - sessionStartTime;
    const totalSeconds = Math.floor(diff / 1000);

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    
    const hDisplay = h > 0 ? `${h}h ` : '';
    const mDisplay = `${m}m`;
    const text = hDisplay + mDisplay;
    
    if (sessionTimerEl && sessionTimerEl.textContent !== text) {
        sessionTimerEl.textContent = text;
    }
    
    // Animazione bordo
    const msInMinute = diff % 60000; 
    const percentage = (msInMinute / 60000) * 100;
    if(sessionBox) sessionBox.style.setProperty('--p', `${percentage.toFixed(2)}%`);

    requestAnimationFrame(animateTimer);
}
requestAnimationFrame(animateTimer);

// Export funzioni globali per HTML
window.autoSaveSession = autoSaveSession;
window.toggleSet = toggleSet;
window.smartCopy = smartCopy;
// A. ANTEPRIMA NELLA LISTA (Semplice)
// ==========================================
// NUOVA FUNZIONE RENDER PL (DASHBOARD STYLE)
// ==========================================
function renderFundamentalCard(ex, idx) {
    const card = document.createElement('div');
    card.className = 'ex-card fundamental'; 
    card.dataset.idx = idx;

    // 1. HEADER DATI
    const userMax = findBestMaxMatch(ex.name);
    // Se non c'è variante scritta, non mostrare "Standard", lascia vuoto o metti un placeholder stiloso
    const variant = ex.variant ? ex.variant : 'COMPETITION / STANDARD';
    
    // Badges
    let metaTags = '';
    if(userMax > 0) metaTags += `<span class="meta-tag rm">🎯 1RM: ${userMax}kg</span>`;
    
    // Totale Sets
    metaTags += `<span class="meta-tag">📊 ${ex.sets.length} Serie</span>`;

    // Note Coach (Badge tecnico)
    if(ex.notes) {
        // Tagliamo le note lunghe per l'header
        const shortNote = ex.notes.length > 20 ? ex.notes.substring(0, 20) + '...' : ex.notes;
        metaTags += `<span class="meta-tag">💡 ${shortNote}</span>`;
    }

    // HTML HEADER
    const summaryHtml = `
        <div class="ex-summary" onclick="toggleCard(this)">
            <!-- VARIANTE BEN VISIBILE SOPRA IL TITOLO -->
            <div class="variant-large">${variant}</div>
            
            <h3>${ex.name}</h3>
            
            <div class="pl-meta-row">
                ${metaTags}
            </div>

            <div class="icon-ring"><i class="ph ph-caret-down"></i></div>
        </div>
    `;

    // 2. BODY (Espandibile)
    let detailsHtml = `<div class="ex-details"><div class="details-content">`;
    
    // Note Coach Complete (se presenti) all'interno
    if (ex.notes) {
        detailsHtml += `<div class="coach-tip" style="background:#333; color:#FFD60A; border:1px solid #FFD60A;">💡 <b>Note Coach:</b> ${ex.notes}</div>`;
    }

    // Divisione Gruppi (Warmup, Top, Backoff)
    const warmups = ex.sets.filter(s => s.role === 'warmup');
    const mains = ex.sets.filter(s => s.role !== 'warmup');

    // Helper render gruppo
    const renderSetGroup = (sets, title, isMainList = false) => {
        if(sets.length === 0) return '';
        
        let html = '';
        if(title) html += `<div class="pl-section-header">${title}</div>`;
        
        // Se è una lista principale (Backoff o 5x5), usiamo il contenitore unito
        if(isMainList) {
            html += `<div style="background: rgba(255,255,255,0.03); border-radius: 16px; overflow:hidden; border: 1px solid rgba(255,255,255,0.05);">`;
        }

        sets.forEach(group => {
            const realIdx = ex.sets.indexOf(group);
            const numSets = parseInt(group.numSets) || 1;
            
            for(let i=0; i < numSets; i++) {
                html += createPLSetRow(group, realIdx, i, userMax, ex.rest);
            }
        });

        if(isMainList) html += `</div>`; // Chiudi contenitore
        return html;
    };

    // 1. RENDER WARMUP (Sempre lista unita)
    detailsHtml += renderSetGroup(warmups, "Riscaldamento", true);
    
    // 2. RENDER MAIN WORK (Logica Adattiva)
    const hasTopSet = mains.some(s => s.role === 'top');

    if (hasTopSet) {
        // --- CASO A: TOP SET + BACKOFF ---
        const topSets = mains.filter(s => s.role === 'top');
        const backoffSets = mains.filter(s => s.role !== 'top');

        // Render Top Sets (Senza contenitore, così prendono lo stile Eroe staccato)
        if(topSets.length > 0) {
            detailsHtml += `<div class="pl-section-header">Top Set</div>`;
            topSets.forEach(group => {
                 const realIdx = ex.sets.indexOf(group);
                 // Nota: Qui assumiamo che sia 1 solo top set solitamente
                 detailsHtml += createPLSetRow(group, realIdx, 0, userMax, ex.rest);
            });
        }

        // Render Back-offs (Contenitore unito)
        if(backoffSets.length > 0) {
            detailsHtml += renderSetGroup(backoffSets, "Volume & Back-off", true);
        }

    } else {
        // --- CASO B: STRAIGHT SETS (Es. 5x5 Carico Fisso) ---
        // Nessun Top Set rilevato. Renderizziamo tutto come una lista pulita unica.
        // Titolo generico "Allenamento" o "Working Sets"
        if(mains.length > 0) {
            detailsHtml += renderSetGroup(mains, "Allenamento", true);
        }
    }

    detailsHtml += `</div></div>`; // Chiusura details

    card.innerHTML = summaryHtml + detailsHtml;
    listContainer.appendChild(card);
}

// HELPER CREAZIONE RIGA SINGOLA (GRID LAYOUT)
function createPLSetRow(group, groupIdx, subIdx, userMax, rest) {
    const isTop = group.role === 'top';
    const rowClass = isTop ? 'top' : (group.role === 'warmup' ? 'warmup' : '');
    
    // Calcolo Target Visivo
    let targetText = "";
    let placeholder = "Kg";
    let prefillKg = "";

    if (group.mode === 'PERC') {
        if(userMax > 0 && group.val) {
            const kg = Math.round((userMax * parseFloat(group.val)) / 100 / 2.5) * 2.5;
            targetText = `<span class="target-val">${kg}kg</span> (${group.val}%)`;
            placeholder = kg;
            // prefillKg = kg; // Decommenta se vuoi precompilare il campo
        } else {
            targetText = `${group.val}% (No 1RM)`;
        }
    } else if (group.mode === 'KG') {
        targetText = `<span class="target-val">${group.val}kg</span> (Fissi)`;
        placeholder = group.val;
        prefillKg = group.val; // Kg fissi si precompilano spesso
    } else if (group.mode === 'RPE') {
        targetText = `Target: <span class="target-val">RPE ${group.val}</span>`;
        placeholder = "Kg?";
    } else if (group.mode === 'MAV') {
        targetText = `Target: <span class="target-val">MAV</span>`;
        placeholder = "Kg";
    }

    const repsDisplay = `${group.reps} reps`;

    // Recupero valori salvati (Auto-restore)
    // Nota: idx corrente è 'card.dataset.idx'. Qui non lo abbiamo diretto,
    // ma la funzione autoSaveSession rilegge il DOM, quindi basta generare classi giuste.
    // Per il restore "al volo" servirebbe passare l'idx dell'esercizio.
    // (Per semplicità qui generiamo input puliti, il restoreSession li riempirà dopo il render)

    return `
        <div class="pl-set-row ${rowClass}" data-rest="${rest || 90}" data-reps="${group.reps}">
            
            <!-- 1. Indice -->
            <div class="pl-set-idx">${isTop ? '👑' : (groupIdx + 1)}</div>

            <!-- 2. Info Centrale -->
            <div class="pl-set-body">
                <!-- ... (tutto uguale a prima) ... -->
                <div class="pl-target-line">
                    <span>${group.reps} reps</span> ${targetText ? '• ' + targetText : ''}
                </div>
                
                <div class="pl-input-line">
                     <input type="number" class="pl-big-input input-kg" 
                        placeholder="${placeholder}" value="${prefillKg}"
                        oninput="window.autoSaveSession()">
                    
                    <button class="pl-disc-btn" onclick="window.openDynamicPlateModal(this)">
                        <i class="ph ph-disc"></i>
                    </button>

                    ${group.role !== 'warmup' ? `<input type="number" class="pl-rpe-input" placeholder="RPE">` : ''}
                </div>
            </div>

            <!-- 3. Check -->
            <button class="pl-check-btn btn-check" onclick="toggleSet(this)">
                <i class="ph ph-check"></i>
            </button>
        </div>
    `;
}


// Helper per creare la riga PL (VERSIONE FIXATA)
function createFundamentalRow(group, setIdx, userMax) {
    const roleClass = group.role || 'normal'; 
    const isTop = roleClass === 'top';
    const isMav = group.mode === 'MAV';
    
    // Calcoli Target
    let targetKg = 0;
    let placeholder = "Kg";
    let targetDisplay = "";

    // LOGICA DI VISUALIZZAZIONE E INPUT
    let showRpeInput = false; // Flag per decidere se mostrare l'input RPE extra

    if (group.mode === 'PERC') {
        // Se è %, l'utente ha un carico target, quindi tracciamo l'RPE
        showRpeInput = true; 
        if (group.val) targetDisplay = `<span style="font-size:11px; color:#888; font-weight:700;">${group.val}%</span>`;
        
        if (userMax > 0 && group.val) {
            targetKg = Math.round((userMax * parseFloat(group.val)) / 100 / 2.5) * 2.5; 
            placeholder = targetKg; 
        } else {
            placeholder = "Kg (no 1RM)";
        }
    } 
    else if (group.mode === 'KG') {
        // Se è Kg fissi, tracciamo l'RPE
        showRpeInput = true;
        targetKg = parseFloat(group.val);
        placeholder = targetKg;
        targetDisplay = `<span style="font-size:11px; color:#888;">Carico fisso</span>`;
    } 
    else if (group.mode === 'RPE') {
        // Se è RPE, dobbiamo trovare i Kg (Niente input RPE extra, è già il target)
        targetDisplay = `<span class="badge-tech">@RPE ${group.val}</span>`;
        placeholder = "Kg?";
    } 
    else if (isMav) {
        // Se è MAV, dobbiamo trovare i Kg
        targetDisplay = `<span class="mav-badge">MAV</span>`;
        placeholder = "Kg?";
    }

    // Bottone Disco (solo se abbiamo un peso ipotetico)
    const plateBtn = (targetKg > 0) 
        ? `<button class="btn-plate-calc" onclick="window.openDynamicPlateModal(this)"><i class="ph ph-disc"></i></button>`
        : `<button class="btn-plate-calc" style="opacity:0.2;" onclick="alert('Inserisci prima i Kg')"><i class="ph ph-disc"></i></button>`;

    // Input RPE HTML (Solo se necessario)
    const rpeInputHtml = showRpeInput 
        ? `<input type="number" class="input-rpe" placeholder="RPE" oninput="window.autoSaveSession()">` 
        : ``;

    let idxLabel = setIdx;
    if (isTop) idxLabel = `👑 ${setIdx}`;

    return `
        <div class="set-row ${roleClass}">
            <div class="set-info">
                <div class="set-idx">${idxLabel}</div>
                <div style="display:flex; flex-direction:column;">
                    <span class="set-target" style="color:#000; font-weight:700;">${group.reps} reps</span>
                    ${targetDisplay}
                </div>
            </div>
            
            <!-- Gruppo Input -->
            <div class="set-input-area">
                <div class="set-input-group">
                    <!-- Input Kg Principale -->
                    <input type="number" class="input-kg" 
                        value="${targetKg > 0 ? targetKg : ''}"
                        placeholder="${placeholder}" 
                        ${isTop ? 'style="border-color:#FFD60A;"' : ''}
                        oninput="window.autoSaveSession()">
                    
                    ${plateBtn}

                    <!-- Input RPE (Opzionale) -->
                    ${rpeInputHtml}
                </div>
            </div>

            <button class="btn-check" onclick="toggleSet(this)"><i class="ph ph-check"></i></button>
        </div>
    `;
}


// =========================================
// PLATE CALCULATOR LOGIC
// =========================================

// Configurazione
let use25kg = true; // Default
const inventoryToggle = document.getElementById('inventory-toggle');
const status25kg = document.getElementById('status-25kg');

// Toggle Inventory
if(inventoryToggle) {
    inventoryToggle.addEventListener('click', () => {
        use25kg = !use25kg;
        status25kg.textContent = use25kg ? "SÌ" : "NO";
        status25kg.style.color = use25kg ? "#0071E3" : "#FF3B30";
        // Ricalcola se aperto
        const currentWeight = parseFloat(document.getElementById('plate-total-display').dataset.val);
        if(currentWeight) calculateAndRenderPlates(currentWeight);
    });
}

window.openPlateModal = (weight) => {
    if (!weight || weight < 20) { alert("Peso troppo basso (min 20kg)"); return; }
    
    const modal = document.getElementById('plate-modal-overlay');
    modal.classList.remove('hidden');
    
    // Salva valore corrente per ricalcoli
    const display = document.getElementById('plate-total-display');
    display.textContent = `${weight} Kg`;
    display.dataset.val = weight;

    calculateAndRenderPlates(weight);
};

window.closePlateModal = (e) => {
    if(e) e.stopPropagation();
    document.getElementById('plate-modal-overlay').classList.add('hidden');
};

function calculateAndRenderPlates(targetWeight) {
    const barWeight = 20;
    let remainder = (targetWeight - barWeight) / 2;
    
    const plates = [];
    // Inventario dischi disponibili
    const inventory = [
        { w: 25, color: 'red' },
        { w: 20, color: 'blue' },
        { w: 15, color: 'yellow' },
        { w: 10, color: 'green' },
        { w: 5,  color: 'white' },
        { w: 2.5, color: 'black' },
        { w: 1.25, color: 'silver' }
    ];

    // Se disabilitato 25kg, filtra
    const available = use25kg ? inventory : inventory.filter(p => p.w !== 25);

    // Algoritmo Greedy
    available.forEach(plate => {
        while (remainder >= plate.w) {
            plates.push(plate);
            remainder -= plate.w;
        }
    });

    // Render Grafico
    const container = document.getElementById('plate-visual-container');
    // Rimuovi vecchi dischi (mantieni barbell-sleeve)
    const sleeve = container.querySelector('.barbell-sleeve');
    container.innerHTML = ''; 
    container.appendChild(sleeve);

    plates.forEach(p => {
        const div = document.createElement('div');
        div.className = 'plate';
        div.dataset.w = p.w; // Per CSS styling altezza/colore
        div.textContent = p.w;
        container.appendChild(div);
    });

    // Render Testo
    const textList = document.getElementById('plate-text-list');
    if (plates.length === 0) {
        textList.textContent = "Solo Bilanciere Vuoto";
    } else {
        // Raggruppa per testo (es. 2x20, 1x10)
        const counts = {};
        plates.forEach(p => counts[p.w] = (counts[p.w] || 0) + 1);
        textList.textContent = Object.entries(counts)
            .sort((a,b) => parseFloat(b[0]) - parseFloat(a[0]))
            .map(([w, count]) => `${count}x${w}`)
            .join(', ');
    }
}


// NUOVA FUNZIONE DINAMICA PER IL BOTTONE DISCHI
// RENDIAMO LA FUNZIONE GLOBALE (Fix per onclick nell'HTML)
window.openDynamicPlateModal = function(btnElement) {
    // Nel nuovo layout .pl-input-line, l'input è fratello precedente del bottone
    const container = btnElement.parentElement; // .pl-input-line
    const inputField = container.querySelector('.input-kg'); 
    
    if (!inputField) return;

    let weight = parseFloat(inputField.value);
    
    // Se vuoto, usa il placeholder
    if (isNaN(weight)) {
        const ph = parseFloat(inputField.placeholder);
        if (!isNaN(ph)) weight = ph;
        else {
            alert("Inserisci un peso valido.");
            inputField.focus();
            return;
        }
    }
    
    if(weight < 20) { alert("Minimo 20kg"); return; }
    
    window.openPlateModal(weight); 
};

// ANCHE QUESTE DEVONO ESSERE GLOBALI
window.openPlateModal = (weight) => {
    const modal = document.getElementById('plate-modal-overlay');
    const display = document.getElementById('plate-total-display');
    
    if(modal && display) {
        modal.classList.remove('hidden');
        display.textContent = `${weight} Kg`;
        display.dataset.val = weight;
        calculateAndRenderPlates(weight);
    }
};

window.closePlateModal = (e) => {
    if(e) e.stopPropagation();
    document.getElementById('plate-modal-overlay').classList.add('hidden');
};



// B. LOGICA MODALITÀ FOCUS (FULLSCREEN)
window.openFundamentalFocus = function(idx) {
    // 1. Recupera Dati
    // Usa la logica di mapping corretta per trovare la chiave PL
    // (Assumiamo che loadData abbia già settato workoutData correttamente)
    // Per sicurezza ricalcoliamo l'esercizio dall'array visualizzato
    // Nota: Il renderList originale lavorava su un array 'exercises'. 
    // Dobbiamo recuperare quell'oggetto specifico.
    
    // Trucco: recuperiamo l'esercizio direttamente dalla lista renderizzata o dallo state globale
    // Usiamo una variabile globale temporanea se necessario o riaccediamo a workoutData
    // Per semplicità, assumiamo che workoutData.data[currentKey] sia accessibile.
    
    // FIX RAPIDO: Poiché idx è l'indice nell'array visualizzato:
    // Dobbiamo sapere quale array stiamo guardando.
    // Nel loadData, salviamo l'array corrente in una variabile globale 'currentExercisesList'
    
    if(!window.currentExercisesList) {
        console.error("Errore: lista esercizi non trovata");
        return;
    }

    const ex = window.currentExercisesList[idx];
    const userMax = findBestMaxMatch(ex.name);

    // 2. Popola Header
    document.getElementById('focus-ex-title').textContent = ex.name;
    document.getElementById('focus-variant-badge').textContent = ex.variant || 'Standard';
    
    let metaHtml = '';
    if (userMax > 0) metaHtml += `<span>🎯 1RM: <b>${userMax}kg</b></span>`;
    if (ex.notes) metaHtml += `<span style="border-left:1px solid #ccc; padding-left:10px;">💡 ${ex.notes}</span>`;
    document.getElementById('focus-meta-box').innerHTML = metaHtml || '<span>Nessuna nota particolare</span>';

    // 3. Popola Body (Set)
    const container = document.getElementById('focus-sets-container');
    container.innerHTML = '';

    // Raggruppa i set
    const warmups = ex.sets.filter(s => s.role === 'warmup');
    const tops = ex.sets.filter(s => s.role === 'top');
    const backoffs = ex.sets.filter(s => s.role === 'backoff' || s.role === 'normal' || !s.role);

    // Render Function Helper
    const renderGroup = (sets, title, typeClass) => {
        if (sets.length === 0) return;
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'focus-section-title';
        titleDiv.textContent = title;
        container.appendChild(titleDiv);

        sets.forEach((set) => {
            // Trova l'indice assoluto del set originale per il salvataggio
            const absoluteIdx = ex.sets.indexOf(set);
            
            // Calcolo Target (Logica identica a prima ma pulita)
            let targetText = "";
            let placeholder = "Kg";
            let calcKg = 0;

            if(set.mode === 'PERC' && userMax > 0 && set.val) {
                calcKg = Math.round((userMax * parseFloat(set.val)) / 100 / 2.5) * 2.5;
                targetText = `${set.reps} reps @ ${set.val}% (~${calcKg}kg)`;
                placeholder = calcKg;
            } else if (set.mode === 'RPE') {
                targetText = `${set.reps} reps @ RPE ${set.val}`;
                placeholder = "Kg?";
            } else if (set.mode === 'KG') {
                targetText = `${set.reps} reps @ ${set.val} Kg`;
                calcKg = parseFloat(set.val);
                placeholder = calcKg;
            } else {
                targetText = `${set.reps} reps`;
            }

            // Recupera valore salvato se esiste (auto-restore)
            // Nota: Qui dovremmo leggere dal localStorage se c'è un valore temporaneo
            // Per ora usiamo input vuoti, il restoreSession popolerà dopo se implementato correttamente
            // Ma dato che stiamo creando DOM dinamico, dobbiamo leggere manually.
            const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            let savedKg = '';
            let savedDone = false;
            
            // Logica recupero salvataggio un po' complessa per il modal dinamico
            // Per semplicità: Quando apriamo il modal, cerchiamo se c'è un valore salvato per questo 'idx' e 'sub-index'
            if(savedState[idx] && savedState[idx].sets[absoluteIdx]) {
                 savedKg = savedState[idx].sets[absoluteIdx].kg || '';
                 savedDone = savedState[idx].sets[absoluteIdx].done || false;
            }

            const card = document.createElement('div');
            card.className = `focus-set-card ${typeClass}`;
            card.innerHTML = `
                <div class="card-header-row">
                    <span class="set-badge">${typeClass === 'top' ? '👑 TOP SET' : (typeClass === 'warmup' ? 'Warmup' : `Set ${absoluteIdx+1}`)}</span>
                    <span class="target-text">${targetText}</span>
                </div>
                <div class="controls-row">
                    <input type="number" class="big-input js-kg-input" 
                        data-ex-idx="${idx}" data-set-idx="${absoluteIdx}"
                        value="${savedKg}" placeholder="${placeholder}"
                        oninput="window.handleFocusInput(this)">
                    
                    <button class="btn-plate-calc" onclick="window.openDynamicPlateModal(this)">
                        <i class="ph ph-disc"></i>
                    </button>
                    
                    ${typeClass !== 'warmup' ? `<input type="number" class="rpe-input-small" placeholder="RPE">` : ''}

                    <button class="btn-check-focus ${savedDone ? 'done' : ''}" 
                        onclick="window.toggleFocusSet(this, ${idx}, ${absoluteIdx})">
                        <i class="ph ph-check"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    };

    renderGroup(warmups, "Riscaldamento", "warmup");
    renderGroup(tops, "🏆 Top Set (Main Work)", "top");
    renderGroup(backoffs, "📉 Volume / Back-off", "backoff");

    // 4. Mostra Modale
    document.getElementById('pl-focus-modal').classList.remove('hidden');
};

// C. UTILITY DEL MODALE
document.getElementById('btn-close-focus').onclick = () => {
    document.getElementById('pl-focus-modal').classList.add('hidden');
};
document.getElementById('btn-save-focus').onclick = () => {
    document.getElementById('pl-focus-modal').classList.add('hidden');
    // Feedback opzionale
};

// Gestione Input nel Modale (Salvataggio Live)
window.handleFocusInput = (input) => {
    // Qui dobbiamo aggiornare lo stato "ombra" che poi verrà salvato
    // Poiché autoSaveSession legge dal DOM della lista principale (che ora è vuota di input),
    // dobbiamo aggiornare una struttura dati centrale o scrivere nel localStorage direttamente.
    
    // SOLUZIONE RAPIDA: Aggiorniamo direttamente il localStorage
    const exIdx = input.dataset.exIdx;
    const setIdx = input.dataset.setIdx;
    
    const sessionState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if(!sessionState[exIdx]) sessionState[exIdx] = { sets: [] };
    if(!sessionState[exIdx].sets[setIdx]) sessionState[exIdx].sets[setIdx] = {};
    
    sessionState[exIdx].sets[setIdx].kg = input.value;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionState));
};

window.toggleFocusSet = (btn, exIdx, setIdx) => {
    btn.classList.toggle('done');
    const isDone = btn.classList.contains('done');
    
    // Vibrazione
    if(isDone && navigator.vibrate) navigator.vibrate(50);
    
    // Salva stato
    const sessionState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if(!sessionState[exIdx]) sessionState[exIdx] = { sets: [] };
    if(!sessionState[exIdx].sets[setIdx]) sessionState[exIdx].sets[setIdx] = {};
    
    sessionState[exIdx].sets[setIdx].done = isDone;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionState));
};