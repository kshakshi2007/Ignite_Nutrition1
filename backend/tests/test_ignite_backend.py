"""Ignite Nutrition - Backend API tests (pytest)."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"

API = f"{BASE_URL}/api"
TIMEOUT = 60  # Mercury-2 can take 5-15s


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def unique_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@ignite.app"


@pytest.fixture(scope="session")
def auth(s, unique_email):
    """Register a fresh user, complete onboarding, return token + uid."""
    r = s.post(f"{API}/auth/register",
               json={"email": unique_email, "password": "Test1234!", "name": "TestUser"},
               timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["token"]
    uid = data["user"]["uid"]
    headers = {"Authorization": f"Bearer {token}"}
    # Onboarding (Male, 28, 175, 72, weight_loss)
    r2 = s.post(f"{API}/profile/onboarding",
                json={"age": 28, "height": 175, "weight": 72, "gender": "male",
                      "goal": "weight_loss", "dietType": "Omnivore", "allergies": ["Nuts"]},
                headers=headers, timeout=TIMEOUT)
    assert r2.status_code == 200, r2.text
    return {"token": token, "uid": uid, "headers": headers, "email": unique_email,
            "profile": r2.json()}


# ---------- Health ----------
def test_root(s):
    r = s.get(f"{API}/", timeout=TIMEOUT)
    assert r.status_code == 200
    j = r.json()
    assert j.get("app") and j.get("status")


# ---------- Auth ----------
def test_register_login_flow(s):
    email = f"TEST_{uuid.uuid4().hex[:10]}@ignite.app"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Pass1234!", "name": "Reg"},
               timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "token" in j and j["user"]["email"] == email.lower()
    assert "passwordHash" not in j["user"]

    # Duplicate
    r2 = s.post(f"{API}/auth/register",
                json={"email": email, "password": "Pass1234!"}, timeout=TIMEOUT)
    assert r2.status_code == 400

    # Login OK
    r3 = s.post(f"{API}/auth/login", json={"email": email, "password": "Pass1234!"}, timeout=TIMEOUT)
    assert r3.status_code == 200
    assert r3.json()["token"]

    # Login bad
    r4 = s.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=TIMEOUT)
    assert r4.status_code == 401


def test_google_auth_creates_then_logs_in(s):
    email = f"TEST_g_{uuid.uuid4().hex[:8]}@ignite.app"
    r = s.post(f"{API}/auth/google", json={"email": email, "name": "G User"}, timeout=TIMEOUT)
    assert r.status_code == 200
    uid1 = r.json()["user"]["uid"]
    r2 = s.post(f"{API}/auth/google", json={"email": email}, timeout=TIMEOUT)
    assert r2.status_code == 200
    assert r2.json()["user"]["uid"] == uid1


def test_me_endpoint(s, auth):
    r = s.get(f"{API}/auth/me", headers=auth["headers"], timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["uid"] == auth["uid"]
    # No auth
    r2 = s.get(f"{API}/auth/me", timeout=TIMEOUT)
    assert r2.status_code == 401


# ---------- Profile / Onboarding ----------
def test_onboarding_calc(auth):
    p = auth["profile"]
    # Male, 28, 175cm, 72kg, weight_loss
    # BMR = 10*72 + 6.25*175 - 5*28 + 5 = 720 + 1093.75 - 140 + 5 = 1678.75 -> 1679
    # Calorie target = 1678.75*1.4 - 500 = 2350.25 - 500 = 1850.25 -> 1850
    assert p["bmr"] == 1679, f"bmr was {p['bmr']}"
    assert p["calorieEstimate"] == 1850, f"calorieEstimate was {p['calorieEstimate']}"
    assert p["onboarded"] is True


def test_profile_update_recalcs(s, auth):
    r = s.put(f"{API}/profile", json={"weight": 80, "goal": "muscle_gain"},
              headers=auth["headers"], timeout=TIMEOUT)
    assert r.status_code == 200
    j = r.json()
    # BMR = 10*80 + 6.25*175 - 5*28 + 5 = 800+1093.75-140+5 = 1758.75 -> 1759
    # Calories = 1758.75*1.4 + 300 = 2462.25+300 = 2762.25 -> 2762
    assert j["bmr"] == 1759
    assert j["calorieEstimate"] == 2762
    # restore
    s.put(f"{API}/profile", json={"weight": 72, "goal": "weight_loss"},
          headers=auth["headers"], timeout=TIMEOUT)


# ---------- Meal Plan ----------
def test_meal_plan_generate_and_latest(s, auth):
    r = s.post(f"{API}/meal-plan/generate", json={"notes": "high protein"},
               headers=auth["headers"], timeout=90)
    assert r.status_code == 200, r.text
    plan = r.json()
    for k in ("breakfast", "lunch", "dinner", "snack"):
        assert k in plan and isinstance(plan[k], dict)
        assert "name" in plan[k] and "reason" in plan[k]
    r2 = s.get(f"{API}/meal-plan/latest", headers=auth["headers"], timeout=TIMEOUT)
    assert r2.status_code == 200
    assert r2.json().get("id") == plan["id"]


# ---------- Scan ----------
def test_scan_text(s, auth):
    r = s.post(f"{API}/scan/analyze",
               json={"ingredients_text": "Sugar, Wheat Flour, Palm Oil, E211, Salt, Cocoa"},
               headers=auth["headers"], timeout=90)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("verdict") in ("good", "limit", "avoid")
    assert isinstance(j.get("ingredients"), list) and len(j["ingredients"]) >= 1


def test_scan_no_input(s, auth):
    r = s.post(f"{API}/scan/analyze", json={}, headers=auth["headers"], timeout=TIMEOUT)
    assert r.status_code == 400


# ---------- Chat ----------
def test_chat_pre_auth_and_history(s):
    sid = f"TEST_sess_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{API}/chat/send",
               json={"session_id": sid, "message": "Quick high-protein breakfast idea?", "pre_auth": True},
               timeout=90)
    assert r.status_code == 200, r.text
    assert r.json().get("reply")
    r2 = s.get(f"{API}/chat/history/{sid}", timeout=TIMEOUT)
    assert r2.status_code == 200
    msgs = r2.json()
    assert len(msgs) >= 2
    roles = [m["role"] for m in msgs]
    assert "user" in roles and "assistant" in roles


def test_chat_authed(s, auth):
    sid = f"TEST_sess_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{API}/chat/send",
               json={"session_id": sid, "message": "Suggest a snack.", "pre_auth": False},
               headers=auth["headers"], timeout=90)
    assert r.status_code == 200, r.text
    assert r.json().get("reply")


# ---------- Recipes ----------
@pytest.fixture(scope="session")
def recipe(s, auth):
    r = s.post(f"{API}/recipes",
               json={"title": "TEST_Protein Bowl", "ingredients": "chicken, rice, broccoli",
                     "description": "High-protein lunch"},
               headers=auth["headers"], timeout=90)
    assert r.status_code == 200, r.text
    return r.json()


def test_recipe_create(recipe):
    for k in ("id", "title", "category", "tags", "healthNote", "likes", "likedBy"):
        assert k in recipe
    assert recipe["likes"] == 0


def test_recipe_list(s, recipe):
    r = s.get(f"{API}/recipes", timeout=TIMEOUT)
    assert r.status_code == 200
    items = r.json()
    assert any(it["id"] == recipe["id"] for it in items)


def test_recipe_like_toggle(s, auth, recipe):
    rid = recipe["id"]
    r = s.post(f"{API}/recipes/{rid}/like", headers=auth["headers"], timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["likes"] == 1
    assert auth["uid"] in r.json()["likedBy"]
    r2 = s.post(f"{API}/recipes/{rid}/like", headers=auth["headers"], timeout=TIMEOUT)
    assert r2.json()["likes"] == 0
    assert auth["uid"] not in r2.json()["likedBy"]


# ---------- Progress ----------
def test_progress_crud(s, auth):
    r = s.post(f"{API}/progress",
               json={"title": "TEST_Oatmeal", "type": "meal", "mealType": "breakfast"},
               headers=auth["headers"], timeout=TIMEOUT)
    assert r.status_code == 200
    pid = r.json()["id"]
    r2 = s.get(f"{API}/progress", headers=auth["headers"], timeout=TIMEOUT)
    assert r2.status_code == 200
    assert any(x["id"] == pid for x in r2.json())
    r3 = s.delete(f"{API}/progress/{pid}", headers=auth["headers"], timeout=TIMEOUT)
    assert r3.status_code == 200
    r4 = s.get(f"{API}/progress", headers=auth["headers"], timeout=TIMEOUT)
    assert not any(x["id"] == pid for x in r4.json())
