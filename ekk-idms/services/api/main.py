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
    allow_origin_regex=(
        r"(http://(localhost|127\.0\.0\.1)(:\d+)?)"
        r"|(https://.*\.trycloudflare\.com)"
        # Private LAN ranges: 192.168.x.x, 10.x.x.x, 172.16-31.x.x (any port)
        r"|(http://(192\.168|10\.\d+|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+(:\d+)?)"
    ),
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

from routers.project_config_router import router as project_config_router
app.include_router(project_config_router, prefix="/project-config", tags=["Project Config"])

from routers.grade_sheet_router    import router as grade_sheet_router
from routers.level_register_router import router as level_register_router
from routers.ogl_router            import router as ogl_router
from routers.gps_router            import router as gps_router

app.include_router(grade_sheet_router,    prefix="/reference-data", tags=["Reference Data"])
app.include_router(level_register_router, prefix="/level-register",  tags=["Level Register"])
app.include_router(ogl_router,            prefix="/ogl",             tags=["OGL"])
app.include_router(gps_router,            prefix="/gps",             tags=["GPS"])

from routers.resources_router import router as resources_router
app.include_router(resources_router, prefix="/api/resources", tags=["3M Master Data"])

from routers.user_mgmt_router  import router as user_mgmt_router
from routers.hr_router         import router as hr_router
from routers.permission_router import router as permission_router
app.include_router(user_mgmt_router,  prefix="/api/v1/users",       tags=["User Management"])
app.include_router(hr_router,         prefix="/api/v1/hr",          tags=["HR"])
app.include_router(permission_router, prefix="/api/v1/permissions", tags=["Permissions"])

from routers.master_data_router import router as master_router
app.include_router(master_router, prefix="/api/masters", tags=["Master Data"])

from routers.boq_router import router as boq_router
app.include_router(boq_router, prefix="/api/boq", tags=["BOQ Versioning"])

app.mount("/media", StaticFiles(directory="media_uploads"), name="media")


@app.on_event("startup")
async def verify_super_admin():
    """Warn if no active SUPER_ADMIN exists in the database."""
    import logging
    from database import SessionLocal
    from models.user import User
    db = SessionLocal()
    try:
        count = db.query(User).filter(
            User.user_type.in_(["SUPER_ADMIN", "SUPER ADMIN"]),
            User.is_active == True,
        ).count()
        if count == 0:
            logging.warning("⚠️  No active SUPER_ADMIN user found. Run migrations or create one.")
    finally:
        db.close()

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "EKK IDMS API", "version": "1.0.0"}

@app.get("/app/version", tags=["System"])
def app_version():
    """
    Returns minimum required app version and download URL.
    Called by mobile app on launch to enforce mandatory updates.
    Update minimum_version and force_update when a new APK is released.
    """
    return {
        "minimum_version": "0.3.2",
        "latest_version": "0.3.2",
        "force_update": True,
        "message": (
            "A new version of EKK IDMS is available.\n\n"
            "Please download and install v0.3.2 to continue using the app.\n\n"
            "This update adds Structure Activity selection and a Count "
            "field for repeating elements (piers, walls, etc.)."
        ),
        "download_url": "https://idms.ikkuips.co.in/downloads/ekk-idms-v0.3.2.apk",
    }

@app.get("/", tags=["System"])
def root():
    return {"service": "EKK IDMS API", "docs": "/docs"}
