require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const Groq = require('groq-sdk');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { run, get, all, init } = require('./db');
const { signToken, requireAuth, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

const chatLimiter = rateLimit({ windowMs: 60000, max: 30, message: { error: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 900000, max: 10, message: { error: 'Too many login attempts' } });

// ── Auth ─────────────────────────────────────────────────────────
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password, roll_number } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await run(
      'INSERT INTO users (name,email,password,roll_number) VALUES (?,?,?,?)',
      [name, email.toLowerCase(), hash, roll_number || null]
    );
    const user = await get('SELECT id,name,email,role FROM users WHERE id=?', [result.lastID]);
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, maxAge: 7*86400000, sameSite: 'lax' });
    res.json({ user });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = await get('SELECT * FROM users WHERE email=?', [email.toLowerCase()]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  await run('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
  const token = signToken(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 7*86400000, sameSite: 'lax' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await get('SELECT id,name,email,role,roll_number,created_at FROM users WHERE id=?', [req.user.id]);
  res.json({ user });
});

// ── Conversations ────────────────────────────────────────────────
app.get('/api/conversations', requireAuth, async (req, res) => {
  const convs = await all(
    `SELECT c.id, c.title, c.updated_at,
      (SELECT COUNT(*) FROM messages WHERE conversation_id=c.id) as msg_count
     FROM conversations c WHERE c.user_id=? ORDER BY c.updated_at DESC LIMIT 20`,
    [req.user.id]
  );
  res.json({ conversations: convs });
});

app.get('/api/conversations/:id', requireAuth, async (req, res) => {
  const conv = await get('SELECT * FROM conversations WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const messages = await all('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC', [req.params.id]);
  res.json({ conversation: conv, messages });
});

app.delete('/api/conversations/:id', requireAuth, async (req, res) => {
  await run('DELETE FROM messages WHERE conversation_id=?', [req.params.id]);
  await run('DELETE FROM conversations WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ── Chat ─────────────────────────────────────────────────────────
app.post('/api/chat', requireAuth, chatLimiter, async (req, res) => {
  const { message, conversation_id } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const start = Date.now();
  let convId = conversation_id;

  if (!convId) {
    convId = uuidv4();
    await run('INSERT INTO conversations (id,user_id,title) VALUES (?,?,?)',
      [convId, req.user.id, message.slice(0, 60)]);
  } else {
    const conv = await get('SELECT id FROM conversations WHERE id=? AND user_id=?', [convId, req.user.id]);
    if (!conv) return res.status(403).json({ error: 'Forbidden' });
  }

  await run('INSERT INTO messages (conversation_id,role,content) VALUES (?,?,?)', [convId, 'user', message]);

  // Build knowledge base context
  const kbItems = await all('SELECT category,title,content FROM knowledge_base WHERE is_active=1 ORDER BY category');
  const kbText = kbItems.map(k => `[${k.category}] ${k.title}: ${k.content}`).join('\n');

  // Build conversation history for Groq
  const history = await all('SELECT role,content FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 20', [convId]);
  const chatHistory = history.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const systemPrompt = `You are AcadBot, a friendly academic support chatbot for a university. Answer student questions using the knowledge base below. Keep answers concise (3-5 sentences). If a question is outside academic topics, politely redirect.

KNOWLEDGE BASE:
${kbText}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;
    const elapsed = Date.now() - start;
    const tag = detectTag(message);

    await run('INSERT INTO messages (conversation_id,role,content,topic_tag) VALUES (?,?,?,?)',
      [convId, 'assistant', reply, tag]);
    await run('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [convId]);
    await run('INSERT INTO analytics (user_id,event_type,topic_tag,query_text,response_time_ms) VALUES (?,?,?,?,?)',
      [req.user.id, 'chat_message', tag, message.slice(0, 200), elapsed]);

    res.json({ reply, conversation_id: convId, tag, response_time_ms: elapsed });
  } catch (e) {
    console.error('Groq error:', e.message);
    res.status(500).json({ error: 'AI error: ' + e.message });
  }
});

function detectTag(text) {
  const t = text.toLowerCase();
  if (/syllabus|subject|semester|course|credit/.test(t)) return 'syllabus';
  if (/exam|test|assessment|hall ticket|result|mark|pass|fail|supplementary/.test(t)) return 'exam';
  if (/deadline|due|date|submit|schedule/.test(t)) return 'deadline';
  if (/procedure|apply|certificate|transcript|tc|bonafide/.test(t)) return 'procedure';
  return 'general';
}

// ── Admin ────────────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const { c: totalUsers } = await get("SELECT COUNT(*) as c FROM users WHERE role='student'");
  const { c: totalMessages } = await get('SELECT COUNT(*) as c FROM messages');
  const { c: totalConversations } = await get('SELECT COUNT(*) as c FROM conversations');
  const { c: todayMessages } = await get("SELECT COUNT(*) as c FROM messages WHERE date(created_at)=date('now')");
  const avgRow = await get("SELECT AVG(response_time_ms) as avg FROM analytics WHERE event_type='chat_message'");
  const topTopics = await all("SELECT topic_tag, COUNT(*) as count FROM analytics WHERE topic_tag IS NOT NULL GROUP BY topic_tag ORDER BY count DESC LIMIT 5");
  const dailyActivity = await all("SELECT date(created_at) as day, COUNT(*) as count FROM messages WHERE created_at >= date('now','-7 days') GROUP BY day ORDER BY day ASC");
  const recentUsers = await all('SELECT name,email,role,created_at,last_login FROM users ORDER BY created_at DESC LIMIT 5');
  res.json({ totalUsers, totalMessages, totalConversations, todayMessages, avgResponseTime: Math.round(avgRow?.avg || 0), topTopics, dailyActivity, recentUsers });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await all('SELECT id,name,email,role,roll_number,created_at,last_login FROM users ORDER BY created_at DESC');
  res.json({ users });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await run('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/admin/knowledge', requireAdmin, async (req, res) => {
  const items = await all('SELECT * FROM knowledge_base ORDER BY category,title');
  res.json({ items });
});

app.post('/api/admin/knowledge', requireAdmin, async (req, res) => {
  const { category, title, content } = req.body;
  if (!category || !title || !content) return res.status(400).json({ error: 'All fields required' });
  const result = await run('INSERT INTO knowledge_base (category,title,content) VALUES (?,?,?)', [category, title, content]);
  res.json({ id: result.lastID });
});

app.put('/api/admin/knowledge/:id', requireAdmin, async (req, res) => {
  const { category, title, content, is_active } = req.body;
  await run('UPDATE knowledge_base SET category=?,title=?,content=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [category, title, content, is_active ? 1 : 0, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/admin/knowledge/:id', requireAdmin, async (req, res) => {
  await run('DELETE FROM knowledge_base WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── SPA fallback ─────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// ── Start ────────────────────────────────────────────────────────
init().then(() => {
  app.listen(PORT, () => console.log(`\n🚀 AcadBot running → http://localhost:${PORT}\n`));
}).catch(e => { console.error('DB init failed:', e); process.exit(1); });
