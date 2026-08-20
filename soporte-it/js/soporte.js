const ADMIN_EMAIL = 'noreplyreciminsasrl@gmail.com';
let session = null;
let isAdmin = false;
let currentChatTicketId = null;
let chatSubscription = null;

// Failsafe initialization for Supabase client
function ensureSupabaseConnected() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    try {
      if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        const _dec = (str) => { try { return atob(str); } catch (e) { return ""; } };
        const DEFAULT_URL = _dec("aHR0cHM6Ly93a3Fnc3ByZ3p0cXhtb3ZvamV3dS5zdXBhYmFzZS5jbw==");
        const DEFAULT_KEY = _dec("c2JfcHVibGlzaGFibGVfTXE2bUV4NXFTSXh2Nm12dF9ETmFFd19OVGVVSUZQdg==");
        const url = localStorage.getItem('recim_db_url') || DEFAULT_URL;
        const key = localStorage.getItem('recim_db_key') || DEFAULT_KEY;
        window.supabaseClient = supabase.createClient(url, key);
        window.isSupabaseActive = true;
      }
    } catch (e) {
      console.warn("⚠️ Error en respaldo de conexión Supabase en soporte.js:", e);
    }
  }
}
// Helper fallback for userKey in soporte.js
if (typeof userKey !== 'function') {
  window.userKey = function(baseKey) {
    try {
      const sessionStr = localStorage.getItem('recim_session');
      if (sessionStr) {
        const u = JSON.parse(sessionStr);
        if (u && u.accountId) {
          const scope = u.familyId ? `family_${u.familyId}` : u.accountId;
          return `${baseKey}_${scope}`;
        }
      }
    } catch (e) {
      console.error('Error in userKey fallback:', e);
    }
    return baseKey;
  };
}

// Animated Toast Notification System for Soporte IT
if (typeof showToast !== 'function') {
  window.showToast = function(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    try {
      if (navigator.vibrate) {
        if (type === 'error') navigator.vibrate([30, 50, 30]);
        else if (type === 'warning') navigator.vibrate([25]);
        else navigator.vibrate([15]);
      }
    } catch (_) {}

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    let icon = '🔔';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `<span style="font-size:1.15rem; flex-shrink:0;">${icon}</span><span style="flex:1;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };
}

function cleanUserName(name) {
  if (!name) return '';
  return name.split(' | ')[0].trim();
}
// --- Funciones para el Visor de Imágenes ---
function openImageFullscreen(url) {
  document.getElementById('image-viewer-img').src = url;
  const modal = document.getElementById('image-viewer-modal');
  modal.classList.remove('hidden');
  
  // Ocultamos el scroll del body
  document.body.style.overflow = 'hidden';
}

function closeImageViewer() {
  const modal = document.getElementById('image-viewer-modal');
  modal.classList.add('hidden');
  document.getElementById('image-viewer-img').src = '';
  
  // Restauramos el scroll del body
  document.body.style.overflow = 'auto';
}

// Esperar a que el DOM cargue y supabase esté listo
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  if (typeof translateSupportITPage === 'function') translateSupportITPage();

  // Verificar sesión
  const sessionStr = localStorage.getItem('recim_session');
  if (!sessionStr) {
    showToast(typeof t === 'function' ? t('sup.ticket_alert_login') : "Debes iniciar sesión para acceder al Soporte IT.", 'warning');
    setTimeout(() => { window.location.href = "../index.html"; }, 1500);
    return;
  }
  
  session = JSON.parse(sessionStr);
  isAdmin = (session.email === ADMIN_EMAIL || session.email === 'keyletsebas@gmail.com');

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

function translateSupportITPage() {
  if (typeof t !== 'function') return;
  
  try {
    const selectors = [
      { sel: 'header .btn-secondary', key: 'sup.back', prop: 'innerHTML' },
      { sel: 'header .topbar-title', key: 'sup.title', prop: 'innerHTML' },
      { sel: '#loading-state p', key: 'sup.verifying', prop: 'innerHTML' },
      { sel: '#user-view .section-title', key: 'sup.report_title', prop: 'innerHTML' },
      { sel: '#ticket-module option[value=""]', key: 'sup.select_module', prop: 'innerHTML' },
      { sel: '#ticket-desc', key: 'sup.desc_ph', prop: 'placeholder' },
      { sel: '#btn-submit-ticket span', key: 'sup.submit_btn', prop: 'innerHTML' },
      { sel: '#user-view .card:nth-child(2) .section-title', key: 'sup.my_tickets', prop: 'innerHTML' },
      { sel: '#my-tickets-list p', key: 'sup.loading_tickets', prop: 'innerHTML' },
      { sel: '#admin-view .section-title', key: 'sup.admin_title', prop: 'innerHTML' },
      { sel: '#admin-view button.btn-secondary', key: 'sup.refresh_btn', prop: 'innerHTML' },
      { sel: '#admin-tickets-list p', key: 'sup.admin_loading', prop: 'innerHTML' },
      { sel: '#chat-title', key: 'sup.title', prop: 'innerHTML' },
      { sel: '#btn-close-ticket', key: 'sup.close_ticket', prop: 'innerHTML' },
      { sel: '#chat-messages p', key: 'sup.chat_conn', prop: 'innerHTML' },
      { sel: '#image-preview-container button', key: 'btn.cancel', prop: 'innerHTML', prefix: '✕ ' },
      { sel: '#chat-form button:nth-of-type(1)', key: 'sup.attach_img', prop: 'title' },
      { sel: '#chat-input', key: 'sup.write_msg_ph', prop: 'placeholder' },
      { sel: '#btn-send-msg', key: 'sup.send_title', prop: 'title' }
    ];

    selectors.forEach(item => {
      const el = document.querySelector(item.sel);
      if (el) {
        let txt = t(item.key);
        if (item.prefix) txt = item.prefix + txt;
        el[item.prop] = txt;
      }
    });

    const labels = document.querySelectorAll('#user-view .form-label');
    const labelKeys = ['sup.user_lbl', 'sup.module_lbl', 'sup.date_lbl', 'sup.spec_lbl'];
    labels.forEach((el, idx) => {
      if (labelKeys[idx]) el.innerHTML = t(labelKeys[idx]);
    });
  } catch(e) {
    console.error("Error translating Support IT page:", e);
  }
}

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
      const themesList = typeof COLOR_THEMES !== 'undefined' ? COLOR_THEMES : (window.COLOR_THEMES || []);
      const theme = themesList.find(t => t.id === settings.colorTheme);
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
  const select = document.getElementById('ticket-user');
  if (!select) return;

  // Clear previous options
  select.innerHTML = '';

  // 1. Add current user
  const meOption = document.createElement('option');
  meOption.value = session.email;
  meOption.textContent = `${cleanUserName(session.name)} (${session.email}) [Tú]`;
  select.appendChild(meOption);

  // 2. Add local company collaborators
  const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
  colabs.forEach(c => {
    const colabOption = document.createElement('option');
    colabOption.value = c.email || `${c.name}@collaborator.local`;
    colabOption.textContent = `${c.name} (${c.role})`;
    select.appendChild(colabOption);
  });
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
    showToast("⚠️ Error de conexión a la base de datos.", 'error');
    btn.disabled = false;
    spinner.classList.add('hidden');
    return;
  }

  try {
    ensureSupabaseConnected();
    if (!supabaseClient) {
      showToast("❌ Error de conexión: No se pudo conectar con Supabase. Verifica tu internet.", 'error');
      return;
    }

    const selectedReporterValue = document.getElementById('ticket-user').value;
    
    // Find if it's a collaborator or the user
    const colabs = JSON.parse(localStorage.getItem(userKey('recim_collaborators')) || '[]');
    const matchedColab = colabs.find(c => (c.email === selectedReporterValue || `${c.name}@collaborator.local` === selectedReporterValue));
    
    const companyId = session.familyId || 'Ninguna';
    const companyName = JSON.parse(localStorage.getItem('recim_settings') || '{}').companyName || 'Reciminsa';
    
    let formattedUserName = '';
    if (matchedColab) {
      formattedUserName = `${cleanUserName(session.name)} | Empresa: ${companyName} (${companyId}) | Colaborador: ${matchedColab.name}`;
    } else {
      formattedUserName = `${cleanUserName(session.name)} | Empresa: ${companyName} (${companyId}) | Cuenta Principal`;
    }

    const ticketPayload = {
      user_email: session.email, // Keep in reporter's dashboard
      user_name: formattedUserName,
      module: moduleVal,
      issue_date: dateVal,
      description: descVal,
      status: 'open'
    };

    // Generar UUID en cliente para compatibilidad universal con Supabase
    if (window.crypto && window.crypto.randomUUID) {
      ticketPayload.id = window.crypto.randomUUID();
    }

    let { data, error } = await supabaseClient
      .from('support_tickets')
      .insert([ticketPayload]);

    // Reintento sin ID de cliente si falla por restricciones de UUID del servidor
    if (error && ticketPayload.id) {
      console.warn("⚠️ Reintentando inserción en Supabase sin ID de cliente...", error);
      delete ticketPayload.id;
      const retryRes = await supabaseClient
        .from('support_tickets')
        .insert([ticketPayload]);
      error = retryRes.error;
      data = retryRes.data;
    }

    if (error) throw error;

    showToast("✅ Reclamo enviado correctamente. El equipo de soporte se pondrá en contacto pronto.", 'success', 4000);
    document.getElementById('ticket-form').reset();
    document.getElementById('ticket-user').value = session.email;
    loadMyTickets();
  } catch (err) {
    console.error("Error al enviar reclamo:", err);
    const detail = err ? (err.message || err.details || JSON.stringify(err)) : '';
    showToast(`❌ Error al enviar el reclamo: ${detail}`, 'error', 5000);
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

      // Parse detailed company metadata for admin
      let userDisplay = ticket.user_name || 'Desconocido';
      if (ticket.user_name && ticket.user_name.includes(' | ')) {
        const parts = ticket.user_name.split(' | ');
        const userName = parts[0].trim();
        const companyPart = parts.find(p => p.startsWith('Empresa:')) || 'Empresa: N/A';
        const colabPart = parts.find(p => p.startsWith('Colaborador:')) || '';
        
        userDisplay = `${userName} (${companyPart.replace('Empresa:', '').trim()})${colabPart ? ` - Colab: ` + colabPart.replace('Colaborador:', '').trim() : ''}`;
      }

      const card = document.createElement('div');
      card.className = 'ticket-card';
      card.onclick = () => openChat(ticket);

      card.innerHTML = `
        <div class="ticket-card-header">
          <span class="ticket-module-badge">${ticket.module}</span>
          <span class="ticket-status ${statusClass}">${statusText}</span>
        </div>
        <h4 class="ticket-title">${showUserInfo ? `Reclamo de: ${userDisplay}` : 'Mi Reclamo'}</h4>
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
    showToast("🗑️ Ticket eliminado con éxito", 'success');
    // Recargar tickets
    if (isAdmin) {
      loadAllTickets();
    } else {
      loadMyTickets();
    }
  } catch (err) {
    console.error("Error al borrar ticket:", err);
    showToast("❌ Hubo un error al eliminar el ticket.", 'error');
  }
};

async function openChat(ticket) {
  currentChatTicketId = ticket.id;
  
  const modal = document.getElementById('chat-modal');
  const title = document.getElementById('chat-title');
  const context = document.getElementById('chat-context');
  const messagesContainer = document.getElementById('chat-messages');
  
  let userDisplay = ticket.user_name || 'Desconocido';
  if (ticket.user_name && ticket.user_name.includes(' | ')) {
    const parts = ticket.user_name.split(' | ');
    const userName = parts[0].trim();
    const companyPart = parts.find(p => p.startsWith('Empresa:')) || 'Empresa: N/A';
    const colabPart = parts.find(p => p.startsWith('Colaborador:')) || '';
    userDisplay = `${userName} (${companyPart.replace('Empresa:', '').trim()})${colabPart ? ` - Colab: ` + colabPart.replace('Colaborador:', '').trim() : ''}`;
  }

  title.textContent = isAdmin ? `Chat con ${userDisplay}` : 'Soporte IT';
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
  const confirmClose = confirm("¿Estás seguro de que deseas cerrar y eliminar este ticket de forma permanente? Se borrarán todos los datos y mensajes asociados.");
  if (!confirmClose) return;

  try {
    // Eliminar el ticket por completo (los mensajes se borran automáticamente por ON DELETE CASCADE)
    await supabaseClient
      .from('support_tickets')
      .delete()
      .eq('id', currentChatTicketId);

    showToast("✅ Ticket cerrado correctamente.", 'success');
    closeChat();
    
    // Refrescar la lista de tickets
    if (isAdmin) {
      loadAllTickets();
    } else {
      loadMyTickets();
    }
  } catch (err) {
    console.error("Error al cerrar ticket:", err);
    showToast("❌ Hubo un error al cerrar el ticket.", 'error');
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
    imageHtml = `<div style="margin-bottom:8px;"><img src="${msg.image_url}" alt="Attachment" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="openImageFullscreen('${msg.image_url}')"></div>`;
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
    showToast("❌ No se pudo enviar el mensaje.", 'error');
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
        
        // Disparar Notificación Push en Móvil si estamos en background
        if (document.visibilityState !== 'visible') {
            const title = 'Soporte IT: Nuevo Mensaje';
            const body = `${payload.new.sender_name}: ${payload.new.message}`;
            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.Plugins.LocalNotifications) {
                Capacitor.Plugins.LocalNotifications.requestPermissions().then((result) => {
                    if (result.display === 'granted') {
                        Capacitor.Plugins.LocalNotifications.schedule({
                            notifications: [{
                                title: title, body: body, id: new Date().getTime(), schedule: { at: new Date(Date.now() + 500) }
                            }]
                        });
                    }
                });
            } else if ('Notification' in window) {
                if (Notification.permission === 'granted') new Notification(title, { body: body });
                else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') new Notification(title, { body: body }); });
            }
        }
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
