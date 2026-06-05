﻿// src/screens/AnalyticsWizardScreen.tsx
// Task 6 — 3-step Analytics Wizard
// Entry: navigation.navigate('AnalyticsWizard', { tableId, tableName })
// Calls saveAnalyticsConfig() from database.ts — no duplicated save logic.

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { getTableFields, saveAnalyticsConfig } from '../services/database';
import { ParticleField, GlowOrb } from '../components/ParticleField';

// ── Types ─────────────────────────────────────────────────────────────────────
type AnalyticsRole = 'revenue' | 'expense' | 'inventory' | 'people' | 'none';
type WizardStep = 1 | 2 | 3 | 'confirm';

interface RoleOption {
  value: AnalyticsRole;
  icon: string;
  label: string;
  desc: string;
}

const ROLES: RoleOption[] = [
  { value: 'revenue',   icon: 'cash-outline', label: 'Money coming IN',  desc: 'Sales, income, invoices, receipts' },
  { value: 'expense',   icon: 'trending-down-outline', label: 'Money going OUT',  desc: 'Expenses, purchases, wages, costs' },
  { value: 'inventory', icon: 'cube-outline', label: 'Stock / Inventory', desc: 'Products, raw material, goods' },
  { value: 'people',    icon: 'people-outline', label: 'People',            desc: 'Staff, customers, vendors' },
  { value: 'none',      icon: 'skip-forward-outline', label: 'Not sure / Skip',  desc: 'Set up later from Admin Builder' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function amountQuestion(role: AnalyticsRole): string {
  switch (role) {
    case 'revenue':   return 'Which column has the sale amount? (the ₹ value for each entry)';
    case 'expense':   return 'Which column has the cost or expense amount?';
    case 'inventory': return 'Which column has the stock quantity? (how many units you have)';
    default:          return 'Which column has the main number?';
  }
}

function confirmMessage(
  role: AnalyticsRole, tableName: string,
  amountField: string, dateField: string
): string {
  const dateDesc = dateField ? `filtered by "${dateField}"` : 'all-time total (no date filter)';
  switch (role) {
    case 'revenue':
      return dateField
        ? `✅ Done! LaunchEdge will now show Today's Sales on your Home dashboard and a revenue chart in Insights, filtered by "${dateField}".`
        : `✅ Done! LaunchEdge will show your all-time Sales total on the Home dashboard. Add a date column to your table later to enable daily/weekly filtering.`;
    case 'expense':
      return dateField
        ? `✅ Done! Today's Expenses will appear on your Home dashboard, filtered by "${dateField}".`
        : `✅ Done! Total Expenses will appear on your Home dashboard.`;
    case 'inventory':
      return `✅ Done! LaunchEdge will track stock levels and alert you when items fall below the reorder level.`;
    case 'people':
      return `✅ Done! LaunchEdge will count your ${tableName} and show the total on your dashboard.`;
    default:
      return `✅ Skipped. You can configure analytics later from Admin Builder → select "${tableName}" → Analytics tab.`;
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyticsWizardScreen({ navigation, route }: any) {
  const { tableId, tableName } = route?.params ?? {};

  const [step, setStep] = useState<WizardStep>(1);
  // Fix 14: step transition animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const prevStepRef = useRef<WizardStep>(1);

  const animateStep = (newStep: WizardStep) => {
    const isForward = (newStep as number) > (prevStepRef.current as number);
    slideAnim.setValue(isForward ? screenWidth : -screenWidth);
    prevStepRef.current = newStep;
    setStep(newStep);
    Animated.timing(slideAnim, {
      toValue: 0, duration: 260, useNativeDriver: true,
    }).start();
  };
  const [role, setRole] = useState<AnalyticsRole>('revenue');
  const [fields, setFields] = useState<any[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [amountField, setAmountField] = useState('');
  const [dateField, setDateField] = useState('');
  const [saving, setSaving] = useState(false);

  // Load fields when screen mounts
  useEffect(() => {
    if (!tableId) return;
    setLoadingFields(true);
    getTableFields(tableId)
      .then((f: any[]) => {
        setFields(f);
        // Smart defaults
        const firstNumber = f.find((fld: any) => fld.type === 'number' || fld.type === 'currency');
        if (firstNumber) setAmountField(firstNumber.name);
        const firstDate = f.find((fld: any) => fld.type === 'date');
        if (firstDate) setDateField(firstDate.name);
      })
      .catch((e: any) => console.error('AnalyticsWizard getTableFields:', e))
      .finally(() => setLoadingFields(false));
  }, [tableId]);

  // ── Save & advance to confirm ─────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true);
    try {
      await saveAnalyticsConfig(tableId, {
        analyticsRole: role,
        primaryAmountField: role !== 'people' && role !== 'none' ? amountField : '',
        primaryDateField: role !== 'people' && role !== 'none' ? dateField : '',
        primaryLabelField: '',
        secondaryGroupField: '',
        reorderField: '',
        targetAmount: 0,
      });
      animateStep('confirm');
    } catch (e: any) {
      Alert.alert('Error', `Could not save: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Step navigation ───────────────────────────────────────────────────────
  const nextFromStep1 = () => {
    if (role === 'none') { handleFinish(); return; }
    if (role === 'people') { animateStep(3); return; }  // skip amount step
    animateStep(2);
  };

  const nextFromStep2 = () => {
    if (!amountField) { Alert.alert('Please select a field', 'Pick the column that holds the main number.'); return; }
    animateStep(3);
  };

  const backFromStep2 = () => setStep(1);
  const backFromStep3 = () => { if (role === 'people') setStep(1); else animateStep(2); };

  // ── Total steps label ─────────────────────────────────────────────────────
  const totalSteps = role === 'people' || role === 'none' ? 2 : 3;
  const stepLabel = step === 1 ? 'Step 1' : step === 2 ? 'Step 2' : `Step ${totalSteps}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Background particles */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <ParticleField variant="full" count={14} height={1400} />
        <GlowOrb x={-30} y={30} size={160} color="rgba(196,150,58,0.09)" />
        <GlowOrb x="65%" y={80} size={120} color="rgba(196,150,58,0.08)" />
      </View>
      {/* Header */}
      <View style={styles.header}>
        {step !== 'confirm' && (
          <TouchableOpacity
            onPress={step === 1 ? () => navigation.goBack() : step === 2 ? backFromStep2 : backFromStep3}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Analytics Setup</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{tableName ?? 'Table'}</Text>
        </View>
        {step !== 'confirm' && (
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>{stepLabel} of {totalSteps}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>

        {/* ── STEP 1: Role ───────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <Text style={styles.questionText}>What does this table track?</Text>
            <Text style={styles.questionSub}>
              This tells LaunchEdge how to count numbers and build your dashboard.
            </Text>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleCard, role === r.value && styles.roleCardActive]}
                onPress={() => setRole(r.value)}
                activeOpacity={0.75}
              >
                <Ionicons name={r.icon as any} size={24} color={Theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleLabel, role === r.value && { color: Theme.primary }]}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </View>
                {role === r.value && <Ionicons name="checkmark-circle" size={20} color={Theme.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.nextBtn} onPress={nextFromStep1}>
              <Text style={styles.nextBtnText}>Continue →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 2: Amount field ───────────────────────────────────────── */}
        {step === 2 && (
          <>
            <Text style={styles.questionText}>{amountQuestion(role)}</Text>
            <Text style={styles.questionSub}>
              Pick the column that holds the ₹ value or quantity for each row.
            </Text>
            {loadingFields
              ? <ActivityIndicator color={Theme.primary} style={{ margin: Spacing.xl }} />
              : fields.length === 0
                ? (
                  <View style={styles.noFieldsBox}>
                    <Ionicons name="warning-outline" size={28} color={Colors.gold} />
                    <Text style={styles.noFieldsText}>
                      No fields found. Go to Admin Builder → Fields tab and add a Number or Currency field first.
                    </Text>
                  </View>
                )
                : (
                  <View style={styles.fieldGrid}>
                    {fields.map((f: any) => (
                      <TouchableOpacity
                        key={f.id}
                        style={[styles.fieldChip, amountField === f.name && styles.fieldChipActive]}
                        onPress={() => setAmountField(f.name)}
                      >
                        <Text style={[styles.fieldChipText, amountField === f.name && styles.fieldChipTextActive]}>
                          {f.name}
                        </Text>
                        {(f.type === 'number' || f.type === 'currency') && (
                          <Text style={styles.fieldTypeTag}> ({f.type})</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )
            }
            <TouchableOpacity style={styles.nextBtn} onPress={nextFromStep2} disabled={loadingFields}>
              <Text style={styles.nextBtnText}>Continue →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 3: Date field ─────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <Text style={styles.questionText}>Which column has the date of each entry?</Text>
            <Text style={styles.questionSub}>
              This lets LaunchEdge filter by Today / This Week / This Month in Insights.
            </Text>
            {loadingFields
              ? <ActivityIndicator color={Theme.primary} style={{ margin: Spacing.xl }} />
              : (
                <View style={styles.fieldGrid}>
                  {fields.map((f: any) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.fieldChip, dateField === f.name && styles.fieldChipActive]}
                      onPress={() => setDateField(f.name)}
                    >
                      <Text style={[styles.fieldChipText, dateField === f.name && styles.fieldChipTextActive]}>
                        {f.name}
                      </Text>
                      {f.type === 'date' && <Text style={styles.fieldTypeTag}> (date)</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )
            }

            {/* "No date" separator option */}
            <View style={styles.noDateSeparator} />
            <TouchableOpacity
              style={[styles.noDateOption, dateField === '' && styles.noDateOptionActive]}
              onPress={() => setDateField('')}
            >
              <Ionicons
                name={dateField === '' ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={dateField === '' ? Theme.primary : Theme.textDim}
              />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={[styles.noDateLabel, dateField === '' && { color: Theme.primary }]}>
                  No date column — show all-time total
                </Text>
                <Text style={styles.noDateSub}>
                  Home dashboard will show total across all time instead of today's.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, saving && { opacity: 0.6 }]}
              onPress={handleFinish}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={Colors.ivory} size="small" />
                : <Text style={styles.nextBtnText}>Finish Setup ✓</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* ── CONFIRM ───────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              {confirmMessage(role, tableName ?? 'this table', amountField, dateField)}
            </Text>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Insights' })}
            >
              <Text style={styles.nextBtnText}>Go to Insights →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryBtnText}>Back to Table</Text>
            </TouchableOpacity>
          </View>
        )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Theme.border,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { ...Typography.headingM, color: Theme.textPrimary },
  headerSub: { ...Typography.bodyS, color: Theme.textSecondary },
  stepPill: {
    backgroundColor: 'rgba(196,150,58,0.12)', borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(196,150,58,0.25)',
  },
  stepPillText: { ...Typography.label, color: Colors.gold, fontSize: 11 },

  body: { padding: Spacing.lg, paddingBottom: 60 },

  questionText: { ...Typography.headingL, color: Theme.textPrimary, marginBottom: Spacing.sm },
  questionSub:  { ...Typography.bodyM, color: Theme.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },

  // Role cards
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Theme.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Theme.border,
  },
  roleCardActive: { borderColor: Theme.primary, backgroundColor: 'rgba(196,150,58,0.08)' },
  roleEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  roleLabel: { ...Typography.headingS, color: Theme.textPrimary, marginBottom: 2 },
  roleDesc:  { ...Typography.bodyS, color: Theme.textSecondary },

  // Field chips
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  fieldChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: Theme.border, backgroundColor: Theme.surface,
  },
  fieldChipActive: { borderColor: Theme.primary, backgroundColor: 'rgba(196,150,58,0.10)' },
  fieldChipText: { ...Typography.label, color: Theme.textSecondary },
  fieldChipTextActive: { color: Theme.primary },
  fieldTypeTag: { ...Typography.bodyS, color: Theme.textDim, fontSize: 10 },

  noFieldsBox: {
    alignItems: 'center', gap: Spacing.md,
    backgroundColor: 'rgba(196,150,58,0.08)', borderRadius: Radius.lg,
    padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(196,150,58,0.20)',
    marginBottom: Spacing.xl,
  },
  noFieldsText: { ...Typography.bodyM, color: Theme.textSecondary, textAlign: 'center', lineHeight: 22 },

  // "No date" option
  noDateSeparator: { height: 1, backgroundColor: Theme.border, marginVertical: Spacing.lg },
  noDateOption: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: Spacing.lg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Theme.border, backgroundColor: Theme.surface,
    marginBottom: Spacing.xl,
  },
  noDateOptionActive: { borderColor: Theme.primary, backgroundColor: 'rgba(196,150,58,0.08)' },
  noDateLabel: { ...Typography.headingS, color: Theme.textSecondary, marginBottom: 2 },
  noDateSub:   { ...Typography.bodyS, color: Theme.textDim, lineHeight: 18 },

  // Buttons
  nextBtn: {
    backgroundColor: Theme.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  nextBtnText: { ...Typography.label, color: Colors.ivory, fontSize: 15 },

  secondaryBtn: {
    borderWidth: 1, borderColor: Theme.border, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  secondaryBtnText: { ...Typography.label, color: Theme.textSecondary },

  // Confirm
  confirmBox: {
    backgroundColor: Theme.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Theme.border,
    marginTop: Spacing.lg,
  },
  confirmText: { ...Typography.bodyL, color: Theme.textPrimary, lineHeight: 26, marginBottom: Spacing.xl },
});




