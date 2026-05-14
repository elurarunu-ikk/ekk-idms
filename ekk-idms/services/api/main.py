from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / '.env')
from routers.media import router as media_router
from routers.voice_router import router as voice_router
from routers.chat_router import router as chat_router
from routers.company_router import router as company_router
from routers.user_router import router as user_router
from fastapi.staticfiles import StaticFiles



from database import engine, Base
from routers import (
    capture_router, project_router, computation_router, design_router,
    discipline_router, manual_entry_router, schedule_router,
    detector_router, export_router, plan_router,
)
from auth import router as auth_router
from routers import whatsapp_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title="EKK IDMS API",
    description="Intelligent Data Management System — EKK Infrastructure Ltd",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8081", "http://localhost:8082"],
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1)(:\d+)?)|(https://.*\.trycloudflare\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,                prefix="/auth",             tags=["Auth"])
app.include_router(capture_router.router,      prefix="/api/capture",      tags=["M1 Capture"])
app.include_router(company_router,             prefix="/api/companies",    tags=["Companies"])
app.include_router(project_router.router,      prefix="/api/projects",     tags=["Projects"])
app.include_router(user_router,                prefix="/api/users",        tags=["Users"])
app.include_router(plan_router.router,         prefix="/api/plan",         tags=["Plan Data"])
app.include_router(computation_router.router,  prefix="/api/compute",      tags=["M2 Conversion"])
app.include_router(design_router.router,       prefix="/api/design",       tags=["M3 Design"])
app.include_router(manual_entry_router.router, prefix="/api/manual",       tags=["M4 Manual Entry"])
app.include_router(discipline_router.router,   prefix="/api/disciplines",  tags=["M5 Disciplines"])
app.include_router(schedule_router.router,     prefix="/api/schedule",     tags=["Schedule"])
app.include_router(detector_router.router,     prefix="/api/detect",       tags=["AI Detector"])
app.include_router(export_router.router,       prefix="/api/export",       tags=["M6 Nway Export"])
app.include_router(whatsapp_router.router,     prefix="/api/whatsapp",     tags=["WhatsApp Capture"])

app.include_router(voice_router,  prefix="/api/voice",  tags=["Voice AI"])
app.include_router(media_router,  prefix="/api/media",  tags=["media"])
app.include_router(chat_router,   prefix="/chat",       tags=["AI Chat"])
app.mount("/media", StaticFiles(directory="media_uploads"), name="media")

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "EKK IDMS API", "version": "1.0.0"}

@app.get("/", tags=["System"])
def root():
    return {"service": "EKK IDMS API", "docs": "/docs"}
