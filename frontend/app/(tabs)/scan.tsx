import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Sparkles, X, ImageIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../src/GlassCard';
import { ParticleField } from '../../src/ParticleField';
import { Screen } from '../../src/Screen';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { api } from '../../src/api';

export default function ScanFood() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to scan an image');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    setImage(`data:image/jpeg;base64,${r.assets[0].base64}`);
  };

  const captureImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access to scan a packed food label');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.7, allowsEditing: true });
    if (r.canceled || !r.assets?.[0]) return;
    setImage(`data:image/jpeg;base64,${r.assets[0].base64}`);
  };

  const analyze = async () => {
    if (!image && !text.trim()) return Alert.alert('Add an image or type ingredients');
    setBusy(true); setResult(null);
    try {
      const r = await api.scan({ image_base64: image || undefined, ingredients_text: text.trim() || undefined });
      setResult(r);
    } catch (e: any) { Alert.alert('Scan failed', e.message); }
    finally { setBusy(false); }
  };

  const verdictColor = (v?: string) => ({ good: colors.good, limit: colors.limit, avoid: colors.avoid } as any)[v || ''] || colors.textMuted;

  return (
    <Screen>
      <ParticleField />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>SCANNER</Text>
        <Text style={styles.title}>Decode Your Food</Text>
        <Text style={styles.sub}>Upload a label image or paste the ingredients list.</Text>

        <GlassCard>
          {image ? (
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: image }} style={styles.preview} />
              <TouchableOpacity testID="clear-image" onPress={() => setImage(null)} style={styles.clearBtn}>
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureRow}>
              <TouchableOpacity testID="capture-image" onPress={captureImage} style={[styles.captureBtn, { borderColor: colors.flame, backgroundColor: 'rgba(255,59,48,0.06)' }]}>
                <Camera size={26} color={colors.flame} />
                <Text style={[styles.uploadText, { color: colors.flame }]}>Scan with Camera</Text>
                <Text style={styles.captureHint}>Point at packed food label</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="pick-image" onPress={pickImage} style={[styles.captureBtn, { borderColor: 'rgba(0,255,255,0.4)', backgroundColor: 'rgba(0,255,255,0.04)' }]}>
                <ImageIcon size={26} color={colors.cyan} />
                <Text style={styles.uploadText}>Upload from Gallery</Text>
                <Text style={styles.captureHint}>Pick existing photo</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>OR</Text><View style={styles.divider} /></View>
          <View style={styles.inputBox}>
            <FileText size={16} color={colors.textSecondary} />
            <TextInput
              testID="scan-text"
              value={text} onChangeText={setText}
              placeholder="Type ingredients separated by commas"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
          </View>
          <TouchableOpacity testID="scan-analyze" onPress={analyze} disabled={busy} style={styles.cta} activeOpacity={0.85}>
            <LinearGradient colors={[colors.cyan, '#0099FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              {busy ? <ActivityIndicator color="#000" /> : (
                <>
                  <Sparkles size={18} color="#000" />
                  <Text style={styles.ctaText}>Analyze</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>

        {result && (
          <GlassCard style={{ marginTop: spacing.lg }}>
            <View style={[styles.verdictPill, { borderColor: verdictColor(result.verdict), shadowColor: verdictColor(result.verdict) }]}>
              <Text style={[styles.verdictText, { color: verdictColor(result.verdict) }]}>
                {(result.verdict || 'unknown').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.summary}>{result.summary}</Text>
            <View style={styles.ingredients}>
              {(result.ingredients || []).map((ing: any, i: number) => (
                <View key={i} style={[styles.ingRow, { borderLeftColor: verdictColor(ing.category) }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ingName}>{ing.name}</Text>
                    {ing.note ? <Text style={styles.ingNote}>{ing.note}</Text> : null}
                  </View>
                  <Text style={[styles.ingCat, { color: verdictColor(ing.category) }]}>{(ing.category || '').toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
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
  uploadBtn: { paddingVertical: 28, alignItems: 'center', gap: 8, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(0,255,255,0.4)', borderStyle: 'dashed', backgroundColor: 'rgba(0,255,255,0.04)' },
  uploadText: { color: colors.cyan, fontFamily: fonts.bodySemi },
  preview: { width: '100%', height: 200, borderRadius: radius.md, resizeMode: 'cover' },
  clearBtn: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bodySemi, letterSpacing: 2 },
  inputBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.borderSubtle, minHeight: 80 },
  input: { flex: 1, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, minHeight: 60 },
  cta: { borderRadius: radius.full, overflow: 'hidden', marginTop: spacing.md, shadowColor: colors.cyan, shadowOpacity: 0.5, shadowRadius: 16 },
  ctaGrad: { paddingVertical: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.heading600, color: '#000', fontSize: 15 },
  verdictPill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5, shadowOpacity: 0.7, shadowRadius: 12, marginBottom: spacing.sm },
  verdictText: { fontFamily: fonts.heading700, fontSize: 12, letterSpacing: 2 },
  summary: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginBottom: spacing.md },
  ingredients: { gap: 8 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, borderLeftWidth: 3, borderColor: colors.borderSubtle, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1 },
  ingName: { color: colors.textPrimary, fontFamily: fonts.bodySemi, fontSize: 14 },
  ingNote: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  ingCat: { fontFamily: fonts.heading600, fontSize: 10, letterSpacing: 1.5 },
});
