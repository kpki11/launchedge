// src/components/TableCard.tsx
// v1.2: flex-1 grid fix, no emojis, full text visibility
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { formatRelativeTime } from '../utils/formatters';

const KNOWN_CATEGORIES = ['Finance', 'Sales', 'Inventory', 'People', 'Operations', 'Logistics', 'Compliance', 'Custom'];

interface TableCardProps {
  name: string;
  icon: string;
  recordCount: number;
  updatedAt: string;
  category: string;
  colorTag?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

export function TableCard({ name, icon, recordCount, updatedAt, category, onPress, onLongPress }: TableCardProps) {
  const safeCategory = KNOWN_CATEGORIES.includes(category) ? category : 'Custom';

  // Always use Ionicons â€” map common icon names, default to grid-outline
  // Map 'grid' (bare DB default) to valid Ionicons name 'grid-outline'
  const rawIcon = (icon && /^[a-z]/.test(icon)) ? icon : 'grid-outline';
  const iconName = (rawIcon === 'grid') ? 'grid-outline' : rawIcon;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.75} delayLongPress={500}>
      <View style={styles.iconWrap}>
        <Ionicons name={(iconName as any)} size={22} color={Theme.primary} />
      </View>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      <Text style={styles.count}>{recordCount} Records</Text>
      <Text style={styles.updated}>Updated {formatRelativeTime(updatedAt)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Theme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    margin: Spacing.xs,
    borderWidth: 1,
    borderColor: Theme.border,
    minHeight: 140,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(196,150,58,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  name: { ...Typography.headingS, color: Theme.textPrimary, marginBottom: 4 },
  count: { ...Typography.bodyS, color: Theme.textSecondary, marginBottom: 2 },
  updated: { ...Typography.bodyS, color: Theme.textDim },
});
