const ADMIN_EMAIL = 'noreplyreciminsasrl@gmail.com';
let session = null;
let isAdmin = false;
let currentChatTicketId = null;
let chatSubscription = null;

function cleanUserName(name) {
  if (!name) return '';
  return name.split(' | ')[0].trim();
}
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
          option.textContent = cleanUserName(user.name) || user.email;
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
      <h4 class="ticket-title">${showUserInfo ? `Reclamo de: ${cleanUserName(ticket.user_name)}` : 'Mi Reclamo'}</h4>
      <p class="ticket-desc-preview">${ticket.description}</p>
      <div class="ticket-footer">
        <span>📅 Problema desde: ${ticket.issue_date}</span>
        <span>${createdDate}</span>
      </div>
      <div style="margin-top:12px; border-top:1px solid var(--clr-border); padding-top:10px; display:flex; gap:10px;">
        <button class="btn-secondary" style="flex:1; justify-content:center;">💬 ${showUserInfo ? 'Iniciar chat' : 'Ver chat / Responder'}</button>
        <button style="padding:0 15px; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid #ef4444; border-radius:var(--r-md); cursor:pointer; font-weight:bold; transition:all 0.2s ease;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.color='#ef4444';" onclick="event.stopPropagation(); deleteTicket('${ticket.id}')">🗑️</button>
      </div>
    `;

    container.appendChild(card);
  });
}

// ==========================================
// CHAT FUNCTIONALITY
// ==========================================

window.deleteTicket = async function(id) {
  if(!confirm("¿Estás seguro de que deseas eliminar este ticket de forma permanente? Esta acción no se puede deshacer.")) return;
  try {
    const { error } = await supabaseClient.from('support_tickets').delete().eq('id', id);
    if(error) throw error;
    // Recargar tickets
    if (isAdmin) {
      loadAllTickets();
    } else {
      loadMyTickets();
    }
  } catch (err) {
    console.error("Error al borrar ticket:", err);
    alert("Hubo un error al eliminar el ticket.");
  }
};

async function openChat(ticket) {
  currentChatTicketId = ticket.id;
  
  const modal = document.getElementById('chat-modal');
  const title = document.getElementById('chat-title');
  const context = document.getElementById('chat-context');
  const messagesContainer = document.getElementById('chat-messages');
  
  title.textContent = isAdmin ? `Chat con ${cleanUserName(ticket.user_name)}` : 'Soporte IT';
  context.innerHTML = `<strong>Módulo:</strong> ${ticket.module} <br/> <strong>Problema:</strong> ${ticket.description}`;
  messagesContainer.innerHTML = '<p style="text-align:center; color:var(--clr-text-muted); font-size:0.8rem; margin:auto;">Cargando mensajes...</p>';
  
  modal.classList.remove('hidden');

  // Load existing messages
  await loadChatMessages();
  
  // Marcar como leídos los mensajes recibidos
  markMessagesAsRead();
  
  // Subscribe to new messages
  subscribeToChat();
}

async function closeTicket() {
  if (!currentChatTicketId || !supabaseClient) return;
  const confirmClose = confirm("¿Estás seguro de que deseas cerrar el ticket? Se borrarán todos los mensajes del chat.");
  if (!confirmClose) return;

  try {
    // Borrar todos los mensajes de este ticket
    await supabaseClient
      .from('support_chats')
      .delete()
      .eq('ticket_id', currentChatTicketId);

    // Marcar ticket como resuelto
    await supabaseClient
      .from('support_tickets')
      .update({ status: 'resolved' })
      .eq('id', currentChatTicketId);

    alert("Ticket cerrado correctamente.");
    closeChat();
    
    // Refrescar la lista de tickets
    if (isAdmin) {
      loadAllTickets();
    } else {
      loadMyTickets();
    }
  } catch (err) {
    console.error("Error al cerrar ticket:", err);
    alert("Hubo un error al cerrar el ticket.");
  }
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

async function markMessagesAsRead() {
  if (!currentChatTicketId || !supabaseClient) return;
  try {
    await supabaseClient
      .from('support_chats')
      .update({ is_read: true })
      .eq('ticket_id', currentChatTicketId)
      .neq('sender_email', session.email)
      .eq('is_read', false);
  } catch (err) {
    console.error("Error al marcar como leído:", err);
  }
}

let selectedImageFile = null;

function handleImageSelection(e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedImageFile = file;
  const previewImg = document.getElementById('image-preview-img');
  const previewContainer = document.getElementById('image-preview-container');
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    previewImg.src = evt.target.result;
    previewContainer.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearImageAttachment() {
  selectedImageFile = null;
  document.getElementById('chat-file-input').value = '';
  document.getElementById('image-preview-container').classList.add('hidden');
  document.getElementById('image-preview-img').src = '';
}

function appendMessageToUI(msg) {
  const container = document.getElementById('chat-messages');
  // Eliminar mensaje temporal si existe
  const tempMsg = container.querySelector('p[style*="margin:auto"]');
  if(tempMsg) tempMsg.remove();

  const isMe = msg.sender_email === session.email;
  const bubbleClass = isMe ? 'me' : 'other';
  
  const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  let statusIcon = '';
  if (isMe) {
    if (msg.is_read) {
      statusIcon = `<span class="msg-status msg-read">✓✓</span>`;
    } else {
      statusIcon = `<span class="msg-status msg-sent">✓</span>`;
    }
  }

  let imageHtml = '';
  if (msg.image_url) {
    imageHtml = `<div style="margin-bottom:8px;"><img src="${msg.image_url}" alt="Attachment" style="max-width:100%; border-radius:8px;"></div>`;
  }

  const div = document.createElement('div');
  div.id = `msg-${msg.id}`;
  div.className = `chat-bubble ${bubbleClass}`;
  div.innerHTML = `
    ${!isMe ? `<div style="font-weight:bold; font-size:0.75rem; margin-bottom:2px;">${cleanUserName(msg.sender_name)}</div>` : ''}
    ${imageHtml}
    ${msg.message ? `<div>${msg.message}</div>` : ''}
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
  if(!text && !selectedImageFile) return;

  const btn = document.getElementById('btn-send-msg');
  const spinner = document.getElementById('spinner-send');
  btn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    let uploadedImageUrl = null;

    if (selectedImageFile) {
      const fileExt = selectedImageFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('support_attachments')
        .upload(fileName, selectedImageFile);
      
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from('support_attachments')
        .getPublicUrl(fileName);
      
      uploadedImageUrl = publicUrlData.publicUrl;
    }

    // Insert into DB
    const { error } = await supabaseClient
      .from('support_chats')
      .insert([
        {
          ticket_id: currentChatTicketId,
          sender_email: session.email,
          sender_name: session.name || session.email,
          message: text,
          image_url: uploadedImageUrl
        }
      ]);

    if (error) throw error;
    
    input.value = '';
    clearImageAttachment();
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
      // Si el mensaje lo envió la otra persona, marcarlo como leído automáticamente
      if (payload.new.sender_email !== session.email) {
        markMessagesAsRead();
      }
    })
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'support_chats',
      filter: `ticket_id=eq.${currentChatTicketId}`
    }, payload => {
      const msg = payload.new;
      const msgDiv = document.getElementById(`msg-${msg.id}`);
      if (msgDiv && msg.is_read && msg.sender_email === session.email) {
        const iconSpan = msgDiv.querySelector('.msg-status');
        if (iconSpan) {
          iconSpan.className = 'msg-status msg-read';
          iconSpan.textContent = '✓✓';
        }
      }
    })
    .subscribe();
}
