import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ParticleField } from '../src/ParticleField';
import { GlassCard } from '../src/GlassCard';
import { Screen } from '../src/Screen';
import { colors, fonts, radius, spacing } from '../src/theme';
import { api } from '../src/api';
import { useAuth } from '../src/auth';

const goals = [
  { id: 'weight_loss', label: 'Weight Loss', desc: '-500 kcal/day' },
  { id: 'muscle_gain', label: 'Muscle Gain', desc: '+300 kcal/day' },
  { id: 'weight_gain', label: 'Weight Gain', desc: '+500 kcal/day' },
  { id: 'maintenance', label: 'Maintain', desc: 'Stay balanced' },
];
const diets = ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo'];
const allergyOpts = ['Gluten', 'Dairy', 'Nuts', 'Eggs', 'Soy', 'Shellfish'];

export default function Onboarding() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [goal, setGoal] = useState('');
  const [dietType, setDietType] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const total = 5;

  const next = () => {
    if (step === 0 && (!age || !height || !weight)) return Alert.alert('Fill all fields');
    if (step === 1 && !gender) return Alert.alert('Select gender');
    if (step === 2 && !goal) return Alert.alert('Select a goal');
    if (step === 3 && !dietType) return Alert.alert('Pick a diet');
    if (step < total - 1) setStep(step + 1); else submit();
  };

  const submit = async () => {
    setBusy(true);
    try {
      const updated: any = await api.onboarding({
        age: parseInt(age, 10), height: parseFloat(height), weight: parseFloat(weight),
        gender, goal, dietType, allergies,
      });
      setUser(updated);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setBusy(false); }
  };

  const toggleAllergy = (a: string) => setAllergies(allergies.includes(a) ? allergies.filter(x => x !== a) : [...allergies, a]);

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <ParticleField />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>STEP {step + 1} / {total}</Text>
          <View style={styles.progressBar}>
            <LinearGradient colors={[colors.flame, colors.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${((step + 1) / total) * 100}%` }]} />
          </View>

          <GlassCard style={{ marginTop: spacing.xl }}>
            {step === 0 && (
              <View>
                <Text style={styles.h2}>Tell us about you</Text>
                <Text style={styles.sub}>Used to compute your BMR and calorie target.</Text>
                <Text style={styles.fieldLabel}>Age (years)</Text>
                <TextInput testID="onb-age" style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="28" placeholderTextColor={colors.textMuted} />
                <Text style={styles.fieldLabel}>Height (cm)</Text>
                <TextInput testID="onb-height" style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="175" placeholderTextColor={colors.textMuted} />
                <Text style={styles.fieldLabel}>Weight (kg)</Text>
                <TextInput testID="onb-weight" style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="72" placeholderTextColor={colors.textMuted} />
              </View>
            )}
            {step === 1 && (
              <View>
                <Text style={styles.h2}>Gender</Text>
                <Text style={styles.sub}>Used for the Mifflin-St Jeor formula.</Text>
                {(['male', 'female', 'other'] as const).map((g) => (
                  <TouchableOpacity key={g} testID={`onb-gender-${g}`} style={[styles.opt, gender === g && styles.optActive]} onPress={() => setGender(g)}>
                    <Text style={[styles.optText, gender === g && styles.optTextActive]}>{g[0].toUpperCase() + g.slice(1)}</Text>
                    {gender === g && <Check size={18} color={colors.flame} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {step === 2 && (
              <View>
                <Text style={styles.h2}>Your goal</Text>
                <Text style={styles.sub}>We'll adjust calories accordingly.</Text>
                {goals.map((g) => (
                  <TouchableOpacity key={g.id} testID={`onb-goal-${g.id}`} style={[styles.opt, goal === g.id && styles.optActive]} onPress={() => setGoal(g.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optText, goal === g.id && styles.optTextActive]}>{g.label}</Text>
                      <Text style={styles.optSub}>{g.desc}</Text>
                    </View>
                    {goal === g.id && <Check size={18} color={colors.flame} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {step === 3 && (
              <View>
                <Text style={styles.h2}>Diet type</Text>
                <Text style={styles.sub}>We tailor meals to your style.</Text>
                <View style={styles.chipsRow}>
                  {diets.map((d) => (
                    <TouchableOpacity key={d} testID={`onb-diet-${d}`} onPress={() => setDietType(d)} style={[styles.chip, dietType === d && styles.chipActive]}>
                      <Text style={[styles.chipText, dietType === d && styles.chipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {step === 4 && (
              <View>
                <Text style={styles.h2}>Any allergies?</Text>
                <Text style={styles.sub}>Optional. Multi-select.</Text>
                <View style={styles.chipsRow}>
                  {allergyOpts.map((a) => (
                    <TouchableOpacity key={a} testID={`onb-allergy-${a}`} onPress={() => toggleAllergy(a)} style={[styles.chip, allergies.includes(a) && styles.chipActive]}>
                      <Text style={[styles.chipText, allergies.includes(a) && styles.chipTextActive]}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </GlassCard>

          <View style={styles.navRow}>
            {step > 0 && (
              <TouchableOpacity testID="onb-back" onPress={() => setStep(step - 1)} style={styles.backBtn}>
                <ArrowLeft size={18} color={colors.textPrimary} /><Text style={styles.backTxt}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="onb-next" onPress={next} disabled={busy} style={styles.primaryBtn} activeOpacity={0.85}>
              <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGrad}>
                {busy ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Text style={styles.primaryBtnText}>{step === total - 1 ? 'Ignite' : 'Next'}</Text>
                    <ArrowRight size={20} color="#000" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 40 },
  label: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 3 },
  progressBar: { height: 6, marginTop: spacing.sm, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  h2: { fontFamily: fonts.heading700, fontSize: 26, color: colors.textPrimary, letterSpacing: -0.8 },
  sub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginTop: 4, marginBottom: spacing.md },
  fieldLabel: { color: colors.textMuted, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.5, marginTop: spacing.sm, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 16, borderWidth: 1, borderColor: colors.borderSubtle },
  opt: { flexDirection: 'row', alignItems: 'center', padding: 14, marginVertical: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle },
  optActive: { borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.1)' },
  optText: { color: colors.textPrimary, fontFamily: fonts.bodySemi, fontSize: 15 },
  optSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  optTextActive: { color: colors.flame },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipActive: { borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.15)' },
  chipText: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 13 },
  chipTextActive: { color: colors.flame },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderSubtle },
  backTxt: { color: colors.textPrimary, fontFamily: fonts.bodyMed },
  primaryBtn: { flex: 1, borderRadius: radius.full, overflow: 'hidden', shadowColor: colors.flame, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  btnGrad: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { fontFamily: fonts.heading600, color: '#000', fontSize: 15 },
});
