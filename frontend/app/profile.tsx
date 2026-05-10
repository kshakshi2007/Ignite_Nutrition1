import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/auth';
import { GlassCard } from '../src/GlassCard';
import { ParticleField } from '../src/ParticleField';
import { colors, fonts, radius, spacing } from '../src/theme';
import { api } from '../src/api';

const goals = ['weight_loss', 'muscle_gain', 'weight_gain', 'maintenance'];
const diets = ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo'];
const allergyOpts = ['Gluten', 'Dairy', 'Nuts', 'Eggs', 'Soy', 'Shellfish'];

export default function Profile() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(String(user?.age || ''));
  const [height, setHeight] = useState(String(user?.height || ''));
  const [weight, setWeight] = useState(String(user?.weight || ''));
  const [gender, setGender] = useState(user?.gender || 'male');
  const [goal, setGoal] = useState(user?.goal || 'maintenance');
  const [dietType, setDietType] = useState(user?.dietType || 'Omnivore');
  const [allergies, setAllergies] = useState<string[]>(user?.allergies || []);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated: any = await api.updateProfile({
        name, age: parseInt(age, 10) || undefined, height: parseFloat(height) || undefined,
        weight: parseFloat(weight) || undefined, gender, goal, dietType, allergies,
      });
      setUser(updated);
      Alert.alert('Saved', `New target: ${updated.calorieEstimate} kcal/day`);
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const toggleAllergy = (a: string) => setAllergies(allergies.includes(a) ? allergies.filter(x => x !== a) : [...allergies, a]);

  return (
    <View style={styles.root}>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity testID="profile-back" onPress={() => router.back()} style={styles.iconBtn}><ArrowLeft size={20} color={colors.textPrimary} /></TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <GlassCard>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput testID="profile-name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.textMuted} />

          <View style={styles.row3}>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Age</Text>
              <TextInput testID="profile-age" value={age} onChangeText={setAge} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Height (cm)</Text>
              <TextInput testID="profile-height" value={height} onChangeText={setHeight} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Weight (kg)</Text>
              <TextInput testID="profile-weight" value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.textMuted} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.chips}>
            {(['male', 'female', 'other']).map((g) => (
              <TouchableOpacity key={g} testID={`prof-gender-${g}`} onPress={() => setGender(g)} style={[styles.chip, gender === g && styles.chipActive]}>
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Goal</Text>
          <View style={styles.chips}>
            {goals.map((g) => (
              <TouchableOpacity key={g} testID={`prof-goal-${g}`} onPress={() => setGoal(g)} style={[styles.chip, goal === g && styles.chipActive]}>
                <Text style={[styles.chipText, goal === g && styles.chipTextActive]}>{g.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Diet</Text>
          <View style={styles.chips}>
            {diets.map((d) => (
              <TouchableOpacity key={d} testID={`prof-diet-${d}`} onPress={() => setDietType(d)} style={[styles.chip, dietType === d && styles.chipActive]}>
                <Text style={[styles.chipText, dietType === d && styles.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Allergies</Text>
          <View style={styles.chips}>
            {allergyOpts.map((a) => (
              <TouchableOpacity key={a} testID={`prof-allergy-${a}`} onPress={() => toggleAllergy(a)} style={[styles.chip, allergies.includes(a) && styles.chipActive]}>
                <Text style={[styles.chipText, allergies.includes(a) && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="profile-save" onPress={save} disabled={busy} style={styles.cta} activeOpacity={0.85}>
            <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              {busy ? <ActivityIndicator color="#000" /> : (
                <>
                  <Save size={18} color="#000" />
                  <Text style={styles.ctaText}>Save & Recalculate</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.04)' },
  title: { fontFamily: fonts.heading700, fontSize: 22, color: colors.textPrimary },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginTop: spacing.sm, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, borderWidth: 1, borderColor: colors.borderSubtle },
  row3: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipActive: { borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.15)' },
  chipText: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: colors.flame },
  cta: { borderRadius: radius.full, overflow: 'hidden', marginTop: spacing.lg, shadowColor: colors.flame, shadowOpacity: 0.5, shadowRadius: 16 },
  ctaGrad: { paddingVertical: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.heading600, color: '#000', fontSize: 15 },
});
