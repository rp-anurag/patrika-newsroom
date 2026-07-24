# PulsePatrika

An AI-powered newspaper monitoring & analytics platform — editorial planning,
production tracking, page monitoring, HR & retirement alerts, legal case
management, archive search, and an AI newsroom assistant. Hindi + English,
dark/light mode, role-based access, multi-edition.

> **Read this first.** This is a professionally architected, deployable
> **foundation** for the full platform described in the spec — not a finished
> production system (that scope is months of work). The frontend is fully built
> and runs today on mock data; the PHP REST API and MySQL schema are complete;
> the Python AI service is a working scaffold with clearly marked integration
> points for OpenAI / Whisper / Tesseract / LangChain. See **Status** below.

---

## Architecture

```
┌──────────────┐      /api      ┌──────────────┐   HTTP    ┌────────────────┐
│  Frontend    │ ─────────────▶ │  PHP Backend │ ────────▶ │  AI Service    │
│ React + Vite │   (REST/JSON)  │  REST API    │           │ FastAPI (Python)│
│  (static)    │ ◀───────────── │              │ ◀──────── │ OpenAI/Whisper  │
└──────────────┘                └──────┬───────┘           └────────────────┘
                                       │ PDO
                                       ▼
                                ┌──────────────┐
                                │   MySQL DB   │
                                └──────────────┘
```

- **frontend/** — React 18 + Vite + Tailwind. 11 modules, charts (Recharts),
  i18n (en/hi), theme + auth contexts. Falls back to bundled mock data when the
  backend is unreachable, so it's demoable standalone.
- **backend/** — Framework-free PHP REST API (PSR-4, PDO, dependency-free JWT).
- **ai-service/** — FastAPI microservice scaffolding the AI features.
- **database/** — MySQL `schema.sql` (incl. all 28 HR columns from `edit_hr.xlsx`)
  and `seed.sql` (demo user + sample data).
- **docs/** — `DEPLOYMENT.md` step-by-step server setup.

## Roles
Admin, Editor, Bureau Chief, HR, Legal, Management, Reporter — sidebar and routes
are filtered per role (`frontend/src/context/AppContext.jsx`).

## Demo login
Any non-empty username/password works in demo mode. With the database seeded,
use **admin / patrika123**.

---

## Status — what's complete vs. stubbed

**Complete & working**
- Full responsive UI for all 11 modules, dark/light, Hindi/English, multi-edition.
- Dashboard KPIs + charts; Editorial kanban; Production tracker/heatmap;
  Page monitoring; HR table with the 28-field add/edit form, age distribution &
  retirement alerts; Legal case table; Archive search UI; Alerts; Reports; Settings.
- PHP REST API for every module + dependency-free JWT auth.
- Complete MySQL schema + seed data.

**Scaffolded (structured stubs, marked integration points — need your API keys
and further development)**
- All AI features: content quality grading, trend monitoring, delay prediction,
  OCR, Hindi transcription, newsroom chatbot.
- External integrations: WhatsApp, Telegram, Email/SMTP, SMS, Google Calendar.
- Real user management (password reset, granular permissions), file storage for
  uploads (videos/PDFs), production-grade auth hardening.

See **docs/DEPLOYMENT.md** to deploy, and the `# >>> INTEGRATION POINT` markers
in `ai-service/main.py` plus the `TODO` notes in the PHP controllers to extend.

## Quick start (local preview, no backend needed)
```bash
cd frontend
npm install
npm run dev        # open the printed localhost URL
```

## Quick start (production build)
```bash
cd frontend && npm install && npm run build   # outputs to frontend/dist/
```
Then follow **docs/DEPLOYMENT.md** to serve `dist/`, the PHP API, MySQL and the
AI service. (A pre-built `frontend/dist/` is already included in this package.)
