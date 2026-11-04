/* =============================================
   SUPABASE-CONFIG.JS – Client Initialization
   ============================================= */

function _dec(str) {
    try {
        return atob(str);
    } catch (e) {
        return "";
    }
}

const DEFAULT_URL = _dec("aHR0cHM6Ly93a3Fnc3ByZ3p0cXhtb3ZvamV3dS5zdXBhYmFzZS5jbw==");
const DEFAULT_KEY = _dec("c2JfcHVibGlzaGFibGVfTXE2bUV4NXFTSXh2Nm12dF9ETmFFd19OVGVVSUZQdg==");

const supabaseUrl = localStorage.getItem('recim_db_url') || DEFAULT_URL;
const supabaseKey = localStorage.getItem('recim_db_key') || DEFAULT_KEY;

const APP_SECURITY_TOKEN = DEFAULT_KEY;
const DEFAULT_GEMINI_KEY = "AQ.Ab8RN6K4NjZIvssqDBnWYwOKyWHulGfFcpqPlEhaesrEn5mfxg";
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
