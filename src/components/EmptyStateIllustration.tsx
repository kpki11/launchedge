// src/components/EmptyStateIllustration.tsx
// Small gold flame illustration for empty states — pure RN, no SVG lib needed
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

interface Props {
  title?: string;
  subtitle?: string;
  variant?: 'flame' | 'check' | 'link';
}

export function EmptyStateIllustration({ title, subtitle, variant = 'flame' }: Props) {
  const pulse = useRef(new Animated.Value(0.92)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 1,    duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 0.92, duration: 1400, useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 0,    duration: 1400, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] });

  return (
    <View style={s.container}>
      {/* Outer glow ring */}
      <Animated.View style={[s.glowRing, { opacity: glowOpacity }]} />

      {/* Flame icon container */}
      <Animated.View style={[s.iconWrap, { transform: [{ scale: pulse }] }]}>
        {variant === 'flame' && <FlameShape />}
        {variant === 'check' && <CheckShape />}
        {variant === 'link'  && <LinkShape />}
      </Animated.View>

      {title    && <Text style={s.title}>{title}</Text>}
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}

// ── Flame: three layered tear-drop shapes ─────────────────────────────────────
function FlameShape() {
  return (
    <View style={s.flame}>
      {/* Outer amber layer */}
      <View style={[s.flamePetal, { width: 36, height: 52, borderRadius: 18, backgroundColor: 'rgba(196,150,58,0.22)', bottom: 0 }]} />
      {/* Mid gold layer */}
      <View style={[s.flamePetal, { width: 26, height: 40, borderRadius: 13, backgroundColor: 'rgba(196,150,58,0.55)', bottom: 2 }]} />
      {/* Inner ivory core */}
      <View style={[s.flamePetal, { width: 14, height: 24, borderRadius: 7, backgroundColor: Colors.ivory, bottom: 6, opacity: 0.9 }]} />
    </View>
  );
}

// ── Check: for "all caught up" states ─────────────────────────────────────────
function CheckShape() {
  return (
    <View style={s.checkCircle}>
      {/* Checkmark via two rotated bars */}
      <View style={[s.checkBar, { width: 10, height: 3, transform: [{ rotate: '45deg' }, { translateX: -3 }, { translateY: 2 }] }]} />
      <View style={[s.checkBar, { width: 18, height: 3, transform: [{ rotate: '-50deg' }, { translateX: 3 }, { translateY: -2 }] }]} />
    </View>
  );
}

// ── Link: for "no links" states ───────────────────────────────────────────────
function LinkShape() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={s.linkPill} />
      <View style={[s.linkLine, { width: 12, height: 3, backgroundColor: 'rgba(196,150,58,0.40)', borderRadius: 2 }]} />
      <View style={s.linkPill} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  glowRing: {
    position: 'absolute',
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: Theme.primary,
    top: Spacing.xl - 10,
  },
  iconWrap: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: Theme.surface,
    borderWidth: 1.5,
    borderColor: Theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  title:    { fontFamily: 'DMSans_600SemiBold', fontSize: 17, color: Theme.textPrimary, textAlign: 'center' },
  subtitle: { fontFamily: 'DMSans_400Regular',  fontSize: 13, color: Theme.textSecondary, textAlign: 'center', lineHeight: 19, maxWidth: 240 },

  // Flame
  flame:      { width: 40, height: 56, alignItems: 'center', justifyContent: 'flex-end' },
  flamePetal: { position: 'absolute', alignSelf: 'center', borderTopLeftRadius: 999, borderTopRightRadius: 999 },

  // Check
  checkCircle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  checkBar:    { position: 'absolute', backgroundColor: Theme.primary, borderRadius: 2 },

  // Link
  linkPill: { width: 22, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: Theme.primary, backgroundColor: 'transparent' },
  linkLine: {},
});