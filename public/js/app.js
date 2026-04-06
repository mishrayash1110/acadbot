let state={user:null,page:'login',adminTab:'dashboard',conversations:[],activeConvId:null,messages:[],typing:false,adminData:{},kbItems:[],users:[],kbModal:null,kbSearch:'',sidebarOpen:false};
const $=id=>document.getElementById(id);
const api=async(method,url,body)=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'include'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d;};
const fmtTime=iso=>new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const fmtDate=iso=>iso?new Date(iso).toLocaleDateString():'—';
const initials=name=>name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'??';
const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function render(){
  const app=document.getElementById('app');
  if(state.page==='login'){app.innerHTML=renderLogin();return;}
  if(state.page==='register'){app.innerHTML=renderRegister();return;}
  if(state.page==='admin'){app.innerHTML=renderAdmin();return;}
  app.innerHTML=renderChat();bindChat();
}

/* ── AUTH ── */
function renderLogin(){
  return `<div class="auth-page"><div class="auth-card">
    <div class="auth-logo"><div class="auth-logo-icon">A</div>
      <div><div class="auth-logo-text">AcadBot</div><div class="auth-logo-sub">Academic Support Portal</div></div></div>
    <div class="auth-title">Welcome back 👋</div>
    <div class="auth-subtitle">Sign in to your student account</div>
    <div id="auth-error" class="error-msg" style="display:none"></div>
    <div class="form-group"><label class="form-label">Email address</label>
      <input class="form-input" id="login-email" type="email" placeholder="you@university.edu" autocomplete="email"/></div>
    <div class="form-group"><label class="form-label">Password</label>
      <input class="form-input" id="login-pass" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLogin()"/></div>
    <button class="btn btn-primary" id="login-btn" onclick="doLogin()">Sign in →</button>
    <div class="auth-switch">No account? <a href="#" onclick="goPage('register')">Register here</a></div>
  </div></div>`;
}
function renderRegister(){
  return `<div class="auth-page"><div class="auth-card">
    <div class="auth-logo"><div class="auth-logo-icon">A</div>
      <div><div class="auth-logo-text">AcadBot</div><div class="auth-logo-sub">Academic Support Portal</div></div></div>
    <div class="auth-title">Create account 🎓</div>
    <div class="auth-subtitle">Join your university's academic portal</div>
    <div id="auth-error" class="error-msg" style="display:none"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Full name</label>
        <input class="form-input" id="reg-name" type="text" placeholder="Your name"/></div>
      <div class="form-group"><label class="form-label">Roll No.</label>
        <input class="form-input" id="reg-roll" type="text" placeholder="CS2021001"/></div>
    </div>
    <div class="form-group"><label class="form-label">Email address</label>
      <input class="form-input" id="reg-email" type="email" placeholder="you@university.edu"/></div>
    <div class="form-group"><label class="form-label">Password</label>
      <input class="form-input" id="reg-pass" type="password" placeholder="Min. 6 characters"/></div>
    <button class="btn btn-primary" onclick="doRegister()">Create account →</button>
    <div class="auth-switch">Already registered? <a href="#" onclick="goPage('login')">Sign in</a></div>
  </div></div>`;
}

async function doLogin(){
  const email=$('login-email')?.value?.trim(),password=$('login-pass')?.value;
  if(!email||!password)return showAuthError('Enter email and password');
  const btn=$('login-btn');btn.disabled=true;btn.textContent='Signing in…';
  try{
    const d=await api('POST','/api/auth/login',{email,password});
    state.user=d.user;
    if(d.user.role==='admin'){state.page='admin';render();loadAdminData();}
    else{state.page='chat';await loadConversations();render();}
  }catch(e){showAuthError(e.message);btn.disabled=false;btn.textContent='Sign in →';}
}
async function doRegister(){
  const name=$('reg-name')?.value?.trim(),roll=$('reg-roll')?.value?.trim(),email=$('reg-email')?.value?.trim(),password=$('reg-pass')?.value;
  if(!name||!email||!password)return showAuthError('All fields required');
  try{const d=await api('POST','/api/auth/register',{name,email,password,roll_number:roll});state.user=d.user;state.page='chat';await loadConversations();render();}
  catch(e){showAuthError(e.message);}
}
function showAuthError(msg){const el=$('auth-error');if(el){el.style.display='block';el.textContent=msg;}}
async function doLogout(){await api('POST','/api/auth/logout');Object.assign(state,{user:null,conversations:[],messages:[],activeConvId:null,sidebarOpen:false});goPage('login');}
function goPage(p){state.page=p;render();}

/* ── CHAT ── */
const SUGGS=['What subjects are in Semester 3?','How to get bonafide certificate?','When are semester-end exams?','What is attendance requirement?','How to apply for re-evaluation?','Fee payment deadline?'];

function renderChat(){
  const convItems=state.conversations.map(c=>`
    <div class="conv-item ${c.id===state.activeConvId?'active':''}" onclick="loadConv('${c.id}');closeSidebar()">
      <span style="font-size:15px">💬</span>
      <span class="conv-title">${esc(c.title)}</span>
      <button class="conv-delete" onclick="event.stopPropagation();deleteConv('${c.id}')">×</button>
    </div>`).join('');

  const msgs=state.messages.length?state.messages.map(renderMsg).join(''):
    `<div class="welcome-screen">
      <div class="welcome-icon">A</div>
      <div class="welcome-title">Hi ${esc(state.user?.name?.split(' ')[0]||'there')} 👋</div>
      <div class="welcome-sub">Ask me anything about syllabus, exams, deadlines, or university procedures. I'm here 24/7.</div>
      <div class="welcome-chips">${SUGGS.map(s=>`<button class="welcome-chip" onclick="useSugg('${esc(s)}')">${esc(s)}</button>`).join('')}</div>
    </div>`;

  const typing=state.typing?`<div class="msg-row bot">
    <div class="msg-avatar bot">AB</div>
    <div class="msg-body"><div class="msg-bubble bot"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>
  </div>`:'';

  const adminBtn=state.user?.role==='admin'?`<button class="nav-icon-btn" onclick="goAdminPanel()" title="Admin">⚙️</button>`:'';

  return `<div class="app-layout">
    <div class="drawer-overlay ${state.sidebarOpen?'open':''}" onclick="closeSidebar()"></div>
    <div class="sidebar ${state.sidebarOpen?'open':''}">
      <div class="sidebar-top">
        <div class="sidebar-brand">
          <div class="brand-icon">A</div>
          <div><div class="brand-name">AcadBot</div><div class="brand-tag">Academic Support</div></div>
        </div>
        <button class="new-chat-btn" onclick="newConv();closeSidebar()">✦ New conversation</button>
      </div>
      <div class="sidebar-section">Recent Chats</div>
      <div class="conv-list">${convItems||'<div class="empty-state">No conversations yet</div>'}</div>
      <div class="sidebar-bottom">
        <div class="user-info">
          <div class="user-avatar">${initials(state.user?.name)}</div>
          <div style="flex:1;min-width:0"><div class="user-name">${esc(state.user?.name)}</div><div class="user-role">${state.user?.role}</div></div>
          <button class="logout-btn" onclick="doLogout()" title="Logout">⏻</button>
        </div>
      </div>
    </div>
    <div class="chat-area">
      <div class="top-nav">
        <button class="nav-menu-btn" onclick="toggleSidebar()">☰</button>
        <div class="nav-title">AcadBot</div>
        <div class="nav-status"><div class="nav-dot"></div>Online</div>
        <div class="nav-actions">${adminBtn}<button class="nav-icon-btn" onclick="doLogout()">⏻</button></div>
      </div>
      <div class="messages-area" id="messages-area">${msgs}${typing}</div>
      <div class="chat-input-area">
        <div class="suggestions-row">${SUGGS.slice(0,5).map(s=>`<button class="sugg-btn" onclick="useSugg('${esc(s)}')">${esc(s)}</button>`).join('')}</div>
        <div class="input-row">
          <textarea class="msg-input" id="msg-input" placeholder="Ask anything academic…" rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg()}"
            oninput="autoResize(this)"></textarea>
          <button class="send-btn" id="send-btn" onclick="sendMsg()">➤</button>
        </div>
      </div>
      <div class="bottom-nav">
        <button class="bottom-nav-item" onclick="newConv()"><span class="bottom-nav-icon">✏️</span>New</button>
        <button class="bottom-nav-item" onclick="toggleSidebar()"><span class="bottom-nav-icon">🕐</span>History</button>
        <button class="bottom-nav-item" onclick="scrollMsgs()"><span class="bottom-nav-icon">⬇️</span>Latest</button>
        ${state.user?.role==='admin'?`<button class="bottom-nav-item" onclick="goAdminPanel()"><span class="bottom-nav-icon">⚙️</span>Admin</button>`:''}
        <button class="bottom-nav-item" onclick="doLogout()"><span class="bottom-nav-icon">👤</span>Logout</button>
      </div>
    </div>
  </div>`;
}

function renderMsg(m){
  const role=m.role==='assistant'?'bot':'user';
  const av=role==='bot'?'AB':initials(state.user?.name);
  const tag=m.topic_tag&&role==='bot'?`<span class="msg-tag tag-${m.topic_tag}">${m.topic_tag.toUpperCase()}</span>`:'';
  return `<div class="msg-row ${role}">
    <div class="msg-avatar ${role}">${av}</div>
    <div class="msg-body">${tag}
      <div class="msg-bubble ${role}">${esc(m.content).replace(/\n/g,'<br>')}</div>
      <div class="msg-time">${fmtTime(m.created_at||new Date())}</div>
    </div></div>`;
}

function bindChat(){scrollMsgs();}
function scrollMsgs(){const el=$('messages-area');if(el)el.scrollTop=el.scrollHeight;}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,110)+'px';}
function useSugg(s){const inp=$('msg-input');if(inp){inp.value=s;sendMsg();}}
function toggleSidebar(){state.sidebarOpen=!state.sidebarOpen;render();}
function closeSidebar(){state.sidebarOpen=false;render();}

async function loadConversations(){try{const d=await api('GET','/api/conversations');state.conversations=d.conversations;}catch(e){state.conversations=[];}}
async function newConv(){state.activeConvId=null;state.messages=[];render();}
async function loadConv(id){state.activeConvId=id;try{const d=await api('GET',`/api/conversations/${id}`);state.messages=d.messages;}catch(e){state.messages=[];}render();}
async function deleteConv(id){await api('DELETE',`/api/conversations/${id}`);if(state.activeConvId===id){state.activeConvId=null;state.messages=[];}await loadConversations();render();}

async function sendMsg(){
  const inp=$('msg-input');const text=inp?.value?.trim();
  if(!text||state.typing)return;
  inp.value='';inp.style.height='auto';
  $('send-btn').disabled=true;
  state.messages.push({role:'user',content:text,created_at:new Date().toISOString()});
  state.typing=true;render();
  try{
    const d=await api('POST','/api/chat',{message:text,conversation_id:state.activeConvId});
    state.activeConvId=d.conversation_id;
    state.messages.push({role:'assistant',content:d.reply,topic_tag:d.tag,created_at:new Date().toISOString()});
    await loadConversations();
  }catch(e){state.messages.push({role:'assistant',content:'Sorry, something went wrong. Please try again.',created_at:new Date().toISOString()});}
  state.typing=false;render();
}

/* ── ADMIN ── */
function goAdminPanel(){state.page='admin';render();loadAdminData();}
function goChat(){state.page='chat';render();}

async function loadAdminData(){
  try{
    const [stats,kb,users]=await Promise.all([api('GET','/api/admin/stats'),api('GET','/api/admin/knowledge'),api('GET','/api/admin/users')]);
    state.adminData=stats;state.kbItems=kb.items;state.users=users.users;render();
  }catch(e){}
}

function renderAdmin(){
  const tab=state.adminTab;
  const tabs=[{id:'dashboard',icon:'📊',label:'Dashboard'},{id:'users',icon:'👥',label:'Users'},{id:'knowledge',icon:'📚',label:'Knowledge'},{id:'analytics',icon:'📈',label:'Analytics'}];
  return `<div class="admin-layout">
    <div class="admin-nav-desktop">
      <div class="admin-brand">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#2563eb,#06b6d4);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:900;font-size:14px">A</div>
          <div class="admin-brand-name">AcadBot</div>
        </div>
        <div class="admin-brand-sub">Admin Console</div>
      </div>
      <div class="nav-items">
        ${tabs.map(t=>`<button class="admin-nav-item ${tab===t.id?'active':''}" onclick="switchAdminTab('${t.id}')">
          <span class="admin-nav-icon">${t.icon}</span>${{dashboard:'Dashboard',users:'Users',knowledge:'Knowledge Base',analytics:'Analytics'}[t.id]}
        </button>`).join('')}
      </div>
      <div class="exit-section"><button class="admin-exit-btn-top" onclick="goChat()">← Back to Chat</button></div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0">
      <div class="admin-top-bar">
        <div class="admin-bar-title">⚙️ Admin Panel</div>
        <button class="admin-exit-btn-top" onclick="goChat()">← Chat</button>
      </div>
      <div class="admin-content">
        <div class="admin-inner">
          ${tab==='dashboard'?renderDashboard():''}
          ${tab==='users'?renderUsers():''}
          ${tab==='knowledge'?renderKnowledge():''}
          ${tab==='analytics'?renderAnalytics():''}
        </div>
      </div>
      <div class="admin-bottom-nav">
        ${tabs.map(t=>`<button class="admin-nav-item ${tab===t.id?'active':''}" onclick="switchAdminTab('${t.id}')">
          <span class="admin-nav-icon">${t.icon}</span>${t.label}
        </button>`).join('')}
      </div>
    </div>
  </div>
  ${state.kbModal?renderKbModal():''}`;
}

/* gradient card helper */
const gcard=(content,extra='')=>`<div class="admin-card" ${extra}>${content}</div>`;

function renderDashboard(){
  const d=state.adminData;
  const bars=d.dailyActivity||[];
  const maxBar=Math.max(...bars.map(b=>b.count),1);
  return `
    <div class="admin-page-title">Dashboard</div>
    <div class="admin-page-sub">AcadBot usage overview • ${new Date().toLocaleDateString()}</div>

    <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px;scrollbar-width:none">
      ${[
        {l:'👥 Students',v:d.totalUsers||0,c:'#3b82f6'},
        {l:'💬 Messages',v:d.totalMessages||0,c:'#10b981'},
        {l:'🗂 Chats',v:d.totalConversations||0,c:'#8b5cf6'},
        {l:'📅 Today',v:d.todayMessages||0,c:'#f59e0b'},
        {l:'⚡ Avg ms',v:d.avgResponseTime||0,c:'#ef4444'},
      ].map(s=>`<div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px 20px;min-width:120px;flex-shrink:0;text-align:center;backdrop-filter:blur(10px)">
        <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:8px;white-space:nowrap">${s.l}</div>
        <div style="font-size:30px;font-weight:700;color:${s.c};line-height:1;font-family:'Playfair Display',serif">${s.v}</div>
      </div>`).join('')}
    </div>

    ${gcard(`<div class="admin-card-title">📈 7-Day Activity</div>
      <div style="display:flex;align-items:flex-end;gap:8px;height:80px">
        ${bars.length?bars.map(b=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:9px;color:#64748b">${b.count}</div>
          <div style="width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#3b82f6,#06b6d4);min-height:4px;height:${Math.round((b.count/maxBar)*60)+4}px"></div>
          <div style="font-size:9px;color:#64748b;text-align:center">${(b.day||'').slice(5)}</div>
        </div>`).join(''):'<div style="color:#475569;font-size:12px;margin:auto;align-self:center;width:100%;text-align:center">No data yet</div>'}
      </div>`)}

    ${gcard(`<div class="admin-card-title">🏷 Top Topics</div>
      ${(d.topTopics||[]).map(t=>`<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span style="text-transform:capitalize;font-weight:600;color:#cbd5e1">${t.topic_tag}</span>
          <span style="color:#64748b;font-weight:700">${t.count}</span>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,#2563eb,#06b6d4);width:${Math.round((t.count/(d.topTopics[0]?.count||1))*100)}%"></div>
        </div>
      </div>`).join('')||'<div class="empty-state">No data yet</div>'}`)}

    ${gcard(`<div class="admin-card-title">🕐 Recent Users</div>
      ${(d.recentUsers||[]).map((u,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 0;${i<(d.recentUsers.length-1)?'border-bottom:1px solid rgba(255,255,255,0.06)':''}">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${initials(u.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.name)}</div>
          <div style="font-size:11px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}</div>
        </div>
        <span class="badge badge-${u.role||'student'}">${u.role||'student'}</span>
      </div>`).join('')||'<div class="empty-state">No users yet</div>'}`)}`;
}

function renderUsers(){
  return `
    <div class="admin-page-title">Users</div>
    <div class="admin-page-sub">${state.users.length} registered users</div>
    ${state.users.map(u=>`
      <div class="admin-card" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0">${initials(u.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:15px;color:#f1f5f9">${esc(u.name)}</div>
            <div style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}</div>
          </div>
          <span class="badge badge-${u.role}">${u.role}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${u.roll_number?`<span style="background:rgba(255,255,255,0.06);color:#94a3b8;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600">🎓 ${esc(u.roll_number)}</span>`:''}
          <span style="background:rgba(255,255,255,0.06);color:#94a3b8;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600">📅 ${fmtDate(u.created_at)}</span>
          <span style="background:rgba(255,255,255,0.06);color:#94a3b8;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600">🕐 ${u.last_login?fmtDate(u.last_login):'Never'}</span>
        </div>
        ${u.id!==state.user?.id?`<button class="btn-danger" onclick="deleteUser(${u.id})" style="width:100%;text-align:center;padding:10px;border-radius:10px">🗑 Remove User</button>`:'<div style="font-size:12px;color:#475569;text-align:center;padding:4px">This is you</div>'}
      </div>`).join('')||'<div class="empty-state">No users registered yet</div>'}`;
}

function renderKnowledge(){
  const q=state.kbSearch.toLowerCase();
  const filtered=state.kbItems.filter(k=>!q||k.title.toLowerCase().includes(q)||k.category.toLowerCase().includes(q));
  const catColors={'FAQ':'#3b82f6','Syllabus':'#10b981','Exam Rules':'#8b5cf6','Internal Assessments':'#f59e0b','Deadlines':'#ef4444','Procedures':'#06b6d4'};
  return `
    <div class="admin-page-title">Knowledge Base</div>
    <div class="admin-page-sub">${state.kbItems.length} entries total</div>
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <input style="flex:1;padding:12px 16px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;font-size:14px;background:rgba(255,255,255,0.06);color:white;font-family:inherit;outline:none" placeholder="🔍 Search entries…" value="${esc(state.kbSearch)}" oninput="kbSearch(this.value)"/>
      <button onclick="openKbModal(null)" style="padding:12px 18px;background:linear-gradient(135deg,#2563eb,#06b6d4);color:white;border-radius:12px;font-size:14px;font-weight:700;border:none;white-space:nowrap;box-shadow:0 0 16px rgba(37,99,235,0.3)">+ Add</button>
    </div>
    ${filtered.map(k=>`
      <div class="admin-card" style="margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px">
          <span style="background:${catColors[k.category]||'#3b82f6'}20;color:${catColors[k.category]||'#3b82f6'};font-size:10px;font-weight:700;padding:4px 10px;border-radius:100px;flex-shrink:0;margin-top:2px;letter-spacing:0.05em">${esc(k.category)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px;color:#f1f5f9;margin-bottom:4px">${esc(k.title)}</div>
            <div style="font-size:12px;color:#64748b;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(k.content)}</div>
          </div>
          <span style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:100px;flex-shrink:0;${k.is_active?'background:rgba(16,185,129,0.15);color:#34d399':'background:rgba(239,68,68,0.15);color:#f87171'}">${k.is_active?'Active':'Off'}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="openKbModal(${k.id})" style="flex:1;padding:10px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;background:rgba(255,255,255,0.05);font-size:13px;font-weight:600;color:#cbd5e1">✏️ Edit</button>
          <button onclick="deleteKb(${k.id})" style="flex:1;padding:10px;border:1px solid rgba(239,68,68,0.3);border-radius:10px;background:rgba(239,68,68,0.1);font-size:13px;font-weight:600;color:#f87171">🗑 Delete</button>
        </div>
      </div>`).join('')||'<div class="empty-state">No entries found</div>'}`;
}

function renderAnalytics(){
  const d=state.adminData;
  const bars=d.dailyActivity||[];
  const maxBar=Math.max(...bars.map(b=>b.count),1);
  return `
    <div class="admin-page-title">Analytics</div>
    <div class="admin-page-sub">Usage insights & performance metrics</div>
    <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px;scrollbar-width:none">
      ${[
        {l:'💬 Total',v:d.totalMessages||0,i:'Queries'},
        {l:'📅 Today',v:d.todayMessages||0,i:'Messages'},
        {l:'⚡ Speed',v:(d.avgResponseTime||0)+'ms',i:'Avg Response'},
        {l:'👥 Users',v:d.totalUsers||0,i:'Students'},
      ].map(s=>`<div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px;min-width:110px;flex-shrink:0;text-align:center">
        <div style="font-size:20px;margin-bottom:6px">${s.l.split(' ')[0]}</div>
        <div style="font-size:24px;font-weight:700;color:#3b82f6;font-family:'Playfair Display',serif;line-height:1;margin-bottom:4px">${s.v}</div>
        <div style="font-size:10px;color:#64748b;font-weight:600">${s.i}</div>
      </div>`).join('')}
    </div>
    ${gcard(`<div class="admin-card-title">📈 Daily Messages (7 days)</div>
      <div style="display:flex;align-items:flex-end;gap:8px;height:80px">
        ${bars.length?bars.map(b=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:9px;color:#64748b">${b.count}</div>
          <div style="width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#2563eb,#06b6d4);min-height:4px;height:${Math.round((b.count/maxBar)*60)+4}px"></div>
          <div style="font-size:9px;color:#64748b;text-align:center">${(b.day||'').slice(5)}</div>
        </div>`).join(''):'<div style="color:#475569;font-size:12px;margin:auto;align-self:center;width:100%;text-align:center">No data yet</div>'}
      </div>`)}
    ${gcard(`<div class="admin-card-title">🏷 Topic Breakdown</div>
      ${(d.topTopics||[]).map((t,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 0;${i<(d.topTopics.length-1)?'border-bottom:1px solid rgba(255,255,255,0.06)':''}">
        <div style="width:38px;height:38px;border-radius:10px;background:rgba(37,99,235,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
          ${{syllabus:'📚',exam:'📝',deadline:'📅',procedure:'📋',general:'💬'}[t.topic_tag]||'💬'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="text-transform:capitalize;font-weight:600;font-size:13px;color:#cbd5e1">${t.topic_tag}</span>
            <span style="color:#64748b;font-weight:700;font-size:13px">${t.count}</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
            <div style="height:100%;border-radius:3px;background:linear-gradient(90deg,#2563eb,#06b6d4);width:${Math.round((t.count/(d.topTopics[0]?.count||1))*100)}%"></div>
          </div>
        </div>
      </div>`).join('')||'<div class="empty-state">No analytics data yet</div>'}`)}`;
}

function renderKbModal(){
  const item=state.kbModal==='new'?null:state.kbItems.find(k=>k.id===state.kbModal);
  const cats=['FAQ','Syllabus','Exam Rules','Internal Assessments','Deadlines','Procedures'];
  return `<div class="modal-overlay" onclick="if(event.target===this)closeKbModal()">
    <div class="modal">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div class="modal-title" style="margin:0">${item?'Edit Entry':'Add Knowledge Entry'}</div>
        <button onclick="closeKbModal()" style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);font-size:18px;color:#94a3b8;cursor:pointer">×</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div><label class="form-label">Category</label>
          <select class="form-select" id="kb-cat">${cats.map(c=>`<option ${(item?.category||'FAQ')===c?'selected':''}>${c}</option>`).join('')}</select></div>
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
        <button class="btn-save" onclick="saveKb(${item?.id||'null'})">${item?'Save Changes':'Add Entry'}</button>
      </div>
    </div>
  </div>`;
}

function switchAdminTab(t){state.adminTab=t;render();}
function kbSearch(v){state.kbSearch=v;render();}
function openKbModal(id){state.kbModal=id===null?'new':id;render();}
function closeKbModal(){state.kbModal=null;render();}

async function saveKb(id){
  const cat=$('kb-cat').value,title=$('kb-title').value.trim(),content=$('kb-content').value.trim(),is_active=parseInt($('kb-active').value);
  if(!title||!content)return alert('Title and content required');
  try{
    if(id)await api('PUT',`/api/admin/knowledge/${id}`,{category:cat,title,content,is_active});
    else await api('POST','/api/admin/knowledge',{category:cat,title,content});
    state.kbModal=null;await loadAdminData();
  }catch(e){alert(e.message);}
}
async function deleteKb(id){if(!confirm('Delete this entry?'))return;await api('DELETE',`/api/admin/knowledge/${id}`);await loadAdminData();}
async function deleteUser(id){if(!confirm('Remove this user?'))return;await api('DELETE',`/api/admin/users/${id}`);await loadAdminData();}

/* ── BOOTSTRAP ── */
(async()=>{
  try{
    const d=await api('GET','/api/auth/me');
    state.user=d.user;
    if(d.user.role==='admin'){state.page='admin';render();loadAdminData();}
    else{state.page='chat';await loadConversations();render();}
  }catch{state.page='login';render();}
})();
