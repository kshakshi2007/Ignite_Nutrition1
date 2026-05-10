import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Coffee, Sun, Moon, Apple, RefreshCw, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../src/GlassCard';
import { ParticleField } from '../../src/ParticleField';
import { Screen } from '../../src/Screen';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { api } from '../../src/api';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee, color: colors.flame },
  { key: 'lunch', label: 'Lunch', icon: Sun, color: '#FF9F0A' },
  { key: 'dinner', label: 'Dinner', icon: Moon, color: colors.purple },
  { key: 'snack', label: 'Snack', icon: Apple, color: colors.cyan },
];

export default function MealPlan() {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try { const p: any = await api.latestMealPlan(); setPlan(p && p.breakfast ? p : null); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try { const p: any = await api.generateMealPlan(); setPlan(p); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setGenerating(false); }
  };

  const log = async (mealType: string, name: string) => {
    try { await api.addProgress({ title: name, type: 'meal', mealType }); Alert.alert('Logged', `${name} added to progress`); } 
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <View style={styles.root}>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>FUEL</Text>
        <Text style={styles.title}>Your Meal Plan</Text>
        <Text style={styles.sub}>AI-tailored to your goal & diet</Text>

        <TouchableOpacity testID="generate-plan" onPress={generate} disabled={generating} style={styles.cta} activeOpacity={0.85}>
          <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
            {generating ? <ActivityIndicator color="#000" /> : (
              <>
                <RefreshCw size={18} color="#000" />
                <Text style={styles.ctaText}>{plan ? 'Regenerate Plan' : 'Generate Today\u2019s Plan'}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={colors.flame} style={{ marginTop: 40 }} />
        ) : !plan ? (
          <GlassCard style={{ marginTop: spacing.lg }}>
            <Text style={styles.empty}>No plan yet. Tap "Generate" to let Mercury craft one for you.</Text>
          </GlassCard>
        ) : (
          MEALS.map((m) => {
            const meal = plan[m.key];
            if (!meal) return null;
            return (
              <GlassCard key={m.key} style={[styles.mealCard, { borderLeftColor: m.color, borderLeftWidth: 4 }]}>
                <View style={styles.mealHead}>
                  <View style={[styles.mealIcon, { backgroundColor: `${m.color}22`, borderColor: m.color }]}>
                    <m.icon size={20} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealLabel}>{m.label.toUpperCase()}</Text>
                    <Text style={styles.mealName}>{meal.name}</Text>
                  </View>
                </View>
                <Text style={styles.mealReason}>{meal.reason}</Text>
                <TouchableOpacity testID={`log-${m.key}`} onPress={() => log(m.label, meal.name)} style={styles.logBtn}>
                  <Plus size={14} color={colors.cyan} />
                  <Text style={styles.logText}>Log to progress</Text>
                </TouchableOpacity>
              </GlassCard>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.lg },
  label: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 3 },
  title: { fontFamily: fonts.heading700, fontSize: 32, color: colors.textPrimary, letterSpacing: -1, marginTop: 4 },
  sub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginBottom: spacing.lg },
  cta: { borderRadius: radius.full, overflow: 'hidden', shadowColor: colors.flame, shadowOpacity: 0.5, shadowRadius: 16, marginBottom: spacing.lg },
  ctaGrad: { paddingVertical: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.heading600, color: '#000', fontSize: 15 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  mealCard: { marginBottom: spacing.md },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  mealIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  mealLabel: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 2, color: colors.textMuted },
  mealName: { fontFamily: fonts.heading600, fontSize: 18, color: colors.textPrimary, marginTop: 2 },
  mealReason: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  logBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: spacing.md, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.cyan, backgroundColor: 'rgba(0,255,255,0.05)' },
  logText: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 12 },
});
