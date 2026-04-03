// ─── State ──────────────────────────────────────────────────────
let state = {
  user: null,
  page: 'login',       // login | register | chat | admin
  adminTab: 'dashboard',
  conversations: [],
  activeConvId: null,
  messages: [],
  typing: false,
  adminData: {},
  kbItems: [],
  users: [],
  kbModal: null,
  kbSearch: '',
};

// ─── Utils ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const api = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
};
const fmtTime = iso => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString() : '—';
const initials = name => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ─── Render ─────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (state.page === 'login') { app.innerHTML = renderLogin(); return; }
  if (state.page === 'register') { app.innerHTML = renderRegister(); return; }
  if (state.page === 'admin') { app.innerHTML = renderAdmin(); bindAdmin(); return; }
  app.innerHTML = renderChat();
  bindChat();
}

// ─── Auth Pages ─────────────────────────────────────────────────
function renderLogin() {
  return `<div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon">A</div>
        <div><div class="auth-logo-text">AcadBot</div><div class="auth-logo-sub">Academic Support Portal</div></div>
      </div>
      <div class="auth-title">Welcome back</div>
      <div class="auth-subtitle">Sign in to your student account</div>
      <div id="auth-error" class="error-msg" style="display:none"></div>
      <div class="form-group"><label class="form-label">Email address</label>
        <input class="form-input" id="login-email" type="email" placeholder="you@university.edu" autocomplete="email"/></div>
      <div class="form-group"><label class="form-label">Password</label>
        <input class="form-input" id="login-pass" type="password" placeholder="••••••••"/></div>
      <button class="btn btn-primary" id="login-btn" onclick="doLogin()">Sign in</button>
      <div class="auth-switch">Don't have an account? <a href="#" onclick="goPage('register')">Register</a></div>
      <div style="margin-top:14px;padding:10px 12px;background:var(--bg3);border-radius:6px;font-size:12px;color:var(--text2);">
        <b>Demo admin:</b> admin@acadbot.edu / admin123
      </div>
    </div>
  </div>`;
}
function renderRegister() {
  return `<div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon">A</div>
        <div><div class="auth-logo-text">AcadBot</div><div class="auth-logo-sub">Academic Support Portal</div></div>
      </div>
      <div class="auth-title">Create account</div>
      <div class="auth-subtitle">Join your university's academic portal</div>
      <div id="auth-error" class="error-msg" style="display:none"></div>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div class="form-group" style="margin-bottom:0"><label class="form-label">Full name</label>
          <input class="form-input" id="reg-name" type="text" placeholder="Your name"/></div>
        <div class="form-group" style="margin-bottom:0"><label class="form-label">Roll number</label>
          <input class="form-input" id="reg-roll" type="text" placeholder="e.g. CS2021001"/></div>
      </div>
      <div class="form-group"><label class="form-label">Email address</label>
        <input class="form-input" id="reg-email" type="email" placeholder="you@university.edu"/></div>
      <div class="form-group"><label class="form-label">Password</label>
        <input class="form-input" id="reg-pass" type="password" placeholder="Min. 6 characters"/></div>
      <button class="btn btn-primary" onclick="doRegister()">Create account</button>
      <div class="auth-switch">Already registered? <a href="#" onclick="goPage('login')">Sign in</a></div>
    </div>
  </div>`;
}

async function doLogin() {
  const email = $('login-email')?.value?.trim();
  const password = $('login-pass')?.value;
  if (!email || !password) return showAuthError('Enter email and password');
  $('login-btn').disabled = true; $('login-btn').textContent = 'Signing in…';
  try {
    const d = await api('POST', '/api/auth/login', { email, password });
    state.user = d.user;
    if (d.user.role === 'admin') { state.page = 'admin'; } else { state.page = 'chat'; await loadConversations(); }
    render();
  } catch(e) { showAuthError(e.message); $('login-btn').disabled = false; $('login-btn').textContent = 'Sign in'; }
}
async function doRegister() {
  const name = $('reg-name')?.value?.trim();
  const roll = $('reg-roll')?.value?.trim();
  const email = $('reg-email')?.value?.trim();
  const password = $('reg-pass')?.value;
  if (!name || !email || !password) return showAuthError('All fields required');
  try {
    const d = await api('POST', '/api/auth/register', { name, email, password, roll_number: roll });
    state.user = d.user;
    state.page = 'chat';
    await loadConversations();
    render();
  } catch(e) { showAuthError(e.message); }
}
function showAuthError(msg) {
  const el = $('auth-error');
  if (el) { el.style.display = 'block'; el.textContent = msg; }
}
async function doLogout() {
  await api('POST', '/api/auth/logout');
  state.user = null; state.conversations = []; state.messages = []; state.activeConvId = null;
  goPage('login');
}
function goPage(p) { state.page = p; render(); }

// ─── Chat ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'What subjects are in Semester 3?',
  'How to get a bonafide certificate?',
  'When are semester-end exams?',
  'Attendance requirement?',
  'How to apply for re-evaluation?',
  'Fee payment deadline?',
];

function renderChat() {
  const convItems = state.conversations.map(c => `
    <div class="conv-item ${c.id === state.activeConvId ? 'active' : ''}" onclick="loadConv('${c.id}')">
      <span style="font-size:13px">💬</span>
      <span class="conv-title">${esc(c.title)}</span>
      <button class="conv-delete" onclick="event.stopPropagation();deleteConv('${c.id}')" title="Delete">×</button>
    </div>`).join('');

  const msgs = state.messages.length ? state.messages.map(renderMsg).join('') :
    `<div class="welcome-screen">
      <div class="welcome-icon">A</div>
      <div class="welcome-title">Hi ${esc(state.user?.name?.split(' ')[0] || 'Student')} 👋</div>
      <div class="welcome-sub">Ask me anything about your syllabus, exams, deadlines, or university procedures. I'm here 24/7.</div>
      <div class="welcome-chips">${SUGGESTIONS.map(s => `<button class="welcome-chip" onclick="useSugg('${esc(s)}')">${esc(s)}</button>`).join('')}</div>
    </div>`;

  const typingRow = state.typing ? `<div class="msg-row bot">
    <div class="msg-avatar bot">AB</div>
    <div class="msg-body"><div class="msg-bubble bot"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>
  </div>` : '';

  const adminLink = state.user?.role === 'admin'
    ? `<button class="btn-ghost" style="font-size:12px;padding:5px 10px" onclick="goAdminPanel()">⚙ Admin</button>` : '';

  return `<div class="app-layout">
    <div class="sidebar">
      <div class="sidebar-top">
        <div class="sidebar-brand">
          <div class="brand-icon">A</div>
          <div><div class="brand-name">AcadBot</div><div class="brand-tag">Academic Support</div></div>
        </div>
        <button class="new-chat-btn" onclick="newConv()">+ New conversation</button>
      </div>
      <div class="sidebar-section">Recent Chats</div>
      <div class="conv-list" id="conv-list">
        ${convItems || '<div class="empty-state">No conversations yet</div>'}
      </div>
      <div class="sidebar-bottom">
        <div class="user-info">
          <div class="user-avatar">${initials(state.user?.name)}</div>
          <div style="flex:1;min-width:0"><div class="user-name">${esc(state.user?.name)}</div><div class="user-role">${state.user?.role}</div></div>
          ${adminLink}
          <button class="logout-btn" onclick="doLogout()" title="Logout">⏻</button>
        </div>
      </div>
    </div>
    <div class="chat-area">
      <div class="chat-header">
        <div class="online-dot"></div>
        <div class="chat-header-title">Academic Assistant</div>
        <span class="header-badge">Gemini AI</span>
      </div>
      <div class="messages-area" id="messages-area">${msgs}${typingRow}</div>
      <div class="chat-input-area">
        <div class="suggestions-row" id="sugg-row">
          ${SUGGESTIONS.slice(0,4).map(s=>`<button class="sugg-btn" onclick="useSugg('${esc(s)}')">${esc(s)}</button>`).join('')}
        </div>
        <div class="input-row">
          <textarea class="msg-input" id="msg-input" placeholder="Ask about syllabus, exams, deadlines…" rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg()}"
            oninput="autoResize(this)"></textarea>
          <button class="send-btn" id="send-btn" onclick="sendMsg()">➤</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderMsg(m) {
  const role = m.role === 'assistant' ? 'bot' : 'user';
  const av = role === 'bot' ? 'AB' : initials(state.user?.name);
  const tagHtml = m.topic_tag && role === 'bot' ? `<span class="msg-tag tag-${m.topic_tag}">${m.topic_tag}</span>` : '';
  return `<div class="msg-row ${role}">
    <div class="msg-avatar ${role}">${av}</div>
    <div class="msg-body">
      ${tagHtml}
      <div class="msg-bubble ${role}">${esc(m.content).replace(/\n/g,'<br>')}</div>
      <div class="msg-time">${fmtTime(m.created_at || new Date())}</div>
    </div>
  </div>`;
}

function bindChat() {
  scrollMsgs();
}
function scrollMsgs() {
  const el = $('messages-area');
  if (el) el.scrollTop = el.scrollHeight;
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
function useSugg(s) {
  const inp = $('msg-input');
  if (inp) { inp.value = s; inp.focus(); sendMsg(); }
}

async function loadConversations() {
  try { const d = await api('GET', '/api/conversations'); state.conversations = d.conversations; }
  catch(e) { state.conversations = []; }
}
async function newConv() {
  state.activeConvId = null;
  state.messages = [];
  render();
}
async function loadConv(id) {
  state.activeConvId = id;
  try {
    const d = await api('GET', `/api/conversations/${id}`);
    state.messages = d.messages;
  } catch(e) { state.messages = []; }
  render();
}
async function deleteConv(id) {
  await api('DELETE', `/api/conversations/${id}`);
  if (state.activeConvId === id) { state.activeConvId = null; state.messages = []; }
  await loadConversations();
  render();
}
async function sendMsg() {
  const inp = $('msg-input');
  const text = inp?.value?.trim();
  if (!text || state.typing) return;
  inp.value = ''; inp.style.height = 'auto';
  $('send-btn').disabled = true;
  const now = new Date().toISOString();
  state.messages.push({ role: 'user', content: text, created_at: now });
  state.typing = true;
  render();
  try {
    const d = await api('POST', '/api/chat', { message: text, conversation_id: state.activeConvId });
    state.activeConvId = d.conversation_id;
    state.messages.push({ role: 'assistant', content: d.reply, topic_tag: d.tag, created_at: new Date().toISOString() });
    await loadConversations();
  } catch(e) {
    state.messages.push({ role: 'assistant', content: 'Sorry, something went wrong. Please try again.', created_at: new Date().toISOString() });
  }
  state.typing = false;
  render();
}

// ─── Admin ───────────────────────────────────────────────────────
function goAdminPanel() { state.page = 'admin'; loadAdminData(); render(); }
function goChat() { state.page = 'chat'; render(); }

async function loadAdminData() {
  try {
    const [stats, kb, users] = await Promise.all([
      api('GET', '/api/admin/stats'),
      api('GET', '/api/admin/knowledge'),
      api('GET', '/api/admin/users'),
    ]);
    state.adminData = stats;
    state.kbItems = kb.items;
    state.users = users.users;
    render();
  } catch(e) {}
}

function renderAdmin() {
  const tab = state.adminTab;
  return `<div class="admin-layout">
    <div class="admin-nav">
      <div class="admin-brand"><div class="admin-brand-name">AcadBot Admin</div><div class="admin-brand-sub">Management Console</div></div>
      <div class="admin-nav-items">
        ${['dashboard','users','knowledge','analytics'].map(t => `
          <button class="admin-nav-item ${tab===t?'active':''}" onclick="switchAdminTab('${t}')">
            <span class="admin-nav-icon">${{dashboard:'📊',users:'👥',knowledge:'📚',analytics:'📈'}[t]}</span>
            ${{dashboard:'Dashboard',users:'Users',knowledge:'Knowledge Base',analytics:'Analytics'}[t]}
          </button>`).join('')}
      </div>
      <div class="admin-exit">
        <button class="admin-exit-btn" onclick="goChat()">← Back to Chat</button>
      </div>
    </div>
    <div class="admin-content">
      <div class="admin-inner">
        ${tab==='dashboard' ? renderDashboard() : ''}
        ${tab==='users' ? renderUsers() : ''}
        ${tab==='knowledge' ? renderKnowledge() : ''}
        ${tab==='analytics' ? renderAnalytics() : ''}
      </div>
    </div>
  </div>
  ${state.kbModal ? renderKbModal() : ''}`;
}

function renderDashboard() {
  const d = state.adminData;
  const bars = (d.dailyActivity || []);
  const maxBar = Math.max(...bars.map(b=>b.count), 1);
  return `
    <div class="admin-page-title">Dashboard</div>
    <div class="admin-page-sub">Overview of AcadBot usage and activity</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${d.totalUsers||0}</div></div>
      <div class="stat-card"><div class="stat-label">Total Messages</div><div class="stat-value">${d.totalMessages||0}</div></div>
      <div class="stat-card"><div class="stat-label">Conversations</div><div class="stat-value">${d.totalConversations||0}</div></div>
      <div class="stat-card"><div class="stat-label">Today's Messages</div><div class="stat-value">${d.todayMessages||0}</div></div>
      <div class="stat-card"><div class="stat-label">Avg Response</div><div class="stat-value">${d.avgResponseTime||0}<span style="font-size:14px;font-weight:400;color:var(--text2)">ms</span></div></div>
    </div>
    <div class="admin-grid2">
      <div class="admin-card">
        <div class="admin-card-title">7-Day Activity</div>
        <div class="bar-chart">
          ${bars.map(b=>`<div class="bar-col">
            <div class="bar-fill" style="height:${Math.round((b.count/maxBar)*80)+4}px" title="${b.count} messages"></div>
            <div class="bar-label">${b.day?.slice(5)||''}</div>
          </div>`).join('') || '<div style="color:var(--text3);font-size:13px;align-self:center;margin:auto">No data yet</div>'}
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">Top Topics</div>
        ${(d.topTopics||[]).map(t=>`<div class="topic-bar">
          <div class="topic-bar-label"><span>${t.topic_tag}</span><span>${t.count}</span></div>
          <div class="topic-bar-track"><div class="topic-bar-fill" style="width:${Math.round((t.count/(d.topTopics[0]?.count||1))*100)}%"></div></div>
        </div>`).join('') || '<div style="color:var(--text3);font-size:13px">No data yet</div>'}
      </div>
    </div>
    <div class="admin-card">
      <div class="admin-card-title">Recent Users</div>
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Last Login</th></tr></thead>
        <tbody>${(d.recentUsers||[]).map(u=>`<tr>
          <td><b>${esc(u.name)}</b></td>
          <td style="color:var(--text2)">${esc(u.email)}</td>
          <td><span class="badge badge-${u.role||'student'}">${u.role||'student'}</span></td>
          <td>${fmtDate(u.created_at)}</td>
          <td>${fmtDate(u.last_login)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function renderUsers() {
  return `
    <div class="admin-page-title">User Management</div>
    <div class="admin-page-sub">All registered users (${state.users.length})</div>
    <div class="kb-table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Roll No.</th><th>Role</th><th>Joined</th><th>Last Login</th><th></th></tr></thead>
        <tbody>${state.users.map(u=>`<tr>
          <td><b>${esc(u.name)}</b></td>
          <td>${esc(u.email)}</td>
          <td style="color:var(--text3);font-family:'DM Mono',monospace;font-size:12px">${esc(u.roll_number)||'—'}</td>
          <td><span class="badge badge-${u.role}">${u.role}</span></td>
          <td>${fmtDate(u.created_at)}</td>
          <td>${fmtDate(u.last_login)}</td>
          <td>${u.id !== state.user?.id ? `<button class="btn-danger" onclick="deleteUser(${u.id})">Remove</button>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function renderKnowledge() {
  const q = state.kbSearch.toLowerCase();
  const filtered = state.kbItems.filter(k => !q || k.title.toLowerCase().includes(q) || k.category.toLowerCase().includes(q));
  return `
    <div class="admin-page-title">Knowledge Base</div>
    <div class="admin-page-sub">Manage the AI's academic knowledge (${state.kbItems.length} entries)</div>
    <div class="kb-table-wrap">
      <div class="kb-toolbar">
        <input class="kb-search" placeholder="Search entries…" value="${esc(state.kbSearch)}" oninput="kbSearch(this.value)"/>
        <button class="btn-add" onclick="openKbModal(null)">+ Add Entry</button>
      </div>
      <table class="table">
        <thead><tr><th>Category</th><th>Title</th><th>Status</th><th>Updated</th><th></th></tr></thead>
        <tbody>${filtered.map(k=>`<tr>
          <td><span class="badge" style="background:var(--blue-bg);color:var(--blue)">${esc(k.category)}</span></td>
          <td><b>${esc(k.title)}</b><div style="font-size:11px;color:var(--text3);margin-top:2px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.content)}</div></td>
          <td><span class="badge ${k.is_active?'badge-active':'badge-inactive'}">${k.is_active?'Active':'Inactive'}</span></td>
          <td style="font-size:12px;color:var(--text3)">${fmtDate(k.updated_at)}</td>
          <td>
            <button class="kb-edit-btn" onclick="openKbModal(${k.id})">Edit</button>
            <button class="btn-danger" onclick="deleteKb(${k.id})">Delete</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function renderAnalytics() {
  const d = state.adminData;
  return `
    <div class="admin-page-title">Analytics</div>
    <div class="admin-page-sub">Usage insights and performance metrics</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total Queries</div><div class="stat-value">${d.totalMessages||0}</div><div class="stat-sub">All time</div></div>
      <div class="stat-card"><div class="stat-label">Today</div><div class="stat-value">${d.todayMessages||0}</div><div class="stat-sub">Queries today</div></div>
      <div class="stat-card"><div class="stat-label">Avg Response</div><div class="stat-value">${d.avgResponseTime||0}ms</div><div class="stat-sub">AI latency</div></div>
      <div class="stat-card"><div class="stat-label">Active Users</div><div class="stat-value">${d.totalUsers||0}</div><div class="stat-sub">Registered students</div></div>
    </div>
    <div class="admin-grid2">
      <div class="admin-card">
        <div class="admin-card-title">Topic Distribution</div>
        ${(d.topTopics||[]).map(t=>`<div class="topic-bar">
          <div class="topic-bar-label"><span style="text-transform:capitalize">${t.topic_tag}</span><span>${t.count} queries</span></div>
          <div class="topic-bar-track"><div class="topic-bar-fill" style="width:${Math.round((t.count/(d.topTopics[0]?.count||1))*100)}%"></div></div>
        </div>`).join('') || '<div class="empty-state">No analytics data yet</div>'}
      </div>
      <div class="admin-card">
        <div class="admin-card-title">Daily Activity (7 days)</div>
        <div class="bar-chart">
          ${(d.dailyActivity||[]).map(b=>{
            const max = Math.max(...(d.dailyActivity||[]).map(x=>x.count),1);
            return `<div class="bar-col">
              <div style="font-size:10px;color:var(--text3);margin-bottom:2px">${b.count}</div>
              <div class="bar-fill" style="height:${Math.round((b.count/max)*70)+4}px"></div>
              <div class="bar-label">${(b.day||'').slice(5)}</div>
            </div>`;
          }).join('') || '<div style="color:var(--text3);font-size:13px;margin:auto">No data</div>'}
        </div>
      </div>
    </div>`;
}

function renderKbModal() {
  const item = state.kbModal === 'new' ? null : state.kbItems.find(k => k.id === state.kbModal);
  const cats = ['FAQ','Syllabus','Exam Rules','Internal Assessments','Deadlines','Procedures'];
  return `<div class="modal-overlay" onclick="if(event.target===this)closeKbModal()">
    <div class="modal">
      <div class="modal-title">${item ? 'Edit Entry' : 'Add Knowledge Entry'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div><label class="form-label">Category</label>
          <select class="form-select" id="kb-cat">
            ${cats.map(c=>`<option ${(item?.category||'FAQ')===c?'selected':''}>${c}</option>`).join('')}
          </select></div>
        <div><label class="form-label">Status</label>
          <select class="form-select" id="kb-active">
            <option value="1" ${(!item||item.is_active)?'selected':''}>Active</option>
            <option value="0" ${item&&!item.is_active?'selected':''}>Inactive</option>
          </select></div>
      </div>
      <div style="margin-bottom:14px"><label class="form-label">Title</label>
        <input class="form-input" id="kb-title" value="${esc(item?.title||'')}" placeholder="e.g. Attendance Policy"/></div>
      <div><label class="form-label">Content</label>
        <textarea class="form-textarea" id="kb-content" placeholder="Detailed information…">${esc(item?.content||'')}</textarea></div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="closeKbModal()">Cancel</button>
        <button class="btn-save" onclick="saveKb(${item?.id||'null'})">${item ? 'Save Changes' : 'Add Entry'}</button>
      </div>
    </div>
  </div>`;
}

function switchAdminTab(tab) { state.adminTab = tab; render(); }
function kbSearch(v) { state.kbSearch = v; render(); }
function openKbModal(id) { state.kbModal = id === null ? 'new' : id; render(); }
function closeKbModal() { state.kbModal = null; render(); }

async function saveKb(id) {
  const category = $('kb-cat').value;
  const title = $('kb-title').value.trim();
  const content = $('kb-content').value.trim();
  const is_active = parseInt($('kb-active').value);
  if (!title || !content) return alert('Title and content required');
  try {
    if (id) { await api('PUT', `/api/admin/knowledge/${id}`, { category, title, content, is_active }); }
    else { await api('POST', '/api/admin/knowledge', { category, title, content }); }
    state.kbModal = null;
    await loadAdminData();
  } catch(e) { alert(e.message); }
}
async function deleteKb(id) {
  if (!confirm('Delete this knowledge entry?')) return;
  await api('DELETE', `/api/admin/knowledge/${id}`);
  await loadAdminData();
}
async function deleteUser(id) {
  if (!confirm('Remove this user? All their data will be deleted.')) return;
  await api('DELETE', `/api/admin/users/${id}`);
  await loadAdminData();
}
function bindAdmin() {}

// ─── Bootstrap ──────────────────────────────────────────────────
(async () => {
  try {
    const d = await api('GET', '/api/auth/me');
    state.user = d.user;
    if (d.user.role === 'admin') {
      state.page = 'admin';
      render();
      loadAdminData();
    } else {
      state.page = 'chat';
      await loadConversations();
      render();
    }
  } catch {
    state.page = 'login';
    render();
  }
})();
