const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../db/acadbot.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let client;
async function getClient() {
  if (client) return client;
  const { createClient } = require('@libsql/client');
  client = createClient({ url: 'file:' + DB_PATH });
  return client;
}

const run = async (sql, params = []) => {
  const c = await getClient();
  const r = await c.execute({ sql, args: params });
  return { lastID: Number(r.lastInsertRowid), changes: r.rowsAffected };
};
const get = async (sql, params = []) => {
  const c = await getClient();
  const r = await c.execute({ sql, args: params });
  return r.rows[0] || null;
};
const all = async (sql, params = []) => {
  const c = await getClient();
  const r = await c.execute({ sql, args: params });
  return r.rows;
};
const exec = async (sql) => {
  const c = await getClient();
  for (const s of sql.split(';').map(x => x.trim()).filter(Boolean))
    await c.execute(s);
};

async function init() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, role TEXT DEFAULT 'student',
      roll_number TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME)`,
    `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL,
      role TEXT NOT NULL, content TEXT NOT NULL, topic_tag TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL,
      title TEXT NOT NULL, content TEXT NOT NULL, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      event_type TEXT NOT NULL, topic_tag TEXT, query_text TEXT,
      response_time_ms INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ];
  for (const t of tables) await exec(t);

  const admin = await get('SELECT id FROM users WHERE role=?', ['admin']);
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    await run('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
      ['Administrator','admin@acadbot.edu',hash,'admin']);
    console.log('Default admin: admin@acadbot.edu / admin123');
  }

  const row = await get('SELECT COUNT(*) as c FROM knowledge_base');
  if (!row || Number(row.c) === 0) {
    const items = [
      ['FAQ','Hall Ticket','Hall tickets are available on the student portal 7 days before exams. Download from Examinations section.'],
      ['FAQ','Attendance','Minimum 75% attendance required per subject for semester-end exam eligibility.'],
      ['FAQ','Supplementary Exams','Apply within 10 days of result declaration. Pay fee at accounts section.'],
      ['FAQ','Missed Assessment',"Submit medical certificate within 3 days. Re-tests at instructor's discretion."],
      ['FAQ','Fee Payment','Fee due by 10th of each month. Late fee applicable after that.'],
      ['Syllabus','Semester 1','Mathematics-I, Physics, Chemistry, Engineering Drawing, Communication Skills. Credits: 24.'],
      ['Syllabus','Semester 2','Mathematics-II, Programming in C, Electronics, Environmental Science, Workshop. Credits: 24.'],
      ['Syllabus','Semester 3','Data Structures, Digital Electronics, Mathematics-III, OOP, Discrete Mathematics. Credits: 22.'],
      ['Syllabus','Semester 4','Algorithms, Computer Organization, DBMS, Operating Systems, Statistics. Credits: 22.'],
      ['Syllabus','Semester 5','Computer Networks, Software Engineering, Microprocessors, Elective-I, Mini Project. Credits: 20.'],
      ['Syllabus','Semester 6','Compiler Design, AI & ML, Cloud Computing, Elective-II, Major Project. Credits: 20.'],
      ['Exam Rules','General','40% aggregate to pass. Exams November (odd) and April (even). Carry ID and hall ticket.'],
      ['Exam Rules','Internal Tests','Three tests per subject. Best 2 of 3 counted. Each test 20 marks.'],
      ['Exam Rules','Re-evaluation','Submit within 15 days of result. Fee per subject. Results final.'],
      ['Deadlines','Dates','Fee: 10th monthly. Exam form: 30 days before. Project: 2 weeks before exams.'],
      ['Procedures','Bonafide Certificate','Apply at admin office. Ready in 3 working days.'],
      ['Procedures','Transcript','Submit form with fee. Takes 7 working days.'],
      ['Procedures','Transfer Certificate','Apply 15 days ahead. Clear all dues.'],
      ['Procedures','Name Change','Submit affidavit and documents to registrar. Takes 10 days.'],
      ['Procedures','Fee Concession','Submit income certificate before semester. SC/ST/OBC/EWS available.'],
    ];
    for (const [cat, title, content] of items)
      await run('INSERT INTO knowledge_base (category,title,content) VALUES (?,?,?)', [cat,title,content]);
    console.log('Knowledge base seeded.');
  }
}

module.exports = { run, get, all, exec, init };
