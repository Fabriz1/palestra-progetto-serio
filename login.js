// IMPORTAZIONI FIREBASE (Nessuna modifica qui)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAZIONE FIREBASE (Nessuna modifica qui)
const firebaseConfig = {
    apiKey: "AIzaSyBCZqWbOdM2a89arMX18TMKqZI6BmeSsVQ",
    authDomain: "personal-trainer-fe4cc.firebaseapp.com",
    projectId: "personal-trainer-fe4cc",
    storageBucket: "personal-trainer-fe4cc.firebasestorage.app",
    messagingSenderId: "340774601063",
    appId: "1:340774601063:web:eeb03cd7ce0755b78aefc2",
    measurementId: "G-CEESE7YR9K"
};

// INIZIALIZZAZIONE APP (Nessuna modifica qui)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ELEMENTI DEL DOM (Nessuna modifica qui)
const loginBtn = document.getElementById('google-login-btn');
const loginSection = document.getElementById('login-section');
const roleSection = document.getElementById('role-selection-section');
const btnRolePT = document.getElementById('btn-role-pt');
const btnRoleClient = document.getElementById('btn-role-client');

// VARIABILE PER MEMORIZZARE L'UTENTE TEMPORANEAMENTE (Nessuna modifica qui)
let tempUser = null;


// ===================================================================
// NUOVA LOGICA CENTRALE CON onAuthStateChanged
// Questo observer diventa il punto di partenza di tutto.
// ===================================================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- CASO 1: L'UTENTE È GIÀ LOGGATO ---
        // Firebase ha trovato una sessione valida. Non c'è bisogno di mostrare il login.
        console.log("Utente già loggato:", user.uid);
        
        // Controlliamo subito il suo stato nel nostro database per reindirizzarlo.
        // Usiamo la stessa funzione che avevi già scritto!
        checkUserInDatabase(user);

    } else {
        // --- CASO 2: L'UTENTE NON È LOGGATO ---
        // Nessuna sessione trovata. Mostriamo la pagina di login e attiviamo il pulsante.
        console.log("Nessun utente loggato. Mostro la pagina di login.");
        
        // Assicuriamoci che la sezione di login sia visibile e quella del ruolo nascosta
        loginSection.classList.remove('hidden');
        roleSection.classList.add('hidden');

        // Attiviamo il listener per il click S SOLO SE l'utente non è loggato
        loginBtn.addEventListener('click', handleGoogleLogin);
    }
});


// FUNZIONE PER GESTIRE IL CLICK (Spostata per pulizia)
async function handleGoogleLogin() {
    try {
        // Non usiamo più la variabile 'result' e 'user' qui
        // perché onAuthStateChanged si attiverà automaticamente dopo il login
        // e rieseguirà il codice nel blocco "if (user)".
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Errore durante il login:", error);
        alert("Errore di connessione. Riprova.");
    }
}


// 2. CONTROLLA SE L'UTENTE ESISTE GIÀ NEL DB (Nessuna modifica qui)
async function checkUserInDatabase(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        
        // PICCOLA MODIFICA: Salviamo i dati nel localStorage per accedervi facilmente nelle altre pagine
        const userSession = {
            uid: userData.uid,
            name: userData.name,
            email: userData.email,
            photoURL: userData.photoURL,
            role: userData.role
        };
        localStorage.setItem('userSession', JSON.stringify(userSession));
        
        redirectUser(userData.role);
    } else {
        tempUser = user;
        showRoleSelection();
    }
}

// 3. MOSTRA LA SELEZIONE RUOLO (Nessuna modifica qui)
function showRoleSelection() {
    loginSection.classList.add('hidden');
    roleSection.classList.remove('hidden');
}

// 4. GESTIONE SELEZIONE "PERSONAL TRAINER" (Leggera modifica)
btnRolePT.addEventListener('click', async () => {
    if (!tempUser) return;
    const trainerCode = generateTrainerCode(6);
    try {
        const userData = {
            uid: tempUser.uid,
            name: tempUser.displayName,
            email: tempUser.email,
            photoURL: tempUser.photoURL,
            role: 'personal_trainer',
            trainerCode: trainerCode,
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, "users", tempUser.uid), userData);

        // Salviamo anche qui la sessione prima di reindirizzare
        localStorage.setItem('userSession', JSON.stringify(userData));
        
        window.location.href = "dashboard-pt.html"; 
    } catch (error) {
        console.error("Errore salvataggio PT:", error);
    }
});

// 5. GESTIONE SELEZIONE "CLIENTE" (Leggera modifica)
btnRoleClient.addEventListener('click', async () => {
    if (!tempUser) return;
    try {
        const userData = {
            uid: tempUser.uid,
            name: tempUser.displayName,
            email: tempUser.email,
            photoURL: tempUser.photoURL,
            role: 'client',
            coachId: null,
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, "users", tempUser.uid), userData);

        // Salviamo anche qui la sessione prima di reindirizzare
        localStorage.setItem('userSession', JSON.stringify(userData));

        window.location.href = "dashboard-client.html";
    } catch (error) {
        console.error("Errore salvataggio Cliente:", error);
    }
});

// FUNZIONI UTILITÀ (Nessuna modifica qui)
function redirectUser(role) {
    if (role === 'personal_trainer') {
        window.location.href = "dashboard-pt.html";
    } else {
        window.location.href = "dashboard-client.html";
    }
}

function generateTrainerCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}