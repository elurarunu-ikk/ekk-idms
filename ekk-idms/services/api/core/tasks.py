from celery_app import celery_app

@celery_app.task(name="core.tasks.recompute_all_evm")
def recompute_all_evm():
    """Recompute EVM metrics for all active projects. Runs hourly via Celery Beat."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        # TODO: implement EVM recompute logic
        pass
    finally:
        db.close()

@celery_app.task(name="core.tasks.compute_evm_for_project")
def compute_evm_for_project(project_id: str):
    """Triggered after each approved SDT entry."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        # TODO: implement per-project EVM compute
        pass
    finally:
        db.close()
