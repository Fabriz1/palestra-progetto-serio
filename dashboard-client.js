import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, 
    onSnapshot, addDoc, serverTimestamp, setDoc, orderBy, limit 
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

// DOM ELEMENTS
const headerName = document.getElementById('header-name');
const headerAvatar = document.getElementById('header-avatar');
const btnLogout = document.getElementById('btn-logout');

// HERO CARD
const heroTitle = document.getElementById('hero-workout-title');
const heroDays = document.getElementById('hero-days-count');
const btnGotoProgram = document.getElementById('btn-goto-program'); 

// NAVIGATION
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');

// SHEET ELEMENTS (Nuovi per il Bottom Sheet)
const sheetOverlay = document.getElementById('preview-overlay');
const sheetTitle = document.getElementById('sheet-day-title');
const sheetInfo = document.getElementById('sheet-day-info');
const btnSheetStart = document.getElementById('btn-sheet-start');
const conflictBox = document.getElementById('sheet-conflict-box');
const conflictName = document.getElementById('conflict-name');
const btnForceStart = document.getElementById('btn-force-start');

// GLOBAL USER STATE
let currentUser = null;
let currentWorkoutData = null;
let pendingDayIdx = null; // Il giorno che l'utente sta guardando nell'anteprima

// 1. AUTH CHECK & INIT
// Evento pageshow per ricaricare la Dynamic Island se si torna indietro con la cache del browser
window.addEventListener('pageshow', (event) => {
    if (event.persisted) checkActiveWorkout();
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "login.html"; return; }

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        currentUser = snap.data();
        
        // Verifica se onboarding completato
        if (!currentUser.onboardingComplete || !currentUser.coachId) {
            window.location.href = "onboarding.html";
            return;
        }

        // Init UI
        initUI(currentUser);
        checkWorkoutUpdate(currentUser);
        loadStats(user.uid);
        
        // Carica Scheda
        if (currentUser.activeWorkoutId) {
            loadWorkout(currentUser.activeWorkoutId);
        } else {
            heroTitle.textContent = "Nessuna scheda assegnata";
            if(btnGotoProgram) btnGotoProgram.style.display = 'none';
        }
        
        // Carica Grafici
        loadChartData(user.uid);
        
        // Controllo immediato allenamento attivo
        checkActiveWorkout();
    }
});

function initUI(data) {
    headerName.textContent = data.name.split(' ')[0];
    headerAvatar.src = data.photoURL || 'https://via.placeholder.com/50';
    
    // Popola Profilo
    const imgLarge = document.getElementById('profile-img-large');
    if(imgLarge) imgLarge.src = data.photoURL || 'https://via.placeholder.com/100';
    
    document.getElementById('prof-goals').value = data.goals || "";
    document.getElementById('prof-history').value = data.history || "";
    document.getElementById('prof-injuries').value = data.injuries || "";
    document.getElementById('prof-notes').value = data.notes || "";

    // AVVIA CHAT
    if (data.coachId) {
        initChat(auth.currentUser.uid, data.coachId);
    }
}

// 2. NAVIGAZIONE TAB
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.dataset.target;
        manualSwitchTab(targetId);
    });
});

window.switchTab = (tabId) => {
    manualSwitchTab(tabId);
};

function manualSwitchTab(tabId) {
    // 1. Nascondi tutto
    views.forEach(v => v.classList.add('hidden'));
    
    // 2. Mostra target
    const targetEl = document.getElementById(tabId);
    if(targetEl) targetEl.classList.remove('hidden');
    
    // 3. Aggiorna Bottom Bar
    navItems.forEach(n => n.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[data-target="${tabId}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    // --- GESTIONE BADGE ---
    
    // CASO CHAT:
    if (tabId === 'view-chat') {
        const b = document.getElementById('badge-chat');
        if(b) b.classList.add('hidden');
        // SALVA: "Ho letto la chat adesso"
        localStorage.setItem('lastReadChatTime', Date.now());
    }
    
    // CASO SCHEDA:
    if (tabId === 'view-program') {
        const b = document.getElementById('badge-program');
        if(b) b.classList.add('hidden');
        localStorage.setItem('lastSeenWorkoutTime', Date.now());
    }
    
    // Scroll top
    document.querySelector('.content-area').scrollTop = 0;
}

// 3. CARICAMENTO SCHEDA
async function loadWorkout(workoutId) {
    try {
        const snap = await getDoc(doc(db, "workouts", workoutId));
        if (!snap.exists()) return;

        currentWorkoutData = snap.data();
        currentWorkoutData.id = snap.id; 

        heroTitle.textContent = currentWorkoutData.name;
        heroDays.innerHTML = `<i class="ph ph-barbell"></i> ${currentWorkoutData.days} Giorni`;
        
        if(btnGotoProgram) {
            btnGotoProgram.onclick = () => { manualSwitchTab('view-program'); };
        }

        renderDaysList(currentWorkoutData);

    } catch (e) {
        console.error("Errore scheda:", e);
        heroTitle.textContent = "Errore caricamento";
    }
}

// 4. RENDER LISTA GIORNI (Modificato per aprire il Bottom Sheet)
function renderDaysList(workout) {
    const container = document.getElementById('workout-days-list');
    if(!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= workout.days; i++) {
        const exercises = workout.data[i] || [];
        const count = exercises.length;
        
        const card = document.createElement('div');
        card.className = 'day-card';
        
        // MODIFICA: Apre l'anteprima invece di andare diretto
        card.onclick = () => {
            openPreview(i, count);
        };

        card.innerHTML = `
            <div class="day-info">
                <h4>Giorno ${i}</h4>
                <p>${count} Esercizi</p>
            </div>
            <i class="ph ph-caret-right" style="color:#C7C7CC; font-size: 20px;"></i>
        `;
        container.appendChild(card);
    }
}

// --- LOGICA BOTTOM SHEET & CONFLITTI ---

// Apre il pannello
// Apre il pannello con la lista esercizi
window.openPreview = (dayIdx, exCount) => {
    pendingDayIdx = dayIdx; // Ci segniamo quale giorno vuole fare
    
    // 1. Testi Intestazione
    const sheetTitle = document.getElementById('sheet-day-title');
    const sheetInfo = document.getElementById('sheet-day-info');
    if(sheetTitle) sheetTitle.textContent = `Giorno ${dayIdx}`;
    if(sheetInfo) sheetInfo.textContent = `${exCount} Esercizi • ${currentWorkoutData.name}`;

    // 2. Generazione Lista Esercizi (NUOVO)
    const listContainer = document.getElementById('sheet-exercises-list');
    if (listContainer) {
        listContainer.innerHTML = ''; // Pulisci lista vecchia
        
        // Recupera gli esercizi veri dall'oggetto globale
        const exercises = currentWorkoutData.data[dayIdx] || [];
        
        if (exercises.length === 0) {
            listContainer.innerHTML = '<p style="padding:20px; text-align:center; color:#999; font-size:13px;">Nessun esercizio</p>';
        } else {
            exercises.forEach(ex => {
                // Calcola etichetta (es. "4x10")
                let label = "";
                if (ex.technique === "Top set + back-off") label = "Top + Backoff";
                else if (ex.technique === "Myo-reps") label = "Myo-reps";
                else label = `${ex.val1 || 3} x ${ex.val2 || 10}`;

                // Crea HTML riga
                const row = document.createElement('div');
                row.className = 'preview-row';
                row.innerHTML = `
                    <span class="preview-name">${ex.name}</span>
                    <span class="preview-details">${label}</span>
                `;
                listContainer.appendChild(row);
            });
        }
    }
    
    // 3. Reset stato visivo (mostra bottone verde, nascondi errore rosso)
    if(btnSheetStart) btnSheetStart.style.display = 'block';
    if(conflictBox) conflictBox.classList.remove('visible');
    
    // 4. Animazione entrata
    if(sheetOverlay) {
        sheetOverlay.classList.remove('hidden');
        setTimeout(() => sheetOverlay.classList.add('active'), 10);
    }
};

// Chiude il pannello
window.closePreview = (e) => {
    // Chiudi solo se clicchi fuori o sul tasto annulla
    if (e && !e.target.classList.contains('sheet-overlay') && !e.target.classList.contains('btn-warn-secondary')) return;
    
    if(sheetOverlay) {
        sheetOverlay.classList.remove('active');
        setTimeout(() => sheetOverlay.classList.add('hidden'), 300);
    }
};

// CLICK SU "INIZIA ALLENAMENTO" (Il tasto blu/verde principale)
if(btnSheetStart) {
    btnSheetStart.addEventListener('click', () => {
        const status = localStorage.getItem('active_workout_status');
        
        if (status === 'running') {
            const meta = JSON.parse(localStorage.getItem('active_workout_meta') || '{}');
            
            // CASO 1: È LO STESSO ALLENAMENTO SOSPESO?
            // Se la scheda è la stessa E il giorno è lo stesso, è un RESUME.
            // NON cancelliamo nulla.
            if (meta.id === currentWorkoutData.id && meta.day == pendingDayIdx) {
                goToWorkout(pendingDayIdx, false); // false = mantieni i dati
                return;
            }

            // CASO 2: CONFLITTO (Giorno diverso o Scheda diversa)
            if(conflictName) conflictName.textContent = `Giorno ${meta.day}`;
            btnSheetStart.style.display = 'none'; 
            if(conflictBox) conflictBox.classList.add('visible'); 
        } else {
            // CASO 3: NUOVO INIZIO PULITO
            // Non c'è nulla in corso, ma potrebbero esserci dati vecchi "zombie" in memoria.
            // Li cancelliamo per sicurezza.
            goToWorkout(pendingDayIdx, true); // true = pulisci prima di entrare
        }
    });
}

// CLICK SU "SOVRASCRIVI" (Il tasto rosso nel box di conflitto)
if(btnForceStart) {
    btnForceStart.addEventListener('click', () => {
        // 1. Dimentica l'allenamento che era in corso (quello che stiamo sovrascrivendo)
        localStorage.removeItem('active_workout_status');
        localStorage.removeItem('active_workout_meta');
        
        // 2. Entra nel nuovo giorno pulendo eventuali suoi dati vecchi
        goToWorkout(pendingDayIdx, true);
    });
}

// Funzione helper per andare alla pagina viewer
function goToWorkout(dayIdx, shouldClear) {
    const wId = currentWorkoutData.id;

    if (shouldClear) {
        // PULIZIA CHIRURGICA: Rimuove solo i dati di QUESTO specifico giorno/scheda
        // Così il timer partirà da 0 e i campi saranno vuoti
        localStorage.removeItem(`workout_session_${wId}_day_${dayIdx}`);
        localStorage.removeItem(`workout_timer_start_${wId}_day_${dayIdx}`);
    }

    localStorage.setItem('currentWorkoutId', wId);
    localStorage.setItem('currentDay', dayIdx);
    window.location.href = "workout-viewer.html";
}


// 5. STATISTICHE RAPIDE
async function loadStats(uid) {
    try {
        const qWeight = query(collection(db, "users", uid, "measurements"), orderBy("date", "desc"), limit(1));
        const snapW = await getDocs(qWeight);
        if(!snapW.empty) {
            document.getElementById('stat-weight').textContent = snapW.docs[0].data().weight;
        }
        
        const snapLogs = await getDocs(collection(db, "users", uid, "logs"));
        document.getElementById('stat-workouts').textContent = snapLogs.size;
        
    } catch(e) { console.log("No stats yet"); }
}

// LOGOUT
if(btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });
}

// =========================================
// CHAT CLIENTE
// =========================================
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');
const chatMsgs = document.getElementById('client-chat-msgs');
const homeLastMsg = document.getElementById('home-last-msg');

function initChat(userUid, coachId) {
    if (!coachId || !chatMsgs) return;

    const chatId = [userUid, coachId].sort().join('_');
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));

    onSnapshot(q, (snapshot) => {
        chatMsgs.innerHTML = '';
        if (snapshot.empty) chatMsgs.innerHTML = '<p style="text-align:center; color:#ccc; margin-top:20px;">Inizia a scrivere...</p>';

        let lastMessageText = "Nessun messaggio";
        let lastSenderId = null;
        let lastMessageTime = 0; // Variabile per salvare l'orario

        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.senderId === userUid;
            
            // Aggiorniamo i dati dell'ultimo messaggio
            lastSenderId = msg.senderId;
            lastMessageText = msg.text;
            if (msg.timestamp) lastMessageTime = msg.timestamp.seconds * 1000;

            const bubble = document.createElement('div');
            bubble.style.cssText = `
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
                background: ${isMe ? '#0071E3' : 'white'};
                color: ${isMe ? 'white' : 'black'};
                padding: 10px 16px; border-radius: 20px;
                border-${isMe ? 'bottom-right' : 'bottom-left'}-radius: 4px;
                max-width: 80%; font-size: 15px; margin-bottom: 8px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            `;
            bubble.textContent = msg.text;
            chatMsgs.appendChild(bubble);
        });

        if (homeLastMsg) homeLastMsg.textContent = lastMessageText;
        chatMsgs.scrollTop = chatMsgs.scrollHeight;

        // --- LOGICA NOTIFICA CHAT (FIXATA) ---
        const chatBadge = document.getElementById('badge-chat');
        const isChatActive = !document.getElementById('view-chat').classList.contains('hidden');
        
        // Recupera l'ultima volta che ho aperto la chat
        const lastReadTime = parseInt(localStorage.getItem('lastReadChatTime')) || 0;

        // ACCENDI SE: 
        // 1. Il messaggio non è mio
        // 2. Non sto guardando la chat ora
        // 3. Il messaggio è NUOVO (arrivato dopo l'ultima mia visita)
        if (lastSenderId && lastSenderId !== userUid && !isChatActive && lastMessageTime > lastReadTime) {
            if(chatBadge) chatBadge.classList.remove('hidden');
        }
    });

    const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        try {
            // Invio messaggio
            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: text, senderId: userUid, timestamp: serverTimestamp()
            });
            // Aggiorno anche la chat generale
            await setDoc(doc(db, "chats", chatId), {
                participants: [userUid, coachId],
                participantNames: [currentUser.name, "Coach"],
                lastMessage: text, lastMessageTime: serverTimestamp()
            }, { merge: true });
            
            // Se scrivo io, aggiorno subito che ho "letto" fino ad ora
            localStorage.setItem('lastReadChatTime', Date.now());
            
        } catch (e) { console.error(e); }
    };

    if(btnSendChat) btnSendChat.addEventListener('click', sendMessage);
    if(chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

// =========================================
// GRAFICI CHART.JS
// =========================================
const ctx = document.getElementById('progressChart')?.getContext('2d');
const chartChips = document.querySelectorAll('.filter-chip');
const chartStats = document.getElementById('chart-stats-details');

// Elementi Custom Dropdown
const dropdownContainer = document.getElementById('chart-dropdown');
const dropdownList = document.getElementById('dropdown-list');
const dropdownLabel = document.getElementById('dropdown-selected-text');

let chartInstance = null;
let allLogs = [], allMeasurements = [], currentChartType = 'exercise';

// 1. CARICAMENTO DATI
async function loadChartData(uid) {
    if(!ctx) return;
    
    // Scarica TUTTI i log (fondamentale per la logica cicli del coach)
    const logsSnap = await getDocs(query(collection(db, "users", uid, "logs"), orderBy("date", "asc")));
    allLogs = []; 
    logsSnap.forEach(doc => allLogs.push(doc.data()));

    // Scarica Misure
    const measuresSnap = await getDocs(query(collection(db, "users", uid, "measurements"), orderBy("date", "asc")));
    allMeasurements = []; 
    measuresSnap.forEach(doc => allMeasurements.push(doc.data()));

    initChartControls();
}

// 2. GESTIONE CONTROLLI & DROPDOWN
function initChartControls() {
    chartChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chartChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentChartType = chip.dataset.type;
            
            // Reset UI
            dropdownLabel.textContent = "Seleziona...";
            renderChart(null);
            
            updateChartSelector();
        });
    });
    
    updateChartSelector();
}

// Funzioni Dropdown Custom
window.toggleChartDropdown = () => {
    if(dropdownList) dropdownList.classList.toggle('hidden');
    if(dropdownContainer) dropdownContainer.classList.toggle('open');
};

document.addEventListener('click', (e) => {
    if (dropdownContainer && !dropdownContainer.contains(e.target)) {
        dropdownList.classList.add('hidden');
        dropdownContainer.classList.remove('open');
    }
});

// 3. POPOLAMENTO TENDINA (LOGICA INTELLIGENTE)
function updateChartSelector() {
    if(!dropdownList) return;
    dropdownList.innerHTML = ''; 
    let options = new Set();

    if (currentChartType === 'exercise') {
        allLogs.forEach(log => { 
            if(log.exercises) log.exercises.forEach(ex => options.add(ex.name)); 
        });
    } 
    else if (currentChartType === 'muscle') {
        allLogs.forEach(log => {
            if(log.exercises) log.exercises.forEach(ex => {
                if(ex.muscles) ex.muscles.forEach(m => options.add(m));
            });
        });
    }
    else if (currentChartType === 'session') {
        // LOGICA COACH: Raggruppa per Giorno (es. Giorno 1, Giorno 2)
        allLogs.forEach(log => {
            if (log.dayIndex) {
                options.add(`Volume: Giorno ${log.dayIndex}`);
            }
        });
    }
    else if (currentChartType === 'body') {
        options.add("Peso Corporeo"); 
        options.add("Massa Grassa %");
    }

    // Ordina e crea HTML
    const sortedOptions = Array.from(options).sort();
    
    if (sortedOptions.length === 0) {
        dropdownList.innerHTML = '<div style="padding:10px; color:#999; font-size:13px; text-align:center;">Nessun dato disponibile</div>';
        return;
    }

    sortedOptions.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'custom-option';
        item.textContent = opt;
        item.onclick = () => {
            dropdownLabel.textContent = opt;
            dropdownList.classList.add('hidden');
            dropdownContainer.classList.remove('open');
            renderChart(opt);
        };
        dropdownList.appendChild(item);
    });
}

// 4. RENDER GRAFICO (LOGICA COACH "PARO PARO")
function renderChart(selection) {
    if (!selection || selection.includes('Seleziona')) return;
    
    let labels = [], dataPoints = [], labelUnit = '';
    let chartType = 'line';
    let tension = 0.4;

    // Ordine cronologico garantito
    const sortedLogs = [...allLogs].sort((a,b) => new Date(a.date) - new Date(b.date));

    // =========================================================
    // A. ESERCIZIO (Max Weight - Standard)
    // =========================================================
    if (currentChartType === 'exercise') {
        labelUnit = 'kg';
        sortedLogs.forEach(log => {
            const exData = log.exercises.find(e => e.name === selection);
            if (exData) {
                let maxWeight = 0;
                exData.sets.forEach(s => { 
                    const w = parseFloat(s.kg)||0; 
                    if(w > maxWeight) maxWeight = w; 
                });
                
                if (maxWeight > 0) {
                    labels.push(new Date(log.date).toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit'}));
                    dataPoints.push(maxWeight);
                }
            }
        });
    } 
    
    // =========================================================
    // B. MUSCOLO (ALGORITMO COACH: CICLI + FILL GAP)
    // =========================================================
    else if (currentChartType === 'muscle') {
        labelUnit = 'kg (Somma Max)';
        tension = 0.2; // Linea più tesa per i cicli

        // 1. Auto-Detect durata scheda
        let maxDayInLogs = 0;
        sortedLogs.forEach(l => { if(l.dayIndex > maxDayInLogs) maxDayInLogs = l.dayIndex; });
        const limitDays = (currentWorkoutData && currentWorkoutData.days) ? currentWorkoutData.days : (maxDayInLogs || 7);

        // 2. Raggruppa in Cicli (COPIATO DA DASHBOARD-PT.JS)
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

            if(!isUpdate) daysSeenInCycle.add(dIndex);
            if (!currentCycle.dayLogs[dIndex]) currentCycle.dayLogs[dIndex] = [];
            currentCycle.dayLogs[dIndex].push(log);

            lastDate = sDate;
            lastDay = dIndex;
        });
        cycles.push(currentCycle); 

        // 3. Calcolo Valori con Fill The Gap (Memoria)
        let memory = {}; // Tiene l'ultimo valore per giorno

        cycles.forEach(cycle => {
            let cycleMuscleStats = 0; // Somma per il muscolo selezionato in questo ciclo

            for (let d = 1; d <= limitDays; d++) {
                const logsForDay = cycle.dayLogs[d];
                let dayMuscleMax = 0; // Miglior peso per questo muscolo in questo giorno
                let foundData = false;

                if (logsForDay && logsForDay.length > 0) {
                    const log = logsForDay[logsForDay.length - 1]; // Ultimo log valido
                    if(log.exercises) {
                        log.exercises.forEach(ex => {
                            // CONTROLLO: È il muscolo che abbiamo selezionato?
                            // Logica Coach: Controlla se è il muscolo primario (index 0)
                            if (ex.muscles && ex.muscles.length > 0 && ex.muscles[0] === selection) {
                                let maxSetKg = 0;
                                if(ex.sets) ex.sets.forEach(s => {
                                    const k = parseFloat(s.kg)||0;
                                    if(k > maxSetKg) maxSetKg = k;
                                });
                                dayMuscleMax += maxSetKg; // Somma se ci sono più esercizi per lo stesso muscolo
                                foundData = true;
                            }
                        });
                    }
                }

                if (foundData) {
                    cycleMuscleStats += dayMuscleMax;
                    memory[d] = dayMuscleMax; // Aggiorna memoria
                } else {
                    // GAP: Usa memoria se esiste
                    if (memory[d]) {
                        cycleMuscleStats += memory[d];
                    }
                }
            }

            // Se il ciclo ha dati per questo muscolo, aggiungi punto
            if (cycleMuscleStats > 0) {
                labels.push(`Ciclo ${cycle.id}`);
                dataPoints.push(cycleMuscleStats);
            }
        });
    }

    // =========================================================
    // C. SEDUTA (TONNELLAGGIO PER GIORNO)
    // =========================================================
    else if (currentChartType === 'session') {
        // La selezione arriva come "Volume: Giorno 1"
        if (selection.includes("Volume: Giorno")) {
            const targetDay = selection.split(' ')[2]; // Prende "1"
            labelUnit = 'kg';

            sortedLogs.forEach(log => {
                // FILTRO FONDAMENTALE: Solo i log di quel giorno specifico
                if (String(log.dayIndex) !== targetDay) return;

                let sessionVolume = 0;
                if(log.exercises) {
                    log.exercises.forEach(ex => {
                        ex.sets.forEach(s => {
                            // Logica Coach: Kg * Reps
                            sessionVolume += (parseFloat(s.kg) || 0) * (parseFloat(s.reps) || 0);
                        });
                    });
                }
                
                if (sessionVolume > 0) {
                    labels.push(new Date(log.date).toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit'}));
                    dataPoints.push(Math.round(sessionVolume));
                }
            });
        }
    }

    // =========================================================
    // D. CORPO (Peso / BF)
    // =========================================================
    else if (currentChartType === 'body') {
        allMeasurements.forEach(m => {
            labels.push(new Date(m.date).toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit'}));
            if (selection === "Peso Corporeo") { dataPoints.push(m.weight); labelUnit = 'kg'; }
            else if (selection === "Massa Grassa %") { if(m.bia?.fat) dataPoints.push(m.bia.fat); labelUnit = '%'; }
        });
    }

    // --- AGGIORNAMENTO STATISTICHE SOTTO AL GRAFICO ---
    if(dataPoints.length > 0 && chartStats) {
        const maxVal = Math.max(...dataPoints);
        const avgVal = (dataPoints.reduce((a,b)=>a+b,0)/dataPoints.length).toFixed(1);
        const lastVal = dataPoints[dataPoints.length-1];
        
        chartStats.innerHTML = `
            <div class="mini-stat">
                <label>Record</label>
                <strong>${maxVal} <span style="font-size:12px">${labelUnit}</span></strong>
            </div>
            <div class="mini-stat">
                <label>Media</label>
                <strong>${avgVal} <span style="font-size:12px">${labelUnit}</span></strong>
            </div>
            <div class="mini-stat">
                <label>Ultimo</label>
                <strong>${lastVal} <span style="font-size:12px">${labelUnit}</span></strong>
            </div>
        `;
    } else {
        chartStats.innerHTML = '<p style="grid-column: 1/-1; color:#999; font-size:13px; margin:0;">Nessun dato disponibile.</p>';
    }

    // --- DISEGNO CHART.JS ---
    if (chartInstance) chartInstance.destroy();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(0, 113, 227, 0.4)'); 
    gradient.addColorStop(1, 'rgba(0, 113, 227, 0.0)');

    chartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: selection, 
                data: dataPoints, 
                borderColor: '#0071E3', 
                backgroundColor: chartType === 'line' ? gradient : '#0071E3',
                borderWidth: 2, 
                pointBackgroundColor: '#fff', 
                pointBorderColor: '#0071E3', 
                pointRadius: 4, 
                pointHoverRadius: 6,
                fill: chartType === 'line', 
                tension: tension
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 13, weight: 'bold' },
                    padding: 10, cornerRadius: 8, displayColors: false,
                    callbacks: { label: (c) => c.parsed.y + ' ' + labelUnit }
                }
            },
            scales: { 
                x: { grid: { display: false }, ticks: { color: '#86868B', font: { size: 10 } } }, 
                y: { beginAtZero: false, grid: { color: '#F2F2F7', borderDash: [5, 5] }, ticks: { color: '#86868B', font: { size: 10 } } } 
            },
            interaction: { mode: 'index', intersect: false },
        }
    });
}

// PROFILO EDIT
const btnSaveProfile = document.getElementById('btn-save-profile');
const inputEditPhoto = document.getElementById('input-edit-photo');
let newProfilePhotoBase64 = null;

if (inputEditPhoto) {
    inputEditPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { newProfilePhotoBase64 = ev.target.result; document.getElementById('profile-edit-img').src = newProfilePhotoBase64; };
            reader.readAsDataURL(file);
        }
    });
}

if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
        btnSaveProfile.textContent = "Salvataggio..."; btnSaveProfile.disabled = true;
        try {
            const updateData = {
                goals: document.getElementById('prof-goals').value,
                history: document.getElementById('prof-history').value,
                injuries: document.getElementById('prof-injuries').value,
                notes: document.getElementById('prof-notes').value
            };
            if (newProfilePhotoBase64) updateData.photoURL = newProfilePhotoBase64;
            await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
            alert("Profilo aggiornato!");
        } catch (e) { console.error(e); } 
        finally { btnSaveProfile.textContent = "Salva Modifiche"; btnSaveProfile.disabled = false; }
    });
}

// --- GESTIONE ALLENAMENTO IN CORSO (DYNAMIC ISLAND) ---

// --- GESTIONE ALLENAMENTO IN CORSO (DYNAMIC ISLAND) ---
function checkActiveWorkout() {
    const status = localStorage.getItem('active_workout_status');
    const meta = JSON.parse(localStorage.getItem('active_workout_meta') || '{}');
    const bar = document.getElementById('active-workout-bar');
    
    if (status === 'running' && bar) {
        bar.classList.remove('hidden');
        document.body.classList.add('is-training'); // <--- NUOVA RIGA: Segnala al CSS che ci alleniamo
        
        // Mostra solo "Giorno X"
        document.getElementById('floating-name').textContent = `Giorno ${meta.day}`;
        
        // Timer
        const start = parseInt(localStorage.getItem(`workout_timer_start_${meta.id}_day_${meta.day}`));
        if(start) {
            if(window.miniTimerInterval) clearInterval(window.miniTimerInterval);
            window.miniTimerInterval = setInterval(() => {
                const diff = Math.floor((Date.now() - start) / 1000);
                const m = Math.floor(diff / 60);
                const s = diff % 60;
                document.getElementById('floating-timer').textContent = `${m}:${s<10?'0'+s:s}`;
            }, 1000);
        }
    } else if (bar) {
        bar.classList.add('hidden');
        document.body.classList.remove('is-training'); // <--- NUOVA RIGA: Pulisci se non ci alleniamo
    }
}

// Chiamala all'avvio
checkActiveWorkout();

// Funzione globale per riprendere cliccando sulla Dynamic Island
window.resumeWorkout = () => {
    window.location.href = "workout-viewer.html";
};
// =========================================
// ANALISI VOLUMI SCHEDA (LATO CLIENTE)
// =========================================

// Configurazione standard volumi (se non salvata nel DB)
const defaultVolumeSettings = { secondary: 0.5, tertiary: 0.3, quaternary: 0.15, other: 0.1 };

let programChartInstance = null; // Variabile globale per il grafico

window.openProgramDetails = () => {
    if (!currentWorkoutData) return;

    // Switch contenuto Sheet
    document.querySelector('.sheet-content:not(#sheet-program-stats)').classList.add('hidden');
    const statsContainer = document.getElementById('sheet-program-stats');
    if(statsContainer) statsContainer.classList.remove('hidden');

    // Calcolo Volumi (Logica invariata)
    const volumeMap = {};
    const volSettings = currentWorkoutData.volumeSettingsUsed || defaultVolumeSettings;
    let grandTotalSets = 0;

    Object.values(currentWorkoutData.data).forEach(dayExercises => {
        dayExercises.forEach(ex => {
            let sets = 0;
            if (ex.technique === "Top set + back-off") {
                const backSets = parseFloat(ex.backSets) || 0;
                sets = 1 + backSets;
            } else {
                sets = parseFloat(ex.val1) || 0;
            }
            if (sets === 0) return;

            if (ex.muscles) {
                ex.muscles.forEach(m => {
                    if (!m.name) return;
                    let mult = 0;
                    if (m.type === 'primary') mult = 1.0;
                    else if (m.type === 'secondary') mult = volSettings.secondary;
                    else if (m.type === 'tertiary') mult = volSettings.tertiary;
                    else if (m.type === 'quaternary') mult = volSettings.quaternary;
                    else mult = volSettings.other;

                    const val = sets * mult;
                    if (!volumeMap[m.name]) volumeMap[m.name] = 0;
                    volumeMap[m.name] += val;
                    grandTotalSets += val;
                });
            }
        });
    });

    // Dati Ordinati
    const sortedMuscles = Object.entries(volumeMap).sort((a,b) => b[1] - a[1]);
    const labels = sortedMuscles.map(x => x[0]);
    const dataPoints = sortedMuscles.map(x => x[1]);
    
    // Genera Colori (Palette fissa o random elegante)
     const palette = [
  '#FF3B30', // Rosso
  '#32ADE6', // Azzurro
  '#A2845E', // Marrone
  '#00C7BE', // Turchese
  '#5856D6', // Viola
  '#FFCC00', // Giallo
  '#1E3A8A', // Blu scuro
  '#FDA4AF', // Fucsia chiaro
  '#34C759', // Verde
  '#9F1239', // Fucsia scuro
  '#7DD3FC', // Azzurro chiaro
  '#5C4033', // Marrone scuro
  '#E5E7EB', // Grigio chiaro
  '#FB8500', // Arancione scuro
  '#A5B4FC', // Viola chiaro
  '#0F766E', // Turchese scuro
  '#FFE066', // Giallo chiaro
  '#0369A1', // Azzurro scuro
  '#6B7280', // Grigio
  '#FF2D55', // Fucsia
  '#15803D', // Verde scuro
  '#FFB703', // Arancione chiaro
  '#AF52DE', // Lilla
  '#60A5FA', // Blu chiaro
  '#C81D25', // Rosso scuro
  '#D6C2A1', // Marrone chiaro
  '#5EEAD4', // Turchese chiaro
  '#4C1D95', // Viola scuro
  '#C9A227', // Giallo scuro
  '#111827', // Nero
  '#6EE7B7', // Verde menta
  '#E9D5FF', // Lilla chiaro
  '#0071E3', // Blu
  '#FF6B6B', // Rosso chiaro
  '#15803D', // Verde scuro
  '#FFFFFF'  // Bianco
];
    
    // Assegna i colori ciclicamente
    const bgColors = sortedMuscles.map((_, i) => palette[i % palette.length]);
    // 1. Renderizza Grafico
    const ctxDonut = document.getElementById('programVolumeChart')?.getContext('2d');
    if(ctxDonut) {
        if (programChartInstance) programChartInstance.destroy(); // Distruggi vecchio per evitare sovrapposizioni

        programChartInstance = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPoints,
                    backgroundColor: bgColors,
                    borderWidth: 0,
                    hoverOffset: 10 // Effetto "esplosione" al click
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '75%', // Spessore ciambella (più alto = più sottile)
                plugins: { legend: { display: false } } // Legenda la facciamo noi sotto
            }
        });
        
        // Scrivi totale al centro
        document.getElementById('total-sets-val').textContent = grandTotalSets.toFixed(0);
    }

    // 2. Renderizza Lista (Con colori abbinati)
    const listEl = document.getElementById('sheet-volume-list');
    listEl.innerHTML = '';
    const maxVal = sortedMuscles.length > 0 ? sortedMuscles[0][1] : 1;

    if (sortedMuscles.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color:#999;">Nessun dato.</p>';
    } else {
        sortedMuscles.forEach(([name, val], i) => {
            const perc = (val / maxVal) * 100;
            const color = bgColors[i]; // Usa lo stesso colore del grafico
            
            listEl.innerHTML += `
                <div class="vol-item">
                    <div class="vol-header">
                        <span style="color:${color}">● ${name}</span>
                        <span>${val.toFixed(1)} set</span>
                    </div>
                    <div class="vol-bar-bg">
                        <div class="vol-bar-fill" style="width: ${perc}%; background-color: ${color}"></div>
                    </div>
                </div>
            `;
        });
    }

    // Apri Sheet
    const sheetOverlay = document.getElementById('preview-overlay');
    sheetOverlay.classList.remove('hidden');
    setTimeout(() => sheetOverlay.classList.add('active'), 10);
};

// Modifica closePreview per resettare la vista
const originalClose = window.closePreview;
window.closePreview = (e) => {
    // Chiama la chiusura originale
    if (e && !e.target.classList.contains('sheet-overlay') && !e.target.classList.contains('btn-sheet-close')) return;
    
    const sheetOverlay = document.getElementById('preview-overlay');
    sheetOverlay.classList.remove('active');
    setTimeout(() => {
        sheetOverlay.classList.add('hidden');
        // Reset: Mostra di nuovo il contenuto standard (Giorno X) e nascondi stats
        document.querySelector('.sheet-content:not(#sheet-program-stats)').classList.remove('hidden');
        document.getElementById('sheet-program-stats').classList.add('hidden');
    }, 300);
};
// --- GESTIONE BADGE SCHEDA ---
function checkWorkoutUpdate(userData) {
    const badge = document.getElementById('badge-program');
    if (!badge) return;

    // Se non c'è una data di aggiornamento dal coach, niente badge
    if (!userData.lastWorkoutUpdate) {
        badge.classList.add('hidden');
        return;
    }

    const lastSeen = parseInt(localStorage.getItem('lastSeenWorkoutTime')) || 0;
    const updateTime = userData.lastWorkoutUpdate.seconds * 1000; 

    console.log("Check Badge -> Update:", updateTime, "Seen:", lastSeen);

    // Mostra badge SOLO SE l'aggiornamento è STRETTAMENTE più recente dell'ultima visita
    if (updateTime > lastSeen) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}