/**
 * Reusable Screen wrapper that handles SafeArea (notch / status bar)
 * and applies the dark futuristic background. Children render inside
 * a flex container.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';

export function Screen({ children, style, edges = { top: true, bottom: false } }:
  { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; edges?: { top?: boolean; bottom?: boolean } }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: edges.top ? insets.top : 0, paddingBottom: edges.bottom ? insets.bottom : 0 }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
