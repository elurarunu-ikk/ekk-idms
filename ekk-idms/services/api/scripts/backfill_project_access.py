"""
Backfill UserProjectAccess rows for users that have module assignments but no
project access row, leaving them locked out of every project-scoped action.

Scope: exactly 4 (user, project) pairs — see TARGETS below.
Grant: view=true on each assigned module, all other actions false.
Safe to re-run: skips any pair that already has a row.
"""
import json
import os
import sys
import uuid

# Allow imports from /app (services/api/) when run from /app/scripts/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.user import User
from models.user_mgmt_models import UserModuleAssignment
from models.user_project_access import UserProjectAccess

ALL_ACTIONS = ["add", "edit", "delete", "view", "approve"]

# (username, project_id)
TARGETS = [
    ("royal",     uuid.UUID("6f2eaeec-6f15-4f51-ae20-4dd0e376f27e")),  # TBRP
    ("testuser1", uuid.UUID("6f2eaeec-6f15-4f51-ae20-4dd0e376f27e")),  # TBRP
    ("testuser",  uuid.UUID("6f2eaeec-6f15-4f51-ae20-4dd0e376f27e")),  # TBRP
    ("testuser",  uuid.UUID("c4cda786-13b0-4ac9-b778-e4a3b066401e")),  # VSRP
]


def build_permissions(module_ids: list[str]) -> str:
    """view=true, everything else false for each module."""
    return json.dumps({
        mid: {action: (action == "view") for action in ALL_ACTIONS}
        for mid in module_ids
    })


def main():
    db = SessionLocal()
    try:
        created = 0
        skipped = 0

        for username, project_id in TARGETS:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                print(f"  WARN  user '{username}' not found — skipping")
                continue

            existing = (
                db.query(UserProjectAccess)
                .filter(
                    UserProjectAccess.user_id == user.id,
                    UserProjectAccess.project_id == project_id,
                )
                .first()
            )
            if existing:
                print(f"  SKIP  {username} / {project_id}  (row already exists, is_active={existing.is_active})")
                skipped += 1
                continue

            module_ids = [
                row.module_id
                for row in db.query(UserModuleAssignment)
                .filter(UserModuleAssignment.user_id == user.id)
                .all()
            ]

            permissions = build_permissions(module_ids)

            row = UserProjectAccess(
                user_id=user.id,
                project_id=project_id,
                is_active=True,
                permissions_json=permissions,
            )
            db.add(row)
            db.flush()

            modules_display = module_ids if module_ids else ["(none)"]
            print(
                f"  CREATE {username} ({user.user_type}) / {project_id}\n"
                f"         modules granted view-only: {', '.join(modules_display)}"
            )
            created += 1

        db.commit()
        print(f"\nDone — {created} created, {skipped} skipped.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
