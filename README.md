# AcadBot — AI Academic Support Chatbot

A full-stack, production-ready academic support chatbot powered by **Google Gemini AI**. Features student chat, admin panel, analytics dashboard, and a live-editable knowledge base.

---

## Features

- **AI Chat** — Powered by Gemini 1.5 Flash with full conversation history
- **User Authentication** — JWT-based login/register with bcrypt password hashing
- **Chat History** — All conversations and messages saved to SQLite
- **Admin Panel** — Dashboard, user management, knowledge base editor
- **Analytics** — Topic distribution, daily activity charts, response time tracking
- **Knowledge Base** — Admin can add/edit/delete/toggle entries live
- **Rate Limiting** — Protects chat and auth endpoints
- **Deploy-ready** — Configs for Render, Railway, Vercel, and Docker

---

## Quick Start (Local)

### 1. Clone & Install

```bash
git clone <your-repo>
cd acadbot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_gemini_api_key
JWT_SECRET=any-long-random-string
```

### 3. Run

```bash
npm start
```

Visit: **http://localhost:3000**

Default admin account: `admin@acadbot.edu` / `admin123`

---

## Deployment

### Option A — Render (Recommended, free tier available)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect repo
3. Set environment variables:
   - `GEMINI_API_KEY` → your key
   - `JWT_SECRET` → any long random string
4. Deploy! Render auto-detects Node.js.

> **Note:** Render free tier has ephemeral storage — SQLite data resets on redeploy. Use a persistent disk ($7/mo) or upgrade to paid plan for production.

### Option B — Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Railway auto-detects the `railway.toml` config and deploys

### Option C — Vercel

```bash
npm i -g vercel
vercel --prod
```

Add env vars in Vercel dashboard. Note: Vercel is serverless — SQLite only works with a mounted volume or swap for Turso/PlanetScale for production persistence.

### Option D — Docker / VPS

```bash
docker build -t acadbot .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your_key \
  -e JWT_SECRET=your_secret \
  -v $(pwd)/db:/app/db \
  acadbot
```

---

## Project Structure

```
acadbot/
├── server/
│   ├── index.js        # Express app, all API routes
│   ├── db.js           # SQLite setup, schema, seed data
│   └── auth.js         # JWT auth middleware
├── public/
│   ├── index.html      # SPA shell
│   ├── css/app.css     # Full stylesheet
│   └── js/app.js       # Frontend SPA (vanilla JS)
├── db/                 # SQLite database (auto-created)
├── .env.example        # Environment variable template
├── render.yaml         # Render deployment config
├── railway.toml        # Railway deployment config
├── vercel.json         # Vercel deployment config
├── Dockerfile          # Docker container
└── package.json
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new student |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET  | `/api/auth/me` | Get current user |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/conversations` | List user's conversations |
| POST | `/api/conversations` | Create new conversation |
| GET  | `/api/conversations/:id` | Get conversation + messages |
| DELETE | `/api/conversations/:id` | Delete conversation |
| POST | `/api/chat` | Send message, get AI reply |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/admin/stats` | Dashboard stats + analytics |
| GET  | `/api/admin/users` | All users |
| DELETE | `/api/admin/users/:id` | Remove user |
| GET  | `/api/admin/knowledge` | All KB entries |
| POST | `/api/admin/knowledge` | Add KB entry |
| PUT  | `/api/admin/knowledge/:id` | Update KB entry |
| DELETE | `/api/admin/knowledge/:id` | Delete KB entry |

---

## Customizing the Knowledge Base

Log in as admin → Admin Panel → Knowledge Base → Add/Edit entries.

Categories available: FAQ, Syllabus, Exam Rules, Internal Assessments, Deadlines, Procedures.

Changes take effect immediately on the next student query.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key |
| `JWT_SECRET` | ✅ Yes | Secret for signing JWTs |
| `PORT` | No | Server port (default: 3000) |
| `DB_PATH` | No | SQLite file path (default: ./db/acadbot.db) |
| `NODE_ENV` | No | Set to `production` in prod |

---

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, bcryptjs, jsonwebtoken
- **AI:** Google Gemini 1.5 Flash (`@google/generative-ai`)
- **Frontend:** Vanilla JS SPA (no framework), DM Sans font
- **Database:** SQLite (zero-config, file-based)
- **Auth:** JWT stored in httpOnly cookies
