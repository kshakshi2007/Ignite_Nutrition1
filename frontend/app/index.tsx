import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame, Sparkles, ArrowRight, Mail, Lock, MessageCircle, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/auth';
import { ParticleField } from '../src/ParticleField';
import { GlassCard } from '../src/GlassCard';
import { colors, fonts, spacing, radius } from '../src/theme';
import { api } from '../src/api';

export default function Landing() {
  const router = useRouter();
  const { user, loading, signIn, signUp, signInGoogle } = useAuth();
  const [mode, setMode] = useState<'home' | 'auth' | 'demo'>('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // Demo chat state
  const [demoQ, setDemoQ] = useState('');
  const [demoMsgs, setDemoMsgs] = useState<{ role: string; content: string }[]>([]);
  const [demoBusy, setDemoBusy] = useState(false);
  const demoSession = React.useRef(`demo-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.onboarded ? '/(tabs)/dashboard' : '/onboarding');
    }
  }, [user, loading, router]);

  const handleAuth = async () => {
    if (!email || !pw) return Alert.alert('Missing fields', 'Email and password required');
    setBusy(true);
    try {
      if (authMode === 'signup') await signUp(email, pw, name); else await signIn(email, pw);
    } catch (e: any) {
      Alert.alert('Auth failed', e.message || 'Try again');
    } finally { setBusy(false); }
  };

  const handleGoogle = async () => {
    // Lightweight demo Google sign-in: prefill and POST to /auth/google
    setBusy(true);
    try {
      const fakeEmail = `guest_${Math.random().toString(36).slice(2, 8)}@ignite.app`;
      await signInGoogle(fakeEmail, 'Ignite Guest');
    } catch (e: any) { Alert.alert('Google sign-in failed', e.message); }
    finally { setBusy(false); }
  };

  const sendDemo = async () => {
    if (!demoQ.trim()) return;
    const q = demoQ.trim();
    setDemoMsgs((m) => [...m, { role: 'user', content: q }]);
    setDemoQ('');
    setDemoBusy(true);
    try {
      const r: any = await api.chatSend(demoSession, q, true);
      setDemoMsgs((m) => [...m, { role: 'assistant', content: r.reply }]);
    } catch (e: any) {
      setDemoMsgs((m) => [...m, { role: 'assistant', content: 'Sorry, AI is unavailable right now.' }]);
    } finally { setDemoBusy(false); }
  };

  if (loading) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.flame} size="large" /></View>;
  }

  return (
    <View style={styles.root}>
      <ParticleField />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroWrap}>
            <View style={styles.flameBadge}>
              <Flame size={28} color={colors.flame} fill={colors.flame} />
            </View>
            <Text style={styles.brand} testID="app-brand">IGNITE</Text>
            <Text style={styles.brandSub}>NUTRITION</Text>
            <Text style={styles.tagline}>
              Your personal AI fuel coach — meal plans, food scanner, and smart insights, all in one neon dashboard.
            </Text>

            {mode === 'home' && (
              <>
                <TouchableOpacity testID="cta-get-started" activeOpacity={0.85} style={styles.primaryBtn} onPress={() => setMode('auth')}>
                  <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGrad}>
                    <Text style={styles.primaryBtnText}>Ignite Your Journey</Text>
                    <ArrowRight size={20} color="#000" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity testID="cta-demo-chat" style={styles.ghostBtn} onPress={() => setMode('demo')}>
                  <MessageCircle size={18} color={colors.cyan} />
                  <Text style={styles.ghostBtnText}>Try the AI nutrition coach (no login)</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {mode === 'auth' && (
            <GlassCard style={styles.card}>
              <View style={styles.authHeader}>
                <Text style={styles.cardTitle}>{authMode === 'login' ? 'Welcome back' : 'Create account'}</Text>
                <TouchableOpacity testID="close-auth" onPress={() => setMode('home')}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              <View style={styles.tabs}>
                <TouchableOpacity testID="tab-login" onPress={() => setAuthMode('login')} style={[styles.tabBtn, authMode === 'login' && styles.tabBtnActive]}>
                  <Text style={[styles.tabText, authMode === 'login' && styles.tabTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="tab-signup" onPress={() => setAuthMode('signup')} style={[styles.tabBtn, authMode === 'signup' && styles.tabBtnActive]}>
                  <Text style={[styles.tabText, authMode === 'signup' && styles.tabTextActive]}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {authMode === 'signup' && (
                <View style={styles.inputWrap}>
                  <TextInput testID="input-name" placeholder="Name" placeholderTextColor={colors.textMuted} style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" />
                </View>
              )}
              <View style={styles.inputWrap}>
                <Mail size={16} color={colors.textSecondary} />
                <TextInput testID="input-email" placeholder="Email" placeholderTextColor={colors.textMuted} style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              </View>
              <View style={styles.inputWrap}>
                <Lock size={16} color={colors.textSecondary} />
                <TextInput testID="input-password" placeholder="Password" placeholderTextColor={colors.textMuted} style={styles.input} value={pw} onChangeText={setPw} secureTextEntry />
              </View>

              <TouchableOpacity testID="btn-auth-submit" disabled={busy} style={styles.primaryBtn} onPress={handleAuth} activeOpacity={0.85}>
                <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGrad}>
                  {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.divider} /><Text style={styles.dividerText}>OR</Text><View style={styles.divider} />
              </View>

              <TouchableOpacity testID="btn-google" disabled={busy} style={styles.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
                <Sparkles size={18} color={colors.cyan} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>
            </GlassCard>
          )}

          {mode === 'demo' && (
            <GlassCard style={styles.card}>
              <View style={styles.authHeader}>
                <Text style={styles.cardTitle}>Ask the Coach</Text>
                <TouchableOpacity testID="close-demo" onPress={() => setMode('home')}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              <Text style={styles.demoHint}>Try: "Best post-workout meal?" or "Decode the label E211"</Text>
              <View style={styles.demoMsgs}>
                {demoMsgs.length === 0 && <Text style={styles.demoEmpty}>Your AI coach is ready.</Text>}
                {demoMsgs.map((m, i) => (
                  <View key={i} style={[styles.demoBubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                    <Text style={[styles.demoBubbleText, m.role === 'user' && { color: '#000' }]}>{m.content}</Text>
                  </View>
                ))}
                {demoBusy && <Text style={styles.demoTyping}>Coach is thinking…</Text>}
              </View>
              <View style={styles.demoInputRow}>
                <TextInput
                  testID="demo-input"
                  placeholder="Ask anything…"
                  placeholderTextColor={colors.textMuted}
                  style={styles.demoInput}
                  value={demoQ}
                  onChangeText={setDemoQ}
                  onSubmitEditing={sendDemo}
                />
                <TouchableOpacity testID="demo-send" style={styles.sendBtn} onPress={sendDemo} disabled={demoBusy}>
                  <ArrowRight size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loadingScreen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 80, paddingBottom: 40 },
  heroWrap: { alignItems: 'center', marginBottom: spacing.xl },
  flameBadge: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,59,48,0.4)',
    marginBottom: spacing.md, shadowColor: colors.flame, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  brand: { fontFamily: fonts.heading900, fontSize: 56, color: colors.textPrimary, letterSpacing: -2, lineHeight: 60 },
  brandSub: { fontFamily: fonts.bodySemi, fontSize: 14, letterSpacing: 6, color: colors.flame, marginTop: -4 },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 22, paddingHorizontal: spacing.md },
  primaryBtn: { marginTop: spacing.xl, width: '100%', borderRadius: radius.full, overflow: 'hidden', shadowColor: colors.flame, shadowRadius: 20, shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 } },
  btnGrad: { paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { fontFamily: fonts.heading600, color: '#000', fontSize: 16 },
  ghostBtn: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(0,255,255,0.4)' },
  ghostBtnText: { fontFamily: fonts.bodyMed, color: colors.cyan, fontSize: 14 },
  card: { marginTop: spacing.lg },
  authHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontFamily: fonts.heading700, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.full, padding: 4, marginBottom: spacing.md },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.full },
  tabBtnActive: { backgroundColor: 'rgba(255,59,48,0.2)' },
  tabText: { fontFamily: fonts.bodySemi, color: colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: colors.flame },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, paddingHorizontal: 14, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  input: { flex: 1, paddingVertical: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bodySemi, letterSpacing: 2 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.cyan },
  googleBtnText: { fontFamily: fonts.bodySemi, color: colors.cyan, fontSize: 14 },
  demoHint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body, marginBottom: spacing.md },
  demoMsgs: { minHeight: 120, gap: 8, marginBottom: spacing.md },
  demoEmpty: { color: colors.textMuted, fontStyle: 'italic', fontFamily: fonts.body, fontSize: 13 },
  demoBubble: { padding: 12, borderRadius: 14, maxWidth: '90%' },
  userBubble: { backgroundColor: colors.flame, alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: 'rgba(0,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,255,0.3)', alignSelf: 'flex-start' },
  demoBubbleText: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  demoTyping: { color: colors.cyan, fontSize: 12, fontFamily: fonts.body, fontStyle: 'italic' },
  demoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.borderSubtle, color: colors.textPrimary, fontFamily: fonts.body },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.flame, alignItems: 'center', justifyContent: 'center' },
});
