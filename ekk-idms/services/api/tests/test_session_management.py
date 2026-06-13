"""
Unit tests for single-session-per-platform enforcement and logout.

Run: cd ekk-idms/services/api && source venv/bin/activate && pytest tests/test_session_management.py -v
"""
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from database import get_db, engine, Base
from main import app
from auth import hash_password
from models.user import User
from models.user_session import RegisteredDevice, UserSession
from sqlalchemy.orm import sessionmaker

# ── Per-test DB session with rollback ─────────────────────────────────────────
TestSession = sessionmaker(bind=engine)


@pytest.fixture()
def db():
    conn = engine.connect()
    trans = conn.begin()
    session = TestSession(bind=conn)
    yield session
    session.close()
    trans.rollback()
    conn.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(db):
    user = User(
        id=uuid.uuid4(),
        full_name="Test Admin",
        username=f"testadmin_{uuid.uuid4().hex[:6]}",
        email=f"testadmin_{uuid.uuid4().hex[:6]}@ekk.in",
        user_type="ADMIN",
        password_hash=hash_password("Test@1234"),
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


# ── Helpers ────────────────────────────────────────────────────────────────────

def do_login(client, user, password="Test@1234", platform="web", device_id=None):
    payload = {"email": user.email, "password": password, "platform": platform}
    if device_id:
        payload["device_id"] = device_id
    return client.post("/auth/login", json=payload)


# ── Login tests ────────────────────────────────────────────────────────────────

class TestLogin:
    def test_web_login_success(self, client, test_user, db):
        r = do_login(client, test_user)
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert db.query(UserSession).filter_by(user_id=test_user.id, platform="web").count() == 1

    def test_web_second_login_rejected_409(self, client, test_user, db):
        assert do_login(client, test_user).status_code == 200
        r = do_login(client, test_user)
        assert r.status_code == 409
        assert "already_logged_in" in r.json()["detail"]

    def test_expired_session_is_reclaimed(self, client, test_user, db):
        expired = UserSession(
            user_id=test_user.id,
            platform="web",
            jti=str(uuid.uuid4()),
            expires_at=datetime.utcnow() - timedelta(minutes=1),
        )
        db.add(expired)
        db.flush()
        r = do_login(client, test_user)
        assert r.status_code == 200, r.json()
        rows = db.query(UserSession).filter_by(user_id=test_user.id, platform="web").all()
        assert len(rows) == 1
        assert rows[0].jti != expired.jti

    def test_invalid_credentials_rejected(self, client, test_user):
        r = do_login(client, test_user, password="WrongPass!")
        assert r.status_code == 401

    def test_invalid_platform_rejected(self, client, test_user):
        r = client.post("/auth/login", json={
            "email": test_user.email, "password": "Test@1234", "platform": "tablet"
        })
        assert r.status_code == 400

    def test_mobile_login_creates_registered_device(self, client, test_user, db):
        device_id = str(uuid.uuid4())
        r = do_login(client, test_user, platform="mobile", device_id=device_id)
        assert r.status_code == 200
        dev = db.query(RegisteredDevice).filter_by(user_id=test_user.id).first()
        assert dev is not None
        assert dev.device_id == device_id

    def test_mobile_login_requires_device_id(self, client, test_user):
        r = do_login(client, test_user, platform="mobile")
        assert r.status_code == 400

    def test_mobile_wrong_device_rejected_403(self, client, test_user, db):
        first_device = str(uuid.uuid4())
        assert do_login(client, test_user, platform="mobile", device_id=first_device).status_code == 200
        # Clear session so device-check is reached on next attempt
        db.query(UserSession).filter_by(user_id=test_user.id, platform="mobile").delete()
        db.flush()
        r = do_login(client, test_user, platform="mobile", device_id=str(uuid.uuid4()))
        assert r.status_code == 403
        assert "device_not_recognized" in r.json()["detail"]

    def test_web_and_mobile_sessions_coexist(self, client, test_user, db):
        assert do_login(client, test_user, platform="web").status_code == 200
        assert do_login(client, test_user, platform="mobile", device_id=str(uuid.uuid4())).status_code == 200
        assert db.query(UserSession).filter_by(user_id=test_user.id).count() == 2


# ── Logout tests ───────────────────────────────────────────────────────────────

class TestLogout:
    def _login(self, client, test_user, platform="web", device_id=None):
        r = do_login(client, test_user, platform=platform, device_id=device_id)
        assert r.status_code == 200
        return r.json()["access_token"]

    def test_logout_deletes_session_row(self, client, test_user, db):
        token = self._login(client, test_user)
        r = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert db.query(UserSession).filter_by(user_id=test_user.id).count() == 0

    def test_logout_then_login_succeeds(self, client, test_user, db):
        token = self._login(client, test_user)
        client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
        r = do_login(client, test_user)
        assert r.status_code == 200

    def test_token_rejected_after_logout(self, client, test_user, db):
        token = self._login(client, test_user)
        client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
        r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_logout_without_token_rejected(self, client, test_user):
        r = client.post("/auth/logout")
        assert r.status_code == 403

    def test_mobile_logout_clears_mobile_session_only(self, client, test_user, db):
        web_token    = self._login(client, test_user, platform="web")
        mobile_token = self._login(client, test_user, platform="mobile", device_id=str(uuid.uuid4()))
        client.post("/auth/logout", headers={"Authorization": f"Bearer {mobile_token}"})
        assert db.query(UserSession).filter_by(user_id=test_user.id, platform="web").count() == 1
        assert db.query(UserSession).filter_by(user_id=test_user.id, platform="mobile").count() == 0
