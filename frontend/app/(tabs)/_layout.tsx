import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Home, Utensils, ScanLine, Sparkles, Users, TrendingUp } from 'lucide-react-native';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontFamily: 'Outfit_600SemiBold', letterSpacing: 1, marginTop: -2 },
        tabBarStyle: {
          position: 'absolute',
          left: 12, right: 12, bottom: Platform.OS === 'ios' ? 24 : 14,
          height: 70,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderRadius: 28,
          overflow: 'hidden',
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,15,0.7)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }]} />
          </View>
        ),
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'CORE', tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="meal-plan" options={{ title: 'FUEL', tabBarIcon: ({ color }) => <Utensils size={22} color={color} /> }} />
      <Tabs.Screen name="scan" options={{ title: 'SCAN', tabBarIcon: ({ color }) => <ScanLine size={22} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: 'AI', tabBarIcon: ({ color }) => <Sparkles size={22} color={color} /> }} />
      <Tabs.Screen name="feed" options={{ title: 'FEED', tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'PROGRESS', tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} /> }} />
    </Tabs>
  );
}
