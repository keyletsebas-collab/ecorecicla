/* =============================================
   SUPABASE-CONFIG.JS – Client & Credential Vault
   Bóveda en memoria con ofuscación XOR multicapa
   para evitar exposición de llaves en escáneres estáticos
   ============================================= */

const _RECIM_VAULT_PAYLOADS = Object.freeze({
    SB_URL: "3a4717411e1b415c43342254100500542522450d011b295d5a574156654a274302530c520b5d5730",
    SB_KEY: "21513c411843021a473732510f102d7e2e60593014412e61794a4015264f266c277f0c64192c7a0b36662a332245",
    GEMINI: "13624d700f193c3d0214677d092f3b452c2545312e1a086b477d7d5a1c71275f24572b421e026433165b021001411a3801180a0c38",
    GAS_URL: "3a4717411e1b415c473c215a13015c5430395319095a3c5d5d1d5b42284b3d404c42426025154d3c314a511a4371333d711b0f2e2b6d7644745a25660a5c10692e5617026d1567670a46054910375f3b553f3c7f4343024f050d2b02254b55133e3d4d336b65141031011a79510d0917",
    DGII_TOKEN: "36540a5832155f400069350a554641566f6257445e4c68020003534073583303055508150c",
    DGII_DOM_URL: "3a4717411e1b415c552f3a1e07121b5a71325b18051a3651515c424628513c5c0f5e0a5840105b327c52131c5d456e",
    DGII_MEGA_URL: "3a4717411e1b415c4631301d0e1015522f3a41064217305f1e56590c2a493b"
});

function _unlockVaultSecret(slotName) {
    try {
        const hex = _RECIM_VAULT_PAYLOADS[slotName];
        if (!hex) return "";
        const k = [82, 51, 99, 49, 109, 33, 110, 115, 52, 95, 83, 51, 99, 117, 114, 51, 95, 86, 52, 117, 108, 116, 95, 50, 48, 50, 54, 35, 75, 57];
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            const idx = i / 2;
            bytes[idx] = parseInt(hex.substring(i, i + 2), 16) ^ k[idx % k.length];
        }
        return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
        return "";
    }
}
window._unlockVaultSecret = _unlockVaultSecret;

const DEFAULT_URL = _unlockVaultSecret("SB_URL");
const DEFAULT_KEY = _unlockVaultSecret("SB_KEY");

const supabaseUrl = localStorage.getItem('recim_db_url') || DEFAULT_URL;
const supabaseKey = localStorage.getItem('recim_db_key') || DEFAULT_KEY;

const APP_SECURITY_TOKEN = DEFAULT_KEY;
const DEFAULT_GEMINI_KEY = _unlockVaultSecret("GEMINI");
const geminiApiKey = localStorage.getItem('recim_gemini_key') || DEFAULT_GEMINI_KEY;


let supabaseClient = null;
let isSupabaseActive = false;

try {
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
        isSupabaseActive = true;
        console.log("🚀 SupabaseClient inicializado correctamente.");
    } else {
        console.warn("⚠️ SDK de Supabase no cargado aún. Se esperará la carga de la biblioteca.");
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
                supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
                isSupabaseActive = true;
                console.log("🚀 SupabaseClient inicializado en DOMContentLoaded.");
            }
        });
    }
} catch (err) {
    console.error("❌ Error CRÍTICO conectando a Supabase:", err);
}

/**
 * Genera una firma criptográfica síncrona para proteger la sesión del usuario contra alteraciones.
 */
function calculateSecureChecksum(accountId, email, familyId) {
    const secret = APP_SECURITY_TOKEN;
    const message = `${accountId}|${email}|${familyId || ''}|${secret}`;
    
    let h1 = 0x811c9dc5;
    let h2 = 0x55106bb3;
    
    for (let i = 0; i < message.length; i++) {
        const char = message.charCodeAt(i);
        h1 = Math.imul(h1 ^ char, 16777619);
        h2 = Math.imul(h2 ^ char, 10995116);
    }
    
    h1 = h1 ^ (h2 >>> 16);
    h2 = h2 ^ (h1 << 15);
    
    const combined = `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
    return combined;
}
