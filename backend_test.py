"""Backend tests for Ignite Nutrition - focuses on 3 needs_retesting tasks plus regression."""
import os
import sys
import json
import time
import uuid
import requests

BASE = "https://ignite-nutrition.preview.emergentagent.com/api"
TIMEOUT = 60  # AI endpoints can be slow

# Use test creds from /app/memory/test_credentials.md
TEST_EMAIL = "smoke1@ignite.app"
TEST_PASSWORD = "Test1234!"

results = []
def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} - {name} :: {detail}")

def post(path, json_body=None, token=None, timeout=TIMEOUT):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE}{path}", json=json_body, headers=h, timeout=timeout)

def get(path, token=None, timeout=TIMEOUT):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE}{path}", headers=h, timeout=timeout)

def ensure_authed_user():
    """Login with seeded creds. If missing, register fresh + onboard."""
    r = post("/auth/login", {"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code == 200:
        data = r.json()
        record("Login existing test user", True, f"uid={data['user'].get('uid')[:8]}")
        # confirm onboarded
        me = get("/auth/me", data["token"])
        if me.status_code == 200 and me.json().get("onboarded"):
            return data["token"], me.json()
        # Else perform onboarding
        ob = post("/profile/onboarding", {
            "age": 28, "height": 175.0, "weight": 72.0,
            "gender": "male", "goal": "weight_loss",
            "dietType": "Omnivore", "allergies": ["Nuts"]
        }, data["token"])
        if ob.status_code == 200:
            return data["token"], ob.json()
        record("Onboarding existing user", False, f"{ob.status_code} {ob.text[:200]}")
        return data["token"], me.json() if me.status_code == 200 else {}

    # Otherwise register fresh user
    fresh_email = f"smoketest+{uuid.uuid4().hex[:8]}@ignite.app"
    r = post("/auth/register", {"email": fresh_email, "password": TEST_PASSWORD, "name": "Smoke Tester"})
    if r.status_code != 200:
        record("Register fresh user", False, f"{r.status_code} {r.text[:200]}")
        sys.exit(1)
    data = r.json()
    record("Register fresh user", True, fresh_email)
    ob = post("/profile/onboarding", {
        "age": 28, "height": 175.0, "weight": 72.0,
        "gender": "male", "goal": "weight_loss",
        "dietType": "Omnivore", "allergies": ["Nuts"]
    }, data["token"])
    if ob.status_code != 200:
        record("Onboarding fresh user", False, f"{ob.status_code} {ob.text[:200]}")
        sys.exit(1)
    record("Onboarding fresh user", True, f"calorieEstimate={ob.json().get('calorieEstimate')}")
    return data["token"], ob.json()


def is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def test_meal_plan_location(token):
    location = "Mumbai, India"
    r = post("/meal-plan/generate", {"notes": None, "location": location}, token, timeout=90)
    if r.status_code != 200:
        record("Meal plan generate (Mumbai, India)", False, f"{r.status_code} {r.text[:300]}")
        return
    data = r.json()
    # Check structure
    missing = [k for k in ("breakfast", "lunch", "dinner", "snack") if k not in data]
    if missing:
        record("Meal plan structure", False, f"missing {missing}")
        return
    # Check macro fields each
    bad = []
    for k in ("breakfast", "lunch", "dinner", "snack"):
        meal = data[k]
        for f in ("name", "reason", "calories", "protein", "carbs", "fat"):
            if f not in meal:
                bad.append(f"{k}.{f} missing")
        for f in ("calories", "protein", "carbs", "fat"):
            if f in meal and not is_number(meal[f]):
                bad.append(f"{k}.{f} not numeric ({type(meal[f]).__name__})")
    if bad:
        record("Meal plan macro fields", False, "; ".join(bad))
    else:
        record("Meal plan macro fields", True, "all 4 meals have numeric macros")

    # Check location echo
    if data.get("location") == location:
        record("Meal plan echoes location", True, location)
    else:
        record("Meal plan echoes location", False, f"got {data.get('location')!r}")

    # Sanity: dish names should hint Indian cuisine for Mumbai
    names = " ".join(str(data[k].get("name", "")).lower() for k in ("breakfast", "lunch", "dinner", "snack"))
    indian_keywords = ["paneer", "dal", "chapati", "roti", "idli", "dosa", "poha", "upma", "khichdi",
                        "biryani", "sabzi", "tikka", "masala", "curry", "rajma", "chana", "thali",
                        "samosa", "bhaji", "pulao", "raita", "chaat", "aloo", "tandoori", "korma",
                        "naan", "vada", "uttapam", "paratha", "lassi", "kheer", "halwa", "paneer",
                        "ghee", "kebab", "tikki", "biriyani", "sambar", "rasam"]
    hits = [w for w in indian_keywords if w in names]
    if hits:
        record("Meal plan dishes look Indian-themed", True, f"keywords: {hits[:5]} | names: {names[:200]}")
    else:
        record("Meal plan dishes look Indian-themed", False, f"no Indian keywords in: {names[:300]}")

    # Persist user location -> /auth/me
    me = get("/auth/me", token)
    if me.status_code == 200 and me.json().get("location") == location:
        record("User location persisted on profile", True, me.json().get("location"))
    else:
        record("User location persisted on profile", False,
               f"me.location={me.json().get('location') if me.status_code==200 else me.text[:100]}")

    # Latest meal plan retrievable
    latest = get("/meal-plan/latest", token)
    if latest.status_code == 200 and latest.json().get("breakfast"):
        record("GET /meal-plan/latest", True, f"location={latest.json().get('location')}")
    else:
        record("GET /meal-plan/latest", False, f"{latest.status_code} {latest.text[:200]}")


def test_estimate_macros(token):
    r = post("/meals/estimate-macros", {"name": "2 eggs and toast", "notes": "1 serving"}, token, timeout=60)
    if r.status_code != 200:
        record("Estimate macros endpoint", False, f"{r.status_code} {r.text[:300]}")
        return
    data = r.json()
    needed = ["name", "calories", "protein", "carbs", "fat", "portion"]
    missing = [k for k in needed if k not in data]
    if missing:
        record("Estimate macros shape", False, f"missing {missing}")
        return
    bad = [k for k in ("calories", "protein", "carbs", "fat") if not is_number(data[k])]
    if bad:
        record("Estimate macros numeric", False, f"non-numeric: {bad}")
        return
    # Sanity: 2 eggs + toast ~ 250-500 kcal
    cal = data["calories"]
    reasonable = 150 <= cal <= 700
    record("Estimate macros values reasonable",
           reasonable, f"cal={cal}, P={data['protein']}, C={data['carbs']}, F={data['fat']}, portion={data['portion']!r}")
    record("Estimate macros echoes name", data["name"] == "2 eggs and toast", f"name={data['name']!r}")

    # No notes variant
    r2 = post("/meals/estimate-macros", {"name": "Grilled chicken salad"}, token, timeout=60)
    if r2.status_code == 200 and is_number(r2.json().get("calories")):
        record("Estimate macros without notes", True, f"cal={r2.json()['calories']}")
    else:
        record("Estimate macros without notes", False, f"{r2.status_code} {r2.text[:200]}")


def test_progress_macros(token):
    payload = {"title": "Test meal", "type": "meal", "mealType": "lunch",
               "calories": 500, "protein": 30, "carbs": 60, "fat": 15}
    r = post("/progress", payload, token)
    if r.status_code != 200:
        record("POST /progress with macros", False, f"{r.status_code} {r.text[:300]}")
        return
    data = r.json()
    bad = []
    for k, v in payload.items():
        if data.get(k) != v:
            bad.append(f"{k}: expected {v}, got {data.get(k)}")
    if bad:
        record("POST /progress echoes macro fields", False, "; ".join(bad))
    else:
        record("POST /progress echoes macro fields", True, f"id={data.get('id', '')[:8]}")
    pid = data.get("id")

    # GET progress
    r2 = get("/progress", token)
    if r2.status_code != 200:
        record("GET /progress", False, f"{r2.status_code} {r2.text[:200]}")
        return
    items = r2.json()
    found = next((it for it in items if it.get("id") == pid), None)
    if not found:
        record("GET /progress contains created entry", False, f"id {pid} missing")
        return
    macro_ok = all(found.get(k) == payload[k] for k in ("calories", "protein", "carbs", "fat"))
    record("GET /progress entry has macro values",
           macro_ok,
           f"cal={found.get('calories')} P={found.get('protein')} C={found.get('carbs')} F={found.get('fat')}")


def test_regression(token):
    # auth/me
    r = get("/auth/me", token)
    record("Regression: GET /auth/me", r.status_code == 200, f"status={r.status_code}")

    # scan/analyze (text)
    r = post("/scan/analyze", {"ingredients_text": "Sugar, palm oil, salt, E211, citric acid"}, token, timeout=60)
    ok = r.status_code == 200 and isinstance(r.json().get("ingredients"), list) and len(r.json()["ingredients"]) > 0
    record("Regression: POST /scan/analyze (text)", ok,
           f"status={r.status_code}, verdict={r.json().get('verdict') if r.status_code==200 else r.text[:120]}")

    # chat send authed
    sid = f"sess-{uuid.uuid4().hex[:8]}"
    r = post("/chat/send", {"session_id": sid, "message": "Give me a quick high-protein snack idea."}, token, timeout=60)
    ok = r.status_code == 200 and isinstance(r.json().get("reply"), str) and len(r.json()["reply"]) > 0
    record("Regression: POST /chat/send (authed)", ok, f"status={r.status_code}, reply_len={len(r.json().get('reply','')) if r.status_code==200 else 0}")

    # recipes list
    r = get("/recipes")
    record("Regression: GET /recipes", r.status_code == 200 and isinstance(r.json(), list),
           f"status={r.status_code}, count={len(r.json()) if r.status_code==200 else 'n/a'}")

    # recipes create
    r = post("/recipes", {
        "title": "Quinoa Power Bowl",
        "ingredients": "quinoa, chickpeas, kale, lemon, olive oil, tahini",
        "description": "Nutty fiber-rich lunch bowl"
    }, token, timeout=60)
    ok = r.status_code == 200 and r.json().get("id") and r.json().get("category")
    record("Regression: POST /recipes", ok, f"status={r.status_code}, category={r.json().get('category') if r.status_code==200 else r.text[:120]}")


def main():
    print(f"Backend: {BASE}")
    token, user = ensure_authed_user()
    print(f"User onboarded: {user.get('onboarded')}, calorieEstimate={user.get('calorieEstimate')}")
    print("\n--- TEST: Location-aware meal plan generation ---")
    test_meal_plan_location(token)
    print("\n--- TEST: Custom meal macro estimation ---")
    test_estimate_macros(token)
    print("\n--- TEST: Progress entries store macros ---")
    test_progress_macros(token)
    print("\n--- REGRESSION ---")
    test_regression(token)

    fails = [r for r in results if not r[1]]
    print(f"\n=== TOTAL: {len(results)}, PASS: {len(results)-len(fails)}, FAIL: {len(fails)} ===")
    for n, ok, d in fails:
        print(f"  FAIL: {n} :: {d}")
    sys.exit(0 if not fails else 1)


if __name__ == "__main__":
    main()
