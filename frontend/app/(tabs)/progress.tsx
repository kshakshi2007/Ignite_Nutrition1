import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Trash2, Utensils, BookOpen } from 'lucide-react-native';
import { GlassCard } from '../../src/GlassCard';
import { ParticleField } from '../../src/ParticleField';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { api } from '../../src/api';

export default function Progress() {
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r: any = await api.listProgress(); setItems(r || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const remove = async (id: string) => {
    try { await api.deleteProgress(id); setItems((arr) => arr.filter((x) => x.id !== id)); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  const grouped = items.reduce<Record<string, any[]>>((acc, it) => {
    const k = it.date || 'unknown';
    (acc[k] = acc[k] || []).push(it);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort().reverse();

  return (
    <View style={styles.root}>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.flame} />}>
        <Text style={styles.label}>PROGRESS</Text>
        <Text style={styles.title}>Your Timeline</Text>
        <Text style={styles.sub}>Last 50 logged meals & recipes</Text>

        {items.length === 0 ? (
          <GlassCard><Text style={styles.empty}>No entries yet. Log a meal from your plan or a recipe.</Text></GlassCard>
        ) : (
          dates.map((d) => (
            <View key={d} style={{ marginBottom: spacing.md }}>
              <Text style={styles.dateHeader}>{formatDate(d)}</Text>
              {grouped[d].map((it) => (
                <View key={it.id} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: it.type === 'meal' ? colors.flame : colors.cyan, shadowColor: it.type === 'meal' ? colors.flame : colors.cyan }]} />
                  <View style={styles.cardLine}>
                    <View style={styles.iconWrap}>
                      {it.type === 'meal' ? <Utensils size={16} color={colors.flame} /> : <BookOpen size={16} color={colors.cyan} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{it.title}</Text>
                      <Text style={styles.itemMeta}>
                        {it.type === 'meal' ? `Meal · ${it.mealType || ''}` : 'Recipe'} · {new Date(it.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <TouchableOpacity testID={`del-${it.id}`} onPress={() => remove(it.id)} style={styles.delBtn}>
                      <Trash2 size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function formatDate(iso: string) {
  if (iso === 'unknown') return 'Earlier';
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.floor((today.getTime() - d.getTime()) / dayMs);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'YESTERDAY';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: 70 },
  label: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 3 },
  title: { fontFamily: fonts.heading700, fontSize: 32, color: colors.textPrimary, letterSpacing: -1, marginTop: 4 },
  sub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginBottom: spacing.lg },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  dateHeader: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.flame, letterSpacing: 2, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 4, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, shadowOpacity: 0.7, shadowRadius: 6 },
  cardLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.borderSubtle },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  itemTitle: { fontFamily: fonts.bodySemi, color: colors.textPrimary, fontSize: 14 },
  itemMeta: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  delBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
