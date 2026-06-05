// src/components/ParticleField.tsx
// Animated floating particles + geometric decorations — pure React Native Animated API
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';

const { width: SW, height: SH } = Dimensions.get('window');

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
  translateX: Animated.Value;
  duration: number;
  delay: number;
  color: string;
}

interface GeomShape {
  id: number;
  x: number;
  y: number;
  size: number;
  type: 'ring' | 'dot' | 'arc';
  opacity: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  color: string;
  delay: number;
}

interface Props {
  count?: number;
  colors?: string[];
  style?: object;
  variant?: 'dots' | 'full' | 'minimal';
  height?: number;
}

function makeParticles(count: number, colors: string[], containerH: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * SW,
    y: Math.random() * containerH,
    size: 2 + Math.random() * 4,
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(0),
    translateX: new Animated.Value(0),
    duration: 4000 + Math.random() * 5000,
    delay: Math.random() * 3000,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

function makeShapes(count: number, colors: string[], containerH: number): GeomShape[] {
  const types: GeomShape['type'][] = ['ring', 'dot', 'arc', 'ring'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * (SW - 60),
    y: Math.random() * containerH,
    size: 20 + Math.random() * 60,
    type: types[Math.floor(Math.random() * types.length)],
    opacity: new Animated.Value(0),
    rotate: new Animated.Value(0),
    scale: new Animated.Value(0.7),
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 2000,
  }));
}

export function ParticleField({ count = 18, colors, style, variant = 'full', height }: Props) {
  const containerH = height ?? SH * 0.6;
  const defaultColors = [
    `rgba(196,150,58,0.70)`,  // gold
    `rgba(196,150,58,0.50)`,
    `rgba(212,168,75,0.60)`,  // gold2
    `rgba(250,248,243,0.45)`, // ivory
    `rgba(154,110,48,0.55)`,  // bronze
  ];
  const particleColors = colors ?? defaultColors;

  const particles = useRef<Particle[]>(makeParticles(count, particleColors, containerH)).current;
  const shapes = useRef<GeomShape[]>(makeShapes(variant === 'minimal' ? 3 : 6, particleColors, containerH)).current;

  useEffect(() => {
    // Animate particles: fade in, drift up & sideways, loop
    particles.forEach(p => {
      const floatLoop = () => {
        p.opacity.setValue(0);
        p.translateY.setValue(0);
        p.translateX.setValue(0);
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 1.0, duration: p.duration * 0.2, useNativeDriver: true }),
            Animated.timing(p.translateY, { toValue: -(40 + Math.random() * 60), duration: p.duration, useNativeDriver: true }),
            Animated.timing(p.translateX, { toValue: (Math.random() - 0.5) * 30, duration: p.duration, useNativeDriver: true }),
          ]),
          Animated.timing(p.opacity, { toValue: 0, duration: p.duration * 0.3, useNativeDriver: true }),
        ]).start(() => floatLoop());
      };
      floatLoop();
    });

    // Animate shapes: breathe in/out + slow rotate
    shapes.forEach((s, i) => {
      const breathe = () => {
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0.75, duration: 1200, useNativeDriver: true }),
            Animated.timing(s.scale,   { toValue: 1,   duration: 1200, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0.15, duration: 2200, useNativeDriver: true }),
            Animated.timing(s.scale,   { toValue: 1.12, duration: 2200, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0.45, duration: 2000, useNativeDriver: true }),
            Animated.timing(s.scale,   { toValue: 0.95, duration: 2000, useNativeDriver: true }),
          ]),
        ]).start(() => breathe());
      };
      const rotateSpin = () => {
        s.rotate.setValue(0);
        Animated.timing(s.rotate, { toValue: 1, duration: 12000 + i * 3000, useNativeDriver: true }).start(() => rotateSpin());
      };
      breathe();
      rotateSpin();
    });
  }, []);

  const rotateInterp = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]} pointerEvents="none">
      {/* Dot grid pattern */}
      {variant !== 'minimal' && <DotGrid color={particleColors[0]} />}

      {/* Geometric shapes */}
      {shapes.map(s => (
        <Animated.View
          key={`shape-${s.id}`}
          style={[
            styles.shapeBase,
            {
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              borderRadius: s.type === 'dot' ? s.size / 2 : s.size / 2,
              borderWidth: s.type === 'ring' || s.type === 'arc' ? 1.5 : 0,
              borderColor: s.color,
              backgroundColor: s.type === 'dot' ? s.color : 'transparent',
              opacity: s.opacity,
              transform: [{ rotate: rotateInterp(s.rotate) }, { scale: s.scale }],
            },
          ]}
        />
      ))}

      {/* Floating particles */}
      {(variant === 'full' || variant === 'dots') && particles.map(p => (
        <Animated.View
          key={`particle-${p.id}`}
          style={[
            styles.particle,
            {
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateY: p.translateY },
                { translateX: p.translateX },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

// Grid lines + dot grid overlay
function DotGrid({ color }: { color: string }) {
  const cols = 6;
  const rows = 14;
  const dotSize = 2.5;
  const colSpacing = SW / cols;
  const rowSpacing = 72;
  const lineColor = 'rgba(196,150,58,0.10)';
  const dotColor = 'rgba(196,150,58,0.32)';

  const verticalLines = Array.from({ length: cols + 1 }, (_, i) => (
    <View
      key={`vline-${i}`}
      style={{
        position: 'absolute',
        left: i * colSpacing,
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: lineColor,
      }}
    />
  ));

  const horizontalLines = Array.from({ length: rows + 1 }, (_, i) => (
    <View
      key={`hline-${i}`}
      style={{
        position: 'absolute',
        top: i * rowSpacing,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: lineColor,
      }}
    />
  ));

  const dots = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (
      <View
        key={`dot-${r}-${c}`}
        style={{
          position: 'absolute',
          left: c * colSpacing + colSpacing / 2 - dotSize / 2,
          top: r * rowSpacing + rowSpacing / 2 - dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: dotColor,
        }}
      />
    ))
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {verticalLines}
      {horizontalLines}
      {dots}
    </View>
  );
}

// Decorative corner accent
export function CornerAccent({ position = 'topRight', color, size = 80 }: {
  position?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  color?: string;
  size?: number;
}) {
  const c = color ?? `rgba(196,150,58,0.18)`;
  const posStyle: any = {};
  if (position === 'topRight')    { posStyle.top = -size/3; posStyle.right = -size/3; }
  if (position === 'topLeft')     { posStyle.top = -size/3; posStyle.left = -size/3; }
  if (position === 'bottomRight') { posStyle.bottom = -size/3; posStyle.right = -size/3; }
  if (position === 'bottomLeft')  { posStyle.bottom = -size/3; posStyle.left = -size/3; }

  return (
    <View style={[{ position: 'absolute', ...posStyle }, { pointerEvents: 'none' } as any]}>
      <View style={{ width: size, height: size, borderRadius: size/2, borderWidth: 1.5, borderColor: c }} />
      <View style={{
        position: 'absolute',
        top: size*0.15, left: size*0.15,
        width: size*0.7, height: size*0.7,
        borderRadius: size*0.35,
        borderWidth: 1,
        borderColor: c,
      }} />
    </View>
  );
}

// Glowing orb
export function GlowOrb({ x, y, size = 120, color }: {
  x: number | string; y: number | string; size?: number; color?: string;
}) {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.6, duration: 2500, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.2, duration: 2500, useNativeDriver: true }),
      ]).start(() => pulse());
    };
    pulse();
  }, []);

  const c = color ?? `rgba(196,150,58,0.18)`;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x as number,
        top: y as number,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c,
        opacity: fadeAnim,
      }}
    />
  );
}

const styles = StyleSheet.create({
  shapeBase: {
    position: 'absolute',
  },
  particle: {
    position: 'absolute',
  },
});


