/* ==========================================================================
   CHATBOT JS - LOGIC & API INTEGRATION - RECIMINSA AP
   ========================================================================== */

const CHATBOT_API_CONFIG = {
    // Si la aplicación corre en el mismo servidor Express (desarrollo, producción o puerto 3000 local),
    // usamos una ruta relativa para evitar bloqueos de CORS originados por el proxy de Google.
    url: (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '')
        ? 'https://ais-dev-5k7wdeb3wqrnmmvqjon4ln-495880864325.us-east1.run.app/api/chat'
        : '/api/chat',
    key: ''  // No se requiere API Key para este endpoint
};

// Historial en memoria durante la sesión
let chatbotHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    // Esperamos un momento para asegurar que el app-screen esté en el DOM
    setTimeout(initChatbot, 500);
});

function initChatbot() {
    const appScreen = document.getElementById('app-screen');
    if (!appScreen) return;

    // Verificar si ya existe en el DOM para evitar duplicados
    if (document.getElementById('chatbot-fab')) return;

    // Inyectar el botón FAB flotante
    const fabButton = document.createElement('button');
    fabButton.id = 'chatbot-fab';
    fabButton.className = 'chatbot-fab';
    fabButton.title = 'Preguntar al asistente';
    fabButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <circle cx="9" cy="10" r="1.5"></circle>
            <circle cx="15" cy="10" r="1.5"></circle>
            <path d="M9 14h6"></path>
        </svg>
    `;
    appScreen.appendChild(fabButton);

    // Inyectar la ventana de chat
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chatbot-window';
    chatWindow.className = 'chatbot-window';
    chatWindow.innerHTML = `
        <div class="chatbot-header">
            <div class="chatbot-title">
                <div class="chatbot-status-dot"></div>
                <span>ReciBot AI</span>
            </div>
            <button id="chatbot-close" class="chatbot-close" title="Cerrar chat">✕</button>
        </div>
        <div id="chatbot-messages" class="chatbot-messages"></div>
        <form id="chatbot-form" class="chatbot-footer">
            <input type="text" id="chatbot-input" class="chatbot-input" placeholder="Pregunta algo sobre la app..." autocomplete="off" required>
            <button type="submit" class="chatbot-send" title="Enviar mensaje">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </form>
    `;
    appScreen.appendChild(chatWindow);

    // Event Listeners
    fabButton.addEventListener('click', toggleChatbot);
    document.getElementById('chatbot-close').addEventListener('click', toggleChatbot);
    document.getElementById('chatbot-form').addEventListener('submit', handleChatSubmit);

    // Agregar mensaje inicial de bienvenida
    addWelcomeMessage();
}

function toggleChatbot() {
    const chatWindow = document.getElementById('chatbot-window');
    if (!chatWindow) return;
    
    chatWindow.classList.toggle('open');
    
    if (chatWindow.classList.contains('open')) {
        const input = document.getElementById('chatbot-input');
        if (input) input.focus();
        scrollToBottom();
    }
}

function addWelcomeMessage() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer || messagesContainer.children.length > 0) return;

    appendMessage('bot', '¡Hola! Soy ReciBot, tu asistente inteligente para Reciminsa App. 🤖\n\n¿En qué puedo ayudarte hoy? Puedes preguntarme sobre cómo registrar facturas, crear bitácoras, consultar ingresos o el impacto ecológico de tus materiales.');
}

function appendMessage(sender, text) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const messageBubble = document.createElement('div');
    messageBubble.className = `chatbot-msg chatbot-msg--${sender}`;
    messageBubble.textContent = text;
    messagesContainer.appendChild(messageBubble);
    
    // Guardar en el historial local
    chatbotHistory.push({ sender, text });
    
    scrollToBottom();
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const indicator = document.createElement('div');
    indicator.id = 'chatbot-typing';
    indicator.className = 'chatbot-typing';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    messagesContainer.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('chatbot-typing');
    if (indicator) {
        indicator.remove();
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chatbot-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // Limpiar input
    input.value = '';

    // Mostrar mensaje del usuario
    appendMessage('user', text);

    // Mostrar indicador de escritura
    showTypingIndicator();

    // Obtener respuesta de la API (o local helper si está vacía)
    const reply = await getChatbotResponse(text);

    // Ocultar indicador y mostrar respuesta
    removeTypingIndicator();
    appendMessage('bot', reply);
}

async function getChatbotResponse(userMessage) {
    const url = CHATBOT_API_CONFIG.url || localStorage.getItem('chatbot_api_url') || '';

    // Obtener datos locales para enriquecer la pregunta
    let clients = [];
    let invoices = [];
    let codes = [];
    let incomes = [];
    let expenses = [];
    
    try {
        if (typeof getClients === 'function') clients = getClients();
        if (typeof getAllInvoices === 'function') invoices = getAllInvoices();
        if (typeof getMaterialCodes === 'function') codes = getMaterialCodes();
        if (typeof userKey === 'function') {
            incomes = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
            expenses = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');
        }
    } catch (e) {
        console.error('Error fetching local app data for chatbot context:', e);
    }

    const todayIso = new Date().toISOString().split('T')[0];
    const todayFormatted = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Filtrar y formatear clientes distinguiendo local de empresa
    const formattedClients = clients.map(c => 
        `* Nombre: ${c.name || 'Sin nombre'} (RNC/Cédula/NIT: ${c.nit || 'No especificado'}, Tipo: ${c.type || 'local'}, Contacto: ${c.contact || 'No especificado'})`
    ).join('\n');

    // Filtrar las últimas 30 facturas y bitácoras
    const sortedInvoices = [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentInvoices = sortedInvoices.slice(0, 30);
    const formattedInvoices = recentInvoices.map(inv => {
        const typeStr = inv.type === 'basica' ? 'Bitácora de Recogida' : 'Factura Estándar';
        const materialsStr = (inv.items || []).map(it => 
            `${it.materialName || it.name || 'Material'} (Cant: ${it.qty || 0}kg, Compra: $${it.costPrice || 0}, Venta: $${it.sellPrice || 0})`
        ).join(', ');
        return `* [Fecha: ${inv.date}] ${typeStr} ID: ${inv.id} - Cliente/Empresa: ${inv.client} - Compra: $${inv.totalCompra || inv.total || 0}, Venta: $${inv.totalVenta || 0}, Ganancia: $${inv.balance || 0} - Notas: ${inv.notes || 'Ninguna'} - Materiales: [${materialsStr}]`;
    }).join('\n');

    const formattedCodes = codes.map(c => `${c.code}: ${c.name}`).join(', ');
    const totalIncomes = incomes.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);

    // Prompt enriquecido de forma invisible con la información en tiempo real de la app del usuario
    const contextPrompt = `
[CONTEXTO EN TIEMPO REAL DEL USUARIO EN LA APP]:
- Fecha de hoy en el sistema: ${todayFormatted} (${todayIso})
- Clientes y proveedores registrados (total: ${clients.length}):
${formattedClients || 'Ninguno registrado aún'}
- Historial de Facturas y Bitácoras de Recogida recientes (últimas 30 registradas):
${formattedInvoices || 'Ninguna factura o bitácora registrada aún'}
- Catálogo de Materiales configurados: ${formattedCodes || 'Ninguno'} (total: ${codes.length})
- Resumen Financiero: Ingresos $${totalIncomes.toFixed(2)}, Egresos $${totalExpenses.toFixed(2)}, Balance Neto $${(totalIncomes - totalExpenses).toFixed(2)}

[DIRECTIVAS DE FORMATO Y RESPUESTA PARA LA IA]:
1. Si el usuario te pide que le digas o liste los clientes, proveedores o empresas, DEBES presentarlos estrictamente separados en dos grupos usando este formato exacto en tu respuesta:
CLIENTES:
- [Nombre del cliente local A]
- [Nombre del cliente local B]

EMPRESAS:
- [Nombre de la empresa A]
- [Nombre de la empresa B]

2. Si te piden información sobre la "bitácora de recogida del último mes" (o cualquier rango de fechas), filtra los registros provistos arriba que correspondan (la fecha actual del sistema es ${todayIso}), procesa los materiales, cantidades y montos, y responde detallando claramente las bitácoras encontradas de ese período.

Pregunta del usuario: ${userMessage}
`;

    if (!url) {
        await new Promise(resolve => setTimeout(resolve, 600));
        return getLocalHelpResponse(userMessage);
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                message: contextPrompt
            })
        });

        if (!response.ok) throw new Error(`HTTP status ${response.status}`);
        
        const data = await response.json();
        return data.reply || data.response || data.text || JSON.stringify(data);
    } catch (error) {
        console.error('Chatbot API Error:', error);
        console.warn('Falling back to local help responses due to API error.');
        return getLocalHelpResponse(userMessage);
    }
}

// Respuestas locales automáticas para guiar al usuario hasta que proporcione la API
function getLocalHelpResponse(message) {
    const lower = message.toLowerCase();

    // Obtener datos de respaldo locales
    let clients = [];
    let invoices = [];
    let codes = [];
    let incomes = [];
    let expenses = [];
    try {
        if (typeof getClients === 'function') clients = getClients();
        if (typeof getAllInvoices === 'function') invoices = getAllInvoices();
        if (typeof getMaterialCodes === 'function') codes = getMaterialCodes();
        if (typeof userKey === 'function') {
            incomes = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
            expenses = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');
        }
    } catch (e) {}

    const totalIncomes = incomes.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);

    if (lower.includes('cliente') || lower.includes('proveedor') || lower.includes('empresa')) {
        if (clients.length === 0) {
            return '👥 Clientes y Empresas:\n\nActualmente no tienes ningún cliente o proveedor registrado en la aplicación. Puedes agregarlos desde el módulo "Clientes / Empresas" en la barra lateral.';
        }
        
        const localClients = clients.filter(c => c.type !== 'empresa');
        const companyClients = clients.filter(c => c.type === 'empresa');

        let responseText = '👥 Tus Clientes y Empresas registrados:\n\n';
        
        responseText += 'CLIENTES:\n';
        if (localClients.length > 0) {
            localClients.forEach(c => {
                responseText += `- ${c.name || 'Sin nombre'} (${c.nit || 'Sin RNC/Cédula'})\n`;
            });
        } else {
            responseText += '(Ninguno registrado)\n';
        }

        responseText += '\nEMPRESAS:\n';
        if (companyClients.length > 0) {
            companyClients.forEach(c => {
                responseText += `- ${c.name || 'Sin nombre'} (${c.nit || 'Sin RNC/Cédula'})\n`;
            });
        } else {
            responseText += '(Ninguna registrada)\n';
        }

        return responseText;
    }
    
    if (lower.includes('factura')) {
        if (invoices.length === 0) {
            return '🧾 Facturación:\n\nActualmente no tienes ninguna factura registrada en la aplicación. Puedes crear facturas desde el módulo de "Facturación".';
        }
        return `🧾 Tus Facturas registradas:\n\nTienes un total de ${invoices.length} factura(s) registrada(s) en tu historial local.`;
    }

    if (lower.includes('codigo') || lower.includes('material')) {
        if (codes.length === 0) {
            return '🏷️ Códigos de Materiales:\n\nNo tienes códigos de materiales configurados. Puedes gestionarlos desde el panel "Códigos de Materiales".';
        }
        return `🏷️ Tus Códigos de Materiales:\n\nTienes ${codes.length} material(es) registrado(s):\n` +
            codes.map(c => `- ${c.code}: ${c.name} (${c.unit || 'kg'})`).join('\n');
    }

    if (lower.includes('ingreso') || lower.includes('finanz') || lower.includes('egreso') || lower.includes('caja')) {
        return `📈 Resumen de Flujo de Caja:\n\n- Ingresos: ${incomes.length} registro(s) por un total de $${totalIncomes.toFixed(2)}\n- Egresos: ${expenses.length} registro(s) por un total de $${totalExpenses.toFixed(2)}\n- Balance Neto: $${(totalIncomes - totalExpenses).toFixed(2)}`;
    }

    if (lower.includes('hola') || lower.includes('buenos') || lower.includes('saludos') || lower.includes('tal')) {
        return '¡Hola de nuevo! ¿Qué módulo de Reciminsa App te gustaría explorar o tienes alguna duda sobre su funcionamiento?';
    }
    
    if (lower.includes('bitacora') || lower.includes('recogida') || lower.includes('viaje')) {
        const basicInvoices = invoices.filter(i => i.type === 'basica');
        
        if (lower.includes('mes') || lower.includes('reciente') || lower.includes('ultimo') || lower.includes('último')) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentBitacoras = basicInvoices.filter(b => new Date(b.date) >= thirtyDaysAgo);
            
            if (recentBitacoras.length === 0) {
                return '🚛 Bitácoras de Recogida:\n\nNo se encontraron bitácoras de recogida registradas en los últimos 30 días.';
            }
            
            let responseText = `🚛 Bitácoras de Recogida del último mes (últimos 30 días):\n\n`;
            recentBitacoras.forEach((b, idx) => {
                const materialsStr = (b.items || []).map(it => `${it.materialName || 'Material'}: ${it.qty || 0}kg`).join(', ');
                responseText += `${idx + 1}. [${b.date}] ID: ${b.id} - Cliente: ${b.client} - Compra: $${b.totalCompra || 0}, Venta: $${b.totalVenta || 0}\n   Materiales: ${materialsStr}\n`;
            });
            return responseText;
        }

        if (basicInvoices.length === 0) {
            return '🚛 Módulo de Bitácoras de Recogida:\n\nActualmente no tienes ninguna bitácora registrada. Puedes crearlas en el menú de "Bitácoras de Recogida" seleccionando el camión, conductor y materiales.';
        }
        return `🚛 Módulo de Bitácoras de Recogida:\n\nTienes un total de ${basicInvoices.length} bitácora(s) registrada(s). Puedes pedirme detalles sobre las del "último mes" para mostrártelas.`;
    }

    if (lower.includes('ecolog') || lower.includes('medio') || lower.includes('co2') || lower.includes('arbol') || lower.includes('ahorro')) {
        return '🌱 Impacto Medioambiental:\n\nCalcula en tiempo real los beneficios ecológicos de tus materiales reciclados (cartón, plástico, metal, etc.). Muestra métricas equivalentes en árboles salvados, metros cúbicos de agua preservados, kilovatios-hora de energía ahorrados y reducción de emisiones de CO2.';
    }

    if (lower.includes('ajuste') || lower.includes('idioma') || lower.includes('tema') || lower.includes('rnc') || lower.includes('perfil')) {
        return '⚙️ Panel de Ajustes:\n\nDesde aquí puedes configurar tu RNC empresarial, teléfono y correo electrónico corporativo (requeridos para facturar). También puedes alternar el idioma (Español / Inglés) y elegir el tema visual de la aplicación.';
    }

    return '🤖 Modo local activo:\n\nEntiendo que preguntas sobre "' + message + '". Actualmente estoy operando en modo desconectado. Tan pronto como tu desarrollador configure la API de IA, podré darte respuestas dinámicas personalizadas sobre cualquier aspecto detallado de la app.\n\nPrueba preguntando sobre "Facturas", "Bitácoras", "Ecología" o "Ajustes".';
}
