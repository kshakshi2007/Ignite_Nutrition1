# Ignite Nutrition — PRD

## Vision
Futuristic, AI-powered nutrition tracking mobile app (Expo iOS + Android). Cyberpunk neon aesthetic with glassmorphism and animated particle background.

## Stack
- **Frontend**: Expo SDK 54 + Expo Router + React Native + react-native-reanimated + expo-blur + expo-linear-gradient + lucide-react-native + @expo-google-fonts (Unbounded + Outfit) + react-native-markdown-display + AsyncStorage.
- **Backend**: FastAPI + Motor (MongoDB).
- **AI**: Mercury-2 (Inception Labs, OpenAI-compatible) for chat / meal plan / recipe tags. Gemini 2.5 Flash (Emergent Universal Key) for food-label image OCR.
- **Auth**: Email/password JWT + lightweight Google sign-in via `/auth/google`.

## Screens
1. **Landing** — animated particle field, flame badge, hero CTAs, pre-auth AI demo chat sheet, glassmorphic auth sheet (email/password tabs + Google).
2. **Onboarding** — 5-step wizard (age/height/weight → gender → goal → diet → allergies). Backend computes BMR (Mifflin-St Jeor) + activity factor 1.4 + goal adjustment.
3. **Tabs (6)**: CORE (dashboard), FUEL (meal plan), SCAN, AI (chat), FEED (recipes), PROGRESS.
4. **Profile** — modal screen, edits all fields, recalculates BMR + calorie target on save.

## Backend Endpoints (all under `/api`)
- POST `/auth/register`, `/auth/login`, `/auth/google`; GET `/auth/me`
- POST `/profile/onboarding`; PUT `/profile`
- POST `/meal-plan/generate`, GET `/meal-plan/latest`
- POST `/scan/analyze` (image_base64 OR ingredients_text)
- POST `/chat/send` (session_id, message, pre_auth?), GET `/chat/history/{session_id}`
- GET/POST `/recipes`, POST `/recipes/{id}/like`
- GET/POST `/progress`, DELETE `/progress/{id}`

## MongoDB Collections
- `users`, `mealPlans`, `recipes`, `progress`, `chatMessages`

## Calorie Formula
BMR (Mifflin-St Jeor) × 1.4 (light activity) + goal adjustment (`-500 / +300 / +500 / 0`).

## Smart Business Enhancement
**Recipe Community + Likes** drives organic engagement and retention — every shared recipe with AI-generated tags becomes a discoverable evergreen asset that boosts daily active users.
