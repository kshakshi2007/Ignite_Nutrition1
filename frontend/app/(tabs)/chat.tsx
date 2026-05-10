import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Send, Sparkles } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { ParticleField } from '../../src/ParticleField';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';

export default function Chat() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef(`u-${user?.uid || 'anon'}-${Math.random().toString(36).slice(2, 8)}`).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setMsgs([{ role: 'assistant', content: `Hey **${user?.name?.split(' ')[0] || 'there'}** — I'm your nutrition coach. Ask me anything about your meals, macros, or health goals.` }]);
  }, [user]);

  const send = async () => {
    if (!text.trim()) return;
    const q = text.trim();
    setText('');
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r: any = await api.chatSend(session, q);
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'assistant', content: `_Error: ${e.message}_` }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={styles.root}>
      <ParticleField />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={20}>
        <View style={styles.header}>
          <View style={styles.iconRing}><Sparkles size={20} color={colors.cyan} /></View>
          <View>
            <Text style={styles.title}>AI Coach</Text>
            <Text style={styles.sub}>Powered by Mercury-2</Text>
          </View>
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.msgs} keyboardShouldPersistTaps="handled">
          {msgs.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {m.role === 'assistant' ? (
                <Markdown style={mdStyles}>{m.content}</Markdown>
              ) : (
                <Text style={[styles.bubbleText, m.role === 'user' && { color: '#000' }]}>{m.content}</Text>
              )}
            </View>
          ))}
          {busy && <View style={[styles.bubble, styles.aiBubble]}><Text style={{ color: colors.cyan, fontFamily: fonts.body, fontStyle: 'italic' }}>Coach is thinking…</Text></View>}
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            value={text} onChangeText={setText}
            placeholder="Ask anything…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            onSubmitEditing={send}
          />
          <TouchableOpacity testID="chat-send" onPress={send} disabled={busy} style={[styles.sendBtn, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#000" /> : <Send size={20} color="#000" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const mdStyles = {
  body: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 } as any,
  strong: { color: colors.flame, fontFamily: fonts.bodyBold } as any,
  bullet_list: { color: colors.textPrimary } as any,
  list_item: { color: colors.textPrimary } as any,
  code_inline: { backgroundColor: 'rgba(0,255,255,0.1)', color: colors.cyan, fontFamily: 'monospace', paddingHorizontal: 4, borderRadius: 4 } as any,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  iconRing: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cyan, backgroundColor: 'rgba(0,255,255,0.08)', shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 12 },
  title: { fontFamily: fonts.heading700, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  msgs: { padding: spacing.lg, gap: 10, paddingBottom: 120 },
  bubble: { padding: 14, borderRadius: 18, maxWidth: '92%' },
  userBubble: { backgroundColor: colors.flame, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(0,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,255,0.3)', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  inputBar: { position: 'absolute', bottom: 100, left: 12, right: 12, padding: 8, flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: 'rgba(10,10,15,0.85)' },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 10 },
});
