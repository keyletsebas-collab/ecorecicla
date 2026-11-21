/* =========================================================================
   STORAGE-ENGINE.JS – Motor Escalable (IndexedDB Mirror + Supabase Storage)
   Respalda colecciones pesadas en IndexedDB y sube logos/activos a
   Supabase Storage ('company-assets') con fallback automático local/inline.
   ========================================================================= */

(function initStorageEngine() {
    const DB_NAME = 'ReciminsaScalableDB';
    const DB_VERSION = 1;
    const HEAVY_KEYS = [
        'recim_invoices',
        'recim_quotes',
        'recim_audit_logs',
        'recim_pickup_routes',
        'recim_eco_certificates',
        'recim_clients',
        'recim_material_codes',
        'recim_company_shared_settings'
    ];
    const LOGO_MODE_KEY = 'recim_logo_storage_mode';

    let _dbPromise = null;
    const _mirroredKeys = new Set();

    function _hasIndexedDb() {
        return typeof indexedDB !== 'undefined' && indexedDB && typeof indexedDB.open === 'function';
    }

    function _openDb() {
        if (!_hasIndexedDb()) return Promise.resolve(null);
        if (_dbPromise) return _dbPromise;

        _dbPromise = new Promise((resolve) => {
            try {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (ev) => {
                    const db = ev.target.result;
                    if (!db.objectStoreNames.contains('collections')) {
                        db.createObjectStore('collections', { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains('assets')) {
                        db.createObjectStore('assets', { keyPath: 'key' });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        });
        return _dbPromise;
    }

    function _isHeavyKey(fullKey) {
        if (!fullKey || typeof fullKey !== 'string') return false;
        return HEAVY_KEYS.some(hk => fullKey === hk || fullKey.startsWith(`${hk}_`));
    }

    async function mirrorKey(fullKey, rawValue) {
        if (!_isHeavyKey(fullKey)) return false;
        _mirroredKeys.add(fullKey);

        const db = await _openDb();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction('collections', 'readwrite');
                const store = tx.objectStore('collections');
                store.put({
                    key: fullKey,
                    value: typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? ''),
                    updatedAt: Date.now()
                });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (_) {
                resolve(false);
            }
        });
    }

    async function readMirroredKey(fullKey) {
        const db = await _openDb();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction('collections', 'readonly');
                const store = tx.objectStore('collections');
                const req = store.get(fullKey);
                req.onsuccess = () => resolve(req.result ? req.result.value : null);
                req.onerror = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        });
    }

    async function saveAsset(assetKey, dataUrl) {
        if (!assetKey || !dataUrl) return false;
        const db = await _openDb();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction('assets', 'readwrite');
                const store = tx.objectStore('assets');
                store.put({ key: assetKey, dataUrl, updatedAt: Date.now() });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (_) {
                resolve(false);
            }
        });
    }

    async function getAsset(assetKey) {
        const db = await _openDb();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction('assets', 'readonly');
                const store = tx.objectStore('assets');
                const req = store.get(assetKey);
                req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
                req.onerror = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        });
    }

    function _parseDataUrl(dataUrl) {
        const match = /^data:(image\/(?:png|webp|jpeg|jpg));base64,(.+)$/i.exec(String(dataUrl || '').trim());
        if (!match) return null;
        const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
        const ext = mime === 'image/webp' ? 'webp' : (mime === 'image/jpeg' ? 'jpg' : 'png');
        const b64 = match[2];

        let bytes;
        if (typeof atob === 'function') {
            const bin = atob(b64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else if (typeof Buffer !== 'undefined') {
            bytes = new Uint8Array(Buffer.from(b64, 'base64'));
        } else {
            return null;
        }

        const body = typeof Blob !== 'undefined' ? new Blob([bytes], { type: mime }) : bytes;
        return { mime, ext, bytes, body };
    }

    async function uploadCompanyLogoToStorage(dataUrl, dbId) {
        if (!dataUrl || !dbId) {
            return { ok: false, mode: 'inline_fallback', publicUrl: '', dataUrl: dataUrl || '' };
        }

        await saveAsset(`logo_${dbId}`, dataUrl);

        const sbActive = (typeof isSupabaseActive !== 'undefined' && isSupabaseActive) || Boolean(window.isSupabaseActive);
        const sbClient = (typeof supabaseClient !== 'undefined' && supabaseClient) || window.supabaseClient;
        const online = typeof navigator === 'undefined' || navigator.onLine !== false;
        const parsed = _parseDataUrl(dataUrl);

        if (!sbActive || !sbClient || !sbClient.storage || !online || !parsed) {
            try { localStorage.setItem(LOGO_MODE_KEY, 'local_inline'); } catch (_) {}
            return { ok: false, mode: 'inline_fallback', publicUrl: '', dataUrl };
        }

        try {
            const objectPath = `${String(dbId).replace(/[^a-zA-Z0-9_-]/g, '_')}/company-logo.${parsed.ext}`;
            const bucket = sbClient.storage.from('company-assets');
            const { error: uploadErr } = await bucket.upload(objectPath, parsed.body, {
                upsert: true,
                contentType: parsed.mime
            });
            if (uploadErr) throw uploadErr;

            const urlResult = bucket.getPublicUrl(objectPath);
            const rawPublicUrl = urlResult?.data?.publicUrl || '';
            if (!rawPublicUrl) throw new Error('Missing Storage public URL');

            const versionedUrl = `${rawPublicUrl}${rawPublicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
            try { localStorage.setItem(LOGO_MODE_KEY, 'storage'); } catch (_) {}
            return { ok: true, mode: 'storage', publicUrl: versionedUrl, dataUrl };
        } catch (err) {
            console.warn('Supabase Storage upload fallback a logo inline:', err?.message || err);
            try { localStorage.setItem(LOGO_MODE_KEY, 'local_inline'); } catch (_) {}
            return { ok: false, mode: 'inline_fallback', publicUrl: '', dataUrl };
        }
    }

    function getStorageHealth() {
        let totalChars = 0;
        let lsKeys = 0;
        let logoMode = 'local_inline';

        try {
            logoMode = localStorage.getItem(LOGO_MODE_KEY) || 'local_inline';
            if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
                lsKeys = localStorage.length;
                for (let i = 0; i < lsKeys; i++) {
                    const k = localStorage.key(i);
                    const v = k ? localStorage.getItem(k) : '';
                    totalChars += (k ? k.length : 0) + (v ? v.length : 0);
                }
            }
        } catch (_) {}

        const limitKb = 5120;
        const localKb = Number(((totalChars * 2) / 1024).toFixed(1));
        const localPctOf5Mb = Math.min(100, Number(((localKb / limitKb) * 100).toFixed(1)));

        return {
            localKb,
            limitKb,
            localPctOf5Mb,
            lsKeys,
            indexedDBAvailable: _hasIndexedDb(),
            mirroredCount: _mirroredKeys.size,
            logoMode
        };
    }

    if (typeof window !== 'undefined') {
        window.StorageEngine = {
            HEAVY_KEYS,
            mirrorKey,
            readMirroredKey,
            saveAsset,
            getAsset,
            uploadCompanyLogoToStorage,
            getStorageHealth
        };
    }
})();
