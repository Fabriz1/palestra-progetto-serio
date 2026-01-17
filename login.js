// -------------------------- IMPORTAZIONI FIREBASE --------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// -------------------------- CONFIGURAZIONE FIREBASE --------------------------
const firebaseConfig = {
    apiKey: "AIzaSyBCZqWbOdM2a89arMX18TMKqZI6BmeSsV",
    authDomain: "personal-trainer-fe4cc.firebaseapp.com",
    projectId: "personal-trainer-fe4cc",
    storageBucket: "personal-trainer-fe4cc.firebasestorage.app",
    messagingSenderId: "340774601063",
    appId: "1:340774601063:web:eeb03cd7ce0755b78aefc2",
    measurementId: "G-CEESE7YR9K"
};

// -------------------------- INIZIALIZZAZIONE APP --------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// -------------------------- PERSISTENZA LOCALE --------------------------
await setPersistence(auth, browserLocalPersistence);

// -------------------------- ELEMENTI DOM --------------------------
const loginBtn = document.getElementById('google-login-btn');
const loginSection = document.getElementById('login-section');
const roleSection = document.getElementById('role-selection-section');
const btnRolePT = document.getElementById('btn-role-pt');
const btnRoleClient = document.getElementById('btn-role-client');

let tempUser = null;

// -------------------------- SERVICE WORKER --------------------------
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js")
            .then(() => console.log("Service Worker registrato"))
            .catch(err => console.error("SW registration failed:", err));
    });
}

// -------------------------- AUTO LOGIN & REDIRECT --------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Utente già loggato, controlla ruolo
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            redirectUser(userSnap.data().role);
        } else {
            // Nuovo utente loggato via Google → selezione ruolo
            tempUser = user;
            showRoleSelection();
        }
    } else {
        console.log("Nessun utente loggato, resta su login");
    }
});

// -------------------------- LOGIN GOOGLE --------------------------
loginBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            redirectUser(userSnap.data().role);
        } else {
            tempUser = user;
            showRoleSelection();
        }
    } catch (err) {
        console.error("Errore login:", err);
        alert("Errore di connessione. Riprova.");
    }
});

// -------------------------- SELEZIONE RUOLO --------------------------
btnRolePT.addEventListener('click', async () => {
    if (!tempUser) return;

    const trainerCode = generateTrainerCode(6);

    try {
        await setDoc(doc(db, "users", tempUser.uid), {
            uid: tempUser.uid,
            name: tempUser.displayName,
            email: tempUser.email,
            photoURL: tempUser.photoURL,
            role: 'personal_trainer',
            trainerCode: trainerCode,
            createdAt: serverTimestamp()
        });
        window.location.href = "dashboard-pt.html";
    } catch (err) {
        console.error("Errore salvataggio PT:", err);
    }
});

btnRoleClient.addEventListener('click', async () => {
    if (!tempUser) return;

    try {
        await setDoc(doc(db, "users", tempUser.uid), {
            uid: tempUser.uid,
            name: tempUser.displayName,
            email: tempUser.email,
            photoURL: tempUser.photoURL,
            role: 'client',
            coachId: null,
            createdAt: serverTimestamp()
        });
        window.location.href = "dashboard-client.html";
    } catch (err) {
        console.error("Errore salvataggio Cliente:", err);
    }
});

// -------------------------- FUNZIONI UTILI --------------------------
function redirectUser(role) {
    if (role === 'personal_trainer') {
        if (!window.location.pathname.includes("dashboard-pt")) {
            window.location.href = "dashboard-pt.html";
        }
    } else {
        if (!window.location.pathname.includes("dashboard-client")) {
            window.location.href = "dashboard-client.html";
        }
    }
}

function showRoleSelection() {
    loginSection.classList.add('hidden');
    roleSection.classList.remove('hidden');
}

function generateTrainerCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
