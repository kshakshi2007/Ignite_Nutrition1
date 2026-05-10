import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame, Utensils, ScanLine, Sparkles, BookPlus, User, LogOut, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/auth';
import { GlassCard } from '../../src/GlassCard';
import { ParticleField } from '../../src/ParticleField';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { api } from '../../src/api';

export default function Dashboard() {
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const [progress, setProgress] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const p: any = await api.listProgress(); setProgress(p || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); await load(); setRefreshing(false); };

  if (!user) return null;
  const today = progress.filter((p) => p.date === new Date().toISOString().slice(0, 10));
  const target = user.calorieEstimate || 2000;

  const actions = [
    { id: 'meal-plan', icon: Utensils, label: 'Meal Plan', color: colors.flame, route: '/(tabs)/meal-plan' },
    { id: 'scan', icon: ScanLine, label: 'Scan Food', color: colors.cyan, route: '/(tabs)/scan' },
    { id: 'chat', icon: Sparkles, label: 'AI Chat', color: colors.purple, route: '/(tabs)/chat' },
    { id: 'recipe', icon: BookPlus, label: 'Upload Recipe', color: '#FF7A00', route: '/(tabs)/feed' },
  ];

  return (
    <View style={styles.root}>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.flame} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, <Text style={{ color: colors.flame }}>{user.name?.split(' ')[0] || 'Athlete'}</Text></Text>
            <Text style={styles.subGreeting}>Let's fuel today.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity testID="header-profile" onPress={() => router.push('/profile')} style={styles.iconBtn}>
              <User size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity testID="header-signout" onPress={signOut} style={styles.iconBtn}>
              <LogOut size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.flameRing}>
              <Flame size={28} color={colors.flame} fill={colors.flame} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>DAILY TARGET</Text>
              <Text style={styles.heroBig}>{target} <Text style={styles.heroUnit}>kcal</Text></Text>
              <Text style={styles.heroSub}>{user.goalSummary}</Text>
            </View>
          </View>
          <LinearGradient colors={['transparent', 'rgba(255,59,48,0.4)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroBar} />
          <View style={styles.statsRow}>
            <Stat label="LOGGED" value={`${today.length}`} />
            <Stat label="GOAL" value={(user.goal || '').replace('_', ' ')} />
            <Stat label="DIET" value={user.dietType || '—'} />
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {actions.map((a) => (
            <TouchableOpacity key={a.id} testID={`action-${a.id}`} onPress={() => router.push(a.route as any)} activeOpacity={0.8} style={styles.actionWrap}>
              <GlassCard style={[styles.action, { borderColor: a.color, shadowColor: a.color }]}>
                <a.icon size={28} color={a.color} />
                <Text style={styles.actionLabel}>{a.label}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <GlassCard>
          {progress.length === 0 ? (
            <Text style={styles.empty}>No logs yet — generate a meal plan or log a recipe.</Text>
          ) : (
            progress.slice(0, 4).map((p) => (
              <View key={p.id} style={styles.activityRow}>
                <View style={[styles.dot, { backgroundColor: p.type === 'meal' ? colors.flame : colors.cyan }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>{p.title}</Text>
                  <Text style={styles.activityMeta}>{p.type === 'meal' ? `Meal · ${p.mealType || ''}` : 'Recipe'} · {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
            ))
          )}
          <TouchableOpacity testID="view-progress" onPress={() => router.push('/(tabs)/progress')} style={{ marginTop: spacing.sm, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TrendingUp size={14} color={colors.cyan} />
            <Text style={{ color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 12 }}>View full progress</Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: 70 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontFamily: fonts.heading700, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.8 },
  subGreeting: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroCard: { marginBottom: spacing.lg, shadowColor: colors.flame, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flameRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.12)', shadowColor: colors.flame, shadowOpacity: 0.6, shadowRadius: 12 },
  heroLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.cyan, letterSpacing: 2 },
  heroBig: { fontFamily: fonts.heading900, fontSize: 38, color: colors.textPrimary, lineHeight: 42, marginTop: 2 },
  heroUnit: { fontFamily: fonts.bodyMed, fontSize: 16, color: colors.textSecondary },
  heroSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  heroBar: { height: 2, marginVertical: spacing.md, borderRadius: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.borderSubtle },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 9, color: colors.textMuted, letterSpacing: 1.5 },
  statValue: { fontFamily: fonts.heading600, fontSize: 14, color: colors.textPrimary, marginTop: 4, textTransform: 'capitalize' },
  sectionTitle: { fontFamily: fonts.heading600, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  actionWrap: { width: '48%' },
  action: { alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  actionLabel: { fontFamily: fonts.heading600, fontSize: 14, color: colors.textPrimary },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activityTitle: { fontFamily: fonts.bodySemi, color: colors.textPrimary, fontSize: 14 },
  activityMeta: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic' },
});
