import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from './theme';

const { width, height } = Dimensions.get('window');

function Particle({ delay, left, color, size }: { delay: number; left: number; color: string; size: number }) {
  const y = useRef(new Animated.Value(height + 50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = () => {
      y.setValue(height + 50);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(y, { toValue: -100, duration: 9000 + Math.random() * 5000, delay, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.7, duration: 1200, delay, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1500, delay: 6000, useNativeDriver: true }),
        ]),
      ]).start(() => loop());
    };
    loop();
  }, [delay, y, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          shadowColor: color,
          transform: [{ translateY: y }],
        },
      ]}
    />
  );
}

export function ParticleField() {
  const particles = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      arr.push({
        id: i,
        delay: i * 600,
        left: Math.random() * width,
        size: 3 + Math.random() * 5,
        color: i % 3 === 0 ? colors.cyan : i % 3 === 1 ? colors.flame : colors.purple,
      });
    }
    return arr;
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#000', '#0a0014', '#0a0a14', '#000']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glow, { top: -150, left: -100, backgroundColor: 'rgba(176,38,255,0.18)' }]} />
      <View style={[styles.glow, { bottom: -200, right: -150, backgroundColor: 'rgba(255,59,48,0.22)' }]} />
      <View style={[styles.glow, { top: '40%', right: -80, backgroundColor: 'rgba(0,255,255,0.10)' }]} />
      {particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  glow: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
  },
});
