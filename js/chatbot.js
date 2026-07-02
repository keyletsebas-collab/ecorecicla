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

    if (!url) {
        // Delay simulado para que se sienta natural (600ms)
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
                message: userMessage
            })
        });

        if (!response.ok) throw new Error(`HTTP status ${response.status}`);
        
        const data = await response.json();
        return data.reply || data.response || data.text || JSON.stringify(data);
    } catch (error) {
        console.error('Chatbot API Error:', error);
        // Fallback elegante al motor local de ayuda para no dejar al usuario sin respuesta
        console.warn('Falling back to local help responses due to API error.');
        return getLocalHelpResponse(userMessage);
    }
}

// Respuestas locales automáticas para guiar al usuario hasta que proporcione la API
function getLocalHelpResponse(message) {
    const lower = message.toLowerCase();

    if (lower.includes('hola') || lower.includes('buenos') || lower.includes('saludos') || lower.includes('tal')) {
        return '¡Hola de nuevo! ¿Qué módulo de Reciminsa App te gustaría explorar o tienes alguna duda sobre su funcionamiento?';
    }
    
    if (lower.includes('factura') || lower.includes('comprobante') || lower.includes('ncf') || lower.includes('dgii')) {
        return '🧾 Módulo de Facturación:\n\nPermite registrar compras y ventas de materiales reciclables. Soporta validación automática de RNC y consulta de NCF oficiales de la DGII Dominicana. Puedes exportar facturas en PDF premium o Excel, y llevar el control de facturas de crédito/gasto.';
    }

    if (lower.includes('bitacora') || lower.includes('recogida') || lower.includes('viaje') || lower.includes('camion') || lower.includes('chofer')) {
        return '🚛 Módulo de Bitácoras de Recogida:\n\nDiseñado para registrar los traslados y pesajes de materiales. Puedes seleccionar el camión, conductor, ruta y peso inicial/final. El sistema calcula automáticamente la merma neta y permite generar informes imprimibles de cada recogida.';
    }

    if (lower.includes('ecolog') || lower.includes('medio') || lower.includes('co2') || lower.includes('arbol') || lower.includes('ahorro')) {
        return '🌱 Impacto Medioambiental:\n\nCalcula en tiempo real los beneficios ecológicos de tus materiales reciclados (cartón, plástico, metal, etc.). Muestra métricas equivalentes en árboles salvados, metros cúbicos de agua preservados, kilovatios-hora de energía ahorrados y reducción de emisiones de CO2.';
    }

    if (lower.includes('ingreso') || lower.includes('egreso') || lower.includes('dinero') || lower.includes('finanz') || lower.includes('caja')) {
        return '📈 Gestión Financiera:\n\nEn los módulos de Ingresos y Egresos puedes llevar el control del flujo de caja de tu centro de acopio. Se categorizan los movimientos automáticamente por tipo de material, cliente o gastos operativos generales.';
    }

    if (lower.includes('ajuste') || lower.includes('idioma') || lower.includes('tema') || lower.includes('rnc') || lower.includes('perfil')) {
        return '⚙️ Panel de Ajustes:\n\nDesde aquí puedes configurar tu RNC empresarial, teléfono y correo electrónico corporativo (requeridos para facturar). También puedes alternar el idioma (Español / Inglés) y elegir el tema visual de la aplicación.';
    }

    if (lower.includes('cliente') || lower.includes('empresa') || lower.includes('proveedor')) {
        return '👥 Clientes y Empresas:\n\nAdministra tu cartera de proveedores de materiales y clientes corporativos. Registra sus datos básicos, dirección, RNC o cédula, y asócialos a las facturas y bitácoras para generar reportes consolidados.';
    }

    return '🤖 Modo local activo:\n\nEntiendo que preguntas sobre "' + message + '". Actualmente estoy operando en modo desconectado. Tan pronto como tu desarrollador configure la API de IA, podré darte respuestas dinámicas personalizadas sobre cualquier aspecto detallado de la app.\n\nPrueba preguntando sobre "Facturas", "Bitácoras", "Ecología" o "Ajustes".';
}
