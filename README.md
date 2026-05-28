# EKK IDMS — Intelligent Data Management System

Field data capture and management platform for Indian highway and structure works.  
Built for **EKK Infrastructure Ltd** — covers site capture, DPR generation, voice-to-text entry, AI analysis, and export.

---

## Project Structure

```
ekk-idms/        → Backend (FastAPI) + Docker Compose stack
ekk-mobile/      → Mobile app (Expo / React Native)
ekk-web/         → Web dashboard (React + Vite)
```

---

## Stack

| Layer | Technology |
|---|---|
| API | FastAPI + SQLAlchemy + PostgreSQL (pgvector) |
| Auth | JWT Bearer tokens |
| Task queue | Celery + Redis |
| AI | OpenAI Whisper (voice) + GPT-4o-mini (parsing) |
| Mobile | Expo SDK 54 / React Native |
| Web | React 18 + Vite |
| Reverse proxy | Nginx |
| Database UI | Adminer |
| Analytics | Metabase |

---

## Quick Start (Docker)

**Requirements:** Docker Desktop, Docker Compose

```bash
cd ekk-idms
cp .env.example .env        # fill in secrets
docker compose up -d
```

| Service | URL |
|---|---|
| Web app | http://localhost |
| API docs | http://localhost/docs |
| API direct | http://localhost:8000 |
| Adminer (DB UI) | http://localhost:8080 |
| Metabase | http://localhost:3100 |

Run migrations (first time):
```bash
docker compose run --rm migrate
```

---

## Mobile App (Expo)

```bash
cd ekk-mobile
npm install
npx expo start --host lan    # LAN dev server — scan QR on phone
```

### Build APK for testers

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile apk
```

> Update `ekk-mobile/.env` with your server's LAN IP before building:
> ```
> EXPO_PUBLIC_API_BASE=http://<your-server-ip>
> ```

---

## Web App (local dev)

```bash
cd ekk-web
npm install
npm run dev      # starts on http://localhost:5173
```

---

## API Modules

| Module | Prefix | Description |
|---|---|---|
| Auth | `/auth` | Login, JWT, password change |
| M1 Capture | `/api/capture` | Field data entry + 3M resources |
| M2 Conversion | `/api/compute` | Quantity computation |
| M3 Design | `/api/design` | Design data |
| M4 Manual Entry | `/api/manual` | Manual DPR entries |
| M5 Disciplines | `/api/disciplines` | Discipline tracking |
| Voice AI | `/api/voice` | Whisper transcription + GPT parsing |
| 3M Master Data | `/api/resources` | Materials, Machines, Manpower masters |
| Media | `/api/media` | Photo/video upload per entry |
| AI Chat | `/chat` | GPT-powered project Q&A |
| GPS | `/gps` | GPS point capture |
| Reference Data | `/reference-data` | Grade sheets, OGL, level register |
| Export | `/api/export` | Nway / DPR export |
| WhatsApp | `/api/whatsapp` | WhatsApp-based field capture |
| Projects | `/api/projects` | Project management |
| Companies | `/api/companies` | Company management |
| Users | `/api/users` | User management + RBAC |
| Health | `/health` | Service health check |

---

## Voice-to-Text

Supports **English, Hindi, Tamil** and 8 other Indian languages.

- **Online mode** — audio is uploaded to OpenAI Whisper for transcription then parsed by GPT-4o-mini into structured fields
- **Offline mode** — device speech recognition (expo-speech) with local NLP parser

Spoken fields extracted automatically: chainage, activity, work type, dimensions, materials, machines deployed, manpower, shift type, road side, weather, progress status.

---

## LAN Network Access

All devices on the same Wi-Fi network can access the system:

- **Web:** `http://<server-ip>` (nginx port 80)
- **API:** `http://<server-ip>/api` (proxied via nginx)
- **Mobile APK:** set `EXPO_PUBLIC_API_BASE=http://<server-ip>` in `ekk-mobile/.env` then rebuild

CORS is configured to allow all private LAN IP ranges (`192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`).

Get your server IP:
```bash
ipconfig getifaddr en0    # macOS
hostname -I               # Linux
```

---

## Environment Variables

Copy `ekk-idms/.env.example` to `ekk-idms/.env` and set:

| Variable | Description |
|---|---|
| `POSTGRES_USER` | Database username |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `SECRET_KEY` | JWT signing key |
| `OPENAI_API_KEY` | OpenAI API key (Whisper + GPT) |

---

## Default Login

```
Email:    admin@ekk.in
Password: (set during first run)
```

---

## License

Private — EKK Infrastructure Ltd. All rights reserved.
