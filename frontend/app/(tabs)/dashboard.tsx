import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame, Utensils, ScanLine, Sparkles, BookPlus, User, LogOut, TrendingUp, Beef, Wheat, Droplet } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/auth';
import { GlassCard } from '../../src/GlassCard';
import { ParticleField } from '../../src/ParticleField';
import { Screen } from '../../src/Screen';
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

  const target = user?.calorieEstimate || 2000;
  const today = useMemo(() => {
    const d = new Date().toISOString().slice(0, 10);
    return progress.filter((p) => p.date === d);
  }, [progress]);

  const totals = useMemo(() => {
    return today.reduce(
      (acc, p) => ({
        calories: acc.calories + (p.calories || 0),
        protein: acc.protein + (p.protein || 0),
        carbs: acc.carbs + (p.carbs || 0),
        fat: acc.fat + (p.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [today]);

  // Recommended macro targets (rough): protein ~25%, carbs ~50%, fat ~25%
  const proteinTarget = Math.round((target * 0.25) / 4);
  const carbsTarget = Math.round((target * 0.5) / 4);
  const fatTarget = Math.round((target * 0.25) / 9);

  if (!user) return null;

  const actions = [
    { id: 'meal-plan', icon: Utensils, label: 'Meal Plan', color: colors.flame, route: '/(tabs)/meal-plan' },
    { id: 'scan', icon: ScanLine, label: 'Scan Food', color: colors.cyan, route: '/(tabs)/scan' },
    { id: 'chat', icon: Sparkles, label: 'AI Chat', color: colors.purple, route: '/(tabs)/chat' },
    { id: 'recipe', icon: BookPlus, label: 'Upload Recipe', color: '#FF7A00', route: '/(tabs)/feed' },
  ];

  return (
    <Screen>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.flame} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, <Text style={{ color: colors.flame }}>{user.name?.split(' ')[0] || 'Athlete'}</Text></Text>
            <Text style={styles.subGreeting}>Let&apos;s fuel today.</Text>
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

        {/* Calories Hero */}
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.flameRing}>
              <Flame size={28} color={colors.flame} fill={colors.flame} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>TODAY · CALORIES</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.heroBig}>{Math.round(totals.calories)}</Text>
                <Text style={styles.heroUnit}>/ {target} kcal</Text>
              </View>
              <Text style={styles.heroSub}>{Math.max(target - Math.round(totals.calories), 0)} kcal remaining</Text>
            </View>
          </View>
          <ProgressBar value={totals.calories} max={target} color={colors.flame} />
        </GlassCard>

        {/* Macros */}
        <Text style={styles.sectionTitle}>Macros Today</Text>
        <View style={styles.macroGrid}>
          <MacroCard icon={Beef} label="Protein" value={totals.protein} target={proteinTarget} color="#FF6B6B" />
          <MacroCard icon={Wheat} label="Carbs" value={totals.carbs} target={carbsTarget} color="#4ECDC4" />
          <MacroCard icon={Droplet} label="Fat" value={totals.fat} target={fatTarget} color="#FFD166" />
        </View>

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

        <Text style={styles.sectionTitle}>Today&apos;s Meals ({today.length})</Text>
        <GlassCard>
          {today.length === 0 ? (
            <Text style={styles.empty}>No meals logged today — generate a plan or tap &quot;+ Add&quot; in the Fuel tab.</Text>
          ) : (
            today.slice(0, 6).map((p) => (
              <View key={p.id} style={styles.activityRow}>
                <View style={[styles.dot, { backgroundColor: p.type === 'meal' ? colors.flame : colors.cyan }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.activityMeta}>
                    {p.mealType ? `${p.mealType} · ` : ''}
                    {p.calories ? `${Math.round(p.calories)} kcal` : 'No macros'}
                    {p.protein ? ` · ${Math.round(p.protein)}P` : ''}
                  </Text>
                </View>
                <Text style={styles.activityTime}>{new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
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
    </Screen>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <View style={styles.progressTrack}>
      <LinearGradient
        colors={[color, '#FF7A00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.progressFill, { width: `${pct}%` }]}
      />
    </View>
  );
}

function MacroCard({ icon: Icon, label, value, target, color }:
  { icon: any; label: string; value: number; target: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(target, 1)) * 100));
  return (
    <GlassCard style={[styles.macroCard, { borderColor: `${color}55` }]}>
      <View style={styles.macroHead}>
        <View style={[styles.macroIcon, { borderColor: color, backgroundColor: `${color}1A` }]}>
          <Icon size={16} color={color} />
        </View>
        <Text style={styles.macroLabel}>{label.toUpperCase()}</Text>
      </View>
      <Text style={styles.macroValue}>{Math.round(value)}<Text style={styles.macroUnit}>g</Text></Text>
      <Text style={styles.macroTarget}>of {target}g</Text>
      <View style={[styles.progressTrack, { marginTop: 8, height: 4 }]}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingTop: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontFamily: fonts.heading700, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.8 },
  subGreeting: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroCard: { marginBottom: spacing.lg, shadowColor: colors.flame, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  flameRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.12)', shadowColor: colors.flame, shadowOpacity: 0.6, shadowRadius: 12 },
  heroLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.cyan, letterSpacing: 2 },
  heroBig: { fontFamily: fonts.heading900, fontSize: 38, color: colors.textPrimary, lineHeight: 42, marginTop: 2 },
  heroUnit: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textSecondary },
  heroSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  sectionTitle: { fontFamily: fonts.heading600, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm },
  macroGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  macroCard: { flex: 1, borderWidth: 1, padding: 14 },
  macroHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  macroIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  macroLabel: { fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1.5, color: colors.textMuted },
  macroValue: { fontFamily: fonts.heading700, fontSize: 22, color: colors.textPrimary },
  macroUnit: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  macroTarget: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  actionWrap: { width: '48%' },
  action: { alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  actionLabel: { fontFamily: fonts.heading600, fontSize: 14, color: colors.textPrimary },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activityTitle: { fontFamily: fonts.bodySemi, color: colors.textPrimary, fontSize: 14 },
  activityMeta: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  activityTime: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 11 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic' },
});
