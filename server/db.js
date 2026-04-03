const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../db/acadbot.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const raw = new sqlite3.Database(DB_PATH);

const run = (sql, p = []) => new Promise((ok, fail) =>
  raw.run(sql, p, function(e) { e ? fail(e) : ok({ lastID: this.lastID, changes: this.changes }); }));
const get = (sql, p = []) => new Promise((ok, fail) =>
  raw.get(sql, p, (e, row) => e ? fail(e) : ok(row)));
const all = (sql, p = []) => new Promise((ok, fail) =>
  raw.all(sql, p, (e, rows) => e ? fail(e) : ok(rows)));
const exec = (sql) => new Promise((ok, fail) =>
  raw.exec(sql, e => e ? fail(e) : ok()));

async function init() {
  await exec(`PRAGMA journal_mode=WAL`);
  await exec(`PRAGMA foreign_keys=ON`);
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      roll_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      topic_tag TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_type TEXT NOT NULL,
      topic_tag TEXT,
      query_text TEXT,
      response_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const admin = await get('SELECT id FROM users WHERE role=?', ['admin']);
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    await run('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
      ['Administrator','admin@acadbot.edu',hash,'admin']);
    console.log('Default admin: admin@acadbot.edu / admin123');
  }

  const row = await get('SELECT COUNT(*) as c FROM knowledge_base');
  if (row.c === 0) {
    const items = [
      ['FAQ','Hall Ticket','Hall tickets are available on the student portal 7 days before exams. Login with your roll number and download from the Examinations section.'],
      ['FAQ','Attendance Requirement','Students must maintain minimum 75% attendance per subject to be eligible for semester-end exams. Medical leave may be condoned with valid documentation.'],
      ['FAQ','Supplementary Exams','Fill the supplementary exam form at the exam office or student portal within 10 days of result declaration. Pay the prescribed fee at the accounts section.'],
      ['FAQ','Missed Internal Assessment',"Submit a medical certificate or valid reason to the department head within 3 days. Re-tests are at the instructor's discretion."],
      ['FAQ','Fee Payment','Fee payment is due by the 10th of each month. Late fee applicable after that. Online payment available through student portal.'],
      ['Syllabus','Semester 1','Mathematics-I, Physics, Chemistry, Engineering Drawing, Communication Skills, Basic Electrical Engineering. Credits: 24.'],
      ['Syllabus','Semester 2','Mathematics-II, Programming in C, Electronics Fundamentals, Environmental Science, Workshop Practice. Credits: 24.'],
      ['Syllabus','Semester 3','Data Structures, Digital Electronics, Mathematics-III, Object-Oriented Programming, Discrete Mathematics. Credits: 22.'],
      ['Syllabus','Semester 4','Algorithms, Computer Organization, Database Management Systems, Operating Systems, Statistics. Credits: 22.'],
      ['Syllabus','Semester 5','Computer Networks, Software Engineering, Microprocessors, Elective-I, Mini Project. Credits: 20.'],
      ['Syllabus','Semester 6','Compiler Design, AI & Machine Learning, Cloud Computing, Elective-II, Major Project. Credits: 20.'],
      ['Exam Rules','General Rules','Students need 40% aggregate to pass. Exams in November (odd) and April (even). Carry ID and hall ticket. Calculators only in Maths/Statistics. Malpractice = all subjects cancelled.'],
      ['Exam Rules','Internal Assessments','Three internal tests per subject per semester. Best 2 of 3 counted. Each test 20 marks. Results in 1 week. Schedules announced 2 weeks ahead.'],
      ['Exam Rules','Re-evaluation','Submit within 15 days of result. Fee per subject. Re-evaluation results are final.'],
      ['Deadlines','Important Dates','Fee: 10th each month. Exam form: 30 days before. Project: 2 weeks before exams. Library return: end of semester. Scholarships: Sep 30 & Feb 28.'],
      ['Procedures','Bonafide Certificate','Apply at admin office or student portal. Ready in 3 working days.'],
      ['Procedures','Transcript Request','Submit form with fee. Takes 7 working days. Express (3 days) at extra cost.'],
      ['Procedures','Transfer Certificate','Apply 15 days ahead. Clear all dues. Collect in person with valid ID.'],
      ['Procedures','Name/Address Change','Submit affidavit and documents to registrar. Takes 10 working days.'],
      ['Procedures','Fee Concession','Submit income certificate before semester start. SC/ST/OBC/EWS concessions available.'],
    ];
    for (const [cat, title, content] of items)
      await run('INSERT INTO knowledge_base (category,title,content) VALUES (?,?,?)', [cat,title,content]);
    console.log('Knowledge base seeded.');
  }
}

module.exports = { run, get, all, exec, init };
