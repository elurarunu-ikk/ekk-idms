import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import hash_password, require_roles, validate_password_policy
from database import get_db
from models.project import Project
from models.user import User
from models.user_project_access import UserProjectAccess
from schemas.admin import ProjectAssignmentResponse, UserCreateRequest, UserResponse, UserUpdateRequest


router = APIRouter()


def _validate_phone(value: str) -> None:
    if not re.fullmatch(r"\d{10}", value):
        raise HTTPException(status_code=400, detail="Contact number must be 10 digits")


def _build_user_response(db: Session, user: User) -> UserResponse:
    assignments = (
        db.query(UserProjectAccess, Project)
        .join(Project, Project.id == UserProjectAccess.project_id)
        .filter(UserProjectAccess.user_id == user.id)
        .all()
    )
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        emp_code=user.emp_code,
        username=user.username,
        contact_no=user.contact_no,
        email=user.email,
        user_type=user.user_type,
        is_active=user.is_active,
        force_password_change=user.force_password_change,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
        assignments=[
            ProjectAssignmentResponse(
                project_id=project.id,
                project_code=project.project_code,
                project_name=project.name,
                is_active=assignment.is_active,
                permissions=json.loads(assignment.permissions_json) if assignment.permissions_json else {},
            )
            for assignment, project in assignments
        ],
    )


def _replace_assignments(db: Session, user: User, assignments):
    db.query(UserProjectAccess).filter(UserProjectAccess.user_id == user.id).delete()
    for assignment in assignments:
        db.add(
            UserProjectAccess(
                user_id=user.id,
                project_id=assignment.project_id,
                permissions_json=json.dumps(assignment.permissions),
                is_active=assignment.is_active,
            )
        )


@router.get("/", response_model=list[UserResponse])
def list_users(
    search: str | None = Query(None),
    user_type: str | None = Query(None),
    is_active: bool | None = Query(None),
    _: User = Depends(require_roles("SUPER ADMIN", "ADMIN")),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter((User.full_name.ilike(like)) | (User.email.ilike(like)) | (User.username.ilike(like)) | (User.emp_code.ilike(like)))
    if user_type:
        query = query.filter(User.user_type == user_type)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return [_build_user_response(db, user) for user in query.order_by(User.created_at.desc()).all()]


@router.post("/", response_model=UserResponse)
def create_user(
    payload: UserCreateRequest,
    admin: User = Depends(require_roles("SUPER ADMIN", "ADMIN")),
    db: Session = Depends(get_db),
):
    _validate_phone(payload.contact_no)
    validate_password_policy(payload.password)

    duplicate = db.query(User).filter(
        (User.email == payload.email)
        | (User.username == payload.username)
        | (User.emp_code == payload.emp_code)
    ).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Email, username, or EMP code already exists")

    user = User(
        full_name=payload.full_name,
        emp_code=payload.emp_code,
        username=payload.username.lower(),
        contact_no=payload.contact_no,
        email=payload.email.lower(),
        user_type=payload.user_type,
        role=payload.user_type,
        is_active=payload.is_active,
        force_password_change=payload.force_password_change,
        password_hash=hash_password(payload.password),
        created_by=admin.email,
        updated_by=admin.email,
    )
    db.add(user)
    db.flush()
    _replace_assignments(db, user, payload.assignments)
    db.commit()
    db.refresh(user)
    return _build_user_response(db, user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    admin: User = Depends(require_roles("SUPER ADMIN", "ADMIN")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = payload.model_dump(exclude_unset=True)
    if "contact_no" in updates and updates["contact_no"] is not None:
        _validate_phone(updates["contact_no"])
    if "password" in updates and updates["password"]:
        validate_password_policy(updates["password"])
        user.password_hash = hash_password(updates.pop("password"))
    if "email" in updates and updates["email"]:
        updates["email"] = updates["email"].lower()
    if "username" in updates and updates["username"]:
        updates["username"] = updates["username"].lower()

    for field in ["email", "username", "emp_code"]:
        if field in updates:
            duplicate = db.query(User).filter(getattr(User, field) == updates[field], User.id != user.id).first()
            if duplicate:
                raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ').title()} already exists")

    assignments = updates.pop("assignments", None)
    for key, value in updates.items():
        setattr(user, key, value)
    user.role = user.user_type
    user.updated_by = admin.email
    if assignments is not None:
        _replace_assignments(db, user, assignments)
    db.commit()
    db.refresh(user)
    return _build_user_response(db, user)