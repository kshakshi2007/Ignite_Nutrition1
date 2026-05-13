# Ignite Nutrition — Deployment Guide

> **Deploy your Ignite Nutrition app to production using Vercel (backend API + landing page) and Supabase (database + authentication).**

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Vercel                          │
│  ┌─────────────────────┐  ┌─────────────────┐   │
│  │  ignite-api         │  │ ignite-landing   │   │
│  │  (FastAPI Serverless)│  │ (Static HTML)     │   │
│  │  api.ignite.vercel. │  │ ignite.vercel.app │   │
│  │  app                │  │ + APK/AAB downloads│  │
│  └────────┬────────────┘  └─────────────────┘   │
│           │                                      │
└───────────┼──────────────────────────────────────┘
            │
            ▼
┌──────────────────────┐
│     Supabase         │
│  ┌────────────────┐  │
│  │ PostgreSQL DB  │  │
│  │ + Auth Service │  │
│  └────────────────┘  │
└──────────────────────┘

┌──────────────────────┐
│  AI Services         │
│  Mercury-2 (Inception)│
│  Gemini (Google)     │
└──────────────────────┘
```

**Two separate Vercel projects recommended:**
1. **`ignite-api`** — FastAPI backend (serverless functions)
2. **`ignite-landing`** — Static landing page with APK/AAB downloads

---

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Once created, navigate to **Project Settings → API**
4. Copy the following keys:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJhbGciOiJIUzI1NiIs...`)
   - **service_role key** (starts with `eyJhbGciOiJIUzI1NiIs...` — keep secret!)

5. Go to **SQL Editor** in the Supabase Dashboard
6. Open `backend/supabase_schema.sql` from this project
7. Paste the entire contents and click **Run**
8. This creates all 5 tables: `users`, `meal_plans`, `recipes`, `progress`, `chat_messages`

### Supabase Auth Configuration

1. In Supabase Dashboard → **Authentication → Providers**
2. **Email/Password** — enable it (default)
3. **Google** — optional, configure OAuth if you want Google sign-in
4. Under **Authentication → Settings**:
   - `SITE_URL` = your landing page URL
   - Make sure email confirmation is **disabled** for testing (unless you want it enabled)

---

## Step 2: Backend Environment Variables

Create `backend/.env` with your keys:

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...  # from Step 1

# Mercury-2 AI (Inception Labs) — sign up at https://inceptionlabs.ai
INCEPTION_API_KEY=sk-inc-xxxxxxxxxxxxxxxxxxxx
INCEPTION_BASE_URL=https://api.inceptionlabs.ai/v1
MERCURY_MODEL=mercury

# Gemini AI (Google) — optional, for food scanning
# Get key from https://aistudio.google.com
EMERGENT_LLM_KEY=AIzaSyYOUR_GEMINI_API_KEY
```

---

## Step 3: Deploy Backend to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. From the project root, deploy the backend:
   ```bash
   cd backend
   vercel --prod
   ```

3. During the setup:
   - Link to/create a Vercel project (name it e.g. `ignite-api`)
   - **Build command:** (none — leave empty)
   - **Output directory:** (default)
   - **Root directory:** `backend/`
   
4. Add environment variables in Vercel:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add INCEPTION_API_KEY
   vercel env add INCEPTION_BASE_URL
   vercel env add MERCURY_MODEL
   vercel env add EMERGENT_LLM_KEY
   ```
   
   Or via Vercel Dashboard → Project → Settings → Environment Variables.

5. After deployment, you'll get a URL like `https://ignite-api.vercel.app`

6. Test it:
   ```bash
   curl https://ignite-api.vercel.app/api/
   # Should return: {"app":"Ignite Nutrition","status":"live"}
   ```

---

## Step 4: Deploy Landing Page to Vercel

1. From the project root:
   ```bash
   cd landing-page
   vercel --prod
   ```

2. Create a new Vercel project (e.g. `ignite-landing`)
3. **No build command needed** — it's a static site
4. The landing page will auto-detect and serve the APK and AAB files

You'll get a URL like `https://ignite-landing.vercel.app`

---

## Step 5: Frontend Environment Variables

Set these in `frontend/.env` (or your CI/CD):

```env
EXPO_PUBLIC_BACKEND_URL=https://ignite-api.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...  # anon public key
```

To use with `react-native-dotenv`, create a `.env` file in the `frontend/` directory:

```bash
cd frontend
echo "EXPO_PUBLIC_BACKEND_URL=https://ignite-api.vercel.app" > .env
echo "EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co" >> .env
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs..." >> .env
```

---

## Step 6: Rebuild Frontend APK/AAB

1. Install dependencies:
   ```bash
   cd frontend
   yarn install
   ```

2. Build for Android:
   ```bash
   # For APK
   eas build -p android --profile preview
   
   # For AAB (Play Store)
   eas build -p android --profile production
   ```

3. Replace the files in `landing-page/public/apk/` and `landing-page/public/aab/` with the new builds

4. Redeploy the landing page:
   ```bash
   cd landing-page
   vercel --prod
   ```

---

## Keys Summary (What Goes Where)

| Key | Where to Get It | Used In |
|-----|----------------|---------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API | Backend `.env` + Frontend `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | Backend `.env` (keep secret!) |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | Frontend `.env` (public) |
| `INCEPTION_API_KEY` | inceptionlabs.ai dashboard | Backend `.env` |
| `EMERGENT_LLM_KEY` | aistudio.google.com | Backend `.env` (optional) |
| `EXPO_PUBLIC_BACKEND_URL` | Your Vercel API URL | Frontend `.env` |
| `JWT_SECRET` | No longer needed | Replaced by Supabase Auth |

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/supabase_schema.sql` | Run this in Supabase SQL Editor to create all tables |
| `backend/.env.example` | Template for all required environment variables |
| `backend/vercel.json` | Vercel deployment config for the API |
| `backend/api/index.py` | Vercel serverless entry point |
| `backend/requirements-vercel.txt` | Python dependencies for Vercel runtime |
| `landing-page/index.html` | Cyberpunk neon landing page with APK/AAB download |
| `landing-page/vercel.json` | Vercel config for static landing page |
| `landing-page/public/apk/IgniteNutrition.apk` | Android APK download file |
| `landing-page/public/aab/IgniteNutrition.aab` | Android AAB download file |
| `frontend/src/supabase.ts` | Supabase client initialization |
| `frontend/src/auth.tsx` | Auth context using Supabase Auth SDK |
| `frontend/src/api.ts` | API client with Supabase token support |

---

## Supabase → MongoDB Field Mapping

| MongoDB Field | Supabase Column | Notes |
|---------------|----------------|-------|
| `uid` | `id` | UUID, auto-generated |
| `dietType` | `diet_type` | snake_case in SQL |
| `calorieEstimate` | `calorie_estimate` | snake_case in SQL |
| `goalSummary` | `goal_summary` | snake_case in SQL |
| `createdAt` | `created_at` | snake_case in SQL |
| `updatedAt` | `updated_at` | snake_case in SQL |
| JSON arrays (e.g. allergies, tags) | `JSONB` type | Stored as PostgreSQL JSONB |

---

## Troubleshooting

### "Cannot find module @supabase/supabase-js"
Run `yarn install` in the frontend directory to install the new dependency.

### Backend 500 errors on Vercel
Check Vercel Dashboard → Function Logs. Common issues:
- Missing environment variables
- `emergentintegrations` package not in `requirements-vercel.txt` (it's optional for Gemini)
- Supabase URL/key incorrect

### Auth not working
- Make sure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set correctly
- Check that `backend/supabase_schema.sql` has been run
- Verify Supabase Auth is enabled for Email/Password provider

### Landing page downloads not working
- Ensure files are at `landing-page/public/apk/IgniteNutrition.apk` and `landing-page/public/aab/IgniteNutrition.aab`
- Redeploy after updating files
- Check browser console for 404 errors