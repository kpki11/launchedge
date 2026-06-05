// src/screens/OnboardingScreen.tsx
// v3.2 - Fix: removed loadBusiness() call in handleFinish (was briefly nulling
//        activeBusiness mid-flight, causing AppNavigator to flash wrong stack).
//        setBusiness(bizData) is sufficient — activeBusiness is already in store.
//        Fix: goBack() on step 1 uses canGoBack() guard instead of bare goBack().
import React, { useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import { insertBusiness, createTable } from '../services/database';
import { TABLE_TEMPLATES } from '../utils/templates';
import { ParticleField, GlowOrb, CornerAccent } from '../components/ParticleField';

const uuidv4 = () =>
  'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const BUSINESS_TYPES = [
  { id: 'manufacturing', label: 'Manufacturing', icon: 'cog-outline' as const },
  { id: 'trading',       label: 'Trading',       icon: 'swap-horizontal-outline' as const },
  { id: 'services',      label: 'Services',       icon: 'briefcase-outline' as const },
  { id: 'distribution',  label: 'Distribution',  icon: 'car-outline' as const },
  { id: 'export',        label: 'Export',         icon: 'airplane-outline' as const },
  { id: 'other',         label: 'Other',          icon: 'ellipsis-horizontal-circle-outline' as const },
];

const FEATURED_TEMPLATES = [
  'sales_orders', 'expense_tracker', 'inventory_stock', 'staff_directory',
  'customer_crm', 'purchase_orders', 'production_batch', 'quality_control',
];

export default function OnboardingScreen({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [bizName, setBizName] = useState('');
  const [bizType, setBizType] = useState('');
  const [storageMode, setStorageMode] = useState<'local' | 'googleDrive'>('local');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { setBusiness, setOnboarded } = useBusinessStore();
  const { loadTables } = useTableStore();

  const TOTAL_STEPS = 5;
  const progress = step / TOTAL_STEPS;

  const stepFade  = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;

  const animateStepChange = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(stepFade,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(stepSlide, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      stepSlide.setValue(30);
      Animated.parallel([
        Animated.timing(stepFade,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(stepSlide, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = () => {
    Haptics.selectionAsync();
    if (step === 1 && !bizName.trim()) {
      Alert.alert('Required', 'Please enter your business name.');
      return;
    }
    if (step === 2 && !bizType) {
      Alert.alert('Required', 'Please select your business type.');
      return;
    }
    if (step < TOTAL_STEPS) animateStepChange(step + 1);
  };

  const goBack = () => {
    if (step > 1) {
      animateStepChange(step - 1);
    } else {
      // Step 1 is the root — nothing behind it. Use canGoBack() to be safe.
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Landing');
      }
    }
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplates(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      const bizId = uuidv4();
      const joinCode = generateJoinCode();
      const bizData = {
        id: bizId,
        name: bizName.trim(),
        type: bizType,
        storageMode,
        googleEmail: '',
        joinCode,
        isOwner: 1,
      };

      // 1. Save to DB
      await insertBusiness(bizData);

      // 2. Create selected template tables
      for (const tplId of selectedTemplates) {
        const tpl = TABLE_TEMPLATES.find(t => t.id === tplId);
        if (tpl) {
          await createTable({
            id: uuidv4(),
            businessId: bizId,
            name: tpl.name,
            icon: tpl.icon,
            category: tpl.category,
            description: tpl.description,
            fields: tpl.fields,
          });
        }
      }

      // 3. Load tables into store
      await loadTables(bizId);

      // 4. Put business into store synchronously
      setBusiness(bizData);

      // 5. Mark onboarded — AppNavigator reads activeBusiness (set above) and
      //    isOnboarded together; both are now truthy so it swaps to the onboarded stack.
      //    DO NOT call loadBusiness() here — it async-queries DB and briefly sets
      //    activeBusiness = null mid-flight, causing HomeScreen to show the blank
      //    landing view instead of the dashboard.
      //    DO NOT call navigation.navigate() after this line — the stack is being
      //    torn down by AppNavigator; any navigate call will silently fail or hang.
      setOnboarded(true);

    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
      console.error(e);
      setLoading(false);
      // Note: setLoading(false) is intentionally only in catch.
      // On success the component unmounts (stack swap) so calling setLoading
      // on an unmounted component would cause a React state-update warning.
    }
  };

  const featuredTemplates = TABLE_TEMPLATES.filter(t => FEATURED_TEMPLATES.includes(t.id));

  return (
    <SafeAreaView style={styles.root}>
      {/* Background decorations */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ParticleField count={8} variant="full" height={900} />
        <GlowOrb x="60%" y={-30} size={160} color="rgba(196,150,58,0.08)" />
        <GlowOrb x={-40} y="70%" size={120} color="rgba(196,150,58,0.08)" />
        <CornerAccent position="topRight" size={80} color="rgba(196,150,58,0.10)" />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i < step ? styles.stepDotDone : i === step - 1 ? styles.stepDotActive : styles.stepDotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Header row */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Animated step content */}
      <Animated.View style={[styles.stepWrapper, { opacity: stepFade, transform: [{ translateX: stepSlide }] }]}>

        {/* STEP 1 */}
        {step === 1 && (
          <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
            <View style={styles.stepAccentRow}>
              <View style={styles.stepAccentLine} />
              <View style={styles.stepAccentDot} />
            </View>
            <Text style={styles.stepTitle}>What's your business name?</Text>
            <Text style={styles.stepSub}>This is how LaunchEdge Labs will greet you every morning.</Text>
            <TextInput
              style={styles.textInput}
              value={bizName}
              onChangeText={setBizName}
              placeholder="e.g. Sharma Traders, Patel Fabrics"
              placeholderTextColor={Theme.textDim}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={goNext}
            />
            <View style={styles.step1Shapes}>
              <View style={styles.step1Ring1} />
              <View style={styles.step1Ring2} />
            </View>
          </ScrollView>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <View style={styles.stepAccentRow}>
              <View style={styles.stepAccentLine} />
              <View style={styles.stepAccentDot} />
            </View>
            <Text style={styles.stepTitle}>What type of business?</Text>
            <Text style={styles.stepSub}>We'll pre-configure the best tables for you.</Text>
            <View style={styles.typeGrid}>
              {BUSINESS_TYPES.map(bt => (
                <TouchableOpacity
                  key={bt.id}
                  style={[styles.typeTile, bizType === bt.id && styles.typeTileActive]}
                  onPress={() => setBizType(bt.id)}
                >
                  {bizType === bt.id && <View style={styles.tileActiveDot} />}
                  <Ionicons name={bt.icon} size={28} color={bizType === bt.id ? Colors.ivory : Theme.primary} />
                  <Text style={[styles.typeLabel, bizType === bt.id && styles.typeLabelActive]}>{bt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <View style={styles.stepAccentRow}>
              <View style={styles.stepAccentLine} />
              <View style={styles.stepAccentDot} />
            </View>
            <Text style={styles.stepTitle}>Where should we store your data?</Text>
            <Text style={styles.stepSub}>Your data stays on your device - we never upload it to our servers.</Text>

            <TouchableOpacity
              style={[styles.storageOption, storageMode === 'local' && styles.storageOptionActive]}
              onPress={() => setStorageMode('local')}
            >
              <Ionicons name="phone-portrait-outline" size={28} color={storageMode === 'local' ? Colors.ivory : Theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.storageTitle, storageMode === 'local' && styles.storageTitleActive]}>Local Only</Text>
                <Text style={[styles.storageSub, storageMode === 'local' && { color: 'rgba(250,248,243,0.80)' }]}>
                  Stored privately on this phone. No cloud. Works fully offline.
                </Text>
              </View>
              {storageMode === 'local' && <Ionicons name="checkmark-circle" size={20} color={Colors.ivory} />}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.storageOption, { marginTop: Spacing.sm, opacity: 0.45 }]} disabled>
              <Ionicons name="cloud-outline" size={28} color={Theme.primary} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.storageTitle}>Google Drive Backup</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Coming Soon</Text>
                  </View>
                </View>
                <Text style={styles.storageSub}>Local + periodic backup to your personal Google account.</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color={Colors.gold} />
              <Text style={styles.privacyNoteText}>We never access, store, or sell your data. It's 100% yours.</Text>
            </View>
          </ScrollView>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <View style={styles.stepAccentRow}>
              <View style={styles.stepAccentLine} />
              <View style={styles.stepAccentDot} />
            </View>
            <Text style={styles.stepTitle}>Pick your starter tables</Text>
            <Text style={styles.stepSub}>Select any you need - or skip and build from scratch later.</Text>
            <View style={styles.templateGrid}>
              {featuredTemplates.map(tpl => {
                const isSelected = selectedTemplates.includes(tpl.id);
                return (
                  <TouchableOpacity
                    key={tpl.id}
                    style={[styles.templateCard, isSelected && styles.templateCardActive]}
                    onPress={() => toggleTemplate(tpl.id)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <View style={styles.templateCheckBadge}>
                        <Ionicons name="checkmark" size={10} color={Colors.ivory} />
                      </View>
                    )}
                    <View style={[styles.templateIconWrap, isSelected && { backgroundColor: 'rgba(250,248,243,0.20)' }]}>
                      <Ionicons name={(tpl.icon as any) || 'grid-outline'} size={20} color={isSelected ? Colors.ivory : Theme.primary} />
                    </View>
                    <Text style={[styles.templateName, isSelected && styles.templateNameActive]} numberOfLines={2}>{tpl.name}</Text>
                    <Text style={[styles.templateCat, isSelected && { color: 'rgba(250,248,243,0.70)' }]}>{tpl.category}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedTemplates.length > 0 && (
              <Text style={styles.selectionCount}>
                {selectedTemplates.length} table{selectedTemplates.length !== 1 ? 's' : ''} selected
              </Text>
            )}
            <TouchableOpacity style={styles.skipLink} onPress={() => animateStepChange(5)}>
              <Text style={styles.skipLinkText}>Skip - I'll build my own tables</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="rocket-outline" size={48} color={Colors.gold} />
            </View>
            <Text style={styles.stepTitle}>You're all set, {bizName.trim() || 'there'}!</Text>
            <Text style={styles.stepSub}>Here's what we'll create for you:</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Ionicons name="business-outline" size={18} color={Theme.primary} />
                <Text style={styles.summaryLabel}>Business</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{bizName.trim()}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Ionicons name="briefcase-outline" size={18} color={Theme.primary} />
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>{BUSINESS_TYPES.find(b => b.id === bizType)?.label ?? bizType}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Ionicons name="server-outline" size={18} color={Theme.primary} />
                <Text style={styles.summaryLabel}>Storage</Text>
                <Text style={styles.summaryValue}>{storageMode === 'local' ? 'Local only' : 'Google Drive backup'}</Text>
              </View>
              {selectedTemplates.length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Ionicons name="albums-outline" size={18} color={Theme.primary} />
                    <Text style={styles.summaryLabel}>Tables</Text>
                    <Text style={styles.summaryValue}>{selectedTemplates.length} pre-built</Text>
                  </View>
                </>
              )}
            </View>
            <View style={styles.taglineWrap}>
              <Text style={styles.tagline}>Set up in 5 minutes, run for years.</Text>
            </View>
          </ScrollView>
        )}

      </Animated.View>

      {/* Bottom CTA */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.bottomBar}>
          {step < TOTAL_STEPS ? (
            <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.ivory} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, loading && { opacity: 0.65 }]}
              onPress={handleFinish}
              disabled={loading}
            >
              {loading
                ? <Text style={styles.nextBtnText}>Setting up...</Text>
                : <>
                    <Text style={styles.nextBtnText}>Launch LaunchEdge</Text>
                    <Ionicons name="rocket-outline" size={18} color={Colors.ivory} />
                  </>
              }
            </TouchableOpacity>
          )}
          <Text style={styles.legalText}>
            By continuing you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },

  progressBarContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, gap: Spacing.xs },
  progressBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(196,150,58,0.20)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 2 },
  stepDots: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  stepDot: { width: 6, height: 6, borderRadius: 3 },
  stepDotDone: { backgroundColor: Colors.gold },
  stepDotActive: { backgroundColor: Colors.gold, width: 18, borderRadius: 3 },
  stepDotInactive: { backgroundColor: 'rgba(196,150,58,0.25)' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { padding: Spacing.xs },
  stepLabel: { ...Typography.label, color: Theme.textSecondary },

  stepWrapper: { flex: 1 },
  stepContent: { padding: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 100 },

  stepAccentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  stepAccentLine: { width: 28, height: 2, backgroundColor: Colors.gold, borderRadius: 1 },
  stepAccentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },

  stepTitle: { ...Typography.displayL, color: Theme.textPrimary, marginBottom: Spacing.sm, lineHeight: 36 },
  stepSub: { ...Typography.bodyM, color: Theme.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },

  textInput: {
    borderWidth: 1.5, borderColor: Theme.border, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    ...Typography.headingM, color: Theme.textPrimary, backgroundColor: Theme.surface,
  },
  step1Shapes: { position: 'relative', height: 120, marginTop: Spacing.xl },
  step1Ring1: { position: 'absolute', right: -20, bottom: -20, width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: 'rgba(196,150,58,0.15)' },
  step1Ring2: { position: 'absolute', right: 20, bottom: 20, width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: 'rgba(196,150,58,0.10)' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeTile: { width: '31%', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, backgroundColor: Theme.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Theme.border, alignItems: 'center', gap: Spacing.xs, position: 'relative', overflow: 'hidden' },
  typeTileActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  tileActiveDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(250,248,243,0.60)' },
  typeLabel: { ...Typography.bodyS, color: Theme.textSecondary, textAlign: 'center', fontSize: 11 },
  typeLabelActive: { color: Colors.ivory },

  storageOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1.5, borderColor: Theme.border },
  storageOptionActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  storageTitle: { ...Typography.headingS, color: Theme.textPrimary },
  storageTitleActive: { color: Colors.ivory },
  storageSub: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 2, lineHeight: 18 },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.lg, backgroundColor: 'rgba(196,150,58,0.08)', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(196,150,58,0.18)' },
  privacyNoteText: { ...Typography.bodyS, color: Theme.textSecondary, flex: 1, lineHeight: 18 },

  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  templateCard: { width: '47%', backgroundColor: Theme.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Theme.border, padding: Spacing.md, gap: Spacing.xs, position: 'relative', overflow: 'hidden' },
  templateCardActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  templateCheckBadge: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(250,248,243,0.30)', justifyContent: 'center', alignItems: 'center' },
  templateIconWrap: { width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: 'rgba(196,150,58,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  templateName: { ...Typography.bodyS, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium', lineHeight: 17 },
  templateNameActive: { color: Colors.ivory },
  templateCat: { ...Typography.bodyS, color: Theme.textDim, fontSize: 10 },
  selectionCount: { ...Typography.label, color: Theme.primary, textAlign: 'center', marginTop: Spacing.md },
  skipLink: { alignItems: 'center', marginTop: Spacing.lg },
  skipLinkText: { ...Typography.bodyM, color: Theme.textDim, textDecorationLine: 'underline' },

  confirmIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(196,150,58,0.12)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: Spacing.md },
  summaryCard: { backgroundColor: Theme.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Theme.border, padding: Spacing.lg, marginTop: Spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  summaryLabel: { ...Typography.label, color: Theme.textSecondary, width: 70 },
  summaryValue: { ...Typography.bodyM, color: Theme.textPrimary, flex: 1, fontFamily: 'DMSans_500Medium' },
  summaryDivider: { height: 1, backgroundColor: Theme.border },
  taglineWrap: { marginTop: Spacing.xl, alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, backgroundColor: 'rgba(196,150,58,0.08)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(196,150,58,0.18)' },
  tagline: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 18, color: Colors.gold, textAlign: 'center', fontStyle: 'italic' },

  bottomBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingBottom: Spacing.lg, borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.background },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Theme.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md },
  nextBtnText: { ...Typography.headingS, color: Colors.ivory },
  legalText: { ...Typography.bodyS, color: Theme.textDim, textAlign: 'center', marginTop: Spacing.md, paddingHorizontal: Spacing.xl },
  legalLink: { color: Theme.primary, textDecorationLine: 'underline' },
  comingSoonBadge: { backgroundColor: 'rgba(196,150,58,0.18)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  comingSoonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10, color: '#C4963A', letterSpacing: 0.4 },
});
