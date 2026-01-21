// Extended exercise database with aliases (200 exercises)
// Updated for New Anatomical Hierarchy

export const defaultExercises = {

// ===================== PETTO (Pettorali) =====================
"Panca piana bilanciere": { p: "Pettorali", s: ["Tricipiti", "Deltoidi Anteriori"], aliases: ["Panca piana", "Bench press", "Chest press bilanciere"] },
"Panca piana manubri": { p: "Pettorali", s: ["Tricipiti", "Deltoidi Anteriori"], aliases: ["Panca manubri", "Dumbbell bench press"] },
"Panca inclinata bilanciere": { p: "Pettorali", s: ["Tricipiti", "Deltoidi Anteriori"], aliases: ["Panca inclinata", "Incline bench press"] },
"Panca inclinata manubri": { p: "Pettorali", s: ["Tricipiti", "Deltoidi Anteriori"], aliases: ["Incline dumbbell press"] },
"Panca declinata": { p: "Pettorali", s: ["Tricipiti"], aliases: ["Decline bench press"] },
"Croci manubri panca piana": { p: "Pettorali", s: [], aliases: ["Croci piana", "Dumbbell fly"] },
"Croci panca inclinata": { p: "Pettorali", s: ["Deltoidi Anteriori"], aliases: ["Incline fly"] },
"Croci ai cavi": { p: "Pettorali", s: [], aliases: ["Cable fly"] },
"Chest press macchina": { p: "Pettorali", s: ["Tricipiti"], aliases: ["Press macchina"] },
"Pec deck": { p: "Pettorali", s: [], aliases: ["Butterfly machine"] },
"Dip alle parallele petto": { p: "Pettorali", s: ["Tricipiti", "Deltoidi Anteriori"], aliases: ["Dip petto"] },
"Push up": { p: "Pettorali", s: ["Tricipiti", "Deltoidi Anteriori"], aliases: ["Piegamenti", "Flessioni"] },

// ===================== DORSO (Diviso per Ampiezza/Spessore) =====================
// Trazioni e Verticali -> Ampiezza (Lats)
"Lat machine avanti": { p: "Schiena (Ampiezza/Lats)", s: ["Bicipiti", "Schiena (Alta/Spessore)"], aliases: ["Lat avanti", "Lat pulldown"] },
"Lat machine presa stretta": { p: "Schiena (Ampiezza/Lats)", s: ["Bicipiti"], aliases: ["Lat stretta"] },
"Trazioni alla sbarra": { p: "Schiena (Ampiezza/Lats)", s: ["Bicipiti"], aliases: ["Pull up", "Chin up"] },
"Pullover manubrio": { p: "Schiena (Ampiezza/Lats)", s: ["Pettorali"], aliases: ["Dumbbell pullover"] },
"Pullover cavo": { p: "Schiena (Ampiezza/Lats)", s: [], aliases: ["Cable pullover"] },

// Rematori e Orizzontali -> Spessore (Alta)
"Rematore bilanciere": { p: "Schiena (Alta/Spessore)", s: ["Bicipiti", "Schiena (Ampiezza/Lats)"], aliases: ["Barbell row"] },
"Rematore manubrio": { p: "Schiena (Alta/Spessore)", s: ["Bicipiti"], aliases: ["One arm row"] },
"Pulley basso": { p: "Schiena (Alta/Spessore)", s: ["Bicipiti"], aliases: ["Seated row"] },

// Bassa Schiena
"Stacco da terra": { p: "Schiena (Bassa/Lombari)", s: ["Glutei", "Femorali (Ischiocrurali)", "Schiena (Alta/Spessore)"], aliases: ["Deadlift"] },
"Rack pull": { p: "Schiena (Alta/Spessore)", s: ["Schiena (Bassa/Lombari)"], aliases: ["Stacco parziale"] },
"Good morning": { p: "Schiena (Bassa/Lombari)", s: ["Glutei", "Femorali (Ischiocrurali)"], aliases: [] },
"Iperestensioni": { p: "Schiena (Bassa/Lombari)", s: ["Glutei"], aliases: ["Back extension"] },

// ===================== SPALLE (Divise per capi) =====================
"Lento avanti bilanciere": { p: "Deltoidi Anteriori", s: ["Tricipiti", "Deltoidi Laterali"], aliases: ["Military press"] },
"Lento manubri": { p: "Deltoidi Anteriori", s: ["Tricipiti"], aliases: ["Shoulder press"] },
"Arnold press": { p: "Deltoidi Anteriori", s: ["Tricipiti", "Deltoidi Laterali"], aliases: [] },
"Alzate laterali": { p: "Deltoidi Laterali", s: [], aliases: ["Lateral raise"] },
"Alzate frontali": { p: "Deltoidi Anteriori", s: [], aliases: ["Front raise"] },
"Alzate posteriori": { p: "Deltoidi Posteriori", s: ["Schiena (Alta/Spessore)"], aliases: ["Rear delt raise"] },
"Tirate al mento": { p: "Deltoidi Laterali", s: ["Schiena (Alta/Spessore)"], aliases: ["Upright row"] },
"Scrollate manubri": { p: "Schiena (Alta/Spessore)", s: [], aliases: ["Shrugs"] }, // Trapezio è qui ora
"Scrollate bilanciere": { p: "Schiena (Alta/Spessore)", s: [], aliases: [] },
"Face pull": { p: "Deltoidi Posteriori", s: ["Cuffia dei Rotatori", "Schiena (Alta/Spessore)"], aliases: [] },
"Extrarotazioni cavo": { p: "Cuffia dei Rotatori", s: [], aliases: [] },

// ===================== GAMBE (Quadricipiti) =====================
"Squat": { p: "Quadricipiti", s: ["Glutei", "Schiena (Bassa/Lombari)"], aliases: ["Back squat"] },
"Front squat": { p: "Quadricipiti", s: ["Glutei", "Addominali"], aliases: [] },
"Hack squat": { p: "Quadricipiti", s: [], aliases: [] },
"Leg press": { p: "Quadricipiti", s: ["Glutei"], aliases: [] },
"Affondi in camminata": { p: "Quadricipiti", s: ["Glutei"], aliases: ["Walking lunges"] },
"Affondi statici": { p: "Quadricipiti", s: ["Glutei"], aliases: ["Lunges"] },
"Step up": { p: "Quadricipiti", s: ["Glutei"], aliases: [] },
"Leg extension": { p: "Quadricipiti", s: [], aliases: [] },
"Sissy Squat": { p: "Quadricipiti", s: [], aliases: [] },

// ===================== GAMBE (Femorali/Glutei/Adduttori) =====================
"Leg curl": { p: "Femorali (Ischiocrurali)", s: [], aliases: [] },
"Leg curl sdraiato": { p: "Femorali (Ischiocrurali)", s: [], aliases: ["Lying leg curl"] },
"Leg curl seduto": { p: "Femorali (Ischiocrurali)", s: [], aliases: ["Seated leg curl"] },
"Stacco rumeno": { p: "Femorali (Ischiocrurali)", s: ["Glutei", "Schiena (Bassa/Lombari)"], aliases: ["Romanian deadlift"] },
"Hip thrust": { p: "Glutei", s: ["Femorali (Ischiocrurali)"], aliases: [] },
"Glute bridge": { p: "Glutei", s: [], aliases: [] },
"Abductor machine": { p: "Abduttori (Esterno Coscia)", s: ["Glutei"], aliases: ["Macchina abduttori"] },
"Adductor machine": { p: "Adduttori (Interno Coscia)", s: [], aliases: ["Macchina adduttori"] },

// ===================== POLPACCI =====================
"Calf raise in piedi": { p: "Polpacci", s: [], aliases: ["Standing calf raise"] },
"Calf raise seduto": { p: "Polpacci", s: [], aliases: ["Seated calf raise"] }, // Focus soleo

// ===================== BICIPITI =====================
"Curl bilanciere": { p: "Bicipiti", s: ["Avambracci"], aliases: ["Barbell curl"] },
"Curl manubri": { p: "Bicipiti", s: ["Avambracci"], aliases: ["Dumbbell curl"] },
"Curl alternato": { p: "Bicipiti", s: [], aliases: [] },
"Curl concentrato": { p: "Bicipiti", s: [], aliases: ["Concentration curl"] },
"Curl su panca inclinata": { p: "Bicipiti", s: [], aliases: ["Incline curl"] },
"Curl martello": { p: "Bicipiti", s: ["Avambracci"], aliases: ["Hammer curl"] }, // Brachioradiale è in avambracci o bicipiti, qui Bicipiti padre va bene
"Curl cavo": { p: "Bicipiti", s: [], aliases: ["Cable curl"] },
"Curl preacher": { p: "Bicipiti", s: [], aliases: ["Scott curl"] },

// ===================== TRICIPITI =====================
"French press bilanciere": { p: "Tricipiti", s: [], aliases: ["Skull crusher"] },
"French press manubri": { p: "Tricipiti", s: [], aliases: [] },
"Push down cavo": { p: "Tricipiti", s: [], aliases: ["Triceps pushdown"] },
"Estensioni sopra la testa": { p: "Tricipiti", s: [], aliases: ["Overhead triceps extension"] },
"Dip tricipiti": { p: "Tricipiti", s: ["Deltoidi Anteriori"], aliases: ["Bench dip"] },
"Kickback manubrio": { p: "Tricipiti", s: [], aliases: ["Triceps kickback"] },

// ===================== ADDOME =====================
"Crunch": { p: "Addominali", s: [], aliases: [] },
"Crunch inverso": { p: "Addominali", s: [], aliases: ["Reverse crunch"] },
"Sit up": { p: "Addominali", s: [], aliases: [] },
"Plank": { p: "Addominali", s: [], aliases: [] },
"Ab wheel": { p: "Addominali", s: ["Schiena (Bassa/Lombari)"], aliases: ["Ruota addominale"] },
"Leg raise": { p: "Addominali", s: [], aliases: ["Sollevamento gambe"] },
"Russian twist": { p: "Addominali", s: [], aliases: [] },

// ===================== FULL BODY / VARI =====================
"Burpees": { p: "Accessori & Cardio", s: [], aliases: [] },
"Kettlebell swing": { p: "Glutei", s: ["Schiena (Bassa/Lombari)", "Femorali (Ischiocrurali)"], aliases: [] },
"Farmer walk": { p: "Avambracci", s: ["Schiena (Alta/Spessore)"], aliases: ["Farmer carry"] },
"Thruster": { p: "Quadricipiti", s: ["Deltoidi Anteriori", "Tricipiti"], aliases: [] },
"Clean": { p: "Glutei", s: ["Schiena (Alta/Spessore)"], aliases: ["Power clean"] },
"Snatch": { p: "Glutei", s: ["Deltoidi Anteriori"], aliases: [] },


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
"Panca presa stretta": { p: "Tricipiti", s: ["Pettorali", "Deltoidi Anteriori"], aliases: ["Close grip bench press"] },
"Diamond push up": { p: "Tricipiti", s: ["Pettorali"], aliases: ["Flessioni a diamante"] },

// ===================== EXTRA ADDOME =====================
"Crunch al cavo": { p: "Addominali", s: [], aliases: ["Cable crunch"] },
"Plank laterale": { p: "Addominali", s: [], aliases: ["Side plank"] },
"Toe touch": { p: "Addominali", s: [], aliases: ["Tocco punte piedi"] },
"Mountain climber": { p: "Addominali", s: ["Accessori & Cardio"], aliases: [] },
"Dragon flag": { p: "Addominali", s: [], aliases: [] },

};