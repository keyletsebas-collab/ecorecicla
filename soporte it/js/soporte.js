const ADMIN_EMAIL = 'noreplyreciminsasrl@gmail.com';
let session = null;
let isAdmin = false;
let currentChatTicketId = null;
let chatSubscription = null;

const COLOR_THEMES = [
  { id: 'green', label: 'Verde', primary: '#22c55e', dark: '#16a34a', glow: 'rgba(34, 197, 94, 0.2)' },
  { id: 'blue', label: 'Azul', primary: '#3b82f6', dark: '#2563eb', glow: 'rgba(59, 130, 246, 0.2)' },
  { id: 'purple', label: 'Morado', primary: '#a855f7', dark: '#9333ea', glow: 'rgba(168, 85, 247, 0.2)' },
  { id: 'orange', label: 'Naranja', primary: '#f97316', dark: '#ea580c', glow: 'rgba(249, 115, 22, 0.2)' },
  { id: 'rose', label: 'Rosa', primary: '#f43f5e', dark: '#e11d48', glow: 'rgba(244, 63, 94, 0.2)' },
  { id: 'slate', label: 'Gris Oscuro', primary: '#64748b', dark: '#475569', glow: 'rgba(100, 116, 139, 0.2)' }
];

// Esperar a que el DOM cargue y supabase esté listo
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  // Verificar sesión
  const sessionStr = localStorage.getItem('recim_session');
  if (!sessionStr) {
    alert("Debes iniciar sesión para acceder al Soporte IT.");
    window.location.href = "../index.html";
    return;
  }
  
  session = JSON.parse(sessionStr);
  isAdmin = (session.email === ADMIN_EMAIL);

  // Inicializar interfaz
  document.getElementById('loading-state').classList.add('hidden');
  
  if (isAdmin) {
    document.getElementById('admin-view').classList.remove('hidden');
    loadAllTickets();
  } else {
    document.getElementById('user-view').classList.remove('hidden');
    document.getElementById('ticket-user').value = session.email;
    loadMyTickets();
  }
  
  loadUsersForDatalist();
});

// ==========================================
// PERSONALIZACIÓN
// ==========================================

function applyTheme() {
  try {
    const settingsStr = localStorage.getItem('recim_settings');
    if (!settingsStr) return;
    const settings = JSON.parse(settingsStr);
    
    // Aplicar dark mode
    if (settings.darkMode !== false) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    
    // Aplicar color
    if (settings.colorTheme) {
      const theme = COLOR_THEMES.find(t => t.id === settings.colorTheme);
      if (theme) {
        const root = document.documentElement;
        root.style.setProperty('--clr-primary', theme.primary);
        root.style.setProperty('--clr-primary-dark', theme.dark);
        root.style.setProperty('--clr-primary-light', theme.primary);
        root.style.setProperty('--clr-primary-glow', theme.glow);
      }
    }
  } catch (e) {
    console.warn("No se pudo cargar el tema", e);
  }
}

async function loadUsersForDatalist() {
  const datalist = document.getElementById('users-list');
  if (!datalist || !isSupabaseActive || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient.from('profiles').select('email, name');
    if (error) throw error;
    if (data) {
      data.forEach(user => {
        if(user.email) {
          const option = document.createElement('option');
          option.value = user.email;
          option.textContent = user.name || user.email;
          datalist.appendChild(option);
        }
      });
    }
  } catch (err) {
    console.error("Error al cargar usuarios para datalist:", err);
  }
}

// ==========================================
// USUARIO: ENVIAR Y CARGAR RECLAMOS
// ==========================================

async function submitTicket(e) {
  e.preventDefault();
  
  const btn = document.getElementById('btn-submit-ticket');
  const spinner = document.getElementById('spinner-submit');
  
  btn.disabled = true;
  spinner.classList.remove('hidden');

  const moduleVal = document.getElementById('ticket-module').value;
  const dateVal = document.getElementById('ticket-date').value;
  const descVal = document.getElementById('ticket-desc').value;

  if(!isSupabaseActive || !supabaseClient) {
    alert("Error de conexión a la base de datos.");
    btn.disabled = false;
    spinner.classList.add('hidden');
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('support_tickets')
      .insert([
        {
          user_email: document.getElementById('ticket-user').value,
          user_name: document.getElementById('ticket-user').value,
          module: moduleVal,
          issue_date: dateVal,
          description: descVal,
          status: 'open'
        }
      ]);

    if (error) throw error;

    alert("Reclamo enviado correctamente. El equipo de soporte se pondrá en contacto pronto.");
    document.getElementById('ticket-form').reset();
    document.getElementById('ticket-user').value = session.email;
    loadMyTickets();
  } catch (err) {
    console.error("Error al enviar reclamo:", err);
    alert("Ocurrió un error. Verifica que la tabla 'support_tickets' exista en Supabase.");
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
  }
}

async function loadMyTickets() {
  const container = document.getElementById('my-tickets-list');
  if(!isSupabaseActive || !supabaseClient) {
    container.innerHTML = '<p style="color:red;font-size:0.9rem;">Error de conexión.</p>';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('support_tickets')
      .select('*')
      .eq('user_email', session.email)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:var(--clr-text-muted);font-size:0.9rem;">No has enviado ningún reclamo aún.</p>';
      return;
    }

    renderTicketsList(data, container, false);
  } catch (err) {
    console.error("Error cargando mis reclamos:", err);
    container.innerHTML = '<p style="color:red;font-size:0.9rem;">No se pudieron cargar los reclamos.</p>';
  }
}

// ==========================================
// ADMIN: CARGAR TODOS LOS RECLAMOS
// ==========================================

async function loadAllTickets() {
  const container = document.getElementById('admin-tickets-list');
  container.innerHTML = '<p style="color:var(--clr-text-muted);font-size:0.9rem;">Cargando reclamos...</p>';
  
  if(!isSupabaseActive || !supabaseClient) {
    container.innerHTML = '<p style="color:red;font-size:0.9rem;">Error de conexión.</p>';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:var(--clr-text-muted);font-size:0.9rem;">No hay reclamos en el sistema.</p>';
      return;
    }

    renderTicketsList(data, container, true);
  } catch (err) {
    console.error("Error cargando todos los reclamos:", err);
    container.innerHTML = '<p style="color:red;font-size:0.9rem;">No se pudieron cargar los reclamos.</p>';
  }
}

// ==========================================
// RENDERIZAR TARJETAS DE RECLAMO
// ==========================================

function renderTicketsList(tickets, container, showUserInfo) {
  container.innerHTML = '';
  
  tickets.forEach(ticket => {
    const isResolved = ticket.status === 'resolved';
    const statusClass = isResolved ? 'status-resolved' : 'status-open';
    const statusText = isResolved ? 'Resuelto' : 'Abierto';
    
    // Format date
    const createdDate = new Date(ticket.created_at).toLocaleDateString();

    const card = document.createElement('div');
    card.className = 'ticket-card';
    card.onclick = () => openChat(ticket);

    card.innerHTML = `
      <div class="ticket-card-header">
        <span class="ticket-module-badge">${ticket.module}</span>
        <span class="ticket-status ${statusClass}">${statusText}</span>
      </div>
      <h4 class="ticket-title">${showUserInfo ? `Reclamo de: ${ticket.user_name}` : 'Mi Reclamo'}</h4>
      <p class="ticket-desc-preview">${ticket.description}</p>
      <div class="ticket-footer">
        <span>📅 Problema desde: ${ticket.issue_date}</span>
        <span>${createdDate}</span>
      </div>
      <div style="margin-top:12px; border-top:1px solid var(--clr-border); padding-top:10px; text-align:center;">
        <button class="btn-secondary" style="width:100%; justify-content:center;">💬 ${showUserInfo ? 'Iniciar chat' : 'Ver chat / Responder'}</button>
      </div>
    `;

    container.appendChild(card);
  });
}

// ==========================================
// CHAT FUNCTIONALITY
// ==========================================

async function openChat(ticket) {
  currentChatTicketId = ticket.id;
  
  const modal = document.getElementById('chat-modal');
  const title = document.getElementById('chat-title');
  const context = document.getElementById('chat-context');
  const messagesContainer = document.getElementById('chat-messages');
  
  title.textContent = isAdmin ? `Chat con ${ticket.user_name}` : 'Soporte IT';
  context.innerHTML = `<strong>Módulo:</strong> ${ticket.module} <br/> <strong>Problema:</strong> ${ticket.description}`;
  messagesContainer.innerHTML = '<p style="text-align:center; color:var(--clr-text-muted); font-size:0.8rem; margin:auto;">Cargando mensajes...</p>';
  
  modal.classList.remove('hidden');

  // Load existing messages
  await loadChatMessages();
  
  // Subscribe to new messages
  subscribeToChat();
}

function closeChat() {
  document.getElementById('chat-modal').classList.add('hidden');
  currentChatTicketId = null;
  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
    chatSubscription = null;
  }
}

async function loadChatMessages() {
  const container = document.getElementById('chat-messages');
  if(!isSupabaseActive || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('support_chats')
      .select('*')
      .eq('ticket_id', currentChatTicketId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    container.innerHTML = '';
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--clr-text-muted); font-size:0.8rem; margin:auto;">No hay mensajes aún. Escribe algo para comenzar.</p>';
      return;
    }

    data.forEach(msg => appendMessageToUI(msg));
    scrollToBottom();
  } catch (err) {
    console.error("Error loading messages:", err);
    container.innerHTML = '<p style="text-align:center; color:red; font-size:0.8rem; margin:auto;">Error al cargar mensajes.</p>';
  }
}

function appendMessageToUI(msg) {
  const container = document.getElementById('chat-messages');
  // Eliminar mensaje temporal si existe
  const tempMsg = container.querySelector('p[style*="margin:auto"]');
  if(tempMsg) tempMsg.remove();

  const isMe = msg.sender_email === session.email;
  const bubbleClass = isMe ? 'me' : 'other';
  
  const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const statusIcon = isMe ? `<span style="margin-left:5px; font-size:0.75rem; font-weight:bold; opacity:0.8;">✓✓</span>` : '';

  const div = document.createElement('div');
  div.className = `chat-bubble ${bubbleClass}`;
  div.innerHTML = `
    ${msg.message}
    <span class="chat-timestamp">${timeStr} ${statusIcon}</span>
  `;
  
  container.appendChild(div);
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage(e) {
  e.preventDefault();
  if(!currentChatTicketId) return;

  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;

  const btn = document.getElementById('btn-send-msg');
  const spinner = document.getElementById('spinner-send');
  btn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    // Insert into DB
    const { error } = await supabaseClient
      .from('support_chats')
      .insert([
        {
          ticket_id: currentChatTicketId,
          sender_email: session.email,
          sender_name: session.name || session.email,
          message: text
        }
      ]);

    if (error) throw error;
    
    input.value = '';
    // Let the real-time subscription handle adding it to the UI
  } catch (err) {
    console.error("Error enviando mensaje:", err);
    alert("No se pudo enviar el mensaje.");
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    input.focus();
  }
}

function subscribeToChat() {
  if (!supabaseClient) return;
  
  chatSubscription = supabaseClient
    .channel('public:support_chats')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'support_chats',
      filter: `ticket_id=eq.${currentChatTicketId}`
    }, payload => {
      appendMessageToUI(payload.new);
      scrollToBottom();
    })
    .subscribe();
}
