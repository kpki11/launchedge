// src/components/KPICard.tsx
// v2.2  —  Removed flex:1 from wrapper (causes uneven tile heights). Each tile is self-contained.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

interface KPICardProps {
  icon: string;
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  subNote?: string;
  onRemove?: () => void;
}

export function KPICard({ icon, label, value, change, changeLabel, actionLabel, onAction, subNote, onRemove }: KPICardProps) {
  const isPositive = (change ?? 0) >= 0;
  const isSetupState = !!onAction;

  const inner = (
    <View style={[styles.card, isSetupState && styles.cardSetup]}>
      <View style={styles.row}>
        <Ionicons name={icon as any} size={18} color={isSetupState ? Colors.gold : Theme.primary} />
        <Text style={[styles.label, isSetupState && styles.labelSetup]} numberOfLines={2}>{label}</Text>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
            <Ionicons name="close-circle" size={16} color={Theme.danger} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.value, isSetupState && styles.valueDim]}>{value}</Text>
      {subNote !== undefined && !isSetupState && (
        <Text style={styles.subNote} numberOfLines={1}>{subNote}</Text>
      )}
      {change !== undefined && !isSetupState && (
        <View style={styles.changeRow}>
          <Ionicons
            name={isPositive ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={isPositive ? Theme.success : Theme.danger}
          />
          <Text style={[styles.changeText, { color: isPositive ? Theme.success : Theme.danger }]}>
            {Math.abs(change)}% {changeLabel}
          </Text>
        </View>
      )}
      {isSetupState && (
        <View style={styles.setupHint}>
          <Ionicons name="sparkles-outline" size={11} color={Colors.gold} />
          <Text style={styles.setupHintText}>Tap to configure</Text>
        </View>
      )}
    </View>
  );

  if (onAction) {
    return (
      <TouchableOpacity style={styles.wrapper} onPress={onAction} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.wrapper}>{inner}</View>;
}

const styles = StyleSheet.create({
  // No flex:1  —  width is controlled by the parent kpiTileWrap
  wrapper: { alignSelf: 'stretch' },
  card: {
    height: 108, justifyContent: 'space-between',
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  cardSetup: {
    borderColor: 'rgba(196,150,58,0.35)',
    backgroundColor: 'rgba(196,150,58,0.08)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  label:      { ...Typography.label, color: Theme.textSecondary, flex: 1 },
  labelSetup: { color: Colors.gold },
  value:    { ...Typography.headingL, color: Theme.textPrimary, marginBottom: 4 },
  valueDim: { ...Typography.headingL, color: Theme.textDim, marginBottom: 4 },
  subNote: { ...Typography.bodyS, color: Theme.textDim, marginBottom: 2 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  changeText: { ...Typography.bodyS },
  setupHint: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: Spacing.xs },
  setupHintText: { ...Typography.bodyS, color: Colors.gold, fontSize: 10 },
  removeBtn: { padding: 2 },
});


