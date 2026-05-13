# Ignite Nutrition — Project Overview

> **Ignite Nutrition** is a futuristic, AI-powered nutrition tracking mobile application. It combines a cyberpunk neon aesthetic with intelligent AI coaching to help users manage their diet, scan food labels, generate meal plans, track progress, and discover community recipes.

---

## Table of Contents

1. [Vision & Purpose](#1-vision--purpose)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Design System](#6-design-system)
7. [Data Flow](#7-data-flow)
8. [Key Dependencies](#8-key-dependencies)
9. [Development Setup](#9-development-setup)

---

## 1. Vision & Purpose

A fully AI-native nutrition companion that goes beyond calorie counting. The app provides:

- **AI-generated meal plans** tailored to user goals, diet, allergies, and even geographic location (local cuisine)
- **Food label scanning** via camera (Gemini OCR) or manual ingredient text — with verdicts (Good/Limit/Avoid)
- **AI nutrition coach chat** with personalized context-aware responses (Mercury-2)
- **Community recipe feed** with AI-tagged categorization and like/unlike social features
- **Progress tracking** for meals and recipes with historical data
- **BMR-based calorie targeting** using Mifflin-St Jeor formula with goal adjustments

---

## 2. Tech Stack

| Layer          | Technology                                                                                     |
|----------------|------------------------------------------------------------------------------------------------|
| **Frontend**   | Expo SDK 54 + Expo Router 6 + React Native 0.81.5 + TypeScript 5.9                            |
| **Backend**    | FastAPI (Python) + Motor (async MongoDB driver)                                                |
| **Database**   | MongoDB — collections: `users`, `mealPlans`, `recipes`, `progress`, `chatMessages`             |
| **AI Models**  | Mercury-2 (Inception Labs, OpenAI-compatible) — chat, meal plans, recipe tags, macro estimation |
|                | Gemini 2.5 Flash (via `emergentintegrations`) — food-label image OCR                          |
| **Auth**       | Email/password (bcrypt + JWT) + lightweight Google sign-in                                     |
| **UI/UX**      | Dark mode + cyberpunk neon + glassmorphism + particle animations + reanimated motions          |

---

## 3. Project Structure

```
Ignite_Nutrition1/
├── .gitconfig                  # Git config for AI agent (emergent-agent-e1)
├── .gitignore
├── backend_test.py             # Backend test script
├── design_guidelines.json      # Complete design spec (colors, typography, components)
├── README.md                   # Placeholder
├── test_estimate_macros.py     # Macro estimation test
├── test_result.md              # Test results
│
├── backend/
│   ├── requirements.txt        # Python dependencies (FastAPI, Motor, openai, etc.)
│   ├── server.py               # Main FastAPI application — ALL endpoints in one file
│   ├── .env                    # (not committed) Environment variables
│   └── tests/                  # Backend test directory
│
├── frontend/
│   ├── app.json                # Expo app configuration
│   ├── package.json            # JS dependencies + yarn@1.22.22
│   ├── tsconfig.json           # TypeScript config
│   ├── metro.config.js         # Metro bundler config
│   ├── eslint.config.js        # ESLint config
│   ├── README.md               # Expo default README
│   │
│   ├── app/                    # Expo Router pages
│   │   ├── _layout.tsx         # Root layout — fonts, gesture handler, auth provider, stack nav
│   │   ├── +html.tsx           # HTML template (web)
│   │   ├── index.tsx           # LANDING screen — particles, hero, auth sheet, demo chat
│   │   ├── onboarding.tsx      # 5-step onboarding wizard (age/height/weight/gender/goal/diet)
│   │   ├── profile.tsx         # Profile editing (modal presentation)
│   │   └── (tabs)/             # Main app with 6 bottom tabs
│   │       └── _layout.tsx     # Tab navigator — floating bento-style glass tab bar
│   │       ├── dashboard.tsx   # CORE — greeting, calorie ring, 2×2 action cards
│   │       ├── meal-plan.tsx   # FUEL — timeline of AI-generated meals
│   │       ├── scan.tsx        # SCAN — camera + ingredient analysis results
│   │       ├── chat.tsx        # AI — chat with nutrition coach
│   │       ├── feed.tsx        # FEED — community recipe browsing
│   │       └── progress.tsx    # PROGRESS — vertical timeline of logged items
│   │
│   ├── assets/
│   │   ├── fonts/              # Local font files (if any)
│   │   └── images/             # App images
│   │
│   ├── scripts/
│   │   └── reset-project.js    # Reset script
│   │
│   └── src/
│       ├── api.ts              # Centralized API client — all backend calls
│       ├── auth.tsx            # Auth context provider — signIn, signUp, signOut, Google
│       ├── GlassCard.tsx       # Reusable glassmorphic card component
│       ├── ParticleField.tsx   # Animated floating particles + ambient glow background
│       ├── Screen.tsx          # Screen wrapper with safe area edges
│       └── theme.ts            # Theme tokens derived from design_guidelines.json
│
├── memory/
│   ├── .gitkeep
│   └── PRD.md                 # Product Requirements Document
│
├── test_reports/
│   ├── .gitkeep
│   ├── iteration_1.json
│   ├── iteration_2.json
│   ├── iteration_3.json
│   └── pytest/
│
└── tests/
    └── __init__.py
```

---

## 4. Frontend Architecture

### 4.1 Navigation (Expo Router)

The app uses a **Stack navigator** with the following routes:

| Route          | Screen         | Notes                          |
|----------------|----------------|--------------------------------|
| `index`        | Landing        | Particle field, auth sheet, demo AI chat |
| `onboarding`   | Onboarding     | 5-step wizard (redirect after auth) |
| `(tabs)`       | Main Tabs      | 6-tab bottom navigator         |
| `profile`      | Profile        | Modal presentation             |

### 4.2 Bottom Tab Navigator (6 tabs)

| Tab       | Icon          | Description                        |
|-----------|---------------|------------------------------------|
| CORE      | Home          | Dashboard with stats & quick actions |
| FUEL      | Utensils      | AI-generated daily meal plan       |
| SCAN      | ScanLine      | Camera + ingredient analysis       |
| AI        | Sparkles      | Chat with Ignite nutrition coach   |
| FEED      | Users         | Community recipe feed with likes   |
| PROGRESS  | TrendingUp    | Logged meal/recipe timeline        |

- Floating glassmorphic tab bar with `BlurView` background
- Active icon highlighted with Cyan (`#00FFFF`) glow

### 4.3 Auth Flow

- **Provider:** `AuthProvider` (React Context) wraps the entire app in `_layout.tsx`
- **Token:** JWT stored in AsyncStorage under `ignite_token` key
- **Auto-redirect:** If user is logged in and `loading` is false, redirects to onboarding (if not onboarded) or dashboard (if onboarded)
- **Methods:** `signIn` (email/pw), `signUp` (email/pw/name), `signInGoogle` (email/name), `signOut`, `refresh`

### 4.4 API Layer (`api.ts`)

Centralized request function with:
- Automatic `Bearer` token injection from AsyncStorage
- JSON content-type header
- Error parsing (handles both `detail` and `message` fields)
- Exported `tokenStore` object for direct token management

### 4.5 Key Screens

- **Landing:** Animated particle background with floating glow orbs; hero section with flame badge + "IGNITE NUTRITION" branding; primary CTA → auth sheet; ghost CTA → demo AI chat (pre-auth)
- **Onboarding:** Age/height/weight → Gender → Goal → Diet type → Allergies; computes BMR via Mifflin-St Jeor × 1.4 + goal adjustment
- **Dashboard:** Calorie ring with glow sweep; 4 quick-action cards (2×2 grid); greeting + core stats
- **Profile:** Edits all fields; triggers BMR recalculation on save

---

## 5. Backend Architecture

### 5.1 Structure

Single-file FastAPI application (`backend/server.py`) with an `/api` prefix router.

### 5.2 Complete API Endpoints

| Method | Path                          | Auth | Description                                  |
|--------|-------------------------------|------|----------------------------------------------|
| POST   | `/api/auth/register`          | No   | Register with email/password                 |
| POST   | `/api/auth/login`             | No   | Login with email/password                    |
| POST   | `/api/auth/google`            | No   | Lightweight Google auth (email/name/picture) |
| GET    | `/api/auth/me`                | Yes  | Get current user profile                     |
| POST   | `/api/profile/onboarding`     | Yes  | Save onboarding data, compute BMR & calories |
| PUT    | `/api/profile`                | Yes  | Update profile fields, recalculate BMR       |
| POST   | `/api/meal-plan/generate`     | Yes  | Generate AI meal plan (location-aware)       |
| GET    | `/api/meal-plan/latest`       | Yes  | Get latest meal plan                         |
| POST   | `/api/meals/estimate-macros`  | Yes  | Estimate macros for a user-typed meal name   |
| POST   | `/api/scan/analyze`           | Yes  | Analyze food image (OCR) or ingredient text  |
| POST   | `/api/chat/send`              | Opt  | Send message to AI coach (supports pre-auth) |
| GET    | `/api/chat/history/{session}` | No   | Get chat history for a session               |
| POST   | `/api/recipes`                | Yes  | Create recipe with AI-generated tags         |
| GET    | `/api/recipes`                | No   | List recipes (latest 50)                     |
| POST   | `/api/recipes/{id}/like`      | Yes  | Toggle like/unlike on a recipe               |
| POST   | `/api/progress`               | Yes  | Log meal or recipe progress                  |
| GET    | `/api/progress`               | Yes  | List user's progress (latest 50)             |
| DELETE | `/api/progress/{id}`          | Yes  | Delete a progress entry                      |
| GET    | `/api/`                       | No   | Health check — returns status                |

### 5.3 AI Integration

#### Mercury-2 (Inception Labs)
- **Model:** `mercury` (configurable via `MERCURY_MODEL` env var)
- **Base URL:** `https://api.inceptionlabs.ai/v1` (configurable)
- **Uses:** Meal plan generation, recipe categorization/tagging, chat coaching, macro estimation, ingredient analysis
- **Client:** OpenAI-compatible `AsyncOpenAI` SDK

#### Gemini 2.5 Flash
- **Uses:** Food label OCR — extracts ingredients from images
- **Integration:** Via `emergentintegrations` library with Gemini model
- **Key:** `EMERGENT_LLM_KEY` environment variable

### 5.4 Calorie Formula

```
BMR (Mifflin-St Jeor):
  Male:   10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
  Female: 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161
  Other:  10 × weight(kg) + 6.25 × height(cm) - 5 × age - 78

Calorie Target = BMR × 1.4 (light activity factor) + Goal Adjustment

Goal Adjustments:
  weight_loss:    -500 kcal
  muscle_gain:    +300 kcal
  weight_gain:    +500 kcal
  maintenance:       0 kcal
```

### 5.5 Database (MongoDB Collections)

| Collection      | Key Fields                                                               |
|-----------------|--------------------------------------------------------------------------|
| `users`         | uid, email, name, passwordHash, provider, onboarded, bmr, calorieEstimate, goal, dietType, allergies, age, height, weight, gender, location, createdAt |
| `mealPlans`     | id, uid, date, location, breakfast/lunch/dinner/snack (each: name, reason, calories, protein, carbs, fat) |
| `recipes`       | id, uid, authorName, title, ingredients, description, category, tags, healthNote, likes, likedBy[], createdAt |
| `progress`      | id, uid, title, type (meal|recipe), mealType, recipeId, calories, protein, carbs, fat, timestamp, date |
| `chatMessages`  | id, session_id, uid, role (user|assistant), content, createdAt          |

### 5.6 Auth Details

- **Password hashing:** bcrypt with salt
- **JWT:** HS256 algorithm, 30-day expiry, signed with `JWT_SECRET`
- **Token payload:** `{ "uid": "<user-uuid>", "exp": <expiry-timestamp> }`
- **Auth middleware:** HTTP Bearer token via FastAPI `Depends(security)`
- **Pre-auth chat:** The `/chat/send` endpoint allows `pre_auth: true` to skip authentication for the demo chat on the landing screen

---

## 6. Design System

### 6.1 Theme Overview

- **Archetype:** Electric & Neon — Dark mode cyberpunk
- **Background:** Pure black (`#000000`)
- **Surfaces:** Deep matte blacks (`#0A0A0A`, `#12121A`)
- **Primary Accent:** Flame Orange (`#FF3B30`) with glow (`rgba(255,59,48,0.4)`)
- **Secondary Accent:** Cyan (`#00FFFF`)
- **Tertiary Accent:** Purple (`#B026FF`)
- **Status Colors:** Good (`#00FF41`), Limit (`#FF9F0A`), Avoid (`#FF3B30`)

### 6.2 Typography

| Style   | Font           | Weight/Variant          | Size | Line Height | Letter Spacing |
|---------|----------------|-------------------------|------|-------------|----------------|
| h1      | Unbounded      | 900 Black               | 48   | 52          | -1.5           |
| h2      | Unbounded      | 700 Bold                | 32   | 36          | -1.0           |
| h3      | Unbounded      | 600 SemiBold            | 24   | 28          | -0.5           |
| h4      | Unbounded      | 600 SemiBold            | 18   | 24          | -0.2           |
| body    | Outfit         | 400 Regular             | 16   | 24          | —              |
| body_sm | Outfit         | 400 Regular             | 14   | 20          | —              |
| label   | Outfit         | 600 SemiBold + Uppercase| 12   | 16          | 1.2            |

### 6.3 Spacing & Layout

| Token | Value |
|-------|-------|
| Container padding | 24px |
| Card padding | 20px |
| Gaps | sm: 8, md: 16, lg: 24, xl: 32 |

### 6.4 Border Radius

| Token | Value |
|-------|-------|
| sm    | 8px   |
| md    | 16px  |
| lg    | 24px  |
| xl    | 32px  |
| full  | 9999px|

### 6.5 Surface Strategies

- **Cards:** Glassmorphism via `BlurView` (intensity 30, dark tint) + 1px subtle border
- **Buttons:** Primary CTA uses Flame Orange background with drop shadow matching bg for neon glow
- **Bottom Nav:** Floating bento-style bar with `BlurView`, absolute positioning, active icon in Cyan with glow
- **Dashboard:** Bento box grid layout (1×1, 1×2, 2×2 widgets)

### 6.6 Animations

- **Library:** `react-native-reanimated` for physics-based motion
- **Page transitions:** Fade in + translateY (20px → 0px) with spring physics
- **Interactions:** Scale to 0.95 on press-in, back to 1 on press-out
- **Background:** Floating AI particles on Landing screen; pulsing opacity on AI Chat button

---

## 7. Data Flow

### 7.1 Authentication Flow

```
User enters email/password → POST /api/auth/login
  → Backend verifies bcrypt hash → Returns JWT + user object
  → Frontend stores JWT in AsyncStorage → Sets user in AuthContext
  → Router redirects based on onboarded status
```

### 7.2 Onboarding Flow

```
User completes 5-step wizard → POST /api/profile/onboarding
  → Backend computes BMR (Mifflin-St Jeor)
  → Applies activity factor (1.4) + goal adjustment
  → Saves profile fields + calorieEstimate + goalSummary
  → Sets onboarded: true → Frontend redirects to dashboard
```

### 7.3 Meal Plan Generation

```
User taps "Generate" → POST /api/meal-plan/generate (optional: location/notes)
  → Backend builds system prompt + user profile context
  → Sends to Mercury-2 → Parses JSON response
  → Validates structure (breakfast/lunch/dinner/snack each with macros)
  → Falls back to default values if AI fails
  → Saves to mealPlans collection → Returns plan to frontend
```

### 7.4 Food Scan Flow

```
Option A: User takes photo → POST /api/scan/analyze (image_base64)
  → Backend sends image to Gemini 2.5 Flash via emergentintegrations
  → Gemini extracts ingredients text from image
  → Ingredients sent to Mercury-2 for analysis

Option B: User types ingredients → POST /api/scan/analyze (ingredients_text)
  → Sent directly to Mercury-2

Mercury-2 returns JSON verdict:
  { "verdict": "good"|"limit"|"avoid",
    "summary": "...",
    "ingredients": [{ "name": "...", "category": "...", "note": "..." }] }
```

### 7.5 AI Chat Flow

```
User sends message → POST /api/chat/send (session_id, message, pre_auth?)
  → Backend persists user message to chatMessages
  → Loads last 20-40 messages for context
  → Builds system prompt with optional user profile context
  → Sends to Mercury-2 → Returns reply
  → Persists assistant reply → Returns to frontend
```

---

## 8. Key Dependencies

### Frontend (npm)

| Package                      | Purpose                                     |
|------------------------------|---------------------------------------------|
| `expo` ~54.0.34              | Core Expo framework                         |
| `expo-router` ~6.0.22        | File-based routing                          |
| `react-native` 0.81.5       | Core RN framework                           |
| `react-native-reanimated`    | Physics-based animations                    |
| `expo-blur`                  | Glassmorphism blur effects                  |
| `expo-linear-gradient`      | Gradient backgrounds/buttons                |
| `lucide-react-native`        | Icon set (Home, Utensils, ScanLine, etc.)  |
| `@expo-google-fonts/outfit`  | Body text font                              |
| `@expo-google-fonts/unbounded` | Heading font                              |
| `react-native-markdown-display` | Markdown rendering for AI chat responses |
| `@react-native-async-storage/async-storage` | Token persistence          |
| `react-native-gesture-handler` | Touch gesture handling                    |
| `expo-image-picker`          | Camera/gallery for food scanning           |
| `expo-location`              | User location for cuisine-aware meal plans |
| `react-native-svg`           | SVG rendering (icons/graphics)             |
| `react-native-webview`       | WebView for Google auth flow               |

### Backend (Python)

| Package               | Purpose                                   |
|-----------------------|-------------------------------------------|
| `fastapi`             | REST API framework                        |
| `motor`               | Async MongoDB driver                      |
| `openai`              | OpenAI-compatible client for Mercury-2    |
| `emergentintegrations`| Gemini multimodal integration for OCR     |
| `bcrypt`              | Password hashing                          |
| `PyJWT`               | JWT token generation/verification         |
| `python-dotenv`       | Environment variable loading              |
| `uvicorn`             | ASGI server                               |
| `pydantic`            | Request/response model validation         |
| `email-validator`     | Email format validation                   |

---

## 9. Development Setup

### Prerequisites

- Node.js (v18+)
- Python 3.10+
- MongoDB instance (local or Atlas)
- Expo Go app (iOS/Android) for mobile testing

### Environment Variables

**Backend `.env` (in `backend/.env`):**

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ignite_nutrition
JWT_SECRET=your-jwt-secret
INCEPTION_API_KEY=your-inception-labs-key
INCEPTION_BASE_URL=https://api.inceptionlabs.ai/v1
MERCURY_MODEL=mercury
EMERGENT_LLM_KEY=your-google-ai-key  # For Gemini multimodal
```

**Frontend (via `react-native-dotenv` or `EXPO_PUBLIC_*`):**

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Running the App

```bash
# Terminal 1 — Start Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Terminal 2 — Start Frontend
cd frontend
yarn install
yarn start
```

Then scan the Expo QR code with Expo Go, or press `a` for Android emulator / `i` for iOS simulator.

### Testing

- Backend tests are in `backend/tests/`
- Test scripts: `backend_test.py`, `test_estimate_macros.py`
- Test reports stored in `test_reports/`

---

> *Built with Ignition by the Ignite Nutrition team.*