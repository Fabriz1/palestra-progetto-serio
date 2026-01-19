import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAZIONE FIREBASE
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

// VARIABILI DI STATO
let currentStep = 1;
const totalSteps = 6;
let coachIdFound = null; // ID del coach trovato tramite codice
let photoBase64 = null; // Foto convertita

// ELEMENTI DOM
const slider = document.getElementById('wizard-slider');
const progressBar = document.getElementById('progress-bar');

// 1. INIZIALIZZAZIONE E CONTROLLI
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Se non loggato, via al login
        window.location.href = "login.html";
        return;
    }

    // Controlliamo lo stato dell'utente nel DB
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    
    if (snap.exists()) {
        const data = snap.data();

        // SICUREZZA: Se è un Coach, non deve stare qui
        if (data.role === 'personal_trainer') {
            alert("Sei registrato come Coach. Verrai reindirizzato alla Dashboard PT.");
            window.location.href = "dashboard-pt.html";
            return;
        }

        // Se ha già completato l'onboarding...
        if (data.onboardingComplete) {
            if (data.status === 'pending') {
                // ...ma è in attesa -> Pagina Pending
                window.location.href = "pending.html";
            } else if (data.coachId) {
                // ...ed è attivo -> Dashboard Cliente
                window.location.href = "dashboard-client.html";
            }
        }
    }
});

// 2. FUNZIONE PER AVANZARE DI STEP
window.nextStep = async (stepCalled) => {
    
    // --- VALIDAZIONE STEP 1: CODICE COACH ---
    if (stepCalled === 1) {
        const inputCode = document.getElementById('inp-code');
        const errorMsg = document.getElementById('code-error-msg');
        const code = inputCode.value.trim().toUpperCase();

        if (code.length < 6) return; // Troppo corto

        // Verifichiamo se il codice esiste nel DB (cerchiamo tra i coach)
        const q = query(collection(db, "users"), where("trainerCode", "==", code));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
            errorMsg.classList.remove('hidden');
            return; // Blocca qui
        } else {
            // Codice valido! Salviamo l'ID del coach
            coachIdFound = querySnap.docs[0].id;
            errorMsg.classList.add('hidden');
        }
    }

    // --- VALIDAZIONE STEP 2: FOTO E DATI ---
    if (stepCalled === 2) {
        if (!photoBase64) {
            alert("La foto profilo è obbligatoria per farti riconoscere dal coach.");
            return;
        }
        const name = document.getElementById('inp-name').value.trim();
        const age = document.getElementById('inp-age').value.trim();
        if (!name || !age) {
            alert("Inserisci Nome, Cognome ed Età per proseguire.");
            return;
        }
    }

    // --- VALIDAZIONE STEP 3 (Opzionale ma consigliata) ---
    if (stepCalled === 3) {
        // Almeno un obiettivo selezionato?
        if (!document.querySelector('#grid-goals .opt-card.selected')) {
            alert("Seleziona almeno un obiettivo principale.");
            return;
        }
    }

    // AVANZAMENTO GRAFICO
    currentStep++;
    
    // Aggiorna Barra Progresso
    const progressPct = (currentStep / totalSteps) * 100;
    progressBar.style.width = `${progressPct}%`;

    // Sposta lo Slider (ogni slide è larga 100%)
    const translateX = -(currentStep - 1) * 100;
    slider.style.transform = `translateX(${translateX}%)`;

    // Aggiorna classi active per accessibilità
    document.querySelectorAll('.step-slide').forEach(el => el.classList.remove('active'));
    document.querySelector(`.step-slide[data-step="${currentStep}"]`).classList.add('active');
};

// 3. GESTIONE SELEZIONE OPZIONI (Bottoni)
const grids = document.querySelectorAll('.grid-options');
grids.forEach(grid => {
    const isSingle = grid.classList.contains('single-select');
    
    grid.querySelectorAll('.opt-card').forEach(card => {
        card.addEventListener('click', () => {
            if (isSingle) {
                // Deseleziona tutti gli altri
                grid.querySelectorAll('.opt-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            } else {
                // Selezione multipla (Toggle)
                card.classList.toggle('selected');
            }
        });
    });
});

// 4. GESTIONE UPLOAD FOTO (Anteprima immediata)
const photoArea = document.getElementById('photo-area');
const inpPhoto = document.getElementById('inp-photo');
const imgPreview = document.getElementById('img-preview');
const placeholder = document.querySelector('.photo-placeholder');

if (photoArea) {
    photoArea.addEventListener('click', () => inpPhoto.click());

    inpPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Creiamo un canvas per ridimensionare
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Max dimensioni (es. 800x800 è sufficiente per avatar)
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Converti in JPG compresso (0.7 qualità)
                    photoBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    
                    // Mostra anteprima
                    imgPreview.src = photoBase64;
                    imgPreview.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                    photoArea.style.border = "none";
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// 5. SALVATAGGIO FINALE E INVIO RICHIESTA
document.getElementById('btn-finish').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-finish');
    btn.textContent = "Invio Richiesta...";
    btn.disabled = true;

    try {
        // --- RACCOLTA DATI DAI CAMPI ---
        const name = document.getElementById('inp-name').value.trim();
        const age = document.getElementById('inp-age').value.trim();
        
        // Obiettivo
        const goalsArr = [];
        document.querySelectorAll('#grid-goals .selected').forEach(el => goalsArr.push(el.dataset.val));
        const goalString = goalsArr.length > 0 ? goalsArr.join(', ') : "Generico";

        // Sport (Multiplo)
        const sports = [];
        document.querySelectorAll('#grid-sports .selected').forEach(el => sports.push(el.dataset.val));
        const otherSport = document.getElementById('inp-sport-other').value.trim();
        if (otherSport) sports.push(otherSport);

        // Fisico (Multiplo)
        const injuriesArr = [];
        document.querySelectorAll('#grid-injuries .selected').forEach(el => injuriesArr.push(el.dataset.val));
        const injuryDetail = document.getElementById('inp-injuries-detail').value.trim();
        
        const postureArr = [];
        document.querySelectorAll('#grid-posture .selected').forEach(el => postureArr.push(el.dataset.val));

        // Note
        const notes = document.getElementById('inp-notes').value.trim();

        // --- PREPARAZIONE OGGETTO DB ---
        const updatePayload = {
            // Dati Anagrafici
            name: name,
            age: age,
            photoURL: photoBase64, // La foto caricata
            
            // Logica Coach (RICHIESTA IN ATTESA)
            coachId: null,           // Non ancora attivo
            pendingCoachId: coachIdFound, // L'ID del coach trovato al Step 1
            status: "pending",       // Stato fondamentale per la logica di approvazione
            
            // Anamnesi
            goals: goalString,
            history: sports.join(', '),
            injuries: `${injuriesArr.join(', ')} ${injuryDetail ? '- ' + injuryDetail : ''}`,
            posture: postureArr.join(', '),
            notes: notes,
            
            // Flags sistema
            onboardingComplete: true,
            updatedAt: new Date().toISOString()
        };

        // Scrittura su Firestore
        await updateDoc(doc(db, "users", user.uid), updatePayload);

        // Redirect alla pagina di attesa
        window.location.href = "pending.html";

    } catch (e) {
        console.error("Errore Onboarding:", e);
        alert("Si è verificato un errore nel salvataggio: " + e.message);
        btn.textContent = "Riprova";
        btn.disabled = false;
    }
});