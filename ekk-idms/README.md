# EKK IDMS — Intelligent Data Management System

**EKK Infrastructure Ltd | VSRP Highway NH-45C / NH-46**

## Quick Start

```bash
cp .env.example .env
# Edit .env — set WHATSAPP_TOKEN, JWT_SECRET_KEY, ANTHROPIC_API_KEY

docker-compose up -d
```

## Service URLs

| Service     | URL                         |
|-------------|----------------------------|
| API docs    | http://localhost:8000/docs  |
| Frontend    | http://localhost:5173       |
| Metabase BI | http://localhost:3100       |

## Phase 1 Build Order

1. Database schema (`files/sql/`)
2. FastAPI app + auth (`services/api/`)
3. M1 Capture router (WhatsApp + manual)
4. M2 Conversion engine
5. M5 Discipline master
6. M4 Daily entry
7. M3 Design master
8. M6 Nway export
9. React frontend (`../ekk-web/`)
10. Metabase dashboards

## Tech Stack

- **Backend**: Python 3.11, FastAPI 0.115, SQLAlchemy 2.0
- **Database**: PostgreSQL 16 + pgvector
- **Queue**: Celery 5.4 + Redis 7
- **Frontend**: React 18, Vite 5
- **AI**: Anthropic Claude API
- **Storage**: AWS S3
- **BI**: Metabase (open source)
- **Deploy**: Docker Compose
