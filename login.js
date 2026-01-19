// IMPORTAZIONI FIREBASE (Versione compatibile con quella che mi hai dato)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"; // Uso la stable recente
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// CONFIGURAZIONE FIREBASE (La tua configurazione)
const firebaseConfig = {
    apiKey: "AIzaSyBCZqWbOdM2a89arMX18TMKqZI6BmeSsVQ",
    authDomain: "personal-trainer-fe4cc.firebaseapp.com",
    projectId: "personal-trainer-fe4cc",
    storageBucket: "personal-trainer-fe4cc.firebasestorage.app",
    messagingSenderId: "340774601063",
    appId: "1:340774601063:web:eeb03cd7ce0755b78aefc2",
    measurementId: "G-CEESE7YR9K"
};

// INIZIALIZZAZIONE APP
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ELEMENTI DEL DOM
const loginBtn = document.getElementById('google-login-btn');
const loginSection = document.getElementById('login-section');
const roleSection = document.getElementById('role-selection-section');
const btnRolePT = document.getElementById('btn-role-pt');
const btnRoleClient = document.getElementById('btn-role-client');

// VARIABILE PER MEMORIZZARE L'UTENTE TEMPORANEAMENTE (Mentre sceglie il ruolo)
let tempUser = null;

// 1. GESTIONE CLICK LOGIN
loginBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        checkUserInDatabase(user);
    } catch (error) {
        console.error("Errore durante il login:", error);
        alert("Errore di connessione. Riprova.");
    }
});

// 2. CONTROLLA SE L'UTENTE ESISTE GIÀ NEL DB
async function checkUserInDatabase(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        // UTENTE ESISTENTE: Reindirizza in base al ruolo
        const userData = userSnap.data();
        redirectUser(userData.role);
    } else {
        // NUOVO UTENTE: Mostra selezione ruolo
        tempUser = user;
        showRoleSelection();
    }
}

// 3. MOSTRA LA SELEZIONE RUOLO (Nasconde login, mostra opzioni)
function showRoleSelection() {
    loginSection.classList.add('hidden');
    roleSection.classList.remove('hidden');
}

// 4. GESTIONE SELEZIONE "PERSONAL TRAINER"
btnRolePT.addEventListener('click', async () => {
    if (!tempUser) return;
    
    // Genera un codice invito univoco (6 caratteri alfanumerici)
    const trainerCode = generateTrainerCode(6);

    try {
        // Salva nel database
        await setDoc(doc(db, "users", tempUser.uid), {
            uid: tempUser.uid,
            name: tempUser.displayName,
            email: tempUser.email,
            photoURL: tempUser.photoURL,
            role: 'personal_trainer',
            trainerCode: trainerCode, // Il codice che darai ai clienti
            createdAt: serverTimestamp()
        });

        // Reindirizza alla dashboard PT
        window.location.href = "dashboard-pt.html"; 
    } catch (error) {
        console.error("Errore salvataggio PT:", error);
    }
});

// 5. GESTIONE SELEZIONE "CLIENTE"
btnRoleClient.addEventListener('click', async () => {
    if (!tempUser) return;

    try {
        // Salva nel database (Senza codice trainer per ora, lo inserirà dopo)
        await setDoc(doc(db, "users", tempUser.uid), {
            uid: tempUser.uid,
            name: tempUser.displayName,
            email: tempUser.email,
            photoURL: tempUser.photoURL,
            role: 'client',
            coachId: null, // Nessun coach assegnato inizialmente
            createdAt: serverTimestamp()
        });

        // Reindirizza alla dashboard Cliente (che faremo in futuro)
        window.location.href = "dashboard-client.html";
    } catch (error) {
        console.error("Errore salvataggio Cliente:", error);
    }
});

// FUNZIONI UTILITÀ
function redirectUser(role) {
    if (role === 'personal_trainer') {
        window.location.href = "dashboard-pt.html";
    } else {
        window.location.href = "dashboard-client.html"; // O dashboard-client.html
    }
}

function generateTrainerCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result; // Es: "X7K9P2"
}