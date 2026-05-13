-- ============================================================
-- Ignite Nutrition — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Users Table
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  onboarded BOOLEAN DEFAULT FALSE,
  bmr INTEGER,
  calorie_estimate INTEGER,
  goal TEXT,                      -- weight_loss | muscle_gain | weight_gain | maintenance
  goal_summary TEXT,
  diet_type TEXT,
  allergies JSONB DEFAULT '[]',
  age INTEGER,
  height REAL,                    -- cm
  weight REAL,                    -- kg
  gender TEXT,                    -- male | female | other
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- 2. Meal Plans Table
-- ============================================================
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  breakfast JSONB NOT NULL DEFAULT '{"name": "", "reason": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0}',
  lunch JSONB NOT NULL DEFAULT '{"name": "", "reason": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0}',
  dinner JSONB NOT NULL DEFAULT '{"name": "", "reason": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0}',
  snack JSONB NOT NULL DEFAULT '{"name": "", "reason": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meal_plans_uid ON meal_plans(uid);
CREATE INDEX idx_meal_plans_date ON meal_plans(date);

-- ============================================================
-- 3. Recipes Table
-- ============================================================
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT DEFAULT 'Chef',
  title TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'snack',  -- breakfast | lunch | dinner | snack | dessert | drink
  tags JSONB DEFAULT '[]',
  health_note TEXT DEFAULT 'Tasty community recipe.',
  likes INTEGER DEFAULT 0,
  liked_by JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipes_created ON recipes(created_at DESC);

-- ============================================================
-- 4. Progress Table
-- ============================================================
CREATE TABLE progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('meal', 'recipe')),
  meal_type TEXT,
  recipe_id UUID,
  calories REAL,
  protein REAL,
  carbs REAL,
  fat REAL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_progress_uid ON progress(uid);
CREATE INDEX idx_progress_timestamp ON progress(timestamp DESC);

-- ============================================================
-- 5. Chat Messages Table
-- ============================================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  uid UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at ASC);

-- ============================================================
-- Row Level Security (RLS) — Recommended for production
-- ============================================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read/update only their own record
CREATE POLICY "users_own" ON users
  FOR ALL USING (id = auth.uid());

-- Meal plans: only owner
CREATE POLICY "meal_plans_own" ON meal_plans
  FOR ALL USING (uid = auth.uid());

-- Recipes: everyone can read, only owner can update/delete
CREATE POLICY "recipes_read_all" ON recipes
  FOR SELECT USING (true);
CREATE POLICY "recipes_own" ON recipes
  FOR INSERT WITH CHECK (uid = auth.uid());
CREATE POLICY "recipes_update_own" ON recipes
  FOR UPDATE USING (uid = auth.uid());

-- Progress: only owner
CREATE POLICY "progress_own" ON progress
  FOR ALL USING (uid = auth.uid());

-- Chat: read/write own messages
CREATE POLICY "chat_own" ON chat_messages
  FOR ALL USING (uid = auth.uid());