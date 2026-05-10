import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Heart, Plus, BookPlus, X, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../src/GlassCard';
import { ParticleField } from '../../src/ParticleField';
import { Screen } from '../../src/Screen';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';

export default function Feed() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r: any = await api.listRecipes(); setRecipes(r || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  // poll for realtime-ish feel
  useEffect(() => { const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const create = async () => {
    if (!title.trim() || !ingredients.trim()) return Alert.alert('Title and ingredients required');
    setBusy(true);
    try {
      await api.createRecipe(title.trim(), ingredients.trim(), desc.trim());
      setTitle(''); setIngredients(''); setDesc(''); setOpen(false);
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const like = async (id: string) => {
    try { const r: any = await api.likeRecipe(id); setRecipes((arr) => arr.map((x) => x.id === id ? r : x)); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  const log = async (r: any) => {
    try { await api.addProgress({ title: r.title, type: 'recipe', recipeId: r.id }); Alert.alert('Logged', `${r.title} added to progress`); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <Screen>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.flame} />}>
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={styles.label}>FUEL FEED</Text>
            <Text style={styles.title} numberOfLines={1}>Community Recipes</Text>
          </View>
          <TouchableOpacity testID="open-upload" onPress={() => setOpen(true)} style={styles.fab}>
            <Plus size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {recipes.length === 0 ? (
          <GlassCard><Text style={styles.empty}>No recipes yet. Be the first to share!</Text></GlassCard>
        ) : (
          recipes.map((r) => {
            const liked = r.likedBy?.includes(user?.uid);
            return (
              <GlassCard key={r.id} style={{ marginBottom: spacing.md }}>
                <View style={styles.tagRow}>
                  <View style={styles.tagPill}><Text style={styles.tagText}>{(r.category || 'recipe').toUpperCase()}</Text></View>
                  {(r.tags || []).slice(0, 3).map((t: string) => (
                    <View key={t} style={[styles.tagPill, { borderColor: colors.cyan }]}><Text style={[styles.tagText, { color: colors.cyan }]}>{t}</Text></View>
                  ))}
                </View>
                <Text style={styles.recipeTitle}>{r.title}</Text>
                <Text style={styles.author}>by {r.authorName}</Text>
                <Text style={styles.ingredientsTxt} numberOfLines={3}>{r.ingredients}</Text>
                <View style={styles.healthRow}>
                  <Sparkles size={14} color={colors.cyan} />
                  <Text style={styles.healthNote}>{r.healthNote}</Text>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity testID={`like-${r.id}`} onPress={() => like(r.id)} style={[styles.smallBtn, liked && { borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.08)' }]}>
                    <Heart size={14} color={liked ? colors.flame : colors.textSecondary} fill={liked ? colors.flame : 'none'} />
                    <Text style={[styles.smallBtnText, liked && { color: colors.flame }]}>{r.likes || 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID={`log-${r.id}`} onPress={() => log(r)} style={[styles.smallBtn, { borderColor: colors.cyan }]}>
                    <Plus size={14} color={colors.cyan} />
                    <Text style={[styles.smallBtnText, { color: colors.cyan }]}>Log</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Share a Recipe</Text>
              <TouchableOpacity testID="close-upload" onPress={() => setOpen(false)}><X color={colors.textPrimary} size={22} /></TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput testID="recipe-title" value={title} onChangeText={setTitle} style={styles.input} placeholder="High-Protein Bowl" placeholderTextColor={colors.textMuted} />
            <Text style={styles.fieldLabel}>Ingredients</Text>
            <TextInput testID="recipe-ingredients" value={ingredients} onChangeText={setIngredients} style={[styles.input, { minHeight: 80 }]} multiline placeholder="200g chicken, 1 cup quinoa, ..." placeholderTextColor={colors.textMuted} />
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput testID="recipe-desc" value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 60 }]} multiline placeholder="Easy 15-min recipe…" placeholderTextColor={colors.textMuted} />
            <TouchableOpacity testID="recipe-submit" onPress={create} disabled={busy} style={styles.cta} activeOpacity={0.85}>
              <LinearGradient colors={[colors.flame, '#FF7A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
                {busy ? <ActivityIndicator color="#000" /> : (
                  <>
                    <BookPlus size={18} color="#000" />
                    <Text style={styles.ctaText}>Publish</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  label: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 3 },
  title: { fontFamily: fonts.heading700, fontSize: 26, color: colors.textPrimary, letterSpacing: -0.8, marginTop: 4 },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.flame, alignItems: 'center', justifyContent: 'center', shadowColor: colors.flame, shadowOpacity: 0.6, shadowRadius: 14 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm, flexWrap: 'wrap' },
  tagPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.08)' },
  tagText: { color: colors.flame, fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1.2 },
  recipeTitle: { fontFamily: fonts.heading600, fontSize: 18, color: colors.textPrimary },
  author: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  ingredientsTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  healthRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: spacing.sm, padding: 8, borderRadius: radius.sm, backgroundColor: 'rgba(0,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(0,255,255,0.2)' },
  healthNote: { color: colors.cyan, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderSubtle },
  smallBtnText: { color: colors.textSecondary, fontFamily: fonts.bodySemi, fontSize: 12 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surfaceElevated, padding: spacing.lg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: colors.glassBorder },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.heading700, fontSize: 22, color: colors.textPrimary },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginTop: spacing.sm, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, borderWidth: 1, borderColor: colors.borderSubtle },
  cta: { borderRadius: radius.full, overflow: 'hidden', marginTop: spacing.lg, shadowColor: colors.flame, shadowOpacity: 0.5, shadowRadius: 16 },
  ctaGrad: { paddingVertical: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.heading600, color: '#000', fontSize: 15 },
});
