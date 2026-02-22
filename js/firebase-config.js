/* =============================================
   FIREBASE-CONFIG.JS – Manual Initialization
   ============================================= */

const firebaseConfig = {
    apiKey: "AIzaSyA_hF1PTodhEdV80_YiMBZwewaHQpS1iE4",
    authDomain: "reciminsa-app.firebaseapp.com",
    databaseURL: "https://reciminsa-app-default-rtdb.firebaseio.com",
    projectId: "reciminsa-app",
    storageBucket: "reciminsa-app.firebasestorage.app",
    messagingSenderId: "869141401027",
    appId: "1:869141401027:web:1be2255e14e134bb48c176",
    measurementId: "G-BKLM9CV9V7"
};

let db = null;
let isFirebaseActive = false;

try {
    // Inicialización manual para compatibilidad con Vercel/Local
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
    isFirebaseActive = true;
    console.log("🚀 Firebase conectado correctamente a:", firebaseConfig.databaseURL);

    // Prueba de conexión silenciosa
    db.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            console.log("📡 Conexión activa con Realtime Database");
        } else {
            console.warn("📡 Buscando conexión con Firebase...");
        }
    });
} catch (err) {
    console.error("❌ Error CRÍTICO conectando a Firebase:", err);
    console.warn("ℹ️ Revisa que las URLs y claves en js/firebase-config.js sean correctas.");
}
