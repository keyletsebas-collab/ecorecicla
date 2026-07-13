/* =============================================
   SECURITY.JS – Anti-Cloning & Subscription Gate
   Depends on: auth.js, app.js
   ============================================= */

const SUBSCRIPTION_STATE_KEY = 'recim_subscription_state';

// Generate or retrieve persistent Device UUID (emulating IMEI check)
function getDeviceUUID() {
    let uuid = localStorage.getItem('recim_device_uuid');
    if (!uuid) {
        // Generate secure persistent random UUID
        const array = new Uint32Array(4);
        (window.crypto || window.msCrypto).getRandomValues(array);
        let hex = '';
        for (let i = 0; i < array.length; i++) {
            hex += array[i].toString(16).padStart(8, '0');
        }
        uuid = 'DEV-' + hex.substring(0, 8).toUpperCase() + '-' + hex.substring(8, 16).toUpperCase();
        localStorage.setItem('recim_device_uuid', uuid);
    }
    return uuid;
}

// Get subscription state for the logged-in user
function getSubscriptionState() {
    try {
        const local = localStorage.getItem(userKey(SUBSCRIPTION_STATE_KEY));
        if (local) return JSON.parse(local);
    } catch (e) {
        console.error("Error reading subscription state:", e);
    }
    
    // Default inactive state
    return {
        plan: null,
        status: 'inactive',
        expiresAt: 0,
        costCenter: '',
        promoCode: '',
        registeredDeviceId: '',
        trialUsed: false
    };
}

// Save subscription state
function saveSubscriptionState(state) {
    localStorage.setItem(userKey(SUBSCRIPTION_STATE_KEY), JSON.stringify(state));
    syncSubscriptionToSupabase(state);
}

// Background sync to Supabase so the landing page can read the plan and expiration
async function syncSubscriptionToSupabase(state) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    
    const sessionStr = localStorage.getItem('recim_session');
    if (!sessionStr) return;
    
    try {
        const session = JSON.parse(sessionStr);
        if (!session.accountId) return;

        // Save username alongside Device ID: "Name | DEV:Device-UUID"
        const cleanName = (session.name || 'Usuario').split(' | ')[0].trim();
        const newFormattedName = `${cleanName} | DEV:${getDeviceUUID()}`;

        const { error } = await supabaseClient
            .from('profiles')
            .update({ name: newFormattedName })
            .eq('id', session.accountId);
            
        if (error) console.error("Error syncing subscription to Supabase:", error);
    } catch (e) {
        console.error("Failed to parse session for Supabase sync:", e);
    }
}

// Verify if the active device matches and subscription is active
function verifyDeviceAndSubscription() {
    const sessionStr = localStorage.getItem('recim_session');
    if (!sessionStr) {
        return { success: true }; // Not logged in, no lock needed
    }

    const currentDeviceUuid = getDeviceUUID();
    const state = getSubscriptionState();

    // 1. Anti-Cloning Lock
    // If no device is registered yet for this account, link it now
    if (!state.registeredDeviceId) {
        state.registeredDeviceId = currentDeviceUuid;
        saveSubscriptionState(state);
    } else if (state.registeredDeviceId !== currentDeviceUuid) {
        return {
            success: false,
            reason: 'device_cloned',
            registered: state.registeredDeviceId,
            current: currentDeviceUuid
        };
    }

    // --- ARCHIVED PAYMENT SYSTEM ---
    // The payment requirement has been temporarily bypassed for sales/demonstrations.
    // To re-enable the paywall, simply uncomment the Expiration Lock below.
    return { success: true };

    /*
    // 2. Expiration Lock
    const isLifetime = state.expiresAt === 'lifetime';
    const isExpired = !isLifetime && (Date.now() > state.expiresAt);

    if (!state.plan || isExpired) {
        return {
            success: false,
            reason: 'subscription_expired',
            state: state
        };
    }

    return { success: true };
    */
}

// Render unclosable security screens if verification fails
function checkSubscriptionAndDevice() {
    // Remove any old overlay
    const oldOverlay = document.getElementById('security-guard-overlay');
    if (oldOverlay) oldOverlay.remove();

    const verification = verifyDeviceAndSubscription();
    if (verification.success) {
        return; // All good, let the user in
    }

    // Block application access
    const overlay = document.createElement('div');
    overlay.id = 'security-guard-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = '#060907';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.fontFamily = "'Inter', sans-serif";
    overlay.style.color = '#f8fafc';
    overlay.style.overflowY = 'auto';
    overlay.style.padding = '20px';

    if (verification.reason === 'device_cloned') {
        renderClonedLock(overlay, verification);
    } else {
        renderPaywallLock(overlay);
    }

    document.body.appendChild(overlay);
}

// Opens the paywall manually allowing the user to apply codes or buy a new plan
window.forceOpenPaywall = function() {
    const oldOverlay = document.getElementById('security-guard-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'security-guard-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = '#060907';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.fontFamily = "'Inter', sans-serif";
    overlay.style.color = '#f8fafc';
    overlay.style.overflowY = 'auto';
    overlay.style.padding = '20px';

    renderPaywallLock(overlay);

    // Add a close button since this is opened voluntarily
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕ Cancelar';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '20px';
    closeBtn.style.background = 'rgba(255,255,255,0.1)';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = '1px solid rgba(255,255,255,0.2)';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.zIndex = '100000';
    closeBtn.onclick = () => overlay.remove();
    
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
};

// Render Anti-Cloning Device Lock Screen
function renderClonedLock(container, verification) {
    container.innerHTML = `
        <div style="background: rgba(22, 13, 13, 0.85); backdrop-filter: blur(20px); border: 2px solid #ef4444; border-radius: 20px; box-shadow: 0 0 30px rgba(239, 68, 68, 0.25); max-width: 440px; width: 100%; padding: 30px; text-align: center;">
            <span style="font-size: 4rem; display: block; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(239,68,68,0.5));">⚠️</span>
            <h2 style="font-size: 1.4rem; font-weight: 800; text-transform: uppercase; color: #ef4444; letter-spacing: 0.05em; margin-bottom: 12px; font-family:'Outfit', sans-serif;">Dispositivo no Autorizado</h2>
            <p style="font-size: 0.88rem; color: #cbd5e1; line-height: 1.5; margin-bottom: 24px;">
                Para garantizar la seguridad y evitar la <b>clonación de cuentas</b>, tu licencia de <b>Reciminsaap</b> está vinculada de forma exclusiva a otro dispositivo móvil.
            </p>
            
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; text-align: left; font-family: monospace; font-size: 0.75rem; margin-bottom: 24px;">
                <div style="margin-bottom: 8px; color: #94a3b8;">DISPOSITIVO REGISTRADO (Firma):</div>
                <div style="color: #ef4444; font-weight: bold; overflow-wrap: break-word;">${verification.registered}</div>
                <div style="margin: 12px 0 8px 0; color: #94a3b8;">DISPOSITIVO ACTUAL (Firma):</div>
                <div style="color: #fbbf24; font-weight: bold; overflow-wrap: break-word;">${verification.current}</div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
                <button onclick="resetRegisteredDeviceForTesting()" style="background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; border: none; border-radius: 8px; padding: 12px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: transform 0.2s;">
                    🔄 Restablecer Dispositivo Registrado
                </button>
                <button onclick="handleLogout()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 8px; padding: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">
                    🚪 Cerrar Sesión
                </button>
            </div>
        </div>
    `;
}

// Allows testing deactivation
function resetRegisteredDeviceForTesting() {
    const confirmation = confirm("¿Deseas revincular esta cuenta a este dispositivo?\n\nEsto desvinculará el dispositivo anterior.");
    if (!confirmation) return;

    const state = getSubscriptionState();
    state.registeredDeviceId = getDeviceUUID();
    saveSubscriptionState(state);

    window.location.reload();
}

// Prices structure
const BASE_PLANS = {
    mensual:  { id: 'mensual',  name: 'Plan Mensual (30 Días)', price: 2046.49,  days: 30,  sub: 'Facturación flexible' },
    anual:    { id: 'anual',    name: 'Plan Anual (1 Año)',     price: 5000, days: 365, sub: 'Ahorra más del 20%' },
    lifetime: { id: 'lifetime', name: 'Plan De Por Vida',       price: 9000, days: -1,  sub: 'Acceso ilimitado' }
};

let activeSelectedPlanId = 'mensual';
let currentAppliedDiscount = 0; // percentage
let validatedPromoCode = '';
let validatedTrialDays = 0;

let paypalInitialized = false;

// Render Netflix-style Paywall Lock Screen
function renderPaywallLock(container) {
    const state = getSubscriptionState();
    
    // Build plans HTML
    const plansHtml = Object.values(BASE_PLANS).map(p => {
        const isSelected = p.id === activeSelectedPlanId;
        const discountedPrice = Math.round(p.price * (1 - currentAppliedDiscount / 100));
        const priceLabel = p.days === -1 
            ? `RD$ ${discountedPrice.toLocaleString()}` 
            : `RD$ ${discountedPrice.toLocaleString()} / ${p.days === 30 ? 'mes' : 'año'}`;
        
        const originalPrice = currentAppliedDiscount > 0 
            ? `<span style="text-decoration: line-through; color: #ef4444; font-size:0.75rem; display:block; margin-bottom: 2px;">RD$ ${p.price.toLocaleString()}</span>` 
            : '';

        return `
            <div onclick="selectPaywallPlan('${p.id}')" style="flex:1; min-width: 150px; background: ${isSelected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)'}; border: 2px solid ${isSelected ? '#10b981' : 'rgba(255,255,255,0.05)'}; border-radius: 14px; padding: 18px 15px; cursor: pointer; transition: all 0.2s; text-align:center; position:relative;">
                ${isSelected ? '<span style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:#10b981; color:black; font-size:0.6rem; font-weight:800; padding:2px 8px; border-radius:8px; text-transform:uppercase;">Seleccionado</span>' : ''}
                <strong style="font-size:0.85rem; color:white; display:block; margin-bottom:4px; font-family:'Outfit', sans-serif;">${p.name}</strong>
                <span style="font-size:0.68rem; color:#94a3b8; display:block; margin-bottom:12px;">${p.sub}</span>
                ${originalPrice}
                <strong style="font-size:1.15rem; color: #10b981; font-family: monospace;">${priceLabel}</strong>
            </div>
        `;
    }).join('');

    const trialActiveMsg = validatedTrialDays > 0 
        ? `<div style="background: rgba(6, 182, 212, 0.1); border:1px solid #06b6d4; color:#22d3ee; padding: 8px 12px; border-radius:8px; font-size:0.75rem; text-align:center; margin-bottom:15px; font-weight:700;">🎁 Código Promocional: Prueba Gratuita de ${validatedTrialDays} Días Activa (RD$ 0.00)</div>`
        : '';

    // Show 10-day trial button if not used yet
    const showTrialButton = !state.trialUsed;
    const trialButtonHtml = showTrialButton 
        ? `<button onclick="activate10DayFreeTrial()" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); color: white; border: none; border-radius: 8px; padding: 12px 20px; font-size: 0.85rem; font-weight: 700; cursor: pointer; display:flex; align-items:center; gap:6px; transition: transform 0.2s;">
            🎁 Iniciar Prueba Gratuita (10 Días)
           </button>`
        : '';

    // Rendered Container
    container.innerHTML = `
        <div style="background: rgba(13, 20, 15, 0.9); backdrop-filter: blur(25px); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 24px; box-shadow: 0 0 40px rgba(16, 185, 129, 0.1); max-width: 600px; width: 100%; padding: 35px 25px; display:flex; flex-direction:column; gap:20px;">
            
            <!-- Paywall Header -->
            <div style="text-align:center; margin-bottom:5px;">
                <div style="width: 50px; height: 50px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: black; margin: 0 auto 12px; font-weight:800; box-shadow:0 0 15px rgba(16,185,129,0.3);">♻️</div>
                <h2 style="font-family:'Outfit', sans-serif; font-size:1.5rem; font-weight:800; margin:0;">Reciminsaap Premium</h2>
                <p style="color:#94a3b8; font-size:0.8rem; margin-top:4px;">Activa tu plan de suscripción para acceder a la facturación y bitácoras del sistema.</p>
            </div>

            <!-- Paywall Plans -->
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                ${plansHtml}
            </div>

            ${trialActiveMsg}

            <!-- Promo Code Form -->
            <div style="display:flex; flex-direction:column; gap:12px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.03); border-radius:14px; padding:16px;">
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <!-- Promo Code Input -->
                    <div style="flex:1; min-width: 200px; display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:0.65rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Código de Descuento / Prueba</label>
                        <div style="display:flex; gap:8px;">
                            <input id="paywall-promo-code" type="text" placeholder="TRIAL30, DESCUENTO50..." style="flex:1; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:white; padding:10px; border-radius:8px; font-size:0.8rem; outline:none; text-transform:uppercase;" value="${validatedPromoCode}" />
                            <button onclick="validatePaywallPromoCode()" style="background:#10b981; color:black; border:none; padding: 0 14px; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">
                                Validar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PayPal Smart Buttons Container -->
            <div id="paypal-buttons-wrapper" style="display:flex; flex-direction:column; gap:8px;">
                <label style="font-size:0.65rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 2px;">Método de Pago Seguro (PayPal, Tarjeta o Google Pay)</label>
                <div id="paypal-button-container" style="width:100%; min-height: 100px;"></div>
                <div style="text-align: center; color: #64748b; font-size: 0.7rem; font-weight: 500; margin-top: -5px;">Desarrollado por Reciminsa studio</div>
            </div>

            <!-- Footer Action Buttons -->
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:18px; flex-wrap:wrap; gap:12px;">
                <button onclick="handleLogout()" style="background:transparent; border:none; color:#cbd5e1; font-weight:600; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                    🚪 Cerrar Sesión
                </button>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${trialButtonHtml}
                </div>
            </div>
        </div>
    `;

    // Render PayPal Buttons dynamically
    paypalInitialized = false;
    setTimeout(() => initPayPalButtons(), 100);
}

function selectPaywallPlan(planId) {
    activeSelectedPlanId = planId;
    const overlay = document.getElementById('security-guard-overlay');
    if (overlay) renderPaywallLock(overlay);
}

// Dynamically load PayPal Script and render buttons
function initPayPalButtons() {
    const container = document.getElementById('paypal-button-container');
    if (!container) return;

    loadPayPalScript(() => {
        if (paypalInitialized) return;
        paypalInitialized = true;

        container.innerHTML = '';
        
        paypal.Buttons({
            createOrder: function(data, actions) {
                const selectedPlan = BASE_PLANS[activeSelectedPlanId];
                // Apply promo discounts
                const finalPriceRD = selectedPlan.price * (1 - currentAppliedDiscount / 100);
                
                // Convert to exact USD amount based on user's exact specifications
                // 2046.49 RD$ -> 35.00 USD
                // 5000.00 RD$ -> 85.51 USD
                // 9000.00 RD$ -> 153.92 USD
                // Exchange rate is approximately 58.4711
                const priceUSD = (finalPriceRD / 58.4711).toFixed(2);

                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            value: priceUSD
                        },
                        description: `Suscripción Reciminsaap: ${selectedPlan.name}`
                    }]
                });
            },
            onApprove: function(data, actions) {
                return actions.order.capture().then(function(details) {
                    const selectedPlan = BASE_PLANS[activeSelectedPlanId];
                    let expiresAt = 0;
                    
                    if (selectedPlan.days === -1) {
                        expiresAt = 'lifetime';
                    } else {
                        expiresAt = Date.now() + (selectedPlan.days * 24 * 60 * 60 * 1000);
                    }

                    const state = getSubscriptionState();
                    const updatedState = {
                        ...state,
                        plan: activeSelectedPlanId,
                        status: 'active',
                        expiresAt: expiresAt,
                        costCenter: 'Principal',
                        promoCode: validatedPromoCode || 'Ninguno',
                        registeredDeviceId: getDeviceUUID(),
                        paymentDetails: {
                            orderID: data.orderID,
                            payerEmail: details.payer.email_address,
                            payerName: details.payer.name.given_name
                        }
                    };

                    saveSubscriptionState(updatedState);
                    
                    // Mark promo code as used if one was applied
                    if (validatedPromoCode) {
                        const promoCodes = getPromoCodesList();
                        const match = promoCodes.find(p => p.code === validatedPromoCode);
                        if (match) {
                            match.used = true;
                            localStorage.setItem('recim_promo_codes', JSON.stringify(promoCodes));
                        }
                    }
                    
                    // Dispatch welcome subscription email in background
                    sendSubscriptionEmailNotification(updatedState);

                    const overlay = document.getElementById('security-guard-overlay');
                    if (overlay) overlay.remove();

                    showToast('✨ Pago completado con éxito. ¡Licencia activada!', 'success');
                    window.location.reload();
                });
            },
            onError: function(err) {
                console.error("PayPal button error:", err);
                showToast("❌ Error al procesar pago. Verifica los datos de tu tarjeta/cuenta.", "error");
            }
        }).render('#paypal-button-container');
    });
}

// Dynamically load PayPal Script tag
function loadPayPalScript(callback) {
    if (window.paypal) {
        callback();
        return;
    }

    const scriptId = 'paypal-sdk-script';
    let script = document.getElementById(scriptId);
    
    if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://www.paypal.com/sdk/js?client-id=test&currency=USD';
        script.onload = () => callback();
        script.onerror = () => showToast("❌ Error al cargar pasarela de pagos PayPal.", "error");
        document.head.appendChild(script);
    } else {
        script.onload = () => callback();
    }
}

// Activate 10-day free trial immediately
function activate10DayFreeTrial() {
    const state = getSubscriptionState();
    if (state.trialUsed) {
        showToast('❌ Ya has utilizado el periodo de prueba gratuito.', 'error');
        return;
    }

    const expiresAt = Date.now() + (10 * 24 * 60 * 60 * 1000); // 10 days duration

    const updatedState = {
        ...state,
        plan: 'trial_10d',
        status: 'trial',
        expiresAt,
        costCenter: 'Prueba de 10 Días',
        promoCode: 'TRIAL10D',
        registeredDeviceId: getDeviceUUID(),
        trialUsed: true
    };

    saveSubscriptionState(updatedState);
    
    // Dispatch welcome email
    sendSubscriptionEmailNotification(updatedState);

    const overlay = document.getElementById('security-guard-overlay');
    if (overlay) overlay.remove();

    showToast('🎁 ¡Periodo de prueba de 10 días activado con éxito!', 'success');
    window.location.reload();
}

// Get custom generated promo codes list from shared localStorage
function getPromoCodesList() {
    try {
        const local = localStorage.getItem('recim_promo_codes');
        if (local) return JSON.parse(local);
    } catch (e) {}
    
    // Fallback default codes
    return [
        { id: 'c1', code: 'TRIAL30', type: 'trial', value: 30 },
        { id: 'c2', code: 'FREE90', type: 'trial', value: 90 },
        { id: 'c3', code: 'DESCUENTO50', type: 'discount', value: 50 },
        { id: 'c4', code: 'LIFETIME100', type: 'trial', value: 99999 }
    ];
}

// Validates the entered promo code and applies the corresponding benefits
function validatePaywallPromoCode() {
    const codeEl = document.getElementById('paywall-promo-code');
    if (!codeEl) return;

    const inputCode = codeEl.value.trim().toUpperCase();
    if (!inputCode) {
        showToast('❌ Por favor introduce un código.', 'error');
        return;
    }

    const promoCodes = getPromoCodesList();
    const match = promoCodes.find(p => p.code === inputCode);

    if (!match) {
        showToast('❌ Código promocional inválido o expirado.', 'error');
        currentAppliedDiscount = 0;
        validatedPromoCode = '';
        validatedTrialDays = 0;
    } else if (match.used) {
        showToast('❌ Este código ya ha sido utilizado.', 'error');
        return;
    } else {
        validatedPromoCode = match.code;
        if (match.type === 'trial') {
            validatedTrialDays = match.value;
            currentAppliedDiscount = 0;
            showToast(`🎁 Código Válido: ¡Prueba de ${match.value >= 9999 ? 'De Por Vida' : match.value + ' días'} activada!`, 'success');
            
            // Mark as used immediately for 100% free codes
            match.used = true;
            localStorage.setItem('recim_promo_codes', JSON.stringify(promoCodes));

            activateTrialFromPromoCode(match.value, match.code);
            return;
        } else {
            currentAppliedDiscount = match.value;
            validatedTrialDays = 0;
            showToast(`💰 Código Válido: ¡Descuento de ${match.value}% aplicado! Completa el pago abajo.`, 'success');
        }
    }

    const overlay = document.getElementById('security-guard-overlay');
    if (overlay) renderPaywallLock(overlay);
}

// Activates a trial/lifetime subscription directly from a promo code
function activateTrialFromPromoCode(days, codeStr) {
    const state = getSubscriptionState();
    let expiresAt = 0;
    
    if (days >= 9999) {
        expiresAt = 'lifetime';
    } else {
        expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
    }

    const updatedState = {
        ...state,
        plan: days >= 9999 ? 'lifetime' : 'trial_code',
        status: 'active',
        expiresAt,
        costCenter: 'Activación por Código',
        promoCode: codeStr,
        registeredDeviceId: getDeviceUUID()
    };

    saveSubscriptionState(updatedState);
    sendSubscriptionEmailNotification(updatedState);

    const overlay = document.getElementById('security-guard-overlay');
    if (overlay) overlay.remove();

    showToast('✨ ¡Licencia activada mediante código promocional con éxito!', 'success');
    setTimeout(() => window.location.reload(), 2000);
}

// Sends an email notification through Google Apps Script detailing the license plan activated
async function sendSubscriptionEmailNotification(state) {
    const sessionStr = localStorage.getItem('recim_session');
    if (!sessionStr) return;

    try {
        const session = JSON.parse(sessionStr);
        const userEmail = session.email;
        const userName = session.name || 'Usuario';
        
        if (!userEmail) return;

        const scriptUrl = 'https://script.google.com/macros/s/AKfycbxYHnE-4KnXCqd-l3MWNKtQ3_HU-Fz6GNsNhf05loH0pfvJTXxbwujAC21OvLZddvSI/exec';
        
        let planLabel = state.plan === 'trial_10d' ? 'Prueba Gratuita (10 Días)' : (BASE_PLANS[state.plan]?.name || state.plan);
        let expiresText = state.expiresAt === 'lifetime' ? 'De Por Vida (Acceso Ilimitado)' : new Date(state.expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

        const payload = {
            appToken: APP_SECURITY_TOKEN,
            action: 'email',
            to: userEmail,
            subject: '🔔 Licencia de Reciminsaap Premium Activada',
            htmlBody: `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 25px; text-align: center;">
                  <h2 style="color: white; margin: 0; font-size: 20px;">🎉 ¡Licencia Activada con Éxito!</h2>
                </div>
                <div style="padding: 25px;">
                  <p style="font-size: 16px; margin: 0 0 15px 0;">Hola <strong>${userName}</strong>,</p>
                  <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0 0 20px 0;">Queremos informarte que la licencia premium para tu cuenta de <strong>Reciminsaap</strong> ha sido activada en tu dispositivo. A continuación, te compartimos los detalles de tu plan:</p>
                  
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px 0; font-size: 14px; color: #64748b; font-weight: bold;">Plan Contratado:</td>
                      <td style="padding: 8px 0; font-size: 14px; color: #0f172a; font-weight: bold; text-align: right;">${planLabel}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px 0; font-size: 14px; color: #64748b; font-weight: bold;">Centro de Costos:</td>
                      <td style="padding: 8px 0; font-size: 14px; color: #0f172a; font-family: monospace; text-align: right;">${state.costCenter}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px 0; font-size: 14px; color: #64748b; font-weight: bold;">Vencimiento:</td>
                      <td style="padding: 8px 0; font-size: 14px; color: #10b981; font-weight: bold; text-align: right;">${expiresText}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px 0; font-size: 14px; color: #64748b; font-weight: bold;">Firma del Dispositivo:</td>
                      <td style="padding: 8px 0; font-size: 12px; color: #64748b; font-family: monospace; text-align: right; overflow-wrap: break-word; max-width: 250px;">${state.registeredDeviceId}</td>
                    </tr>
                  </table>
                  
                  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Importante:</strong> Esta licencia está vinculada a este dispositivo físico mediante verificación anti-clonación. No intentes iniciar sesión desde otro terminal sin antes desvincular esta cuenta en la sección de Ajustes.</p>
                  </div>
                  
                  <p style="font-size: 14px; color: #475569; margin: 0;">Gracias por formar parte de la red de economía circular de Reciminsa.</p>
                </div>
                <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
                  <p style="margin: 0;">Este es un correo de notificación automática enviado por Reciminsa App.</p>
                </div>
              </div>
            `,
            textBody: `Hola ${userName},\n\nTu suscripción premium a Reciminsaap ha sido activada con éxito.\n\nDetalles:\n- Plan: ${planLabel}\n- Centro de Costos: ${state.costCenter}\n- Vencimiento: ${expiresText}\n- Firma Dispositivo: ${state.registeredDeviceId}\n\nGracias por utilizar Reciminsa App.`
        };

        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        console.log("Subscription email notification sent to", userEmail);
    } catch(e) {
        console.error("Failed to send subscription confirmation email:", e);
    }
}
