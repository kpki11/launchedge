// src/components/ApprovalCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

interface ApprovalCardProps {
  id: string;
  tableName: string;
  changeType: 'create' | 'edit' | 'delete';
  requestedBy: string;
  timeAgo: string;
  preview: string;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalCard({ tableName, changeType, requestedBy, timeAgo, preview, onApprove, onReject }: ApprovalCardProps) {
  const typeColors: any = {
    create: Theme.success,
    edit: Theme.info,
    delete: Theme.danger,
  };
  const color = typeColors[changeType] || Theme.primary;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.typeText, { color }]}>{changeType.toUpperCase()}</Text>
        </View>
        <Text style={styles.tableName}>{tableName}</Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
      <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
      <Text style={styles.by}>Requested by {requestedBy}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
          <Text style={styles.approveText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  typeText: { ...Typography.labelCaps, fontSize: 9 },
  tableName: { ...Typography.headingS, color: Theme.textPrimary, flex: 1 },
  time: { ...Typography.bodyS, color: Theme.textDim },
  preview: { ...Typography.bodyM, color: Theme.textSecondary, marginBottom: Spacing.xs },
  by: { ...Typography.bodyS, color: Theme.textDim, marginBottom: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  rejectBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Theme.danger, alignItems: 'center',
  },
  rejectText: { ...Typography.label, color: Theme.danger },
  approveBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Theme.success, alignItems: 'center',
  },
  approveText: { ...Typography.label, color: '#fff' },
});
