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
const btnGotoProgram = document.getElementById('btn-goto-program'); // ID CORRETTO

// NAVIGATION
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');

// GLOBAL USER STATE
let currentUser = null;
let currentWorkoutData = null;

// 1. AUTH CHECK & INIT
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

// 2. NAVIGAZIONE TAB (Fixato switchTab)
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.dataset.target;
        manualSwitchTab(targetId);
    });
});

// Funzione unificata per cambiare tab senza errori
window.switchTab = (tabId) => {
    manualSwitchTab(tabId);
};

function manualSwitchTab(tabId) {
    // 1. Nascondi tutto
    views.forEach(v => v.classList.add('hidden'));
    
    // 2. Mostra target
    const targetEl = document.getElementById(tabId);
    if(targetEl) targetEl.classList.remove('hidden');
    
    // 3. Aggiorna Bottom Bar (Se il bottone esiste)
    navItems.forEach(n => n.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[data-target="${tabId}"]`);
    if(activeBtn) {
        activeBtn.classList.add('active');
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
        currentWorkoutData.id = snap.id; // <--- ECCO IL PEZZO CHE MANCAVA!

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

function renderDaysList(workout) {
    const container = document.getElementById('workout-days-list');
    if(!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= workout.days; i++) {
        const exercises = workout.data[i] || [];
        const count = exercises.length;
        
        const card = document.createElement('div');
        card.className = 'day-card';
        card.onclick = () => {
            localStorage.setItem('currentWorkoutId', workout.id);
            localStorage.setItem('currentDay', i);
            window.location.href = "workout-viewer.html";
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

// 4. STATISTICHE RAPIDE
async function loadStats(uid) {
    try {
        const qWeight = query(collection(db, "users", uid, "measurements"), orderBy("date", "desc"), limit(1));
        const snapW = await getDocs(qWeight);
        if(!snapW.empty) {
            document.getElementById('stat-weight').textContent = snapW.docs[0].data().weight;
        }
        
        // Conta allenamenti (lettura completa, attenzione ai costi in prod)
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

        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.senderId === userUid;
            lastMessageText = msg.text;

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
    });

    const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        try {
            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: text, senderId: userUid, timestamp: serverTimestamp()
            });
            await setDoc(doc(db, "chats", chatId), {
                participants: [userUid, coachId],
                participantNames: [currentUser.name, "Coach"],
                lastMessage: text, lastMessageTime: serverTimestamp()
            }, { merge: true });
        } catch (e) { console.error(e); }
    };

    if(btnSendChat) btnSendChat.addEventListener('click', sendMessage);
    if(chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

// =========================================
// GRAFICI CHART.JS
// =========================================
const ctx = document.getElementById('progressChart')?.getContext('2d');
const chartSelect = document.getElementById('chart-selector');
const chartChips = document.querySelectorAll('.filter-chip');
const chartStats = document.getElementById('chart-stats-details');
let chartInstance = null;
let allLogs = [], allMeasurements = [], currentChartType = 'exercise';

async function loadChartData(uid) {
    if(!ctx) return;
    const logsSnap = await getDocs(query(collection(db, "users", uid, "logs"), orderBy("date", "asc")));
    allLogs = []; logsSnap.forEach(doc => allLogs.push(doc.data()));

    const measuresSnap = await getDocs(query(collection(db, "users", uid, "measurements"), orderBy("date", "asc")));
    allMeasurements = []; measuresSnap.forEach(doc => allMeasurements.push(doc.data()));

    initChartControls();
}

function initChartControls() {
    chartChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chartChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentChartType = chip.dataset.type;
            updateChartSelector();
        });
    });
    if(chartSelect) chartSelect.addEventListener('change', (e) => renderChart(e.target.value));
    updateChartSelector();
}

function updateChartSelector() {
    if(!chartSelect) return;
    chartSelect.innerHTML = '<option>Seleziona...</option>';
    let options = new Set();

    if (currentChartType === 'exercise') {
        allLogs.forEach(log => { if(log.exercises) log.exercises.forEach(ex => options.add(ex.name)); });
    } else if (currentChartType === 'body') {
        options.add("Peso Corporeo"); options.add("Massa Grassa %");
    }

    options.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt; el.textContent = opt;
        chartSelect.appendChild(el);
    });
}

function renderChart(selection) {
    if (!selection || selection === 'Seleziona...') return;
    let labels = [], dataPoints = [], labelUnit = '';

    if (currentChartType === 'exercise') {
        labelUnit = 'kg';
        allLogs.forEach(log => {
            const exData = log.exercises.find(e => e.name === selection);
            if (exData) {
                let maxWeight = 0;
                exData.sets.forEach(s => { const w = parseFloat(s.kg)||0; if(w>maxWeight) maxWeight=w; });
                if (maxWeight > 0) {
                    labels.push(new Date(log.date).toLocaleDateString(undefined, {day:'numeric', month:'numeric'}));
                    dataPoints.push(maxWeight);
                }
            }
        });
    } else if (currentChartType === 'body') {
        allMeasurements.forEach(m => {
            labels.push(new Date(m.date).toLocaleDateString(undefined, {day:'numeric', month:'numeric'}));
            if (selection === "Peso Corporeo") { dataPoints.push(m.weight); labelUnit = 'kg'; }
            else if (selection === "Massa Grassa %") { if(m.bia?.fat) dataPoints.push(m.bia.fat); labelUnit = '%'; }
        });
    }

    if(dataPoints.length > 0 && chartStats) {
        const maxVal = Math.max(...dataPoints);
        const avgVal = (dataPoints.reduce((a,b)=>a+b,0)/dataPoints.length).toFixed(1);
        chartStats.innerHTML = `<div class="mini-stat"><label>Record</label><strong>${maxVal} ${labelUnit}</strong></div><div class="mini-stat"><label>Media</label><strong>${avgVal} ${labelUnit}</strong></div><div class="mini-stat"><label>Ultimo</label><strong>${dataPoints[dataPoints.length-1]} ${labelUnit}</strong></div>`;
    }

    if (chartInstance) chartInstance.destroy();
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 113, 227, 0.5)'); gradient.addColorStop(1, 'rgba(0, 113, 227, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: selection, data: dataPoints, borderColor: '#0071E3', backgroundColor: gradient,
                borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#0071E3', pointRadius: 4, fill: true, tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: false, grid: { color: '#F2F2F7' } } }
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