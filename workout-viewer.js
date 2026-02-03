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
        <div class="ex-summary" onclick="toggleCard(this)">
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

window.toggleCard = (header) => {
    const card = header.parentElement;
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
    const row = btn.closest('.set-row');
    btn.classList.toggle('done');
    
    // Se è done, vibra e parte timer
    if (btn.classList.contains('done')) {
        startTimer(row.dataset.rest);
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

// SALVATAGGIO SU FIRESTORE
async function saveWorkout() {
    const sessionLog = {
        workoutId: currentWorkoutId,
        workoutName: workoutData.name,
        dayIndex: parseInt(currentDay) || 1,
        date: new Date().toISOString(),
        exercises: []
    };

    const originalExercises = workoutData.data[currentDay] || workoutData.data[String(currentDay)] || [];

    document.querySelectorAll('.ex-card').forEach(card => {
        const idx = card.dataset.idx;
        const originalEx = originalExercises[idx];
        const name = card.querySelector('h3').textContent;
        const sets = [];

        card.querySelectorAll('.set-row').forEach(row => {
            const kg = parseFloat(row.querySelector('.input-kg').value) || 0;
            const done = row.querySelector('.btn-check').classList.contains('done');
            let repsVal = row.dataset.reps;
            let repsNum = parseFloat(repsVal);
            if (isNaN(repsNum) && repsVal.includes('-')) repsNum = parseFloat(repsVal.split('-')[0]);

            if (kg > 0 || done) {
                sets.push({ kg: kg, reps: repsNum || 0, done: done });
            }
        });

        if (sets.length > 0) {
            sessionLog.exercises.push({
                name,
                sets,
                muscles: originalEx?.muscles ? originalEx.muscles : []
            });
        }
    });

    try {
        await addDoc(collection(db, "users", auth.currentUser.uid, "logs"), sessionLog);
        
        // PULIZIA: Rimuovi dati locali solo dopo successo
        clearSessionData();
        
        // Vai alla dashboard (che aggiornerà i grafici)
        window.location.href = "dashboard-client.html";
    } catch (e) {
        console.error(e);
        alert("Errore salvataggio. Riprova.");
        // Reset slider
        const knob = document.querySelector('.slide-knob');
        if (knob) knob.style.transform = `translateX(0px)`;
        slideText.textContent = "SCORRI PER FINIRE";
        slideText.style.opacity = 1;
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
function renderFundamentalCard(ex, idx) {
    const card = document.createElement('div');
    card.className = 'ex-card fundamental'; // Attiva CSS Hero
    card.dataset.idx = idx;

    // BADGES
    let badgesHtml = '';
    if (ex.variant) badgesHtml += `<div class="variant-badge"><i class="ph ph-shuffle"></i> ${ex.variant}</div>`;
    // ... codice param badge (uguale a prima) ...
    if (ex.variantParamType && ex.variantParamType !== 'none' && ex.variantValue) {
        let icon = 'clock';
        if (ex.variantParamType === 'height') icon = 'ruler';
        if (ex.variantParamType === 'angle') icon = 'angle';
        badgesHtml += `<div class="variant-badge param"><i class="ph ph-${icon}"></i> ${ex.variantValue}</div>`;
    }

    // CERCA 1RM CON LA NUOVA LOGICA
    const userMax = findBestMaxMatch(ex.name);
    let maxLabel = userMax > 0 
        ? `<div class="one-rm-label" style="color:#1D1D1F;">Max: ${userMax}kg</div>` 
        : '';

    const summaryHtml = `
        <div class="ex-summary" onclick="toggleCard(this)">
            <div class="ex-info">
                <div style="margin-bottom:8px; display:flex; gap:5px;">${badgesHtml} ${maxLabel}</div>
                <h3>${ex.name}</h3>
                <div class="ex-meta">
                    ${ex.sets.length} Gruppi di Lavoro
                </div>
            </div>
            <div class="icon-ring"><i class="ph ph-caret-down"></i></div>
        </div>
    `;

    // BODY (Esplosione Set)
    let detailsHtml = `<div class="ex-details"><div class="details-content">`;
    if (ex.notes) detailsHtml += `<div class="coach-tip">💡 ${ex.notes}</div>`;

    let absoluteSetIndex = 0;
    ex.sets.forEach((group) => {
        const numSets = parseInt(group.numSets) || 1;
        for (let i = 0; i < numSets; i++) {
            absoluteSetIndex++;
            // Passiamo il massimale trovato alla funzione della riga
            detailsHtml += createFundamentalRow(group, absoluteSetIndex, userMax);
        }
    });

    detailsHtml += `</div></div>`;
    card.innerHTML = summaryHtml + detailsHtml;
    listContainer.appendChild(card);
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
    // 1. Trova l'input Kg vicino al bottone premuto
    // La struttura è: .set-input-group -> [input-kg] [btn]
    const inputGroup = btnElement.closest('.set-input-group');
    if (!inputGroup) {
        console.error("Errore struttura HTML: .set-input-group non trovato");
        return;
    }

    const inputField = inputGroup.querySelector('.input-kg');
    if (!inputField) return;

    // 2. Determina il peso
    let weight = parseFloat(inputField.value);
    
    // Se l'utente non ha scritto, prova a leggere il placeholder (peso calcolato)
    if (isNaN(weight)) {
        const ph = parseFloat(inputField.placeholder);
        if (!isNaN(ph)) weight = ph;
    }

    // 3. Validazione e Apertura
    if (!weight || weight < 20) {
        // Feedback visivo rapido (shake o alert)
        alert("Peso non valido o troppo basso (<20kg). Inserisci i Kg.");
        inputField.focus();
        return;
    }

    // Chiama la logica di renderizzazione (che deve essere accessibile)
    // Assicurati che calculateAndRenderPlates sia definita nel file
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