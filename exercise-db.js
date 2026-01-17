/* exercise-db.js - Database Base Esercizi */

export const defaultExercises = {
    // --- PETTO (Sinergici: Tricipiti, Spalle Ant) ---
    "Panca piana bilanciere": { p: "Pettorali", s: ["Tricipiti", "Spalle (Ant)"] },
    "Panca piana manubri": { p: "Pettorali", s: ["Tricipiti", "Spalle (Ant)"] },
    "Panca inclinata bilanciere": { p: "Pettorali", s: ["Tricipiti", "Spalle (Ant)"] },
    "Panca inclinata manubri": { p: "Pettorali", s: ["Tricipiti", "Spalle (Ant)"] },
    "Panca declinata bilanciere": { p: "Pettorali", s: ["Tricipiti"] },
    "Chest press macchina": { p: "Pettorali", s: ["Tricipiti"] },
    "Croci manubri panca piana": { p: "Pettorali", s: [] },
    "Croci ai cavi alti": { p: "Pettorali", s: [] },
    "Dips alle parallele": { p: "Pettorali", s: ["Tricipiti", "Spalle (Ant)"] },
    "Piegamenti a terra (Push-up)": { p: "Pettorali", s: ["Tricipiti", "Addome"] },

    // --- DORSO (Sinergici: Bicipiti, Avambracci) ---
    "Lat machine avanti": { p: "Dorsali", s: ["Bicipiti"] },
    "Lat machine inversa": { p: "Dorsali", s: ["Bicipiti"] },
    "Pulley basso": { p: "Dorsali", s: ["Bicipiti", "Lombari"] },
    "Rematore bilanciere": { p: "Dorsali", s: ["Bicipiti", "Lombari"] },
    "Rematore manubrio": { p: "Dorsali", s: ["Bicipiti"] },
    "Trazioni alla sbarra": { p: "Dorsali", s: ["Bicipiti"] },
    "Pullover ai cavi": { p: "Dorsali", s: ["Tricipiti"] },
    "Stacco da terra": { p: "Dorsali", s: ["Glutei", "Femorali", "Lombari"] },

    // --- SPALLE (Ant/Lat/Post) ---
    "Military press": { p: "Spalle (Ant)", s: ["Tricipiti"] },
    "Lento avanti manubri": { p: "Spalle (Ant)", s: ["Tricipiti"] },
    "Alzate laterali": { p: "Spalle (Lat)", s: [] },
    "Alzate laterali ai cavi": { p: "Spalle (Lat)", s: [] },
    "Alzate frontali": { p: "Spalle (Ant)", s: [] },
    "Alzate posteriori 90°": { p: "Spalle (Post)", s: [] },
    "Face pull": { p: "Spalle (Post)", s: ["Trapezio"] },
    "Tirate al mento": { p: "Spalle (Lat)", s: ["Trapezio"] },

    // --- GAMBE (Quadricipiti/Femorali/Glutei) ---
    "Squat bilanciere": { p: "Quadricipiti", s: ["Glutei", "Lombari"] },
    "Front squat": { p: "Quadricipiti", s: ["Glutei", "Addome"] },
    "Leg press": { p: "Quadricipiti", s: ["Glutei"] },
    "Affondi manubri": { p: "Quadricipiti", s: ["Glutei"] },
    "Leg extension": { p: "Quadricipiti", s: [] },
    "Bulgarian split squat": { p: "Glutei", s: ["Quadricipiti"] },
    "Stacco rumeno": { p: "Femorali", s: ["Glutei", "Lombari"] },
    "Leg curl sdraiato": { p: "Femorali", s: [] },
    "Hip thrust": { p: "Glutei", s: ["Femorali"] },
    "Calf raise in piedi": { p: "Polpacci", s: [] },

    // --- BRACCIA ---
    "Curl bilanciere": { p: "Bicipiti", s: ["Avambracci"] },
    "Curl manubri alternato": { p: "Bicipiti", s: [] },
    "Curl martello": { p: "Bicipiti", s: ["Avambracci"] },
    "French press": { p: "Tricipiti", s: [] },
    "Pushdown ai cavi": { p: "Tricipiti", s: [] },
    "Estensioni dietro nuca": { p: "Tricipiti", s: [] },
    "Panca piana presa stretta": { p: "Tricipiti", s: ["Pettorali"] },

    // --- ALTRO ---
    "Crunch a terra": { p: "Addome", s: [] },
    "Plank": { p: "Addome", s: ["Spalle (Ant)"] },
    "Hanging leg raise": { p: "Addome", s: [] },
    "Iperestensioni": { p: "Lombari", s: ["Glutei"] }
};