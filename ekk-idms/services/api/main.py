from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / '.env')
from routers.media import router as media_router
from fastapi.staticfiles import StaticFiles



from database import engine, Base
from routers import (
    capture_router, project_router, computation_router, design_router,
    discipline_router, manual_entry_router, schedule_router,
    detector_router, export_router,
)
from auth import router as auth_router
from routers import whatsapp_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="EKK IDMS API",
    description="Intelligent Data Management System — EKK Infrastructure Ltd",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8081", "http://localhost:8082"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,                prefix="/auth",             tags=["Auth"])
app.include_router(capture_router.router,      prefix="/api/capture",      tags=["M1 Capture"])
app.include_router(project_router.router,      prefix="/api/projects",     tags=["Projects"])
app.include_router(computation_router.router,  prefix="/api/compute",      tags=["M2 Conversion"])
app.include_router(design_router.router,       prefix="/api/design",       tags=["M3 Design"])
app.include_router(manual_entry_router.router, prefix="/api/manual",       tags=["M4 Manual Entry"])
app.include_router(discipline_router.router,   prefix="/api/disciplines",  tags=["M5 Disciplines"])
app.include_router(schedule_router.router,     prefix="/api/schedule",     tags=["Schedule"])
app.include_router(detector_router.router,     prefix="/api/detect",       tags=["AI Detector"])
app.include_router(export_router.router,       prefix="/api/export",       tags=["M6 Nway Export"])
app.include_router(whatsapp_router.router,     prefix="/api/whatsapp",     tags=["WhatsApp Capture"])

app.include_router(media_router, prefix="/api/media", tags=["media"])
app.mount("/media", StaticFiles(directory="media_uploads"), name="media")

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "EKK IDMS API", "version": "1.0.0"}

@app.get("/", tags=["System"])
def root():
    return {"service": "EKK IDMS API", "docs": "/docs"}
