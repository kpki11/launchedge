// src/screens/LandingScreen.tsx
// v3.0 — UI enhancement: particles, glowing orbs, geometric shapes, dot grid
import React, { useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, ImageBackground, ScrollView,
  TouchableOpacity, StatusBar, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { GoldButton } from '../components/GoldButton';
import { ParticleField, GlowOrb, CornerAccent } from '../components/ParticleField';

const { width: SW } = Dimensions.get('window');

const TRUST_BADGES = [
  { icon: 'gift-outline' as const,              label: 'Free ERP' },
  { icon: 'lock-closed-outline' as const,        label: 'Privacy First' },
  { icon: 'phone-portrait-outline' as const,     label: 'Works Offline' },
  { icon: 'cloud-upload-outline' as const,       label: 'Your Google Drive' },
  { icon: 'shield-checkmark-outline' as const,   label: 'No Our Servers' },
  { icon: 'globe-outline' as const,              label: 'Made in India' },
];

const FEATURES = [
  {
    icon: 'grid-outline' as const,
    title: 'Smart Tables',
    desc: 'Customers, orders, inventory — structured exactly the way you think.',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Live Insights',
    desc: 'Sales trends, low stock alerts, overdue receivables — at a glance.',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    title: 'Approval Flows',
    desc: 'Nothing enters your records without your explicit approval.',
  },
];

export default function LandingScreen({ navigation }: any) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroParallax = scrollY.interpolate({
    inputRange: [0, 300], outputRange: [0, -80], extrapolate: 'clamp',
  });

  const featAnims = useRef(
    FEATURES.map(() => ({ opacity: new Animated.Value(0), translateY: new Animated.Value(30) }))
  ).current;

  // Decorative line pulse
  const linePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    FEATURES.forEach((_, i) => {
      Animated.parallel([
        Animated.timing(featAnims[i].opacity,    { toValue: 1, duration: 380, delay: 300 + i * 100, useNativeDriver: true }),
        Animated.timing(featAnims[i].translateY, { toValue: 0, duration: 380, delay: 300 + i * 100, useNativeDriver: true }),
      ]).start();
    });

    const pulseLine = () => {
      Animated.sequence([
        Animated.timing(linePulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(linePulse, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]).start(() => pulseLine());
    };
    pulseLine();
  }, []);
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Hero */}
      <Animated.View style={[styles.heroWrap, { transform: [{ translateY: heroParallax }] }]}>
        <ImageBackground
          source={require('../../assets/images/hero_warm_network.jpeg')}
          style={styles.hero}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />
          <SafeAreaView style={styles.heroSafe} edges={['top']}>
            <View style={styles.logoRow}>
              <Image source={require('../../assets/logo.png')} style={{ width: 36, height: 36, resizeMode: 'contain' }} />
              <Text style={styles.wordmark}>LaunchEdge Labs</Text>
            </View>
            <Text style={styles.headline}>
              {'Your business.\nYour data.\nYour rules.'}
            </Text>
            <Text style={styles.subCopy}>
              The privacy-first operations app built for Indian MSME owners.
              Your data lives in your Google Drive — never on our servers.
            </Text>
            <View style={styles.ctaStack}>
              <GoldButton
                label="Start Free — No Credit Card"
                onPress={() => navigation.navigate('Onboarding')}
                size="lg"
                style={styles.primaryBtn}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Onboarding')}>
                <Text style={styles.secondaryBtnText}>See how it works ?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.joinTeamBtn}
                onPress={() => navigation.navigate('JoinBusiness')}
                activeOpacity={0.75}
              >
                <Text style={styles.joinTeamBtnText}>Already have a team? Join with code</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ImageBackground>
      </Animated.View>

      {/* Body below hero */}
      <Animated.ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Body section with subtle decorations */}
        <View style={styles.bodyDecorContainer}>
          {/* Large faint background circles */}
          <View style={styles.bgCircle1} />
          <View style={styles.bgCircle2} />
          <View style={styles.bgCircle3} />

          {/* Trust badges */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContent}
            style={styles.badgesRow}
          >
            {TRUST_BADGES.map(b => (
              <View key={b.label} style={styles.badge}>
                <Ionicons name={b.icon} size={13} color={Theme.primary} />
                <Text style={styles.badgeLabel}>{b.label}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Section divider line */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.sectionHeading}>
            {"Everything you need,\nnothing you don't"}
          </Text>

          {/* Feature cards */}
          <View style={styles.featureList}>
            {FEATURES.map((f, i) => (
              <Animated.View
                key={f.title}
                style={[
                  styles.featureCard,
                  { opacity: featAnims[i].opacity, transform: [{ translateY: featAnims[i].translateY }] },
                ]}
              >
                {/* Card corner accent */}
                <CornerAccent position="topRight" size={40} color="rgba(196,150,58,0.15)" />

                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={22} color={Theme.primary} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          {/* Section divider */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </View>

          {/* Bottom CTA */}
          <View style={styles.bottomSection}>
            {/* CTA card decorations */}
            <View style={styles.ctaRing1} />
            <View style={styles.ctaRing2} />

            <Text style={styles.bottomHeading}>{"Set up in 5 minutes.\nRun for years."}</Text>
            <Text style={styles.bottomSub}>No subscription. No data charges. No lock-in.</Text>
            <GoldButton
              label="Start for Free"
              onPress={() => navigation.navigate('Onboarding')}
              size="lg"
              style={styles.bottomBtn}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },

  // Hero
  heroWrap: { zIndex: 1 },
  hero: { height: 540 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,11,9,0.54)' },
  heroSafe: { flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center' },

  // Diagonal accent lines in hero
  diagLine1: {
    position: 'absolute',
    width: SW * 1.5,
    height: 1,
    backgroundColor: Colors.gold,
    top: '35%',
    left: -SW * 0.25,
    transform: [{ rotate: '-18deg' }],
  },
  diagLine2: {
    position: 'absolute',
    width: SW * 1.5,
    height: 1,
    backgroundColor: Colors.gold,
    top: '65%',
    left: -SW * 0.1,
    transform: [{ rotate: '-18deg' }],
  },

  // Hero decorative rings (top-right corner)
  heroRingOuter: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: 'rgba(196,150,58,0.25)',
  },
  heroRingInner: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(196,150,58,0.18)',
  },

  // Logo
  logoRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.xxxl,
  },
  wordmark: { ...Typography.headingM, color: Colors.ivory, letterSpacing: 0.6 },

  // Headline
  headline: {
    ...Typography.displayXL,
    color: Colors.ivory,
    lineHeight: 52,
    marginBottom: Spacing.lg,
  },
  subCopy: {
    ...Typography.bodyL,
    color: 'rgba(250,248,243,0.82)',
    lineHeight: 26,
    marginBottom: Spacing.xxl,
  },

  // Free badge pill
  freeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(196,150,58,0.20)', borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(196,150,58,0.38)',
    alignSelf: 'flex-start', marginBottom: Spacing.lg,
  },
  freeBadgeText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: Colors.gold, letterSpacing: 0.3 },
  // CTAs
  ctaStack: { gap: Spacing.md },
  primaryBtn: { borderRadius: Radius.md },
  secondaryBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  secondaryBtnText: { ...Typography.bodyM, color: 'rgba(250,248,243,0.72)', letterSpacing: 0.3 },
  joinTeamBtn: { marginTop: 8, alignItems: 'center', paddingVertical: 10 },
  joinTeamBtnText: { fontSize: 13, color: 'rgba(250,248,243,0.70)', fontFamily: 'DMSans_400Regular', textDecorationLine: 'underline' },

  // Body
  body: { flex: 1 },
  bodyDecorContainer: { position: 'relative', overflow: 'hidden', backgroundColor: '#FAF8F3' },

  // Background circles (faint, decorative)
  bgCircle1: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(196,150,58,0.08)',
    top: 60,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(196,150,58,0.08)',
    top: 200,
    left: -50,
  },
  bgCircle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(196,150,58,0.08)',
    top: 520,
    right: 30,
  },

  // Trust badges
  badgesRow: { paddingVertical: Spacing.lg },
  badgesContent: {
    paddingHorizontal: Spacing.lg, gap: Spacing.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Theme.surface, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Theme.border,
  },
  badgeLabel: { ...Typography.label, color: Theme.textPrimary },

  // Divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(196,150,58,0.15)' },
  dividerDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.gold,
    opacity: 0.5,
  },

  // Features
  sectionHeading: {
    ...Typography.displayM,
    color: Theme.textPrimary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    marginVertical: Spacing.xl,
  },
  featureList: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  featureCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg,
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    padding: Spacing.xl, borderWidth: 1, borderColor: Theme.border,
    overflow: 'hidden',
    position: 'relative',
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Theme.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: { ...Typography.headingS, color: Theme.textPrimary, marginBottom: Spacing.xs },
  featureDesc:  { ...Typography.bodyM, color: Theme.textSecondary, lineHeight: 22 },

  // Bottom CTA
  bottomSection: {
    margin: Spacing.xl, backgroundColor: Theme.surface,
    borderRadius: Radius.xl, padding: Spacing.xxl,
    alignItems: 'center', borderWidth: 1, borderColor: Theme.border,
    overflow: 'hidden',
    position: 'relative',
  },
  ctaRing1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: 'rgba(196,150,58,0.12)',
    top: -60,
    right: -60,
  },
  ctaRing2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(196,150,58,0.10)',
    bottom: -30,
    left: -30,
  },
  bottomHeading: {
    ...Typography.displayL, color: Theme.textPrimary,
    textAlign: 'center', marginBottom: Spacing.md,
  },
  bottomSub: {
    ...Typography.bodyM, color: Theme.textSecondary,
    textAlign: 'center', marginBottom: Spacing.xl,
  },
  bottomBtn: { width: '100%', borderRadius: Radius.md },
});


