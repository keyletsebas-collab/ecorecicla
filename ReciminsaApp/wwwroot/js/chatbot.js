/* ==========================================================================
   CHATBOT JS - LOGIC & API INTEGRATION - RECIMINSA APP
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

// Amplio repositorio local de Q&A para la IA (Offline / Búsqueda Semántica)
const CHATBOT_QA_REPOSITORY = [
  {
    keywords: ['crear', 'registrar', 'hacer', 'nueva', 'bitacora', 'bitacoras', 'recogida', 'viaje', 'conductor', 'chofer', 'camion', 'materiales'],
    question: '¿Cómo registro una bitácora de recogida?',
    answer: 'Para registrar una **Bitácora de Recogida** de materiales:<br>' +
            '1. Dirígete a la pestaña **Bitácoras** (Menú ➡️ 🚛 Bitácoras de Recogida).<br>' +
            '2. Selecciona el **Cliente**, **Camión/Ficha**, **Chofer** y la **Fecha** del viaje.<br>' +
            '3. En la tabla de desglose, agrega cada material, ingresando su **Cantidad (kg)**, **Precio Compra** y **Precio Venta**.<br>' +
            '4. Opcionalmente añade notas al pie y presiona **Guardar Bitácora**.'
  },
  {
    keywords: ['eliminar', 'quitar', 'borrar', 'miembro', 'usuario', 'persona', 'expulsar', 'empresa', 'desvincular'],
    question: '¿Cómo elimino a un miembro de la empresa?',
    answer: 'Por seguridad, **solo el fundador o administrador** principal de la empresa tiene permisos para dar de baja a otros miembros.<br>' +
            'Para hacerlo:<br>' +
            '1. Ve a **Ajustes** (Menú ➡️ ⚙️ Ajustes).<br>' +
            '2. Busca la sección **Miembros de la Empresa**.<br>' +
            '3. Haz clic en el botón rojo 🗑️ **Eliminar** al lado del miembro correspondiente.<br>' +
            '4. El sistema actualizará sus accesos de inmediato desvinculándolo del código común.'
  },
  {
    keywords: ['id', 'codigo', 'entrar', 'unirse', 'empresa', 'digitos', 'identificador'],
    question: '¿Dónde encuentro el ID de la empresa?',
    answer: 'El **ID de tu Empresa** es la clave única de 10 dígitos que vincula a todo tu equipo a la misma base de datos.<br>' +
            'Para ubicarlo:<br>' +
            '1. Ve al panel de **Ajustes** (Menú ➡️ ⚙️ Ajustes).<br>' +
            '2. En el bloque de empresa, verás el **Código de tu Empresa**.<br>' +
            '3. Copia este código y proporciónalo a tus colaboradores para que se unan desde sus dispositivos.'
  },
  {
    keywords: ['agregar', 'crear', 'nuevo', 'colaborador', 'empleado', 'auxiliar', 'chofer', 'personal', 'roles'],
    question: '¿Cómo agrego a un colaborador?',
    answer: 'Para dar de alta a un trabajador:<br>' +
            '1. Navega a **Colaboradores** (Menú ➡️ 🤝 Colaboradores).<br>' +
            '2. Completa el formulario con su **Nombre**, **Teléfono**, **Rol** y **Permisos de Módulo**.<br>' +
            '3. Si deseas que acceda con su propia cuenta, asígnale su cuenta vinculada en el selector correspondiente.'
  },
  {
    keywords: ['ecologia', 'medio', 'ambiente', 'arbol', 'agua', 'co2', 'ahorro', 'energia', 'impacto', 'verde'],
    question: '¿Cómo se calcula el impacto ecológico?',
    answer: 'El módulo **Impacto medioambiental** (Menú ➡️ 🌱 Impacto medioambiental) calcula automáticamente los beneficios ecológicos del reciclaje en base a los kg registrados en las bitácoras:<br>' +
            '- **Árboles salvados**: Papel/Cartón.<br>' +
            '- **Agua preservada**: Litros ahorrados.<br>' +
            '- **Energía ahorrada**: Kilovatios-hora.<br>' +
            '- **CO2 evitado**: Reducción de gases de efecto invernadero.'
  },
  {
    keywords: ['excel', 'exportar', 'descargar', 'informe', 'reporte', 'guardar'],
    question: '¿Cómo exportar reportes a Excel?',
    answer: 'Puedes generar planillas Excel de tus operaciones de dos formas:<br>' +
            '1. Desde **Historial** (Menú ➡️ 📑 Historial), haciendo clic en el botón 🟢 **Exportar Excel**.<br>' +
            '2. En la pestaña de conteos rápidos dentro de **Bitácoras**, para descargar resúmenes específicos de materiales.'
  },
  {
    keywords: ['ganancia', 'balance', 'ingresos', 'egresos', 'flujo', 'caja', 'dinero', 'finanzas'],
    question: '¿Cómo consulto el flujo de caja?',
    answer: 'La app ofrece dos secciones financieras:<br>' +
            '- **Ingresos** (Menú ➡️ 📈 Ingresos): Para registrar ventas y entradas extraordinarias.<br>' +
            '- **Egresos** (Menú ➡️ 📉 Egresos): Para gastos operativos y compras de materiales.<br>' +
            'El balance financiero neto se calcula y muestra automáticamente en la parte superior.'
  },
  {
    keywords: ['material', 'materiales', 'codigo', 'nuevo', 'precio', 'unidad', 'cambiar'],
    question: '¿Cómo modifico los precios de los materiales?',
    answer: 'Para gestionar tus materiales y precios:<br>' +
            '1. Entra a **Códigos de Materiales** (Menú ➡️ 🏷️ Códigos de Materiales).<br>' +
            '2. Podrás agregar nuevos códigos (ej: PET, CARTON) o editar los precios base de compra y venta de los existentes.'
  },
  {
    keywords: ['offline', 'sin', 'internet', 'conexion', 'red', 'sincronizar', 'nube'],
    question: '¿Puedo usar la aplicación sin conexión a internet?',
    answer: '¡Sí! Reciminsa App está diseñada para operar **offline**.<br>' +
            'Todos los registros que crees se guardarán de forma local en tu dispositivo y se subirán a la nube de manera automática en cuanto detecte conexión a internet.'
  },
  {
    keywords: ['soporte', 'ayuda', 'error', 'falla', 'tecnico', 'it', 'correo', 'escribir'],
    question: '¿Cómo contacto al soporte técnico de TI?',
    answer: 'Si experimentas problemas técnicos o necesitas asistencia con la aplicación, nuestro soporte de TI está a tu disposición.<br>' +
            'Haz clic en el botón de abajo para enviar un correo de soporte:<br>' +
            '<button class="btn-primary" style="margin-top:10px; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:bold;" onclick="window.open(\'mailto:soporte@reciminsa.com?subject=Soporte%20TI%20-%20Reciminsa%20App\')">📧 Contactar Soporte TI</button>'
  }
];

// Algoritmo de similitud de palabras clave (Jaccard NLP Model) para Machine Learning local
function calculateSemanticScore(query, keywords) {
    const clean = (text) => text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remover acentos
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2); // Excluir palabras cortas (artículos, preposiciones)
    
    const queryTokens = clean(query);
    if (queryTokens.length === 0) return 0;
    
    let matches = 0;
    queryTokens.forEach(token => {
        if (keywords.some(kw => kw.includes(token) || token.includes(kw))) {
            matches++;
        }
    });
    return matches / Math.sqrt(queryTokens.length * keywords.length);
}

// Intercepta solicitudes locales de navegación
function detectNavigationIntent(message) {
    const lower = message.toLowerCase();
    const pages = {
        'historial': ['historial', 'history', 'transacciones', 'registros', 'inicio'],
        'bitacoras': ['bitacora', 'bitácora', 'recogida', 'viaje', 'camion', 'chofer'],
        'codigos': ['codigo', 'código', 'material', 'precio compra', 'precio venta'],
        'clientes': ['cliente', 'proveedor', 'directorio', 'base de clientes', 'contribuyente', 'contribuyentes', 'rnc', 'dgii'],
        'ingresos': ['ingreso', 'ventas', 'ganancia', 'caja chica'],
        'egresos': ['egreso', 'gasto', 'compra externa', 'perdida'],
        'ecologia': ['ecologia', 'ecología', 'impacto', 'arbol', 'co2', 'medio ambiente'],
        'ajustes': ['ajuste', 'configuracion', 'configuración', 'perfil', 'tema', 'idioma'],
        'colaboradores': ['colaborador', 'empleado', 'personal', 'permiso', 'auxiliar']
    };

    for (const [page, keywords] of Object.entries(pages)) {
        if (keywords.some(kw => lower.includes(kw) && (lower.includes('ir ') || lower.includes('lleva') || lower.includes('abrir') || lower.includes('navegar') || lower.includes('pantalla')))) {
            return page;
        }
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initChatbot, 500);
});

function initChatbot() {
    const appScreen = document.getElementById('app-screen');
    if (!appScreen) return;

    if (document.getElementById('chatbot-fab')) return;

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

    fabButton.addEventListener('click', toggleChatbot);
    document.getElementById('chatbot-close').addEventListener('click', toggleChatbot);
    document.getElementById('chatbot-form').addEventListener('submit', handleChatSubmit);

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

    appendMessage('bot', '¡Hola! Soy ReciBot, tu asistente inteligente para Reciminsa App. 🤖\n\nEstoy conectado a tu base de datos y puedo ayudarte a consultar tu impacto ecológico, ver tus colaboradores, redirigirte a pantallas o resolver dudas técnicas.');
}

function appendMessage(sender, text) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    let cleanText = text;
    if (cleanText.includes('[NAVIGATE:')) {
        const match = cleanText.match(/\[NAVIGATE:(.*?)\]/);
        if (match && match[1]) {
            const pageName = match[1].trim();
            if (typeof navigate === 'function') {
                setTimeout(() => {
                    navigate(pageName);
                    const chatWindow = document.getElementById('chatbot-window');
                    if (chatWindow && chatWindow.classList.contains('open')) {
                        chatWindow.classList.remove('open');
                    }
                }, 1000);
            }
        }
        cleanText = cleanText.replace(/\[NAVIGATE:.*?\]/g, '').trim();
    }

    const messageBubble = document.createElement('div');
    messageBubble.className = `chatbot-msg chatbot-msg--${sender}`;
    
    // Soporte para HTML enriquecido (botones, estilos)
    if (cleanText.includes('<button') || cleanText.includes('<div') || cleanText.includes('<strong>') || cleanText.includes('<p>') || cleanText.includes('<br>')) {
        messageBubble.innerHTML = cleanText;
    } else {
        let formatted = cleanText
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
        messageBubble.innerHTML = formatted;
    }
    
    messagesContainer.appendChild(messageBubble);
    chatbotHistory.push({ sender, text: cleanText });
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

    input.value = '';
    appendMessage('user', text);
    showTypingIndicator();

    const reply = await getChatbotResponse(text);
    removeTypingIndicator();
    appendMessage('bot', reply);
}

async function getChatbotResponse(userMessage) {
    const url = CHATBOT_API_CONFIG.url || localStorage.getItem('chatbot_api_url') || '';
    const lower = userMessage.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Remover acentos

    // Interceptar redirección por palabra clave en local
    const navPage = detectNavigationIntent(userMessage);
    if (navPage) {
        const pageLabels = {
            historial: '📑 Historial de Operaciones',
            bitacoras: '🚛 Bitácoras de Recogida',
            codigos: '🏷️ Códigos de Materiales',
            clientes: '👥 Clientes',
            ingresos: '📈 Ingresos',
            egresos: '📉 Egresos',
            ecologia: '🌱 Impacto medioambiental',
            ajustes: '⚙️ Ajustes',
            colaboradores: '🤝 Colaboradores'
        };
        return `Te estoy llevando al panel de **${pageLabels[navPage]}**... ➡️<br>` +
               `Ruta manual: Menú lateral ➡️ **${pageLabels[navPage]}** ➡️ 👇 [NAVIGATE:${navPage}]`;
    }

    // 1. Obtener contexto en tiempo real de la base de datos de la empresa
    const session = JSON.parse(localStorage.getItem('recim_session') || '{}');
    const companyId = session.familyId || 'Sin ID (Base de Datos Local)';
    const myName = session.name || 'Usuario';

    let companyMembers = [];
    if (isSupabaseActive && supabaseClient && session.familyId) {
        try {
            const { data } = await supabaseClient
                .from('profiles')
                .select('name, email')
                .eq('family_id', session.familyId);
            companyMembers = data || [];
        } catch (e) {
            console.error('Error al leer miembros de empresa desde Supabase:', e);
        }
    }

    let clients = [];
    let invoices = [];
    let codes = [];
    let incomes = [];
    let expenses = [];
    let collaborators = [];
    
    try {
        if (typeof getClients === 'function') clients = getClients();
        if (typeof getAllInvoices === 'function') invoices = getAllInvoices();
        if (typeof getMaterialCodes === 'function') codes = getMaterialCodes();
        if (typeof userKey === 'function') {
            incomes = JSON.parse(localStorage.getItem(userKey('recim_ingresos')) || '[]');
            expenses = JSON.parse(localStorage.getItem(userKey('recim_egresos')) || '[]');
            collaborators = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
        }
    } catch (e) {
        console.error(e);
    }

    // Intercepciones dinámicas locales basadas en base de datos real
    // MIEMBROS DE LA EMPRESA / EQUIPO
    if (lower.includes('quienes') || lower.includes('miembro') || lower.includes('equipo') || lower.includes('gente') || lower.includes('personas en mi')) {
        if (companyMembers.length === 0) {
            return `Actualmente no hay otros miembros vinculados a tu empresa (ID de Empresa: **${companyId}**). Puedes compartir tu código de empresa desde Ajustes para que se unan.`;
        }
        const memberList = companyMembers.map(m => `- **${m.name.split(' | ')[0]}** (${m.email})`).join('<br>');
        return `Los miembros registrados en tu empresa (ID: **${companyId}**) son:<br>${memberList}`;
    }

    // COLABORADORES
    if (lower.includes('colaborador') || lower.includes('empleado') || lower.includes('personal') || lower.includes('trabajador') || lower.includes('auxiliar')) {
        if (collaborators.length === 0) {
            return `No tienes colaboradores registrados en la base de datos local. Puedes agregarlos desde el panel **Colaboradores** (Menú ➡️ 🤝 Colaboradores).`;
        }
        const colabList = collaborators.map(c => `- **${c.name}** (Rol: ${c.role || 'Auxiliar'})`).join('<br>');
        return `Tienes **${collaborators.length}** colaborador(es) registrado(s) en tu empresa:<br>${colabList}`;
    }

    // FACTURAS / BITÁCORAS
    if (lower.includes('factura') || lower.includes('bitacora') || lower.includes('viaje') || lower.includes('transaccion')) {
        if (invoices.length === 0) {
            return `No tienes bitácoras o facturas registradas en tu historial. Puedes crearlas en el panel **Bitácoras** (Menú ➡️ 🚛 Bitácoras de Recogida).`;
        }
        const recent = invoices.slice(0, 5).map(inv => `- [${inv.date}] ID: ${inv.id} - Cliente: ${inv.client} - Total: $${inv.totalCompra || 0}`).join('<br>');
        return `Tienes un total de **${invoices.length}** bitácoras de recogida registradas en tu base de datos.<br><br>**Últimas registradas:**<br>${recent}`;
    }

    // CLIENTES / CONTRIBUYENTES
    if (lower.includes('cliente') || lower.includes('proveedor') || lower.includes('comprador') || lower.includes('contribuyente') || lower.includes('rnc') || lower.includes('dgii')) {
        if (clients.length === 0) {
            return `No tienes clientes o contribuyentes registrados. Puedes agregarlos desde el panel **Clientes** (Menú ➡️ 👥 Clientes).`;
        }
        const clientList = clients.slice(0, 8).map(c => `- **${c.name}** (${c.nit || 'Sin RNC'})`).join('<br>');
        return `Tienes **${clients.length}** cliente(s)/contribuyente(s) registrado(s) en tu directorio:<br>${clientList}`;
    }

    // FINANZAS / CAJA / BALANCE
    if (lower.includes('ingreso') || lower.includes('egreso') || lower.includes('gasto') || lower.includes('balance') || lower.includes('ganancia') || lower.includes('caja') || lower.includes('flujo')) {
        const totalIncomes = incomes.reduce((s,i) => s + (i.amount||0), 0);
        const totalExpenses = expenses.reduce((s,i) => s + (i.amount||0), 0);
        return `**Resumen de Flujo de Caja en tiempo real**:<br>` +
               `- Ingresos totales: **$${totalIncomes.toFixed(2)}**<br>` +
               `- Egresos totales: **$${totalExpenses.toFixed(2)}**<br>` +
               `- Balance Neto: **$${(totalIncomes - totalExpenses).toFixed(2)}**`;
    }

    // 3. Consultar API Remota si está disponible
    if (url) {
        try {
            const formattedClients = clients.map(c => `- ${c.name} (${c.nit || 'Sin RNC'}, Tipo: ${c.type || 'local'})`).join('\n');
            const recentInvoices = [...invoices].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
            const formattedInvoices = recentInvoices.map(inv => 
                `* [Fecha: ${inv.date}] Bitácora ID: ${inv.id} - Cliente: ${inv.client} - Compra: $${inv.totalCompra || 0}, Venta: $${inv.totalVenta || 0}, Colaborador: ${inv.collaborator || 'No asignado'}`
            ).join('\n');

            const formattedColabs = collaborators.map(c => `- ${c.name} (Rol: ${c.role || 'Auxiliar'})`).join('\n');
            const formattedMembers = companyMembers.map(m => `- ${m.name} (${m.email})`).join('\n');

            const contextPrompt = `
[CONTRATO DE IA - ASISTENTE RECI_BOT]
Eres ReciBot AI, el cerebro asistente de Reciminsa App. Tienes acceso completo en tiempo real a la base de datos de la empresa.

[DATOS DE TU EMPRESA]:
- ID de Empresa actual: ${companyId}
- Tu nombre de usuario: ${myName}
- Miembros activos en tu empresa/familia (en la nube):
${formattedMembers || 'Solo tú estás registrado en la empresa actualmente'}
- Colaboradores y empleados registrados:
${formattedColabs || 'Ninguno registrado aún'}
- Clientes / Proveedores registrados:
${formattedClients || 'Ninguno'}
- Últimos registros de Bitácoras de Recogida:
${formattedInvoices || 'Ninguna bitácora registrada aún'}
- Conteo actual de códigos de materiales configurados: ${codes.length}
- Caja Chica: Ingresos totales $${incomes.reduce((s,i) => s + (i.amount||0), 0)}, Egresos totales $${expenses.reduce((s,i) => s + (i.amount||0), 0)}

[DIRECTIVAS IMPORTANTES]:
1. Si el usuario te pregunta por los miembros de la empresa, colaboradores o quiénes están en su equipo, respondes en base a los datos arriba listados.
2. Si te pide que le lleves o redirijas a un panel, incluye la etiqueta [NAVIGATE:nombre_de_la_pestaña] al final de tu mensaje.
3. Si el usuario realiza una pregunta que no sepas responder basándote en los datos provistos o tu entrenamiento técnico de Reciminsa, DEBES responder brevemente indicando que no tienes esa respuesta en este momento, y brindarle el botón de Soporte TI.

Pregunta del usuario: ${userMessage}
`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: contextPrompt })
            });

            if (response.ok) {
                const data = await response.json();
                const reply = data.reply || data.response || data.text || '';
                if (reply) return reply;
            }
        } catch (e) {
            console.error('Error al conectar con la API de IA:', e);
        }
    }

    // 4. Búsqueda Semántica local usando Jaccard NLP
    let bestMatch = null;
    let highestScore = 0;

    CHATBOT_QA_REPOSITORY.forEach(qa => {
        const score = calculateSemanticScore(userMessage, qa.keywords);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = qa;
        }
    });

    if (highestScore > 0.20 && bestMatch) {
        return `**${bestMatch.question}**:<br><br>${bestMatch.answer}`;
    }

    // 5. Fallback definitivo (Soporte TI)
    return `Lo siento, no tengo esa información o no he podido procesar tu solicitud en este momento. 🤖🔧<br><br>` +
           `Para obtener ayuda técnica o reportar problemas con la aplicación, por favor ponte en contacto con nuestro equipo de Soporte IT clicando en el siguiente botón:<br><br>` +
           `<button class="btn-primary" style="margin-top:8px; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px; font-weight:bold; font-size:0.85rem;" onclick="window.open('mailto:soporte@reciminsa.com?subject=Soporte%20TI%20-%20Reciminsa%20App')">📧 Ir a Soporte IT</button>`;
}
