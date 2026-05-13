"""Ignite Nutrition - FastAPI Backend (Supabase Edition)
AI-powered nutrition tracking with Mercury-2 (Inception Labs) for chat/meal-plans/recipes
and Gemini multimodal for food image scanning.
Database: Supabase PostgreSQL via supabase-py SDK
Auth: Supabase Auth (email/password + Google OAuth)
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import re
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
from openai import AsyncOpenAI
import httpx

# Supabase client
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
INCEPTION_API_KEY = os.environ["INCEPTION_API_KEY"]
INCEPTION_BASE_URL = os.environ.get("INCEPTION_BASE_URL", "https://api.inceptionlabs.ai/v1")
MERCURY_MODEL = os.environ.get("MERCURY_MODEL", "mercury")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ---------- Supabase Client ----------
# Using service_role key for backend-to-database operations
# Frontend uses anon key with RLS policies
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# ---------- LLM Clients ----------
mercury_client = AsyncOpenAI(api_key=INCEPTION_API_KEY, base_url=INCEPTION_BASE_URL)

# ---------- App ----------
app = FastAPI(title="Ignite Nutrition API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ============================================================
# Models
# ============================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthIn(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    picture: Optional[str] = None

class TokenOut(BaseModel):
    token: str
    user: Dict[str, Any]

class OnboardingIn(BaseModel):
    age: int
    height: float  # cm
    weight: float  # kg
    gender: Literal["male", "female", "other"]
    goal: Literal["weight_loss", "muscle_gain", "weight_gain", "maintenance"]
    dietType: str
    allergies: List[str] = []

class ProfileUpdate(BaseModel):
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    gender: Optional[str] = None
    goal: Optional[str] = None
    dietType: Optional[str] = None
    allergies: Optional[List[str]] = None
    name: Optional[str] = None

class MealPlanGenIn(BaseModel):
    notes: Optional[str] = None
    location: Optional[str] = None  # e.g., "Mumbai, India" or "Tokyo, Japan"

class MealEstimateIn(BaseModel):
    name: str
    notes: Optional[str] = None

class ScanIn(BaseModel):
    image_base64: Optional[str] = None  # data url or pure base64
    ingredients_text: Optional[str] = None

class ChatMessageIn(BaseModel):
    session_id: str
    message: str
    pre_auth: bool = False

class RecipeIn(BaseModel):
    title: str
    ingredients: str
    description: Optional[str] = ""

class ProgressIn(BaseModel):
    title: str
    type: Literal["meal", "recipe"]
    mealType: Optional[str] = None
    recipeId: Optional[str] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None

# ============================================================
# Auth Helpers — Supabase JWT Verification
# ============================================================
async def verify_supabase_token(token: str) -> dict:
    """Verify a Supabase JWT and return the user data."""
    try:
        # Use Supabase's built-in JWT verification via the SDK
        response = supabase.auth.get_user(token)
        if response and response.user:
            user_data = response.user
            return {
                "id": user_data.id,
                "email": user_data.email,
                "name": user_data.user_metadata.get("name", ""),
                "picture": user_data.user_metadata.get("avatar_url", ""),
            }
        raise HTTPException(401, "Invalid token")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(401, "Invalid or expired token")

async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(401, "Missing authorization")
    token = creds.credentials
    auth_user = await verify_supabase_token(token)

    # Get or create user profile in our users table
    result = supabase.table("users").select("*").eq("id", auth_user["id"]).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]

    # First login — create profile entry
    new_user = {
        "id": auth_user["id"],
        "email": auth_user["email"],
        "name": auth_user.get("name", auth_user["email"].split("@")[0]),
        "avatar_url": auth_user.get("picture", ""),
        "onboarded": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("users").insert(new_user).execute()
    return new_user

def fmt_user(u: dict) -> dict:
    """Format user dict for API response (remove sensitive fields)."""
    return {k: v for k, v in u.items() if k not in ("_id",)}

# ============================================================
# Calorie Formula (unchanged)
# ============================================================
def calc_bmr(age: int, height: float, weight: float, gender: str) -> float:
    # Mifflin-St Jeor
    if gender == "male":
        return 10 * weight + 6.25 * height - 5 * age + 5
    if gender == "female":
        return 10 * weight + 6.25 * height - 5 * age - 161
    return 10 * weight + 6.25 * height - 5 * age - 78  # avg for "other"

def goal_adjustment(goal: str) -> int:
    return {
        "weight_loss": -500,
        "muscle_gain": 300,
        "weight_gain": 500,
        "maintenance": 0,
    }.get(goal, 0)

def goal_summary(goal: str) -> str:
    return {
        "weight_loss": "Cut calories sustainably to lean down",
        "muscle_gain": "High-protein surplus to build lean muscle",
        "weight_gain": "Calorie surplus for healthy weight gain",
        "maintenance": "Balanced intake to maintain current weight",
    }.get(goal, "Custom nutrition goal")

# ============================================================
# Auth Endpoints — Supabase Auth
# ============================================================
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    try:
        response = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {
                "data": {
                    "name": body.name or body.email.split("@")[0],
                }
            }
        })
        if not response.user:
            raise HTTPException(400, "Registration failed")

        user_data = response.user
        # Create entry in our users table
        new_user = {
            "id": user_data.id,
            "email": body.email.lower(),
            "name": body.name or body.email.split("@")[0],
            "onboarded": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("users").insert(new_user).execute()

        return {
            "token": user_data.id,  # Supabase manages tokens on frontend side
            "user": new_user
        }
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            raise HTTPException(400, "Email already registered")
        logger.error(f"Registration error: {e}")
        raise HTTPException(400, f"Registration failed: {error_msg[:200]}")

@api_router.post("/auth/login")
async def login(body: LoginIn):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        if not response.user or not response.session:
            raise HTTPException(401, "Invalid email or password")

        # Get user profile from our table
        result = supabase.table("users").select("*").eq("id", response.user.id).execute()
        user_data = result.data[0] if result.data else {
            "id": response.user.id,
            "email": body.email.lower(),
            "name": response.user.user_metadata.get("name", body.email.split("@")[0]),
            "onboarded": False,
        }

        return {
            "token": response.session.access_token,
            "user": fmt_user(user_data)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(401, "Invalid email or password")

@api_router.post("/auth/google")
async def google_auth(body: GoogleAuthIn):
    """Lightweight Google auth — accepts email/name token from client.
    In production, use Supabase OAuth flow instead."""
    try:
        # Check if user exists in our table
        result = supabase.table("users").select("*").eq("email", body.email.lower()).execute()

        if result.data and len(result.data) > 0:
            user_data = result.data[0]
        else:
            # Create new user (no password — Google-authenticated users sign in via Supabase OAuth)
            import hashlib
            fake_password = hashlib.sha256(f"{body.email}_{uuid.uuid4()}".encode()).hexdigest()[:20]
            auth_response = supabase.auth.sign_up({
                "email": body.email,
                "password": fake_password,
                "options": {"data": {"name": body.name or body.email.split("@")[0]}}
            })

            new_user = {
                "id": auth_response.user.id,
                "email": body.email.lower(),
                "name": body.name or body.email.split("@")[0],
                "avatar_url": body.picture or "",
                "onboarded": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("users").insert(new_user).execute()
            user_data = new_user

        # For actual Google OAuth, frontend should use supabase.auth.signInWithOAuth({provider: 'google'})
        # This endpoint provides a lightweight fallback
        return {
            "token": user_data.get("id", ""),
            "user": fmt_user(user_data)
        }
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(400, f"Google auth failed: {str(e)[:200]}")

@api_router.get("/auth/me")
async def me(user=Depends(current_user)):
    return fmt_user(user)

# ============================================================
# Profile / Onboarding
# ============================================================
@api_router.post("/profile/onboarding")
async def onboarding(body: OnboardingIn, user=Depends(current_user)):
    bmr = calc_bmr(body.age, body.height, body.weight, body.gender)
    maintenance = bmr * 1.4
    target = round(maintenance + goal_adjustment(body.goal))

    update_data = {
        "age": body.age,
        "height": body.height,
        "weight": body.weight,
        "gender": body.gender,
        "goal": body.goal,
        "diet_type": body.dietType,
        "allergies": body.allergies,
        "bmr": round(bmr),
        "calorie_estimate": target,
        "goal_summary": goal_summary(body.goal),
        "onboarded": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("users").update(update_data).eq("id", user["id"]).execute()
    result = supabase.table("users").select("*").eq("id", user["id"]).execute()
    return result.data[0] if result.data else update_data

@api_router.put("/profile")
async def update_profile(body: ProfileUpdate, user=Depends(current_user)):
    patch = {k: v for k, v in body.dict().items() if v is not None}

    # Map camelCase frontend fields to snake_case DB columns
    field_map = {
        "dietType": "diet_type",
        "goalSummary": "goal_summary",
        "calorieEstimate": "calorie_estimate",
    }
    mapped_patch = {}
    for k, v in patch.items():
        db_key = field_map.get(k, k)
        mapped_patch[db_key] = v

    # Recompute BMR if relevant fields changed
    merged = {**user, **mapped_patch}
    if all(k in merged for k in ("age", "height", "weight", "gender", "goal")):
        bmr = calc_bmr(merged["age"], merged["height"], merged["weight"], merged["gender"])
        mapped_patch["bmr"] = round(bmr)
        mapped_patch["calorie_estimate"] = round(bmr * 1.4 + goal_adjustment(merged["goal"]))
        mapped_patch["goal_summary"] = goal_summary(merged["goal"])

    mapped_patch["updated_at"] = datetime.now(timezone.utc).isoformat()

    supabase.table("users").update(mapped_patch).eq("id", user["id"]).execute()
    result = supabase.table("users").select("*").eq("id", user["id"]).execute()
    return result.data[0] if result.data else mapped_patch

# ============================================================
# Mercury-2 helpers (unchanged)
# ============================================================
async def mercury_chat(messages: list, max_tokens: int = 1200, temperature: float = 0.7) -> str:
    try:
        resp = await mercury_client.chat.completions.create(
            model=MERCURY_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"Mercury error: {e}")
        raise HTTPException(502, f"AI service error: {str(e)[:200]}")

def extract_json(text: str) -> dict:
    """Extract first JSON object from a model response."""
    # Try fenced code block first
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # Fallback: first {...}
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {}

# ============================================================
# Meal Plan
# ============================================================
@api_router.post("/meal-plan/generate")
async def generate_meal_plan(body: MealPlanGenIn, user=Depends(current_user)):
    if not user.get("onboarded"):
        raise HTTPException(400, "Complete onboarding first")

    sys = (
        "You are an elite nutrition coach. Generate a single-day meal plan as STRICT JSON "
        "with exactly these keys: breakfast, lunch, dinner, snack. Each value must be an object "
        '{"name": string, "reason": string, "calories": number, "protein": number, "carbs": number, "fat": number}. '
        "Macros are in grams (protein, carbs, fat) and kcal for calories — realistic per-meal values. "
        "The reason must be 1 short sentence tailored to the user. "
        "If a location is given, choose dishes that are popular and authentic to that region/cuisine. "
        "Output ONLY JSON, no prose, no markdown fences."
    )
    profile = (
        f"Goal: {user.get('goal')}, Calorie target: {user.get('calorie_estimate')} kcal, "
        f"Diet: {user.get('diet_type')}, Allergies: {', '.join(user.get('allergies') or []) or 'none'}, "
        f"Age: {user.get('age')}, Weight: {user.get('weight')}kg."
    )
    location_str = (body.location or user.get("location") or "").strip()
    user_prompt = (
        f"User profile -> {profile}\n"
        f"Location/Region: {location_str or 'unspecified — use globally common healthy options'}\n"
        f"Notes: {body.notes or 'none'}\nReturn the JSON now."
    )
    raw = await mercury_chat(
        [{"role": "system", "content": sys}, {"role": "user", "content": user_prompt}],
        max_tokens=900,
    )
    plan = extract_json(raw)
    required = ["breakfast", "lunch", "dinner", "snack"]
    if not all(k in plan and isinstance(plan[k], dict) for k in required):
        plan = {k: {"name": "Balanced bowl", "reason": "Tailored fallback option",
                    "calories": 450, "protein": 25, "carbs": 50, "fat": 15} for k in required}

    for k in required:
        m = plan[k]
        m.setdefault("calories", 450)
        m.setdefault("protein", 25)
        m.setdefault("carbs", 50)
        m.setdefault("fat", 15)

    doc = {
        "uid": user["id"],
        "date": datetime.now(timezone.utc).date().isoformat(),
        "location": location_str or None,
        "breakfast": json.dumps(plan["breakfast"]),
        "lunch": json.dumps(plan["lunch"]),
        "dinner": json.dumps(plan["dinner"]),
        "snack": json.dumps(plan["snack"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    result = supabase.table("meal_plans").insert(doc).execute()
    created = result.data[0] if result.data else doc

    # Parse JSON strings back to objects for response
    for meal in ["breakfast", "lunch", "dinner", "snack"]:
        if isinstance(created.get(meal), str):
            created[meal] = json.loads(created[meal])

    # Update user location if provided
    if location_str and location_str != user.get("location"):
        supabase.table("users").update({"location": location_str}).eq("id", user["id"]).execute()

    return created

@api_router.get("/meal-plan/latest")
async def latest_meal_plan(user=Depends(current_user)):
    result = supabase.table("meal_plans") \
        .select("*") \
        .eq("uid", user["id"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if result.data and len(result.data) > 0:
        plan = result.data[0]
        # Parse JSON strings to objects
        for meal in ["breakfast", "lunch", "dinner", "snack"]:
            if isinstance(plan.get(meal), str):
                plan[meal] = json.loads(plan[meal])
        return plan
    return {}

@api_router.post("/meals/estimate-macros")
async def estimate_macros(body: MealEstimateIn, user=Depends(current_user)):
    """Estimate macros for a custom user-typed meal name."""
    sys = (
        "You are a nutrition database. Given a meal name (and optional notes/portion), "
        "return STRICT JSON only on a single line: "
        '{"calories": number, "protein": number, "carbs": number, "fat": number, "portion": string}. '
        "Macros in grams; calories in kcal. Use a typical 1-serving estimate unless portion is specified. "
        "Output ONLY the JSON, nothing else."
    )
    user_msg = f"Meal: {body.name}\nNotes/Portion: {body.notes or 'standard 1 serving'}"

    async def _try():
        return await mercury_chat(
            [{"role": "system", "content": sys}, {"role": "user", "content": user_msg}],
            max_tokens=400,
            temperature=0.3,
        )

    raw = await _try()
    data = extract_json(raw or "")
    if not data or "calories" not in data:
        logger.warning(f"estimate-macros: empty/invalid parse, retrying. raw={raw[:200]!r}")
        raw = await _try()
        data = extract_json(raw or "")

    if not data or "calories" not in data:
        logger.error(f"estimate-macros: still empty after retry. raw={raw[:200]!r}")
        return {
            "name": body.name,
            "calories": 400.0,
            "protein": 20.0,
            "carbs": 45.0,
            "fat": 15.0,
            "portion": "1 serving (estimated)",
            "estimated": False,
        }

    return {
        "name": body.name,
        "calories": float(data.get("calories", 400)),
        "protein": float(data.get("protein", 20)),
        "carbs": float(data.get("carbs", 45)),
        "fat": float(data.get("fat", 15)),
        "portion": str(data.get("portion", "1 serving")),
        "estimated": True,
    }

# ============================================================
# Food Scan
# ============================================================
@api_router.post("/scan/analyze")
async def scan_analyze(body: ScanIn, user=Depends(current_user)):
    """Analyze ingredients via Mercury (text) or Gemini multimodal (image)."""
    ingredients_text = body.ingredients_text or ""

    # If image provided, use Gemini multimodal via emergentintegrations to extract ingredients
    if body.image_base64 and not ingredients_text:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            img_b64 = body.image_base64
            if img_b64.startswith("data:"):
                img_b64 = img_b64.split(",", 1)[1]
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"scan-{uuid.uuid4()}",
                system_message="You read food product labels and ingredients lists from images. Output ONLY a comma-separated list of ingredients you can read. No prose.",
            ).with_model("gemini", "gemini-2.5-flash")
            msg = UserMessage(
                text="Extract the full ingredients list visible in this image. Return only ingredients separated by commas.",
                file_contents=[ImageContent(image_base64=img_b64)],
            )
            ingredients_text = await chat.send_message(msg)
        except Exception as e:
            logger.error(f"Gemini scan error: {e}")
            raise HTTPException(502, "Could not read image. Try manual input.")

    if not ingredients_text.strip():
        raise HTTPException(400, "Provide either an image or ingredients text")

    sys = (
        "You are a food-ingredient expert. Analyze the ingredients and return STRICT JSON only:\n"
        '{"verdict": "good"|"limit"|"avoid", "summary": string, '
        '"ingredients": [{"name": string, "category": "good"|"limit"|"avoid", "note": string}]}\n'
        "Decode preservatives/E-numbers in the note (e.g., E211 = Sodium Benzoate). "
        "Be concise. Output ONLY JSON."
    )
    user_ctx = (
        f"User allergies: {', '.join(user.get('allergies') or []) or 'none'}. "
        f"Diet: {user.get('diet_type') or 'none'}. "
    )
    raw = await mercury_chat(
        [{"role": "system", "content": sys}, {"role": "user", "content": f"{user_ctx}\nIngredients: {ingredients_text}"}],
        max_tokens=900,
    )
    data = extract_json(raw)
    if "ingredients" not in data:
        data = {
            "verdict": "limit",
            "summary": "Could not fully parse ingredients.",
            "ingredients": [{"name": ingredients_text[:80], "category": "limit", "note": "Manual review needed"}],
        }
    data["raw_text"] = ingredients_text
    return data

# ============================================================
# AI Chat
# ============================================================
@api_router.post("/chat/send")
async def chat_send(body: ChatMessageIn, authorization: Optional[str] = Header(None)):
    user = None

    # Try to authenticate if not pre-auth
    if authorization and not body.pre_auth:
        try:
            token = authorization.replace("Bearer ", "")
            auth_user = await verify_supabase_token(token)
            result = supabase.table("users").select("*").eq("id", auth_user["id"]).execute()
            if result.data:
                user = result.data[0]
        except Exception:
            user = None

    # Persist user message
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("chat_messages").insert({
        "session_id": body.session_id,
        "uid": user["id"] if user else None,
        "role": "user",
        "content": body.message,
        "created_at": now,
    }).execute()

    # Pull last 20 messages for context
    history_result = supabase.table("chat_messages") \
        .select("role, content") \
        .eq("session_id", body.session_id) \
        .order("created_at", desc=False) \
        .limit(40) \
        .execute()

    history = history_result.data if history_result.data else []

    sys = (
        "You are Ignite, a sharp, friendly nutrition coach. Answer concisely with practical advice. "
        "Use markdown when helpful (bold, bullet lists). Never give medical diagnoses."
    )
    if user and user.get("onboarded"):
        sys += (
            f" Personalize for: goal={user.get('goal')}, calories={user.get('calorie_estimate')}, "
            f"diet={user.get('diet_type')}, allergies={', '.join(user.get('allergies') or []) or 'none'}."
        )

    messages = [{"role": "system", "content": sys}] + [
        {"role": h["role"], "content": h["content"]} for h in history
    ]
    reply = await mercury_chat(messages, max_tokens=700, temperature=0.6)

    supabase.table("chat_messages").insert({
        "session_id": body.session_id,
        "uid": user["id"] if user else None,
        "role": "assistant",
        "content": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    return {"reply": reply}

@api_router.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    result = supabase.table("chat_messages") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("created_at", desc=True) \
        .limit(200) \
        .execute()
    return result.data if result.data else []

# ============================================================
# Recipes
# ============================================================
@api_router.post("/recipes")
async def create_recipe(body: RecipeIn, user=Depends(current_user)):
    sys = (
        "You categorize user-submitted recipes. Return STRICT JSON only: "
        '{"category": string (one of: breakfast|lunch|dinner|snack|dessert|drink), '
        '"tags": [string up to 5], "healthNote": string (one short sentence)}.'
    )
    raw = await mercury_chat(
        [{"role": "system", "content": sys}, {"role": "user", "content": f"Title: {body.title}\nIngredients: {body.ingredients}\nDescription: {body.description}"}],
        max_tokens=300,
    )
    meta = extract_json(raw) or {}
    doc = {
        "uid": user["id"],
        "author_name": user.get("name") or "Chef",
        "title": body.title,
        "ingredients": body.ingredients,
        "description": body.description,
        "category": meta.get("category", "snack"),
        "tags": json.dumps(meta.get("tags", [])[:5]) if isinstance(meta.get("tags"), list) else json.dumps([]),
        "health_note": meta.get("healthNote", "Tasty community recipe."),
        "likes": 0,
        "liked_by": json.dumps([]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = supabase.table("recipes").insert(doc).execute()
    created = result.data[0] if result.data else doc
    # Parse JSON fields
    if isinstance(created.get("tags"), str):
        created["tags"] = json.loads(created["tags"])
    if isinstance(created.get("liked_by"), str):
        created["liked_by"] = json.loads(created["liked_by"])
    return created

@api_router.get("/recipes")
async def list_recipes():
    result = supabase.table("recipes") \
        .select("*") \
        .order("created_at", desc=True) \
        .limit(50) \
        .execute()

    items = result.data if result.data else []
    for item in items:
        if isinstance(item.get("tags"), str):
            item["tags"] = json.loads(item["tags"])
        if isinstance(item.get("liked_by"), str):
            item["liked_by"] = json.loads(item["liked_by"])
    return items

@api_router.post("/recipes/{rid}/like")
async def like_recipe(rid: str, user=Depends(current_user)):
    result = supabase.table("recipes").select("*").eq("id", rid).execute()
    if not result.data or len(result.data) == 0:
        raise HTTPException(404, "Recipe not found")

    r = result.data[0]
    liked_by = r.get("liked_by", [])
    if isinstance(liked_by, str):
        liked_by = json.loads(liked_by)

    already_liked = user["id"] in liked_by
    if already_liked:
        liked_by.remove(user["id"])
        new_likes = (r.get("likes") or 0) - 1
    else:
        liked_by = liked_by + [user["id"]]
        new_likes = (r.get("likes") or 0) + 1

    supabase.table("recipes").update({
        "likes": max(new_likes, 0),
        "liked_by": json.dumps(liked_by),
    }).eq("id", rid).execute()

    fresh = supabase.table("recipes").select("*").eq("id", rid).execute()
    updated = fresh.data[0] if fresh.data else r
    if isinstance(updated.get("tags"), str):
        updated["tags"] = json.loads(updated["tags"])
    if isinstance(updated.get("liked_by"), str):
        updated["liked_by"] = json.loads(updated["liked_by"])
    return updated

# ============================================================
# Progress
# ============================================================
@api_router.post("/progress")
async def add_progress(body: ProgressIn, user=Depends(current_user)):
    doc = {
        "uid": user["id"],
        "title": body.title,
        "type": body.type,
        "meal_type": body.mealType,
        "recipe_id": body.recipeId,
        "calories": body.calories,
        "protein": body.protein,
        "carbs": body.carbs,
        "fat": body.fat,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).date().isoformat(),
    }
    result = supabase.table("progress").insert(doc).execute()
    return result.data[0] if result.data else doc

@api_router.get("/progress")
async def list_progress(user=Depends(current_user)):
    result = supabase.table("progress") \
        .select("*") \
        .eq("uid", user["id"]) \
        .order("timestamp", desc=True) \
        .limit(50) \
        .execute()
    return result.data if result.data else []

@api_router.delete("/progress/{pid}")
async def delete_progress(pid: str, user=Depends(current_user)):
    supabase.table("progress").delete().eq("id", pid).eq("uid", user["id"]).execute()
    return {"ok": True}

# ============================================================
# Health
# ============================================================
@api_router.get("/")
async def root():
    return {"app": "Ignite Nutrition", "status": "live"}

# ---------- Wire ----------
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)