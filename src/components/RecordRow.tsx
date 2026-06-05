// src/components/RecordRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

const STATUS_COLORS: any = {
  Confirmed:        { bg: 'rgba(74,140,126,0.12)',  text: Colors.success },
  Pending:          { bg: 'rgba(212,168,75,0.15)',   text: Colors.gold },
  Processing:       { bg: 'rgba(74,122,199,0.12)',  text: Colors.info },
  Cancelled:        { bg: 'rgba(196,80,74,0.12)',   text: Colors.danger },
  Draft:            { bg: 'rgba(160,152,128,0.12)', text: Colors.dim },
  pending_approval: { bg: 'rgba(212,168,75,0.15)',  text: Colors.gold },
  active:           { bg: 'rgba(74,140,126,0.12)',  text: Colors.success },
};

interface RecordRowProps {
  id: string;
  primaryLabel: string;
  secondaryLabel?: string;
  amount?: string;
  status?: string;
  date?: string;
  onPress: () => void;
}

export function RecordRow({ id, primaryLabel, secondaryLabel, amount, status, date, onPress }: RecordRowProps) {
  const sc = STATUS_COLORS[status || ''] || { bg: Theme.primaryLight, text: Theme.primary };
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.id}>{id.substring(0, 8)}</Text>
        <Text style={styles.primary}>{primaryLabel}</Text>
        {secondaryLabel ? <Text style={styles.secondary}>{secondaryLabel}</Text> : null}
      </View>
      <View style={styles.right}>
        {amount ? <Text style={styles.amount}>{amount}</Text> : null}
        {date ? <Text style={styles.date}>{date}</Text> : null}
        {status ? (
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{status}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
    backgroundColor: Theme.background,
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  id: { ...Typography.mono, color: Theme.textDim, marginBottom: 2 },
  primary: { ...Typography.bodyM, color: Theme.textPrimary, fontFamily: 'DMSans_500Medium' },
  secondary: { ...Typography.bodyS, color: Theme.textSecondary },
  amount: { ...Typography.headingS, color: Theme.textPrimary },
  date: { ...Typography.bodyS, color: Theme.textSecondary },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { ...Typography.labelCaps, fontSize: 9 },
});
