"""Focused retest of POST /api/meals/estimate-macros after fix."""
import os
import json
import sys
import requests

BASE = "https://ignite-nutrition.preview.emergentagent.com/api"
EMAIL = "smoke1@ignite.app"
PASSWORD = "Test1234!"


def login() -> str:
    r = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    r.raise_for_status()
    return r.json()["token"]


def estimate(token: str, name: str, notes: str | None = None):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"name": name}
    if notes:
        payload["notes"] = notes
    r = requests.post(
        f"{BASE}/meals/estimate-macros",
        json=payload,
        headers=headers,
        timeout=45,
    )
    return r


def main():
    print("== Login ==")
    token = login()
    print(f"token len={len(token)}")

    cases = [
        {"name": "2 eggs and toast"},
        {"name": "Grilled chicken salad", "notes": "1 large bowl"},
        {"name": "Bowl of oatmeal with banana"},
        {"name": "Cheeseburger and fries"},
    ]

    results = []
    failures = []

    for i, c in enumerate(cases, 1):
        print(f"\n== Case {i}: {c} ==")
        r = estimate(token, c["name"], c.get("notes"))
        print(f"status={r.status_code}")
        if r.status_code != 200:
            failures.append(f"Case {i}: HTTP {r.status_code} body={r.text[:300]}")
            continue
        body = r.json()
        print(json.dumps(body, indent=2))

        # Numeric checks
        for k in ("calories", "protein", "carbs", "fat"):
            if not isinstance(body.get(k), (int, float)):
                failures.append(f"Case {i}: {k} not numeric ({body.get(k)!r})")

        # Portion non-empty string
        portion = body.get("portion")
        if not (isinstance(portion, str) and portion.strip()):
            failures.append(f"Case {i}: portion empty/non-string ({portion!r})")

        results.append(body)

    # Variance check across the 4
    fallback = (400.0, 20.0, 45.0, 15.0)
    tuples = [
        (
            float(b.get("calories", 0)),
            float(b.get("protein", 0)),
            float(b.get("carbs", 0)),
            float(b.get("fat", 0)),
        )
        for b in results
    ]
    print("\n== Macro tuples ==")
    for c, t in zip(cases, tuples):
        print(c["name"], "->", t)

    if all(t == fallback for t in tuples):
        failures.append("All 4 responses match the hardcoded fallback (400/20/45/15) — Mercury still not responding")
    elif len(set(tuples)) == 1:
        failures.append(f"All 4 responses identical (not fallback but suspicious): {tuples[0]}")

    # Sanity: cheeseburger calories > oatmeal calories
    name_to_cal = {
        cases[i]["name"]: tuples[i][0] for i in range(len(tuples))
    }
    cb = name_to_cal.get("Cheeseburger and fries", 0)
    oat = name_to_cal.get("Bowl of oatmeal with banana", 0)
    print(f"\nCheeseburger cal={cb} vs Oatmeal cal={oat}")
    if cb <= oat:
        failures.append(f"Sanity: cheeseburger ({cb}) should have more calories than oatmeal ({oat})")

    cb_fat = next((t[3] for c, t in zip(cases, tuples) if c["name"] == "Cheeseburger and fries"), 0)
    oat_fat = next((t[3] for c, t in zip(cases, tuples) if c["name"] == "Bowl of oatmeal with banana"), 0)
    print(f"Cheeseburger fat={cb_fat} vs Oatmeal fat={oat_fat}")
    if cb_fat <= oat_fat:
        failures.append(f"Sanity: cheeseburger fat ({cb_fat}) should exceed oatmeal fat ({oat_fat})")

    # 401 with empty token
    print("\n== 401 check (empty token) ==")
    r = requests.post(
        f"{BASE}/meals/estimate-macros",
        json={"name": "Pizza"},
        headers={"Authorization": "Bearer "},
        timeout=15,
    )
    print(f"empty token status={r.status_code}")
    if r.status_code != 401:
        failures.append(f"Empty token expected 401, got {r.status_code}")

    # No header at all
    r2 = requests.post(
        f"{BASE}/meals/estimate-macros",
        json={"name": "Pizza"},
        timeout=15,
    )
    print(f"no header status={r2.status_code}")
    if r2.status_code not in (401, 403):
        failures.append(f"No auth expected 401/403, got {r2.status_code}")

    print("\n== SUMMARY ==")
    if failures:
        print("FAILURES:")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    else:
        print("All checks passed.")


if __name__ == "__main__":
    main()
