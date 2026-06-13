import json
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.project import Project
from models.user import User
from models.user_project_access import UserProjectAccess
from models.user_session import RegisteredDevice, UserSession
from schemas.admin import SessionProject, SessionResponse, SessionUser
from services.permission_service import invalidate_user_sessions, is_token_revoked

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_this_secret_key_minimum_32_chars")
ALGORITHM = "HS256"
EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
ALL_ACTIONS = ["add", "edit", "delete", "view", "approve"]
MODULES = [
    "dashboard",
    "capture",
    "entries",
    "approvals",
    "report",
    "chat",
    "projects",
    "users",
    "companies",
]
PRIVILEGED_ROLES = {"SUPER ADMIN", "SUPER_ADMIN", "ADMIN"}
FULL_ACCESS_ROLES = {"SUPER ADMIN", "SUPER_ADMIN", "ADMIN", "SITE-ADMIN", "SITE_ADMIN"}


def normalize_user_type(user: User) -> str:
    return user.user_type or user.role or "USER"

class LoginRequest(BaseModel):
    email: str
    password: str
    platform: str = "web"
    device_id: Optional[str] = None
    device_label: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    session: SessionResponse


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

def create_token(data: dict) -> str:
    payload = data.copy()
    payload.setdefault("jti", str(uuid.uuid4()))
    payload["exp"] = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        if jti:
            if is_token_revoked(db, jti):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session_revoked")
            platform = payload.get("platform")
            user_id  = payload.get("user_id")
            if platform and user_id:
                session = db.query(UserSession).filter(
                    UserSession.user_id == user_id,
                    UserSession.platform == platform,
                ).first()
                if not session or session.jti != jti:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session_superseded")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def validate_password_policy(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")


def _full_permissions():
    return {module: {action: True for action in ALL_ACTIONS} for module in MODULES}


def _normalize_permissions(value):
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}


def get_user_permissions(user: User, assignment_permissions=None):
    if normalize_user_type(user) in FULL_ACCESS_ROLES:
        return _full_permissions()
    permissions = _normalize_permissions(assignment_permissions)
    return {
        module: {action: bool(actions.get(action)) for action in ALL_ACTIONS}
        for module, actions in permissions.items()
    }


def get_current_user(payload: dict = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_roles(*roles):
    def dependency(user: User = Depends(get_current_user)):
        if normalize_user_type(user) not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dependency


def get_accessible_projects_for_user(db: Session, user: User):
    if normalize_user_type(user) in PRIVILEGED_ROLES:
        projects = db.query(Project).filter(Project.is_active == True).order_by(Project.name.asc()).all()
        return [(project, _full_permissions()) for project in projects]

    assignments = (
        db.query(UserProjectAccess, Project)
        .join(Project, Project.id == UserProjectAccess.project_id)
        .filter(UserProjectAccess.user_id == user.id, UserProjectAccess.is_active == True, Project.is_active == True)
        .order_by(Project.name.asc())
        .all()
    )
    return [
        (project, get_user_permissions(user, assignment.permissions_json))
        for assignment, project in assignments
    ]


def build_session_response(db: Session, user: User) -> SessionResponse:
    projects = [
        SessionProject(
            id=project.id,
            project_code=project.project_code,
            name=project.name,
            site_type=project.site_type,
            department_type=project.department_type,
            is_active=project.is_active,
            permissions=permissions,
        )
        for project, permissions in get_accessible_projects_for_user(db, user)
    ]

    return SessionResponse(
        user=SessionUser(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            email=user.email,
            contact_no=user.contact_no,
            user_type=normalize_user_type(user),
            force_password_change=user.force_password_change,
        ),
        projects=projects,
    )


def ensure_project_action(db: Session, user: User, project_id, module: str, action: str):
    if normalize_user_type(user) in PRIVILEGED_ROLES:
        return

    assignment = (
        db.query(UserProjectAccess)
        .filter(
            UserProjectAccess.user_id == user.id,
            UserProjectAccess.project_id == project_id,
            UserProjectAccess.is_active == True,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Project access denied")

    permissions = get_user_permissions(user, assignment.permissions_json)
    if not permissions.get(module, {}).get(action, False):
        raise HTTPException(status_code=403, detail=f"{action.title()} permission denied for {module}")

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    if req.platform not in ("web", "mobile"):
        raise HTTPException(status_code=400, detail="platform must be 'web' or 'mobile'")

    identifier = req.email.strip().lower()
    user = db.query(User).filter((User.email == identifier) | (User.username == identifier)).first()
    if not user or not user.is_active or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if req.platform == "mobile":
        if not req.device_id:
            raise HTTPException(status_code=400, detail="device_id is required for mobile login")
        registered = db.query(RegisteredDevice).filter(RegisteredDevice.user_id == user.id).first()
        if registered is None:
            db.add(RegisteredDevice(
                user_id=user.id,
                device_id=req.device_id,
                device_label=req.device_label,
            ))
        elif registered.device_id != req.device_id:
            raise HTTPException(
                status_code=403,
                detail="device_not_recognized: This device is not registered. Please contact your administrator to reset your device.",
            )

    existing_session = db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.platform == req.platform,
    ).first()

    if existing_session:
        if existing_session.expires_at and existing_session.expires_at <= datetime.utcnow():
            db.delete(existing_session)
            db.flush()
        else:
            raise HTTPException(status_code=409, detail="already_logged_in: An active session already exists on this platform")

    token_jti = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)

    token = create_token({
        "sub": user.email,
        "user_id": str(user.id),
        "user_type": normalize_user_type(user),
        "platform": req.platform,
        "jti": token_jti,
    })

    db.add(UserSession(
        user_id=user.id,
        platform=req.platform,
        jti=token_jti,
        device_id=req.device_id,
        device_label=req.device_label,
        expires_at=expires_at,
    ))

    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=token, session=build_session_response(db, user))


@router.post("/logout")
def logout(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    user_id  = payload.get("user_id")
    platform = payload.get("platform")
    jti      = payload.get("jti")

    if user_id and platform:
        session = db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.platform == platform,
        ).first()
        if session:
            db.delete(session)

    if jti and user_id:
        invalidate_user_sessions(db, user_id, jti)

    db.commit()
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_session_response(db, user)


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password_policy(req.new_password)
    user.password_hash = hash_password(req.new_password)
    user.force_password_change = False
    user.updated_by = user.email
    db.commit()
    return {"changed": True}
