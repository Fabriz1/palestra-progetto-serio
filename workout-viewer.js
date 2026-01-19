import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

async function loadData() {
    try {
        const docRef = doc(db, "workouts", currentWorkoutId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            alert("Errore caricamento scheda");
            window.location.href = "dashboard-client.html";
            return;
        }

        workoutData = snap.data();
        
        // 1. Header Fisso: VUOTO (Solo timer e tasto indietro)
        dayTitle.textContent = `Giorno ${currentDay}`; 
        
        // 2. Titolone Pagina: SCRITTO QUI
        
        
        const exercises = workoutData.data[currentDay] || workoutData.data[String(currentDay)] || [];
        
        

        renderList(exercises);
        restoreSession();

    } catch (e) { console.error(e); }
}

// 2. RENDER ACCORDION LIST
function renderList(exercises) {
    listContainer.innerHTML = '';

    if (exercises.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#888;">Riposo! 💤</div>';
        return;
    }

    exercises.forEach((ex, idx) => {
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

        let summaryHtml = `
            <div class="ex-summary" onclick="toggleCard(this)">
                <div class="ex-info">
                    <h3>${ex.name}</h3>
                    <div class="ex-meta">
                        <span class="badge-info">${summaryText}</span>
                        ${ex.muscles[0]?.name ? `<span>${ex.muscles[0].name}</span>` : ''}
                    </div>
                </div>
                <div class="icon-ring"><i class="ph ph-caret-down"></i></div>
            </div>
        `;

        let detailsHtml = `<div class="ex-details"><div class="details-content">`;
        if (ex.notes) detailsHtml += `<div class="coach-tip">💡 ${ex.notes}</div>`;
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
    });
}

window.toggleCard = (header) => {
    const card = header.parentElement;
    card.classList.toggle('active');
};

function generateInputRows(ex) {
    let html = '';
    const rest = ex.rest || 90;

    if (ex.technique === "Top set + back-off") {
        html += createRow("TOP", ex.topReps, rest);
        const backs = parseInt(ex.backSets) || 2;
        for (let i = 0; i < backs; i++) html += createRow("BACK", ex.backReps, rest);
    }
    else if (ex.technique === "Myo-reps") {
        html += createRow("ACT", "12-15", rest);
        for (let i = 1; i <= 5; i++) html += createRow("MYO", "3-5", 15);
    }
    else {
        const sets = parseInt(ex.val1) || 3;
        const reps = ex.val2 || "10";
        for (let i = 1; i <= sets; i++) html += createRow(i, reps, rest);
    }
    return html;
}

function createRow(label, targetReps, rest) {
    const isSpecial = (String(label).length > 2);
    return `
        <div class="set-row" data-rest="${rest}" data-reps="${targetReps}">
            <div class="set-info">
                <div class="set-idx ${isSpecial ? 'special' : ''}">${label}</div>
                <span class="set-target">${targetReps} reps</span>
            </div>
            <div class="set-input-area">
                <input type="number" class="input-kg" placeholder="Kg" oninput="window.autoSaveSession()">
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
                muscles: originalEx?.muscles ? originalEx.muscles.map(m => m.name) : []
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