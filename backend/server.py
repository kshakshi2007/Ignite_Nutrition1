"""Ignite Nutrition - FastAPI Backend
AI-powered nutrition tracking with Mercury-2 (Inception Labs) for chat/meal-plans/recipes
and Gemini multimodal for food image scanning.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import uuid
import bcrypt
import jwt as pyjwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
from openai import AsyncOpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
INCEPTION_API_KEY = os.environ["INCEPTION_API_KEY"]
INCEPTION_BASE_URL = os.environ.get("INCEPTION_BASE_URL", "https://api.inceptionlabs.ai/v1")
MERCURY_MODEL = os.environ.get("MERCURY_MODEL", "mercury")

# ---------- DB ----------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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

# ============================================================
# Helpers
# ============================================================
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_token(uid: str) -> str:
    payload = {"uid": uid, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(401, "Missing authorization")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        uid = payload["uid"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"uid": uid}, {"_id": 0, "passwordHash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

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

def serialize_user(u: dict) -> dict:
    u = {k: v for k, v in u.items() if k not in ("_id", "passwordHash")}
    return u

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
# Auth
# ============================================================
@api_router.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    user_doc = {
        "uid": uid,
        "email": body.email.lower(),
        "name": body.name or body.email.split("@")[0],
        "passwordHash": hash_pw(body.password),
        "provider": "email",
        "onboarded": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return {"token": make_token(uid), "user": serialize_user(user_doc)}

@api_router.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not u.get("passwordHash") or not verify_pw(body.password, u["passwordHash"]):
        raise HTTPException(401, "Invalid email or password")
    return {"token": make_token(u["uid"]), "user": serialize_user(u)}

@api_router.post("/auth/google", response_model=TokenOut)
async def google_auth(body: GoogleAuthIn):
    """Lightweight Google auth — accepts email/name from client (e.g., from Emergent Google Auth flow).
    Creates account if missing."""
    u = await db.users.find_one({"email": body.email.lower()})
    if not u:
        uid = str(uuid.uuid4())
        u = {
            "uid": uid,
            "email": body.email.lower(),
            "name": body.name or body.email.split("@")[0],
            "picture": body.picture,
            "provider": "google",
            "onboarded": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(dict(u))
    return {"token": make_token(u["uid"]), "user": serialize_user(u)}

@api_router.get("/auth/me")
async def me(user=Depends(current_user)):
    return user

# ============================================================
# Profile / Onboarding
# ============================================================
@api_router.post("/profile/onboarding")
async def onboarding(body: OnboardingIn, user=Depends(current_user)):
    bmr = calc_bmr(body.age, body.height, body.weight, body.gender)
    # Apply mild activity factor (1.4) for base maintenance
    maintenance = bmr * 1.4
    target = round(maintenance + goal_adjustment(body.goal))
    update = {
        **body.dict(),
        "bmr": round(bmr),
        "calorieEstimate": target,
        "goalSummary": goal_summary(body.goal),
        "onboarded": True,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({"uid": user["uid"]}, {"$set": update})
    fresh = await db.users.find_one({"uid": user["uid"]}, {"_id": 0, "passwordHash": 0})
    return fresh

@api_router.put("/profile")
async def update_profile(body: ProfileUpdate, user=Depends(current_user)):
    patch = {k: v for k, v in body.dict().items() if v is not None}
    # Recompute BMR if relevant fields changed
    merged = {**user, **patch}
    if all(k in merged for k in ("age", "height", "weight", "gender", "goal")):
        bmr = calc_bmr(merged["age"], merged["height"], merged["weight"], merged["gender"])
        patch["bmr"] = round(bmr)
        patch["calorieEstimate"] = round(bmr * 1.4 + goal_adjustment(merged["goal"]))
        patch["goalSummary"] = goal_summary(merged["goal"])
    patch["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"uid": user["uid"]}, {"$set": patch})
    return await db.users.find_one({"uid": user["uid"]}, {"_id": 0, "passwordHash": 0})

# ============================================================
# Mercury-2 helpers
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
        '{"name": string, "reason": string}. The reason must be 1 short sentence tailored to the user.'
        " Output ONLY JSON, no prose, no markdown fences."
    )
    profile = (
        f"Goal: {user.get('goal')}, Calorie target: {user.get('calorieEstimate')} kcal, "
        f"Diet: {user.get('dietType')}, Allergies: {', '.join(user.get('allergies') or []) or 'none'}, "
        f"Age: {user.get('age')}, Weight: {user.get('weight')}kg."
    )
    user_prompt = f"User profile -> {profile}\nNotes: {body.notes or 'none'}\nReturn the JSON now."
    raw = await mercury_chat(
        [{"role": "system", "content": sys}, {"role": "user", "content": user_prompt}],
        max_tokens=700,
    )
    plan = extract_json(raw)
    required = ["breakfast", "lunch", "dinner", "snack"]
    if not all(k in plan and isinstance(plan[k], dict) for k in required):
        # Fallback structure
        plan = {k: {"name": "Balanced bowl", "reason": "Tailored fallback option"} for k in required}
    doc = {
        "id": str(uuid.uuid4()),
        "uid": user["uid"],
        "date": datetime.now(timezone.utc).date().isoformat(),
        **{k: plan[k] for k in required},
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.mealPlans.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.get("/meal-plan/latest")
async def latest_meal_plan(user=Depends(current_user)):
    plan = await db.mealPlans.find_one(
        {"uid": user["uid"]}, {"_id": 0}, sort=[("createdAt", -1)]
    )
    return plan or {}

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
        f"Diet: {user.get('dietType') or 'none'}. "
    )
    raw = await mercury_chat(
        [
            {"role": "system", "content": sys},
            {"role": "user", "content": f"{user_ctx}\nIngredients: {ingredients_text}"},
        ],
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
async def chat_send(body: ChatMessageIn, creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    user = None
    if creds and not body.pre_auth:
        try:
            payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
            user = await db.users.find_one({"uid": payload["uid"]}, {"_id": 0, "passwordHash": 0})
        except Exception:
            user = None

    # Persist user message
    now = datetime.now(timezone.utc).isoformat()
    await db.chatMessages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": body.session_id,
        "uid": user["uid"] if user else None,
        "role": "user",
        "content": body.message,
        "createdAt": now,
    })

    # Pull last 20 messages for context
    history_cur = db.chatMessages.find(
        {"session_id": body.session_id}, {"_id": 0, "role": 1, "content": 1}
    ).sort("createdAt", 1).limit(40)
    history = await history_cur.to_list(40)

    sys = (
        "You are Ignite, a sharp, friendly nutrition coach. Answer concisely with practical advice. "
        "Use markdown when helpful (bold, bullet lists). Never give medical diagnoses."
    )
    if user and user.get("onboarded"):
        sys += (
            f" Personalize for: goal={user.get('goal')}, calories={user.get('calorieEstimate')}, "
            f"diet={user.get('dietType')}, allergies={', '.join(user.get('allergies') or []) or 'none'}."
        )

    messages = [{"role": "system", "content": sys}] + [
        {"role": h["role"], "content": h["content"]} for h in history
    ]
    reply = await mercury_chat(messages, max_tokens=700, temperature=0.6)

    await db.chatMessages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": body.session_id,
        "uid": user["uid"] if user else None,
        "role": "assistant",
        "content": reply,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    return {"reply": reply}

@api_router.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    msgs = await db.chatMessages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("createdAt", 1).to_list(200)
    return msgs

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
        [
            {"role": "system", "content": sys},
            {"role": "user", "content": f"Title: {body.title}\nIngredients: {body.ingredients}\nDescription: {body.description}"},
        ],
        max_tokens=300,
    )
    meta = extract_json(raw) or {}
    doc = {
        "id": str(uuid.uuid4()),
        "uid": user["uid"],
        "authorName": user.get("name") or "Chef",
        "title": body.title,
        "ingredients": body.ingredients,
        "description": body.description,
        "category": meta.get("category", "snack"),
        "tags": meta.get("tags", [])[:5] if isinstance(meta.get("tags"), list) else [],
        "healthNote": meta.get("healthNote", "Tasty community recipe."),
        "likes": 0,
        "likedBy": [],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.recipes.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.get("/recipes")
async def list_recipes():
    items = await db.recipes.find({}, {"_id": 0}).sort("createdAt", -1).limit(50).to_list(50)
    return items

@api_router.post("/recipes/{rid}/like")
async def like_recipe(rid: str, user=Depends(current_user)):
    r = await db.recipes.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Recipe not found")
    liked = user["uid"] in (r.get("likedBy") or [])
    op = {"$pull": {"likedBy": user["uid"]}, "$inc": {"likes": -1}} if liked else \
         {"$addToSet": {"likedBy": user["uid"]}, "$inc": {"likes": 1}}
    await db.recipes.update_one({"id": rid}, op)
    fresh = await db.recipes.find_one({"id": rid}, {"_id": 0})
    return fresh

# ============================================================
# Progress
# ============================================================
@api_router.post("/progress")
async def add_progress(body: ProgressIn, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "uid": user["uid"],
        "title": body.title,
        "type": body.type,
        "mealType": body.mealType,
        "recipeId": body.recipeId,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).date().isoformat(),
    }
    await db.progress.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.get("/progress")
async def list_progress(user=Depends(current_user)):
    items = await db.progress.find(
        {"uid": user["uid"]}, {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    return items

@api_router.delete("/progress/{pid}")
async def delete_progress(pid: str, user=Depends(current_user)):
    await db.progress.delete_one({"id": pid, "uid": user["uid"]})
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

@app.on_event("shutdown")
async def shutdown():
    client.close()
