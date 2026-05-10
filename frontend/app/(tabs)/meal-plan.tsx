import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Coffee, Sun, Moon, Apple, RefreshCw, Plus, MapPin, Navigation, X, Edit3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const LOCATION_KEY = 'ignite_location';

export default function MealPlan() {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [location, setLocation] = useState<string>('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [detecting, setDetecting] = useState(false);

  // Manual meal modal state
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualMealType, setManualMealType] = useState<string>('breakfast');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const p: any = await api.latestMealPlan();
      setPlan(p && p.breakfast ? p : null);
      if (p && p.location) setLocation(p.location);
    } catch {}
    const saved = await AsyncStorage.getItem(LOCATION_KEY);
    if (saved) setLocation((cur) => cur || saved);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to auto-detect your region, or type it manually.');
        setDetecting(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const p = places[0];
      if (p) {
        const parts = [p.city || p.subregion || p.region, p.country].filter(Boolean);
        const loc = parts.join(', ');
        setLocation(loc);
        await AsyncStorage.setItem(LOCATION_KEY, loc);
      } else {
        Alert.alert('Location', 'Could not determine your location. Please type it manually.');
      }
    } catch (e: any) {
      Alert.alert('Location error', e.message || 'Could not detect location');
    } finally {
      setDetecting(false);
    }
  };

  const saveLocationEdit = async () => {
    const v = locationInput.trim();
    setLocation(v);
    if (v) await AsyncStorage.setItem(LOCATION_KEY, v);
    else await AsyncStorage.removeItem(LOCATION_KEY);
    setEditingLocation(false);
  };

  const generate = async () => {
    setGenerating(true);
    try { const p: any = await api.generateMealPlan(undefined, location || undefined); setPlan(p); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setGenerating(false); }
  };

  const log = async (mealType: string, meal: any) => {
    try {
      await api.addProgress({
        title: meal.name,
        type: 'meal',
        mealType,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      });
      Alert.alert('Logged', `${meal.name} added to today's progress`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const openManual = (mealType?: string) => {
    setManualName('');
    setManualNotes('');
    setManualMealType(mealType || 'breakfast');
    setManualOpen(true);
  };

  const submitManual = async () => {
    if (!manualName.trim()) {
      Alert.alert('Meal name required', 'Please enter a meal name like "2 eggs and toast"');
      return;
    }
    setManualSaving(true);
    try {
      const macros: any = await api.estimateMacros(manualName.trim(), manualNotes.trim() || undefined);
      await api.addProgress({
        title: manualName.trim(),
        type: 'meal',
        mealType: manualMealType,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      });
      setManualOpen(false);
      Alert.alert('Logged', `${manualName.trim()} • ${Math.round(macros.calories)} kcal • ${Math.round(macros.protein)}g protein`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <Screen>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>FUEL</Text>
        <Text style={styles.title}>Your Meal Plan</Text>
        <Text style={styles.sub}>AI-tailored to your goal, diet & region</Text>

        {/* Location card */}
        <GlassCard style={styles.locCard}>
          <View style={styles.locRow}>
            <View style={[styles.locIcon, { borderColor: colors.cyan }]}>
              <MapPin size={18} color={colors.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locLabel}>REGION</Text>
              {editingLocation ? (
                <TextInput
                  testID="location-input"
                  value={locationInput}
                  onChangeText={setLocationInput}
                  placeholder="e.g., Mumbai, India"
                  placeholderTextColor={colors.textMuted}
                  style={styles.locInput}
                  autoFocus
                  onSubmitEditing={saveLocationEdit}
                  returnKeyType="done"
                />
              ) : (
                <Text style={styles.locText} numberOfLines={1}>
                  {location || 'Set your region for local cuisine'}
                </Text>
              )}
            </View>
            {editingLocation ? (
              <>
                <TouchableOpacity testID="location-save" onPress={saveLocationEdit} style={[styles.locBtn, { borderColor: colors.cyan }]}>
                  <Text style={[styles.locBtnText, { color: colors.cyan }]}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="location-cancel" onPress={() => setEditingLocation(false)} style={styles.locIconBtn}>
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity testID="location-detect" onPress={detectLocation} disabled={detecting} style={[styles.locIconBtn, { borderColor: colors.cyan }]}>
                  {detecting ? <ActivityIndicator size="small" color={colors.cyan} /> : <Navigation size={16} color={colors.cyan} />}
                </TouchableOpacity>
                <TouchableOpacity testID="location-edit" onPress={() => { setLocationInput(location); setEditingLocation(true); }} style={styles.locIconBtn}>
                  <Edit3 size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </GlassCard>

        <View style={styles.actionsRow}>
          <TouchableOpacity testID="generate-plan" onPress={generate} disabled={generating} style={[styles.cta, { flex: 1 }]} activeOpacity={0.85}>
            <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              {generating ? <ActivityIndicator color="#000" /> : (
                <>
                  <RefreshCw size={16} color="#000" />
                  <Text style={styles.ctaText}>{plan ? 'Regenerate' : "Generate Today's Plan"}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity testID="add-manual-meal" onPress={() => openManual()} style={styles.ctaSecondary} activeOpacity={0.85}>
            <Plus size={16} color={colors.cyan} />
            <Text style={styles.ctaSecondaryText}>Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.flame} style={{ marginTop: 40 }} />
        ) : !plan ? (
          <GlassCard style={{ marginTop: spacing.lg }}>
            <Text style={styles.empty}>No plan yet. Tap &quot;Generate&quot; to let Mercury craft one for you, or &quot;Add&quot; to log your own meal.</Text>
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
                  {meal.calories ? (
                    <View style={styles.kcalPill}>
                      <Text style={styles.kcalText}>{Math.round(meal.calories)} kcal</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.mealReason}>{meal.reason}</Text>
                {meal.protein || meal.carbs || meal.fat ? (
                  <View style={styles.macrosRow}>
                    <MacroChip label="P" value={meal.protein} color="#FF6B6B" />
                    <MacroChip label="C" value={meal.carbs} color="#4ECDC4" />
                    <MacroChip label="F" value={meal.fat} color="#FFD166" />
                  </View>
                ) : null}
                <TouchableOpacity testID={`log-${m.key}`} onPress={() => log(m.label, meal)} style={styles.logBtn}>
                  <Plus size={14} color={colors.cyan} />
                  <Text style={styles.logText}>Log to progress</Text>
                </TouchableOpacity>
              </GlassCard>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Manual meal modal */}
      <Modal visible={manualOpen} animationType="slide" transparent onRequestClose={() => setManualOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalRoot}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setManualOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log a Meal</Text>
              <TouchableOpacity onPress={() => setManualOpen(false)} testID="manual-close" style={styles.locIconBtn}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>AI will estimate calories & macros automatically.</Text>

            <Text style={styles.modalLabel}>What did you eat?</Text>
            <TextInput
              testID="manual-name"
              value={manualName}
              onChangeText={setManualName}
              placeholder="e.g., 2 eggs, toast and avocado"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              autoFocus
            />

            <Text style={styles.modalLabel}>Meal type</Text>
            <View style={styles.typeRow}>
              {MEALS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  testID={`type-${m.key}`}
                  onPress={() => setManualMealType(m.key)}
                  style={[styles.typeChip, manualMealType === m.key && { borderColor: m.color, backgroundColor: `${m.color}22` }]}
                >
                  <m.icon size={14} color={manualMealType === m.key ? m.color : colors.textMuted} />
                  <Text style={[styles.typeChipText, manualMealType === m.key && { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Portion / notes (optional)</Text>
            <TextInput
              testID="manual-notes"
              value={manualNotes}
              onChangeText={setManualNotes}
              placeholder="e.g., 1 large bowl, no sugar"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
            />

            <TouchableOpacity testID="manual-submit" onPress={submitManual} disabled={manualSaving} style={[styles.cta, { marginTop: spacing.lg }]} activeOpacity={0.85}>
              <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
                {manualSaving ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Plus size={16} color="#000" />
                    <Text style={styles.ctaText}>Estimate & Log</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function MacroChip({ label, value, color }: { label: string; value?: number; color: string }) {
  if (value == null) return null;
  return (
    <View style={[styles.macroChip, { borderColor: `${color}66`, backgroundColor: `${color}14` }]}>
      <Text style={[styles.macroChipLabel, { color }]}>{label}</Text>
      <Text style={styles.macroChipValue}>{Math.round(value)}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingTop: spacing.lg },
  label: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 3 },
  title: { fontFamily: fonts.heading700, fontSize: 32, color: colors.textPrimary, letterSpacing: -1, marginTop: 4 },
  sub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginBottom: spacing.lg },
  locCard: { marginBottom: spacing.md, paddingVertical: 12 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(0,255,255,0.06)' },
  locLabel: { fontFamily: fonts.bodySemi, fontSize: 9, color: colors.textMuted, letterSpacing: 1.5 },
  locText: { fontFamily: fonts.heading600, fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  locInput: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary, marginTop: 2, padding: 0, borderBottomWidth: 1, borderBottomColor: colors.cyan },
  locBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  locBtnText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  locIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.04)' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  cta: { borderRadius: radius.full, overflow: 'hidden', shadowColor: colors.flame, shadowOpacity: 0.5, shadowRadius: 16 },
  ctaGrad: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.heading600, color: '#000', fontSize: 14 },
  ctaSecondary: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.full, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cyan, backgroundColor: 'rgba(0,255,255,0.06)' },
  ctaSecondaryText: { fontFamily: fonts.heading600, color: colors.cyan, fontSize: 14 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  mealCard: { marginBottom: spacing.md },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  mealIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  mealLabel: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 2, color: colors.textMuted },
  mealName: { fontFamily: fonts.heading600, fontSize: 17, color: colors.textPrimary, marginTop: 2 },
  kcalPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.1)' },
  kcalText: { fontFamily: fonts.heading600, fontSize: 11, color: colors.flame },
  mealReason: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  macrosRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  macroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  macroChipLabel: { fontFamily: fonts.heading700, fontSize: 10 },
  macroChipValue: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textPrimary },
  logBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: spacing.md, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.cyan, backgroundColor: 'rgba(0,255,255,0.05)' },
  logText: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 12 },

  // Modal
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { backgroundColor: '#0F0F12', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl, borderWidth: 1, borderColor: colors.borderSubtle },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontFamily: fonts.heading700, fontSize: 22, color: colors.textPrimary },
  modalSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  modalLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginTop: spacing.sm, marginBottom: 6 },
  modalInput: { fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.03)' },
  typeChipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
});
