from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery("ekk_idms", broker=REDIS_URL, backend=REDIS_URL, include=["core.tasks"])

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    beat_schedule={
        "evm-recompute-hourly": {
            "task": "core.tasks.recompute_all_evm",
            "schedule": 3600.0,
        },
    },
)
