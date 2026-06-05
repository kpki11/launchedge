// src/components/Header.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Theme } from '../theme/colors';
import { Typography, Spacing } from '../theme/typography';
import { SyncBadge } from './SyncBadge';

interface HeaderProps {
  title: string;
  subtitle?: string;
  // Legacy props (kept for backwards compat)
  showBack?: boolean;
  showSync?: boolean;
  rightIcon?: string;
  onRightPress?: () => void;
  // New unified props (used by most screens)
  onBack?: () => void;
  rightAction?: { icon: string; onPress: () => void };
}

export function Header({
  title,
  subtitle,
  showBack = false,
  showSync = false,
  rightIcon,
  onRightPress,
  onBack,
  rightAction,
}: HeaderProps) {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) onBack();
    else navigation.goBack();
  };

  const showBackBtn = showBack || !!onBack;
  const rightIconName = rightAction?.icon || rightIcon;
  const rightPressHandler = rightAction?.onPress || onRightPress;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBackBtn && (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Theme.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        {showSync && <SyncBadge />}
        {rightIconName && (
          <TouchableOpacity onPress={rightPressHandler} style={styles.iconBtn}>
            <Ionicons name={rightIconName as any} size={22} color={Theme.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Theme.background,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  backBtn: { padding: 4 },
  iconBtn: { padding: 4 },
  titleBlock: { flex: 1 },
  title: { ...Typography.headingM, color: Theme.textPrimary },
  subtitle: { ...Typography.bodyS, color: Theme.textSecondary, marginTop: 1 },
});
