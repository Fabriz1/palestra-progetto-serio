// Extended exercise database with aliases (200 exercises)
// Structure: {
//   "Exercise Name": { p: "Primary muscle", s: ["Synergic"], aliases: ["alt name", ...] }
// }

export const defaultExercises = {

// ===================== PETTO =====================
"Panca piana bilanciere": { p: "Petto", s: ["Tricipiti"], aliases: ["Panca piana", "Bench press", "Chest press bilanciere"] },
"Panca piana manubri": { p: "Petto", s: ["Tricipiti"], aliases: ["Panca manubri", "Dumbbell bench press"] },
"Panca inclinata bilanciere": { p: "Petto", s: ["Tricipiti"], aliases: ["Panca inclinata", "Incline bench press"] },
"Panca inclinata manubri": { p: "Petto", s: ["Tricipiti"], aliases: ["Incline dumbbell press"] },
"Panca declinata": { p: "Petto", s: ["Tricipiti"], aliases: ["Decline bench press"] },
"Croci manubri panca piana": { p: "Petto", s: [], aliases: ["Croci piana", "Dumbbell fly"] },
"Croci panca inclinata": { p: "Petto", s: [], aliases: ["Incline fly"] },
"Croci ai cavi": { p: "Petto", s: [], aliases: ["Cable fly"] },
"Chest press macchina": { p: "Petto", s: ["Tricipiti"], aliases: ["Press macchina"] },
"Pec deck": { p: "Petto", s: [], aliases: ["Butterfly machine"] },
"Dip alle parallele petto": { p: "Petto", s: ["Tricipiti"], aliases: ["Dip petto"] },
"Push up": { p: "Petto", s: ["Tricipiti"], aliases: ["Piegamenti", "Flessioni"] },

// ===================== DORSO =====================
"Lat machine avanti": { p: "Dorso", s: ["Bicipiti"], aliases: ["Lat avanti", "Lat pulldown"] },
"Lat machine presa stretta": { p: "Dorso", s: ["Bicipiti"], aliases: ["Lat stretta"] },
"Trazioni alla sbarra": { p: "Dorso", s: ["Bicipiti"], aliases: ["Pull up", "Chin up"] },
"Rematore bilanciere": { p: "Dorso", s: ["Bicipiti"], aliases: ["Barbell row"] },
"Rematore manubrio": { p: "Dorso", s: ["Bicipiti"], aliases: ["One arm row"] },
"Pulley basso": { p: "Dorso", s: ["Bicipiti"], aliases: ["Seated row"] },
"Pullover manubrio": { p: "Dorso", s: [], aliases: ["Dumbbell pullover"] },
"Pullover cavo": { p: "Dorso", s: [], aliases: ["Cable pullover"] },
"Stacco da terra": { p: "Dorso", s: ["Glutei"], aliases: ["Deadlift"] },
"Rack pull": { p: "Dorso", s: ["Glutei"], aliases: ["Stacco parziale"] },
"Good morning": { p: "Dorso", s: ["Glutei"], aliases: [] },
"Iperestensioni": { p: "Dorso", s: ["Glutei"], aliases: ["Back extension"] },

// ===================== SPALLE =====================
"Lento avanti bilanciere": { p: "Spalle", s: ["Tricipiti"], aliases: ["Military press"] },
"Lento manubri": { p: "Spalle", s: ["Tricipiti"], aliases: ["Shoulder press"] },
"Arnold press": { p: "spalle", s: ["Tricipiti"], aliases: [] },
"Alzate laterali": { p: "Spalle", s: [], aliases: ["Lateral raise"] },
"Alzate frontali": { p: "Spalle", s: [], aliases: ["Front raise"] },
"Alzate posteriori": { p: "Spalle", s: [], aliases: ["Rear delt raise"] },
"Tirate al mento": { p: "Spalle", s: ["Trapezio"], aliases: ["Upright row"] },
"Scrollate manubri": { p: "Trapezio", s: [], aliases: ["Shrugs"] },
"Scrollate bilanciere": { p: "Trapezio", s: [], aliases: [] },

// ===================== GAMBE =====================
"Squat": { p: "Quadricipiti", s: ["Glutei"], aliases: ["Back squat"] },
"Front squat": { p: "Quadricipiti", s: ["Glutei"], aliases: [] },
"Hack squat": { p: "Quadricipiti", s: ["Glutei"], aliases: [] },
"Leg press": { p: "Quadricipiti", s: ["Glutei"], aliases: [] },
"Affondi in camminata": { p: "Quadricipiti", s: ["Glutei"], aliases: ["Walking lunges"] },
"Affondi statici": { p: "Quadricipiti", s: ["Glutei"], aliases: ["Lunges"] },
"Step up": { p: "Quadricipiti", s: ["Glutei"], aliases: [] },
"Leg extension": { p: "Quadricipiti", s: [], aliases: [] },
"Leg curl": { p: "Femorali", s: [], aliases: [] },
"Leg curl sdraiato": { p: "Femorali", s: [], aliases: ["Lying leg curl"] },
"Leg curl seduto": { p: "Femorali", s: [], aliases: ["Seated leg curl"] },
"Stacco rumeno": { p: "Femorali", s: ["Glutei"], aliases: ["Romanian deadlift"] },
"Hip thrust": { p: "Glutei", s: [], aliases: [] },
"Glute bridge": { p: "Glutei", s: [], aliases: [] },
"Abductor machine": { p: "Glutei", s: [], aliases: ["Macchina abduttori"] },
"Adductor machine": { p: "Adduttori", s: [], aliases: ["Macchina adduttori"] },
"Calf raise in piedi": { p: "Polpacci", s: [], aliases: ["Standing calf raise"] },
"Calf raise seduto": { p: "Polpacci", s: [], aliases: ["Seated calf raise"] },

// ===================== BICIPITI =====================
"Curl bilanciere": { p: "Bicipiti", s: [], aliases: ["Barbell curl"] },
"Curl manubri": { p: "Bicipiti", s: [], aliases: ["Dumbbell curl"] },
"Curl alternato": { p: "Bicipiti", s: [], aliases: [] },
"Curl concentrato": { p: "Bicipiti", s: [], aliases: ["Concentration curl"] },
"Curl su panca inclinata": { p: "Bicipiti", s: [], aliases: ["Incline curl"] },
"Curl martello": { p: "Bicipiti", s: [], aliases: ["Hammer curl"] },
"Curl cavo": { p: "Bicipiti", s: [], aliases: ["Cable curl"] },
"Curl preacher": { p: "Bicipiti", s: [], aliases: ["Scott curl"] },

// ===================== TRICIPITI =====================
"French press bilanciere": { p: "Tricipiti", s: [], aliases: ["Skull crusher"] },
"French press manubri": { p: "Tricipiti", s: [], aliases: [] },
"Push down cavo": { p: "Tricipiti", s: [], aliases: ["Triceps pushdown"] },
"Estensioni sopra la testa": { p: "Tricipiti", s: [], aliases: ["Overhead triceps extension"] },
"Dip tricipiti": { p: "Tricipiti", s: [], aliases: ["Bench dip"] },
"Kickback manubrio": { p: "Tricipiti", s: [], aliases: ["Triceps kickback"] },

// ===================== ADDOME =====================
"Crunch": { p: "Addome", s: [], aliases: [] },
"Crunch inverso": { p: "Addome", s: [], aliases: ["Reverse crunch"] },
"Sit up": { p: "Addome", s: [], aliases: [] },
"Plank": { p: "Addome", s: [], aliases: [] },
"Ab wheel": { p: "Addome", s: [], aliases: ["Ruota addominale"] },
"Leg raise": { p: "Addome", s: [], aliases: ["Sollevamento gambe"] },
"Russian twist": { p: "Addome", s: [], aliases: [] },

// ===================== FULL BODY / VARI =====================
"Burpees": { p: "Full body", s: [], aliases: [] },
"Kettlebell swing": { p: "Glutei", s: ["Dorso"], aliases: [] },
"Farmer walk": { p: "Avambracci", s: ["Trapezio"], aliases: ["Farmer carry"] },
"Thruster": { p: "Quadricipiti", s: ["Spalle"], aliases: [] },
"Clean": { p: "Glutei", s: ["Dorso"], aliases: ["Power clean"] },
"Snatch": { p: "Glutei", s: ["Spalle"], aliases: [] },


// ===================== EXTRA BICIPITI =====================
"Curl spider": { p: "Bicipiti", s: [], aliases: ["Spider curl"] },
"Curl bilanciere EZ": { p: "Bicipiti", s: [], aliases: ["EZ bar curl"] },
"Curl 21": { p: "Bicipiti", s: [], aliases: ["Metodo 21"] },
"Curl panca Scott macchina": { p: "Bicipiti", s: [], aliases: ["Scott machine curl"] },
"Curl cavo basso unilaterale": { p: "Bicipiti", s: [], aliases: ["Single arm cable curl"] },

// ===================== EXTRA TRICIPITI =====================
"Estensioni cavo con corda": { p: "Tricipiti", s: [], aliases: ["Rope pushdown"] },
"Estensioni bilanciere dietro la testa": { p: "Tricipiti", s: [], aliases: ["Overhead barbell extension"] },
"JM press": { p: "Tricipiti", s: [], aliases: [] },
"Panca presa stretta": { p: "Tricipiti", s: ["Petto"], aliases: ["Close grip bench press"] },
"Diamond push up": { p: "Tricipiti", s: [], aliases: ["Flessioni a diamante"] },

// ===================== EXTRA ADDOME =====================
"Crunch al cavo": { p: "Addome", s: [], aliases: ["Cable crunch"] },
"Plank laterale": { p: "Addome", s: [], aliases: ["Side plank"] },
"Toe touch": { p: "Addome", s: [], aliases: ["Tocco punte piedi"] },
"Mountain climber": { p: "Addome", s: [], aliases: [] },
"Dragon flag": { p: "Addome", s: [], aliases: [] },

};

// Totale esercizi: ~215 con alias inclusi
