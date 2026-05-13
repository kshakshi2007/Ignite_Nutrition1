import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const TOKEN_KEY = 'ignite_token';

export const tokenStore = {
  async get() { return AsyncStorage.getItem(TOKEN_KEY); },
  async set(t: string) { return AsyncStorage.setItem(TOKEN_KEY, t); },
  async clear() { return AsyncStorage.removeItem(TOKEN_KEY); },
};

/**
 * Get a valid access token.
 * Prefers stored token, falls back to Supabase session.
 */
async function getAccessToken(): Promise<string | null> {
  // Try stored token first
  const stored = await tokenStore.get();
  if (stored) return stored;

  // Fall back to Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    await tokenStore.set(session.access_token);
    return session.access_token;
  }

  return null;
}

async function request<T = any>(path: string, opts: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) };
  if (auth) {
    const t = await getAccessToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  // Auth
  register: (email: string, password: string, name?: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }, false),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),
  google: (email: string, name?: string, picture?: string) =>
    request('/auth/google', { method: 'POST', body: JSON.stringify({ email, name, picture }) }, false),
  me: () => request('/auth/me'),
  // Profile
  onboarding: (data: any) => request('/profile/onboarding', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data: any) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  // Meal plan
  generateMealPlan: (notes?: string, location?: string) => request('/meal-plan/generate', { method: 'POST', body: JSON.stringify({ notes, location }) }),
  latestMealPlan: () => request('/meal-plan/latest'),
  estimateMacros: (name: string, notes?: string) => request('/meals/estimate-macros', { method: 'POST', body: JSON.stringify({ name, notes }) }),
  // Scan
  scan: (payload: { image_base64?: string; ingredients_text?: string }) =>
    request('/scan/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  // Chat
  chatSend: (session_id: string, message: string, pre_auth = false) =>
    request('/chat/send', { method: 'POST', body: JSON.stringify({ session_id, message, pre_auth }) }, !pre_auth),
  chatHistory: (session_id: string) => request(`/chat/history/${session_id}`, {}, false),
  // Recipes
  listRecipes: () => request('/recipes', {}, false),
  createRecipe: (title: string, ingredients: string, description?: string) =>
    request('/recipes', { method: 'POST', body: JSON.stringify({ title, ingredients, description }) }),
  likeRecipe: (id: string) => request(`/recipes/${id}/like`, { method: 'POST' }),
  // Progress
  listProgress: () => request('/progress'),
  addProgress: (data: { title: string; type: 'meal' | 'recipe'; mealType?: string; recipeId?: string; calories?: number; protein?: number; carbs?: number; fat?: number }) =>
    request('/progress', { method: 'POST', body: JSON.stringify(data) }),
  deleteProgress: (id: string) => request(`/progress/${id}`, { method: 'DELETE' }),
};