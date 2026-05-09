// ═══════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION — Project D.R.O.P.
// ═══════════════════════════════════════════════════════
//
//  🔧 HOW TO FILL THIS IN:
//  1. Go to https://console.firebase.google.com
//  2. Select your project → click the gear icon → Project Settings
//  3. Scroll to "Your apps" → click your Web app (</>)
//  4. Copy the firebaseConfig block and paste the values below
//
const firebaseConfig = {
    apiKey: "AIzaSyA6fIzONckvCrbpGNCpNGOXiUL1B4F5p9k",
    authDomain: "project-drop-3684a.firebaseapp.com",
    databaseURL: "https://project-drop-3684a-default-rtdb.firebaseio.com",
    projectId: "project-drop-3684a",
    storageBucket: "project-drop-3684a.firebasestorage.app",
    messagingSenderId: "309750061847",
    appId: "1:309750061847:web:b7797348627abfe322b6bf",
    measurementId: "G-CKRLS022G0"
};

// ───────────────────────────────────────────────────────
//  DATABASE PATH — where your ESP32 writes sensor data
//  Change this to match the path in your Firebase database
// ───────────────────────────────────────────────────────
const DB_PATH = '/irrigation/latest';

// ───────────────────────────────────────────────────────
//  FIELD NAMES — exact field names your ESP32 uses
//  e.g. if your ESP32 writes { temp: 28, hum: 65, soil: 42 }
//  change the values below to match
// ───────────────────────────────────────────────────────
const FIELD_NAMES = {
    temperature:      'temperatureC',        // air temperature in °C
    humidity:         'humidity',            // air humidity in %
    soilMoisture:     'soilMoisturePercent', // soil moisture 0–100% (pre-calculated by ESP32)
    pumpOn:           'pumpOn',              // boolean — is pump running?
    waterLevelPct:    'waterLevelPercent',   // water tank level 0–100%
};
